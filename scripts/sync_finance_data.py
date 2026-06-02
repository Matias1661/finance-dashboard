"""
Sync finance data from Google Sheets to finance_data.json

Reads two sheets:
  - Movimientos: transacciones diarias
  - finanzas: tabla de inversiones (col A=fecha, D=Peerberry, E=MyInvestor)
    Toma el ultimo registro de cada mes (serie semanal).

Output finance_data.json:
  {
    "movimientos": [...],
    "inversiones": {
      "capital": [
        { "mes": "2025-07", "peerberry": 13011, "myinvestor": 4926 },
        ...
      ],
      "rendimiento": [
        { "mes": "2025-08", "peerberry": -9.80, "myinvestor": 0.76 },
        ...
      ]
    }
  }
"""

import os, json, re
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID          = os.environ["SHEET_ID"]
MOVIMIENTOS_SHEET = os.environ.get("SHEET_NAME", "Movimientos")
FINANZAS_SHEET    = "finanzas"
SA_JSON           = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

MESES_ES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
}


def get_service():
    creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def read_range(service, sheet_name, cell_range="A:Z"):
    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range=f"{sheet_name}!{cell_range}"
    ).execute()
    return result.get("values", [])


def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    if m:
        return raw
    return None


def parse_amount(raw):
    if raw is None or str(raw).strip() == "":
        return None
    raw = str(raw).strip().replace("€", "").replace("$", "").replace(" ", "")
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_pct(raw):
    if raw is None or str(raw).strip() in ("", "-", "0"):
        return None
    raw = str(raw).strip().replace("%", "").replace(",", ".").replace(" ", "")
    try:
        return round(float(raw), 4)
    except ValueError:
        return None


def parse_mes_label(raw):
    """-agosto-25 o ago-25 -> 2025-08"""
    raw = raw.strip().lower()
    raw = re.sub(r"[^a-z0-9 ]", " ", raw).strip()
    parts = raw.split()
    mes_num = None
    year_2d = None
    for p in parts:
        if p in MESES_ES:
            mes_num = MESES_ES[p]
            continue
        for k, v in MESES_ES.items():
            if len(p) >= 3 and k.startswith(p):
                mes_num = v
                break
        if re.match(r"^\d{2}$", p):
            year_2d = p
        if re.match(r"^\d{4}$", p):
            return f"{p}-{mes_num}" if mes_num else None
    if mes_num and year_2d:
        return f"20{year_2d}-{mes_num}"
    return None


def build_movimientos(rows):
    if not rows:
        return []
    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
    col_map = {}
    for i, h in enumerate(headers):
        if h in ("fecha", "date"):                            col_map["fecha"] = i
        elif h in ("concepto", "descripcion", "description"): col_map["concepto"] = i
        elif h in ("importe", "monto", "amount", "valor"):    col_map["monto"] = i
        elif h in ("categoria", "categoría", "category"):     col_map["categoria"] = i

    records = []
    for row in rows[1:]:
        def get(key):
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return None
            return row[idx]

        fecha     = parse_date(get("fecha"))
        concepto  = (get("concepto") or "").strip()
        monto     = parse_amount(get("monto"))
        categoria = (get("categoria") or "").strip()

        if not fecha or monto is None:
            continue

        records.append({
            "fecha":     fecha,
            "concepto":  concepto,
            "monto":     monto,
            "categoria": categoria or None
        })

    records.sort(key=lambda r: r["fecha"], reverse=True)
    return records


def build_inversiones(rows):
    """
    Capital: col A=fecha, D=Peerberry, E=MyInvestor.
    Toma el ultimo registro de cada mes.

    Rendimiento %: busca fila cabecera con 'peerberry' y '%',
    lee columnas Mes / Peerberry% / MyInvestor%.
    """
    if not rows:
        return {"capital": [], "rendimiento": []}

    # Capital
    month_last = {}
    for row in rows:
        if len(row) < 5:
            continue
        fecha = parse_date(row[0])
        if not fecha:
            continue
        pb = parse_amount(row[3] if len(row) > 3 else None)
        mi = parse_amount(row[4] if len(row) > 4 else None)
        if pb is None and mi is None:
            continue
        mk = fecha[:7]
        if mk not in month_last or fecha > month_last[mk]["fecha"]:
            month_last[mk] = {
                "fecha":      fecha,
                "peerberry":  pb if pb is not None else 0,
                "myinvestor": mi if mi is not None else 0
            }

    capital = []
    for mk in sorted(month_last.keys()):
        e = month_last[mk]
        if e["peerberry"] == 0 and e["myinvestor"] == 0:
            continue
        capital.append({"mes": mk, "peerberry": e["peerberry"], "myinvestor": e["myinvestor"]})

    # Rendimiento %: detectar fila cabecera
    pct_header_idx = None
    pct_mes_col = pct_pb_col = pct_mi_col = None

    for i, row in enumerate(rows):
        row_lower = [str(c).lower().strip() for c in row]
        if any("peerberry" in c and "%" in c for c in row_lower):
            pct_header_idx = i
            for j, c in enumerate(row_lower):
                if c == "mes":
                    pct_mes_col = j
                elif "peerberry" in c and "%" in c:
                    pct_pb_col = j
                elif ("myinvestor" in c or ("my" in c and "investor" in c)) and "%" in c:
                    pct_mi_col = j
            break

    rendimiento = []
    if pct_header_idx is not None and pct_mes_col is not None:
        for row in rows[pct_header_idx + 1:]:
            if pct_mes_col >= len(row):
                continue
            mes_raw = str(row[pct_mes_col]).strip()
            if not mes_raw:
                continue
            mes_iso = parse_mes_label(mes_raw)
            if not mes_iso:
                continue
            pb_pct = parse_pct(row[pct_pb_col] if pct_pb_col is not None and pct_pb_col < len(row) else None)
            mi_pct = parse_pct(row[pct_mi_col] if pct_mi_col is not None and pct_mi_col < len(row) else None)
            if pb_pct is None and mi_pct is None:
                continue
            rendimiento.append({
                "mes":        mes_iso,
                "peerberry":  pb_pct if pb_pct is not None else 0,
                "myinvestor": mi_pct if mi_pct is not None else 0
            })

    rendimiento.sort(key=lambda r: r["mes"])
    return {"capital": capital, "rendimiento": rendimiento}


if __name__ == "__main__":
    service = get_service()

    print("Leyendo Movimientos...")
    mov_rows = read_range(service, MOVIMIENTOS_SHEET)
    print(f"  {len(mov_rows)} filas")
    movimientos = build_movimientos(mov_rows)
    print(f"  {len(movimientos)} registros validos")

    print("Leyendo finanzas (inversiones)...")
    fin_rows = read_range(service, FINANZAS_SHEET)
    print(f"  {len(fin_rows)} filas")
    inversiones = build_inversiones(fin_rows)
    print(f"  {len(inversiones['capital'])} meses de capital")
    print(f"  {len(inversiones['rendimiento'])} meses de rendimiento")

    output = {
        "movimientos": movimientos,
        "inversiones": inversiones
    }

    with open("finance_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("finance_data.json actualizado.")
