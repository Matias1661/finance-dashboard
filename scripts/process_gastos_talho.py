"""
Reemplazo del flujo de Relay "Gastos de Talho Argentino de Drive en Notion"
(paso 4.5 del plan de migracion Relay -> GitHub Actions).

Matias (o Willy) sube una foto o PDF del comprobante a la carpeta Drive
"Gastos Talho Argentino". Este script:

1. Lista los archivos de esa carpeta.
2. Descarta los que ya estan en processed_gastos_talho.json (registro por
   Drive file ID, mismo patron que process_nominas.py).
3. Para cada archivo nuevo, le pide a Claude que extraiga Concepto, Costo y
   Fecha usando el prompt "Extraer gastos Talho Argentino" de la DB Notion
   "Prompts" (se lee en vivo).
4. Antes de crear la pagina, chequea si ya existe una fila en Notion con la
   misma Fecha y el mismo Costo (defensa extra contra el mismo comprobante
   subido dos veces con distinto file ID).
5. Crea la pagina en la DB "Gastos del local", dejando "Pagado por" vacio
   -- igual que el flujo original de Relay. Willy o Matias lo completan a
   mano en Notion; esa edicion ya queda reflejada en sociedad_data.json por
   el cron diario de sync-sociedad-data.yml, sin necesidad de un trigger
   instantaneo (ver docs/DECISIONS.md, entrada de esta implementacion).

Variables de entorno requeridas (todas ya existen como secrets):
  NOTION_TOKEN
  ANTHROPIC_API_KEY
  GOOGLE_SERVICE_ACCOUNT

Prerequisito manual: la carpeta Drive "Gastos Talho Argentino" tiene que
estar compartida (Viewer alcanza) con el email de la cuenta de servicio de
GOOGLE_SERVICE_ACCOUNT, igual que la carpeta "Nominas".

Ver docs/DECISIONS.md (entrada de esta implementacion) y
docs/PROJECT_MEMORY.md, seccion "MIGRACION EN CURSO: Relay -> GitHub Actions".
"""

import os, json, base64, re
import requests

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT"]

NOTION_VERSION = "2025-09-03"
GASTOS_LOCAL_DS_ID = "38933ce5-0e68-80ba-9e03-000b001f2431"
PROMPTS_DS_ID = "39833ce5-0e68-804a-b091-000bef7a0796"
DRIVE_FOLDER_ID = "1rlmEnN35OFcVmpWHylY9G3-qsK14-s0s"  # "Gastos Talho Argentino"
STATE_FILE = "processed_gastos_talho.json"

CLAUDE_MODEL = "claude-sonnet-5"

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

# Mismos tipos de archivo que puede subir un celular: foto o PDF del ticket.
IMAGE_MIME_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/heic": "image/jpeg",  # Drive suele reencodear HEIC al bajarlo via alt=media
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
    """Lee en vivo el texto de extraccion desde la DB Notion 'Prompts'. Si no
    lo encuentra, falla fuerte (mejor frenar que inventar reglas de extraccion)."""
    url = f"https://api.notion.com/v1/data_sources/{PROMPTS_DS_ID}/query"
    payload = {
        "filter": {
            "property": "Nombre",
            "title": {"equals": "Extraer gastos Talho Argentino"}
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        raise RuntimeError(
            "No se encontro el prompt 'Extraer gastos Talho Argentino' en la "
            "DB Notion 'Prompts'.")
    texto_prop = results[0]["properties"]["Texto"]
    return "".join(t["plain_text"] for t in texto_prop.get("rich_text", []))


def extraer_datos_gasto(file_bytes, mime_type, extraccion_prompt):
    """Manda el comprobante a Claude y pide Concepto, Costo y Fecha. Puede ser
    una imagen (foto de un ticket) o un PDF."""
    file_b64 = base64.b64encode(file_bytes).decode("utf-8")

    if mime_type == "application/pdf":
        content_block = {"type": "document", "source": {
            "type": "base64", "media_type": "application/pdf", "data": file_b64
        }}
    else:
        media_type = IMAGE_MIME_TYPES.get(mime_type, "image/jpeg")
        content_block = {"type": "image", "source": {
            "type": "base64", "media_type": media_type, "data": file_b64
        }}

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
                    content_block,
                    {"type": "text", "text": "Extrae los datos de este comprobante."}
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


def ya_existe_en_notion(fecha, costo):
    """Control de duplicados: mismo Fecha + Costo. Defensa extra contra el
    mismo comprobante subido dos veces a Drive con distinto file ID."""
    url = f"https://api.notion.com/v1/data_sources/{GASTOS_LOCAL_DS_ID}/query"
    payload = {
        "filter": {
            "and": [
                {"property": "Fecha", "date": {"equals": fecha}},
                {"property": "Costo", "number": {"equals": costo}},
            ]
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_gasto_notion(concepto, costo, fecha):
    """Crea la pagina en 'Gastos del local'. 'Pagado por' queda sin
    completar -- igual que hacia el flujo original de Relay -- para que
    Willy o Matias lo carguen a mano."""
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"data_source_id": GASTOS_LOCAL_DS_ID},
        "properties": {
            "Concepto": {"title": [{"text": {"content": concepto}}]},
            "Costo": {"number": costo},
            "Fecha": {"date": {"start": fecha}},
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

    print("Buscando comprobantes nuevos en Drive...")
    new_files = list_new_files(drive_token, processed_ids)
    print(f"  {len(new_files)} archivo(s) nuevo(s)")

    if not new_files:
        print("Nada que procesar.")
    else:
        extraccion_prompt = fetch_extraccion_prompt()

        for f in new_files:
            print(f"Procesando {f['name']} ({f['id']}, {f['mimeType']})...")
            file_bytes = download_file(drive_token, f["id"])
            datos = extraer_datos_gasto(file_bytes, f["mimeType"], extraccion_prompt)
            concepto = datos["concepto"]
            costo = float(datos["costo"])
            fecha = datos["fecha"]
            print(f"  Concepto={concepto} Costo={costo} Fecha={fecha}")

            if ya_existe_en_notion(fecha, costo):
                print(f"  Ya existe un gasto con Fecha={fecha} Costo={costo}, se omite.")
            else:
                crear_gasto_notion(concepto, costo, fecha)
                print("  Creado en Notion (Pagado por queda sin completar).")

            processed_ids.add(f["id"])

        state["processed_file_ids"] = sorted(processed_ids)
        save_state(state)
        print("processed_gastos_talho.json actualizado.")
