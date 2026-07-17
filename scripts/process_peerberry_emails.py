"""
Reemplazo del flujo de Relay/Make para Peerberry: lee el email semanal
"Account summary overview" (info@peerberry.com), extrae Capital total,
Ganancia y Fecha reporte de la seccion Portfolio con Claude (prompt ya
validado en Make el 13/07/2026), y crea la fila correspondiente en la DB
Notion "Rendimiento Inversiones".

Autenticacion con Gmail: OAuth 2.0 con refresh_token, NO cuenta de servicio.
matiaso81@gmail.com es una cuenta personal, no Google Workspace, y las
cuentas de servicio solo pueden leer un Gmail ajeno via domain-wide
delegation, que no existe fuera de Workspace. El refresh_token se genera
una unica vez de forma interactiva con scripts/get_gmail_refresh_token.py.

Se pide solo la parte text/plain del email (no el raw/HTML completo), el
mismo motivo por el que Make fallaba con MyInvestor (MaxFileSizeExceededError
por el HTML pesado del email de marketing).

Variables de entorno requeridas:
  NOTION_TOKEN          - ya existe como secret
  ANTHROPIC_API_KEY     - ya existe como secret
  GMAIL_CLIENT_ID       - secret nuevo (ver get_gmail_refresh_token.py)
  GMAIL_CLIENT_SECRET   - secret nuevo
  GMAIL_REFRESH_TOKEN   - secret nuevo

Ver docs/DECISIONS.md 2026-07-17 (plan Relay: Peerberry) para el prompt
validado y el filtro de Gmail. Pendiente de confirmar con el usuario el
contenido exacto de la propiedad "Fecha" (title) — este script usa el mismo
string que "Fecha reporte", a falta de precedente documentado.
"""

import os, json, re, base64
import requests

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GMAIL_CLIENT_ID = os.environ["GMAIL_CLIENT_ID"]
GMAIL_CLIENT_SECRET = os.environ["GMAIL_CLIENT_SECRET"]
GMAIL_REFRESH_TOKEN = os.environ["GMAIL_REFRESH_TOKEN"]

NOTION_VERSION = "2025-09-03"
RENDIMIENTO_DS_ID = "93eda06b-9207-4589-b3f0-66be10ab9caf"
STATE_FILE = "processed_peerberry_emails.json"
CLAUDE_MODEL = "claude-sonnet-5"

GMAIL_QUERY = 'from:info@peerberry.com subject:"Account summary overview"'

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

EXTRACTION_PROMPT = """Extrae del email semanal de Peerberry: Capital total = Invested funds + Available balance de la seccion Portfolio (NUNCA Balance on), Ganancia del periodo, Fecha reporte (YYYY-MM-DD).

Este email de Peerberry tiene DOS secciones con fechas y montos distintos: (1) un resumen de cuenta arriba, con varias lineas 'Balance on <fecha>' e 'Interest income'; (2) una seccion 'Portfolio' mas abajo, con 'Portfolio updated on <fecha>', 'Invested funds', 'Available balance' y 'Profit'. IGNORA COMPLETAMENTE la seccion (1). Usa UNICAMENTE la seccion Portfolio: Capital total = Invested funds + Available balance. Ganancia = el valor de 'Profit' (NO 'Interest income'). Fecha reporte = la fecha de 'Portfolio updated on' (NO ninguna fecha 'Balance on'), formato YYYY-MM-DD.

Respondé ÚNICAMENTE con un JSON valido, sin texto adicional, sin backticks, con este formato exacto:
{"ganancia": number, "capital_total": number, "fecha_reporte": "YYYY-MM-DD"}"""


def get_gmail_access_token():
    """Cambia el refresh_token de larga duracion por un access_token valido
    ~1 hora. No requiere ninguna libreria de Google, solo el endpoint OAuth
    estandar."""
    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": GMAIL_CLIENT_ID,
        "client_secret": GMAIL_CLIENT_SECRET,
        "refresh_token": GMAIL_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()["access_token"]


def list_new_messages(gmail_token, already_processed):
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    headers = {"Authorization": f"Bearer {gmail_token}"}
    resp = requests.get(url, headers=headers,
                         params={"q": GMAIL_QUERY, "maxResults": 20}, timeout=30)
    resp.raise_for_status()
    messages = resp.json().get("messages", [])
    return [m for m in messages if m["id"] not in already_processed]


def _find_plain_text_part(payload):
    """Busca recursivamente la parte text/plain del email. Evita bajar el
    HTML completo (mas pesado, y la causa del limite de tamano de Make)."""
    if payload.get("mimeType") == "text/plain" and "data" in payload.get("body", {}):
        return payload["body"]["data"]
    for part in payload.get("parts", []):
        found = _find_plain_text_part(part)
        if found:
            return found
    return None


def get_message_text(gmail_token, message_id):
    url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}"
    headers = {"Authorization": f"Bearer {gmail_token}"}
    resp = requests.get(url, headers=headers, params={"format": "full"}, timeout=30)
    resp.raise_for_status()
    payload = resp.json()["payload"]
    data = _find_plain_text_part(payload)
    if not data:
        raise RuntimeError(f"Mensaje {message_id} no tiene parte text/plain")
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def extraer_datos_peerberry(texto_email):
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
            "system": EXTRACTION_PROMPT,
            "messages": [{"role": "user", "content": texto_email}],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    text = "".join(b["text"] for b in data["content"] if b["type"] == "text")
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def ya_existe_en_notion(fecha_reporte):
    """Control de duplicados: Plataforma=Peerberry, Periodo=Semanal, misma
    Fecha reporte. El envio semanal de Peerberry tiene una fecha de reporte
    distinta cada semana, asi que esta clave alcanza."""
    url = f"https://api.notion.com/v1/data_sources/{RENDIMIENTO_DS_ID}/query"
    payload = {
        "filter": {"and": [
            {"property": "Plataforma", "select": {"equals": "Peerberry"}},
            {"property": "Periodo", "select": {"equals": "Semanal"}},
            {"property": "Fecha reporte", "date": {"equals": fecha_reporte}},
        ]}
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_fila_notion(ganancia, capital_total, fecha_reporte):
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"data_source_id": RENDIMIENTO_DS_ID},
        "properties": {
            "Fecha": {"title": [{"text": {"content": fecha_reporte}}]},
            "Plataforma": {"select": {"name": "Peerberry"}},
            "Periodo": {"select": {"name": "Semanal"}},
            "Ganancia": {"number": ganancia},
            "Capital total": {"number": capital_total},
            "Fecha reporte": {"date": {"start": fecha_reporte}},
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"processed_message_ids": []}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    state = load_state()
    processed_ids = set(state["processed_message_ids"])

    print("Autenticando con Gmail (OAuth refresh token)...")
    gmail_token = get_gmail_access_token()

    print("Buscando emails nuevos de Peerberry...")
    new_messages = list_new_messages(gmail_token, processed_ids)
    print(f"  {len(new_messages)} mensaje(s) nuevo(s)")

    for msg in new_messages:
        print(f"Procesando mensaje {msg['id']}...")
        texto = get_message_text(gmail_token, msg["id"])
        datos = extraer_datos_peerberry(texto)
        ganancia = float(datos["ganancia"])
        capital_total = float(datos["capital_total"])
        fecha_reporte = datos["fecha_reporte"]
        print(f"  ganancia={ganancia} capital_total={capital_total} fecha_reporte={fecha_reporte}")

        if ya_existe_en_notion(fecha_reporte):
            print("  ya existe en Notion, se omite")
        else:
            crear_fila_notion(ganancia, capital_total, fecha_reporte)
            print("  fila creada en Notion")

        processed_ids.add(msg["id"])

    state["processed_message_ids"] = sorted(processed_ids)
    save_state(state)
    print(f"{STATE_FILE} actualizado.")
