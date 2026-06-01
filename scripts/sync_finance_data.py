"""
Sync finance data from Google Sheets to finance_data.json
Sheet: finanzas
Columns (inferred from memory): fecha, concepto, importe, categoria, ...
"""

import os, json, re
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID   = os.environ["SHEET_ID"]
SHEET_NAME = os.environ.get("SHEET_NAME", "finanzas")
SA_JSON    = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_sheet_data():
    creds   = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)
    result  = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!A:Z"
    ).execute()
    return result.get("values", [])

def parse_date(raw):
    """Convierte DD-MM-AAAA o YYYY-MM-DD a YYYY-MM-DD"""
    if not raw:
        return None
    raw = raw.strip()
    # DD-MM-YYYY o DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    # YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    if m:
        return raw
    return raw

def parse_amount(raw):
    """Parsea montos en locale español: 1.234,56 -> 1234.56"""
    if raw is None or raw == "":
        return None
    raw = str(raw).strip().replace("€", "").replace(" ", "")
    # Separador miles = punto, decimal = coma
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None

def build_records(rows):
    if not rows:
        return []

    # Primera fila = cabeceras, normalizar a lowercase sin espacios
    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]

    # Mapeo flexible de nombres de columna
    col_map = {}
    for i, h in enumerate(headers):
        if h in ("fecha", "date"):
            col_map["fecha"] = i
        elif h in ("concepto", "descripcion", "description", "concept"):
            col_map["concepto"] = i
        elif h in ("importe", "monto", "amount", "valor"):
            col_map["monto"] = i
        elif h in ("categoria", "categoría", "category", "categoria_relay"):
            col_map["categoria"] = i

    records = []
    for row in rows[1:]:
        def get(key):
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return None
            return row[idx]

        fecha    = parse_date(get("fecha"))
        concepto = (get("concepto") or "").strip()
        monto    = parse_amount(get("monto"))
        categoria = (get("categoria") or "").strip()

        if not fecha or monto is None:
            continue

        records.append({
            "fecha":     fecha,
            "concepto":  concepto,
            "monto":     monto,
            "categoria": categoria or None
        })

    # Ordenar más reciente primero
    records.sort(key=lambda r: r["fecha"], reverse=True)
    return records

if __name__ == "__main__":
    print("Leyendo Sheet...")
    rows = get_sheet_data()
    print(f"  {len(rows)} filas leídas (incluyendo cabecera)")

    records = build_records(rows)
    print(f"  {len(records)} registros válidos")

    with open("finance_data.json", "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print("finance_data.json actualizado.")
