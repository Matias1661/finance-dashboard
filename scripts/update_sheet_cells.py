"""
update_sheet_cells.py

Modos de operación:

1. FIND_AND_UPDATE — busca la fila exacta por fecha+concepto+importe y escribe en la columna indicada.
   Variables: FIND_FECHA (dd/MM/yyyy), FIND_CONCEPTO, FIND_IMPORTE (float, ej: -65.58),
              FIND_COLUMN (ej: K), FIND_VALUE

2. Batch — UPDATE_BATCH: JSON array [{range, value}, ...]

3. Single — UPDATE_RANGE + UPDATE_VALUE
"""

import os, json, re
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID   = os.environ["SHEET_ID"]
SHEET_NAME = os.environ.get("SHEET_NAME", "Movimientos")
SA_JSON    = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])
SCOPES     = ["https://www.googleapis.com/auth/spreadsheets"]


def get_service():
    creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def parse_importe(raw: str) -> float:
    """Convierte '-65,58 €' o '-65.58' a float -65.58"""
    cleaned = raw.strip().replace("€", "").replace(" ", "")
    # Si tiene coma como decimal (formato español): quitar puntos de miles, reemplazar coma
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    return float(cleaned)


def find_row(service, fecha: str, concepto: str, importe: float) -> int:
    """
    Busca la fila (1-indexed) donde coincidan fecha, concepto e importe.
    fecha debe estar en formato dd/MM/yyyy (como aparece en el Sheet).
    """
    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!A:C"
    ).execute()

    rows = result.get("values", [])
    for i, row in enumerate(rows):
        if len(row) < 3:
            continue
        row_fecha    = str(row[0]).strip()
        row_concepto = str(row[1]).strip()
        try:
            row_importe = parse_importe(row[2])
        except (ValueError, IndexError):
            continue

        if (row_fecha == fecha and
                row_concepto == concepto and
                abs(row_importe - importe) < 0.01):
            return i + 1  # 1-indexed

    raise ValueError(f"No se encontró fila: fecha={fecha}, concepto={concepto}, importe={importe}")


def write_cells(updates: list):
    service = get_service()

    def is_formula(v):
        return isinstance(v, str) and v.startswith("=")

    raw_data  = [{"range": u["range"], "values": [[u["value"]]]} for u in updates if not is_formula(u["value"])]
    form_data = [{"range": u["range"], "values": [[u["value"]]]} for u in updates if is_formula(u["value"])]

    total = 0
    for option, data in (("RAW", raw_data), ("USER_ENTERED", form_data)):
        if not data:
            continue
        result = service.spreadsheets().values().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={"valueInputOption": option, "data": data}
        ).execute()
        total += result.get("totalUpdatedCells", 0)
        for entry in result.get("responses", []):
            print(f"  {entry.get('updatedRange')} -> OK")
    print(f"Celdas actualizadas: {total}")


def main():
    find_fecha    = os.environ.get("FIND_FECHA", "").strip()
    find_concepto = os.environ.get("FIND_CONCEPTO", "").strip()
    find_importe  = os.environ.get("FIND_IMPORTE", "").strip()
    find_column   = os.environ.get("FIND_COLUMN", "").strip()
    find_value    = os.environ.get("FIND_VALUE", "")

    if find_fecha and find_concepto and find_importe and find_column and find_value is not None:
        print(f"Buscando: fecha={find_fecha}, concepto={find_concepto}, importe={find_importe}")
        service = get_service()
        row = find_row(service, find_fecha, find_concepto, float(find_importe))
        target_range = f"{SHEET_NAME}!{find_column.upper()}{row}"
        print(f"Encontrado en fila {row} -> escribiendo en {target_range}")
        write_cells([{"range": target_range, "value": find_value}])
        return

    batch_json = os.environ.get("UPDATE_BATCH", "").strip()
    if batch_json:
        updates = json.loads(batch_json)
        print(f"Modo batch: {len(updates)} actualizaciones")
        write_cells(updates)
        return

    update_range = os.environ.get("UPDATE_RANGE", "").strip()
    update_value = os.environ.get("UPDATE_VALUE", "")
    if update_range and update_value:
        print(f"Actualizando {update_range} -> \"{update_value}\"")
        write_cells([{"range": update_range, "value": update_value}])
        return

    print("Nada que actualizar.")


if __name__ == "__main__":
    main()
