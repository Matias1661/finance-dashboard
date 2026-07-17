"""
Reemplazo del flujo de Relay/Make para MyInvestor: lee el email mensual
"Rentabilidad de tu cartera en <mes>", extrae Ganancia, Aportes, Capital
total y Fecha reporte con Claude, y crea la fila correspondiente en la DB
Notion "Rendimiento Inversiones". Mismo patron que
scripts/process_peerberry_emails.py (mismo tipo de autenticacion, mismo
control de duplicados, mismo motivo para no usar cuenta de servicio).

Autenticacion con Gmail: reusa los mismos secrets OAuth ya generados para
Peerberry (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN) —
no hace falta un nuevo refresh_token, es la misma cuenta de Gmail.

Leccion aplicada del incidente de Peerberry (ver docs/DECISIONS.md
2026-07-17): antes de dar esta corrida por valida, comparar los agregados
mensuales del finance_data.json resultante contra la serie ya conocida en
Notion (19 meses, dic 2024-jun 2026, sin huecos ni duplicados verificado
antes de la primera corrida), no confiar solo en el log de "creado/duplicado".

Variables de entorno requeridas:
  NOTION_TOKEN          - ya existe como secret
  ANTHROPIC_API_KEY     - ya existe como secret
  GMAIL_CLIENT_ID       - ya existe como secret (creado para Peerberry)
  GMAIL_CLIENT_SECRET   - ya existe como secret
  GMAIL_REFRESH_TOKEN   - ya existe como secret

Ver docs/DECISIONS.md 2026-07-17 (plan Relay: MyInvestor) para el prompt
y el filtro de Gmail.
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
STATE_FILE = "processed_myinvestor_emails.json"
CLAUDE_MODEL = "claude-sonnet-5"


# Cota de fecha: antes de dic 2024 el usuario tuvo varias cuentas/carteras
# distintas en MyInvestor (confirmado 2026-07-17). Varios meses de 2024
# tienen 2-3 emails con el mismo cierre de mes pero capital/ganancia muy
# distintos entre si (cuentas separadas, no reenvios). El backfill oficial
# de docs/DECISIONS.md ya habia elegido arrancar en diciembre 2024 por este
# motivo. Sin este filtro, el control de duplicados (por fecha exacta)
# elige arbitrariamente el primer email que procesa y descarta los demas
# como si fueran duplicados, perdiendo datos reales de las otras cuentas.
GMAIL_QUERY = ('from:(comunicaciones@myinvestor.es OR notificaciones@myinvestor.es) '
               'subject:"Rentabilidad de tu cartera" after:2024/11/25')

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

EXTRACTION_PROMPT = """Extrae del email mensual de MyInvestor (asunto "Rentabilidad de tu cartera en <mes>"): Ganancia del mes, Aportes (si aplica, 0 si no se menciona ningun aporte o retiro), Capital total, Fecha reporte (YYYY-MM-DD, ultimo dia del mes que informa). Si el email tiene mas de una fecha, usa la fecha de cierre del informe/reporte, no fechas de otros movimientos.

Campos tipicos del email: "GANANCIAS ... En <mes>" = Ganancia neta del mes en euros. "VALOR DE TU CARTERA" = Capital total.

Respondé ÚNICAMENTE con un JSON valido, sin texto adicional, sin backticks, con este formato exacto:
{"ganancia": number, "aportes": number, "capital_total": number, "fecha_reporte": "YYYY-MM-DD"}"""


def get_gmail_access_token():
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
                         params={"q": GMAIL_QUERY, "maxResults": 30}, timeout=30)
    resp.raise_for_status()
    messages = resp.json().get("messages", [])
    return [m for m in messages if m["id"] not in already_processed]


def _find_plain_text_part(payload):
    """Busca recursivamente la parte text/plain del email. MyInvestor manda
    HTML de marketing pesado (esto fue justamente lo que bloqueaba a Make
    con MaxFileSizeExceededError) — pedir solo text/plain evita el problema."""
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


def extraer_datos_myinvestor(texto_email):
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
    """Control de duplicados: Plataforma=MyInvestor, Periodo=Mensual, misma
    Fecha reporte (ultimo dia del mes)."""
    url = f"https://api.notion.com/v1/data_sources/{RENDIMIENTO_DS_ID}/query"
    payload = {
        "filter": {"and": [
            {"property": "Plataforma", "select": {"equals": "MyInvestor"}},
            {"property": "Periodo", "select": {"equals": "Mensual"}},
            {"property": "Fecha reporte", "date": {"equals": fecha_reporte}},
        ]}
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_fila_notion(ganancia, aportes, capital_total, fecha_reporte):
    titulo = f"MyInvestor {fecha_reporte[:7]}"
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"data_source_id": RENDIMIENTO_DS_ID},
        "properties": {
            "Fecha": {"title": [{"text": {"content": titulo}}]},
            "Plataforma": {"select": {"name": "MyInvestor"}},
            "Periodo": {"select": {"name": "Mensual"}},
            "Ganancia": {"number": ganancia},
            "Aportes": {"number": aportes},
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

    print("Buscando emails nuevos de MyInvestor...")
    new_messages = list_new_messages(gmail_token, processed_ids)
    print(f"  {len(new_messages)} mensaje(s) nuevo(s)")

    for msg in new_messages:
        print(f"Procesando mensaje {msg['id']}...")
        texto = get_message_text(gmail_token, msg["id"])
        datos = extraer_datos_myinvestor(texto)
        ganancia = float(datos["ganancia"])
        aportes = float(datos.get("aportes") or 0)
        capital_total = float(datos["capital_total"])
        fecha_reporte = datos["fecha_reporte"]
        print(f"  ganancia={ganancia} aportes={aportes} capital_total={capital_total} fecha_reporte={fecha_reporte}")

        if ya_existe_en_notion(fecha_reporte):
            print("  ya existe en Notion, se omite")
        else:
            crear_fila_notion(ganancia, aportes, capital_total, fecha_reporte)
            print("  fila creada en Notion")

        processed_ids.add(msg["id"])

    state["processed_message_ids"] = sorted(processed_ids)
    save_state(state)
    print(f"{STATE_FILE} actualizado.")
