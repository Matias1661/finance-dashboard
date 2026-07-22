"""
Reemplazo del flujo de Relay para Nominas.

A diferencia de Peerberry/MyInvestor (que leian un email), este flujo cambio
de diseno: Matias sube el PDF de la nomina a mano a la carpeta Drive "Nominas"
desde el telefono, sin control sobre el nombre del archivo. Este script:

1. Lista los PDFs de esa carpeta.
2. Descarta los que ya estan en processed_nominas.json (registro por Drive
   file ID, no por nombre de archivo -- los nombres son arbitrarios).
3. Para cada archivo nuevo, le pide a Claude que extraiga Empresa, Fecha de
   pago y Total usando el prompt "Extraer datos de nomina" de la DB Notion
   "Prompts para Relay" (se lee en vivo, mismo patron que process_bank_statements.py).
4. Antes de crear la pagina, chequea si ya existe una fila en Notion con esa
   misma Fecha de pago (defensa extra contra subidas duplicadas del mismo PDF
   con distinto file ID -- ya paso una vez en la carpeta, ver DECISIONS.md).
5. Crea la pagina en la DB Nominas con el link a Drive en "Archivo".

Variables de entorno requeridas (todas ya existen como secrets):
  NOTION_TOKEN
  ANTHROPIC_API_KEY
  GOOGLE_SERVICE_ACCOUNT

Ver docs/DECISIONS.md 2026-07-22 (paso 4 del plan de migracion de Relay) y
docs/PROJECT_MEMORY.md, seccion "MIGRACION EN CURSO: Relay -> GitHub Actions".
"""

import os, json, base64, re
import requests

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT"]

NOTION_VERSION = "2025-09-03"
NOMINAS_DS_ID = "19833ce5-0e68-8121-8f95-000bddffaaea"
PROMPTS_RELAY_DS_ID = "39833ce5-0e68-804a-b091-000bef7a0796"
DRIVE_FOLDER_ID = "1pt9WGS3nzR8t1NIS5egrL0OMm2QGUKGj"  # "Nominas"
STATE_FILE = "processed_nominas.json"

CLAUDE_MODEL = "claude-sonnet-5"

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}


def get_drive_access_token():
    """Autentica con la cuenta de servicio de Google y devuelve un access token
    con scope de solo lectura sobre Drive."""
    from google.oauth2 import service_account
    import google.auth.transport.requests

    info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.readonly"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def list_new_files(drive_token, already_processed):
    """Lista archivos en la carpeta de Drive que todavia no fueron procesados."""
    url = "https://www.googleapis.com/drive/v3/files"
    params = {
        "q": f"'{DRIVE_FOLDER_ID}' in parents and trashed = false",
        "fields": "files(id,name,mimeType,createdTime)",
        "orderBy": "createdTime",
        "pageSize": 200,
    }
    headers = {"Authorization": f"Bearer {drive_token}"}
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    if not resp.ok:
        print(f"  Error de la API de Drive ({resp.status_code}): {resp.text}")
    resp.raise_for_status()
    files = resp.json().get("files", [])
    return [f for f in files if f["id"] not in already_processed]


def download_file(drive_token, file_id):
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
    headers = {"Authorization": f"Bearer {drive_token}"}
    resp = requests.get(url, headers=headers, params={"alt": "media"}, timeout=60)
    resp.raise_for_status()
    return resp.content


def fetch_extraccion_prompt():
    """Lee en vivo el texto de extraccion desde la DB Notion 'Prompts para
    Relay'. Si no lo encuentra, falla fuerte (mejor frenar que inventar
    reglas de extraccion)."""
    url = f"https://api.notion.com/v1/data_sources/{PROMPTS_RELAY_DS_ID}/query"
    payload = {
        "filter": {
            "property": "Nombre",
            "title": {"equals": "Extraer datos de nomina"}
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        raise RuntimeError(
            "No se encontro el prompt 'Extraer datos de nomina' en la DB "
            "Notion 'Prompts para Relay'.")
    texto_prop = results[0]["properties"]["Texto"]
    return "".join(t["plain_text"] for t in texto_prop.get("rich_text", []))


def extraer_datos_nomina(pdf_bytes, extraccion_prompt):
    """Manda el PDF a Claude y pide Empresa, Fecha de pago y Total. El PDF
    puede tener texto seleccionable o ser un escaneo/imagen; Claude hace OCR
    nativo via el bloque 'document' en ambos casos."""
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 1024,
            "system": extraccion_prompt,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "document", "source": {
                        "type": "base64", "media_type": "application/pdf", "data": pdf_b64
                    }},
                    {"type": "text", "text": "Extrae los datos de esta nomina."}
                ]
            }]
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    text = "".join(b["text"] for b in data["content"] if b["type"] == "text")
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def ya_existe_en_notion(fecha_pago):
    """Control de duplicados: una nomina por Fecha de pago. Defensa extra
    contra el mismo PDF subido dos veces a Drive con distinto file ID (ya
    paso una vez en esta carpeta, ver DECISIONS.md 2026-07-22)."""
    url = f"https://api.notion.com/v1/data_sources/{NOMINAS_DS_ID}/query"
    payload = {
        "filter": {"property": "Fecha de pago", "date": {"equals": fecha_pago}}
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_nomina_notion(empresa, fecha_pago, total, drive_file_id):
    url = "https://api.notion.com/v1/pages"
    archivo_url = f"https://drive.google.com/file/d/{drive_file_id}/view"
    payload = {
        "parent": {"data_source_id": NOMINAS_DS_ID},
        "properties": {
            "Empresa": {"title": [{"text": {"content": empresa}}]},
            "Fecha de pago": {"date": {"start": fecha_pago}},
            "Total": {"number": total},
            "Archivo": {"url": archivo_url},
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"processed_file_ids": []}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    state = load_state()
    processed_ids = set(state["processed_file_ids"])

    print("Autenticando con Google Drive (cuenta de servicio)...")
    drive_token = get_drive_access_token()

    print("Buscando nominas nuevas en Drive...")
    new_files = list_new_files(drive_token, processed_ids)
    print(f"  {len(new_files)} archivo(s) nuevo(s)")

    if not new_files:
        print("Nada que procesar.")
    else:
        extraccion_prompt = fetch_extraccion_prompt()

        for f in new_files:
            print(f"Procesando {f['name']} ({f['id']})...")
            pdf_bytes = download_file(drive_token, f["id"])
            datos = extraer_datos_nomina(pdf_bytes, extraccion_prompt)
            empresa = datos["empresa"]
            fecha_pago = datos["fecha_pago"]
            total = float(datos["total"])
            print(f"  Empresa={empresa} Fecha de pago={fecha_pago} Total={total}")

            if ya_existe_en_notion(fecha_pago):
                print(f"  Ya existe una nomina con Fecha de pago={fecha_pago}, se omite.")
            else:
                crear_nomina_notion(empresa, fecha_pago, total, f["id"])
                print("  Creada en Notion.")

            processed_ids.add(f["id"])

        state["processed_file_ids"] = sorted(processed_ids)
        save_state(state)
        print("processed_nominas.json actualizado.")
