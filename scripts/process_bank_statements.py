"""
Reemplazo del flujo de Relay "Pasar extracto bancario a Notion".

Revisa la carpeta de Drive "Extractos para Notion" en busca de PDFs nuevos,
le pide a Claude que extraiga cada movimiento (concepto, monto, fecha,
categoria) usando el mismo prompt de categorizacion que vive en la DB Notion
"Prompts para Relay" (se lee en vivo, no hay copia local que se desactualice),
y crea una pagina por movimiento en la DB Movimientos.

Lleva un registro de que archivos ya proceso en processed_bank_statements.json
(en la raiz del repo) para no reprocesar el mismo PDF dos veces.

Variables de entorno requeridas:
  NOTION_TOKEN            - ya existe como secret
  ANTHROPIC_API_KEY       - ya existe como secret (agregado 2026-07-17)
  GOOGLE_SERVICE_ACCOUNT  - JSON completo de la cuenta de servicio (secret nuevo, pendiente)

Ver docs/DECISIONS.md 2026-07-17 (paso 1 del plan de migracion de Relay).
"""

import os, json, base64, re
import requests

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT"]

NOTION_VERSION = "2025-09-03"
MOVIMIENTOS_DS_ID = "367d58ce-928b-4e31-832d-07707f876365"
PROMPTS_RELAY_DS_ID = "39833ce5-0e68-804a-b091-000bef7a0796"
DRIVE_FOLDER_ID = "1tDJJ8iJJ5SR5pFQdmp-vKO52x9uc_3Cs"  # "Extractos para Notion"
STATE_FILE = "processed_bank_statements.json"

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


def fetch_categorizacion_prompt():
    """Lee en vivo el texto de categorizacion desde la DB Notion 'Prompts para
    Relay', igual que hacia el workflow de Relay. Si no lo encuentra, falla
    fuerte (mejor frenar que categorizar sin las reglas actualizadas)."""
    url = f"https://api.notion.com/v1/data_sources/{PROMPTS_RELAY_DS_ID}/query"
    payload = {
        "filter": {
            "property": "Nombre",
            "title": {"equals": "Pasar extracto bancario a Notion"}
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        raise RuntimeError(
            "No se encontro el prompt 'Pasar extracto bancario a Notion' en "
            "la DB Notion 'Prompts para Relay'.")
    texto_prop = results[0]["properties"]["Texto"]
    return "".join(t["plain_text"] for t in texto_prop.get("rich_text", []))


def extraer_movimientos(pdf_bytes, categorizacion_prompt):
    """Manda el PDF a Claude y pide una lista estructurada de movimientos."""
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    system_prompt = (
        "Sos un extractor de movimientos bancarios. Te paso un extracto en PDF. "
        "Tu tarea tiene dos partes:\n"
        "1. Extraer cada movimiento del extracto: concepto (texto tal cual aparece), "
        "monto (numero, negativo si es gasto, positivo si es ingreso), y fecha "
        "(formato YYYY-MM-DD).\n"
        "2. Asignarle una categoria a cada movimiento siguiendo EXACTAMENTE estas reglas:\n\n"
        f"{categorizacion_prompt}\n\n"
        "Respondé ÚNICAMENTE con un JSON valido, sin texto adicional, sin backticks, "
        "con este formato exacto:\n"
        '{"movimientos": [{"concepto": "...", "monto": -12.34, "fecha": "2026-07-01", "categoria": "..."}]}'
    )

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "document", "source": {
                        "type": "base64", "media_type": "application/pdf", "data": pdf_b64
                    }},
                    {"type": "text", "text": "Extrae y categoriza todos los movimientos de este extracto."}
                ]
            }]
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    text = "".join(b["text"] for b in data["content"] if b["type"] == "text")
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(text)
    return parsed.get("movimientos", [])


def ya_existe_en_notion(concepto, monto, fecha):
    """Control de duplicados: mismo criterio que reviewed_movements.json
    (fecha|concepto|monto)."""
    url = f"https://api.notion.com/v1/data_sources/{MOVIMIENTOS_DS_ID}/query"
    payload = {
        "filter": {"and": [
            {"property": "Concepto", "title": {"equals": concepto}},
            {"property": "Monto", "number": {"equals": monto}},
            {"property": "Fecha", "date": {"equals": fecha}},
        ]}
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_movimiento_notion(concepto, monto, fecha, categoria):
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"data_source_id": MOVIMIENTOS_DS_ID},
        "properties": {
            "Concepto": {"title": [{"text": {"content": concepto}}]},
            "Monto": {"number": monto},
            "Fecha": {"date": {"start": fecha}},
            "Categoria": {"select": {"name": categoria}},
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

    print("Buscando extractos nuevos en Drive...")
    new_files = list_new_files(drive_token, processed_ids)
    print(f"  {len(new_files)} archivo(s) nuevo(s)")

    if not new_files:
        print("Nada que procesar.")
    else:
        categorizacion_prompt = fetch_categorizacion_prompt()

        for f in new_files:
            print(f"Procesando {f['name']} ({f['id']})...")
            pdf_bytes = download_file(drive_token, f["id"])
            movimientos = extraer_movimientos(pdf_bytes, categorizacion_prompt)
            print(f"  {len(movimientos)} movimiento(s) extraido(s)")

            creados, duplicados = 0, 0
            for m in movimientos:
                concepto = m["concepto"]
                monto = float(m["monto"])
                fecha = m["fecha"]
                categoria = m["categoria"]

                if ya_existe_en_notion(concepto, monto, fecha):
                    duplicados += 1
                    continue

                crear_movimiento_notion(concepto, monto, fecha, categoria)
                creados += 1

            print(f"  {creados} creado(s), {duplicados} duplicado(s) omitido(s)")

            processed_ids.add(f["id"])

        state["processed_file_ids"] = sorted(processed_ids)
        save_state(state)
        print("processed_bank_statements.json actualizado.")
