"""
update_sheet_cells.py

Escribe valores en celdas del Google Sheet de finanzas.

Variables de entorno requeridas:
  GOOGLE_SERVICE_ACCOUNT  — JSON del service account (string)
  SHEET_ID                — ID del spreadsheet
  SHEET_NAME              — Nombre de la hoja (default: Movimientos)

Modos de operación:

1. FIND_AND_UPDATE (recomendado para notas):
   Busca la fila exacta por fecha+concepto+importe y escribe en la columna indicada.
   Variables:
     FIND_FECHA    — fecha del movimiento (ej: 19/6/2026)
     FIND_CONCEPTO — concepto exacto (ej: WWW.AMAZON)
     FIND_IMPORTE  — importe como float negativo (ej: -65.58)
     FIND_COLUMN   — columna a escribir (ej: K)
     FIND_VALUE    — valor a escribir

2. Modo batch:
   UPDATE_BATCH — JSON array: [{"range": "Movimientos!D13", "value": "texto"}, ...]

3. Modo single:
   UPDATE_RANGE — Rango A1 (ej: Movimientos!D13)
   UPDATE_VALUE — Valor a escribir
"""

import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID   = os.environ["SHEET_ID"]
SHEET_NAME = os.environ.get("SHEET_NAME", "Movimientos")
SA_JSON    = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_service():
    creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def find_row(service, fecha: str, concepto: str, importe: float) -> int:
    """
    Busca la fila (1-indexed) donde coincidan fecha, concepto e importe.
    Lee columnas A (fecha), B (concepto), C (importe).
    Lanza ValueError si no encuentra coincidencia.
    """
    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!A:C"
    ).execute()

    rows = result.get("values", [])

    # Normalizar importe buscado
    target_importe = float(importe)

    for i, row in enumerate(rows):
        if len(row) < 3:
            continue
        row_fecha   = str(row[0]).strip()
        row_concepto = str(row[1]).strip()
        row_importe_raw = str(row[2]).strip().replace(".", "").replace(",", ".")
        try:
            row_importe = float(row_importe_raw)
        except ValueError:
            continue

        if (row_fecha == fecha and
            row_concepto == concepto and
            abs(row_importe - target_importe) < 0.01):
            return i + 1  # 1-indexed

    raise ValueError(f"No se encontró fila: fecha={fecha}, concepto={concepto}, importe={importe}")


def write_cells(updates: list[dict]):
    """
    updates: lista de {"range": "Sheet!A1", "value": "texto"}
    Los valores que empiezan con "=" se escriben como fórmula (USER_ENTERED);
    el resto como texto literal (RAW).
    """
    service = get_service()

    def is_formula(v):
        return isinstance(v, str) and v.startswith("=")

    raw_data  = [{"range": u["range"], "values": [[u["value"]]]} for u in updates if not is_formula(u["value"])]
    form_data = [{"range": u["range"], "values": [[u["value"]]]} for u in updates if is_formula(u["value"])]

    total = 0
    responses = []
    for option, data in (("RAW", raw_data), ("USER_ENTERED", form_data)):
        if not data:
            continue
        result = service.spreadsheets().values().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={"valueInputOption": option, "data": data}
        ).execute()
        total += result.get("totalUpdatedCells", 0)
        responses.extend(result.get("responses", []))

    print(f"Celdas actualizadas: {total}")
    for entry in responses:
        print(f"  {entry.get('updatedRange')} -> OK")
    return {"totalUpdatedCells": total, "responses": responses}


def main():
    # Modo FIND_AND_UPDATE: busca fila por fecha+concepto+importe
    find_fecha    = os.environ.get("FIND_FECHA")
    find_concepto = os.environ.get("FIND_CONCEPTO")
    find_importe  = os.environ.get("FIND_IMPORTE")
    find_column   = os.environ.get("FIND_COLUMN")
    find_value    = os.environ.get("FIND_VALUE")

    if find_fecha and find_concepto and find_importe and find_column and find_value is not None:
        print(f"Buscando fila: fecha={find_fecha}, concepto={find_concepto}, importe={find_importe}")
        service = get_service()
        row = find_row(service, find_fecha, find_concepto, float(find_importe))
        target_range = f"{SHEET_NAME}!{find_column.upper()}{row}"
        print(f"Encontrado en fila {row} -> escribiendo en {target_range}")
        write_cells([{"range": target_range, "value": find_value}])
        return

    # Modo batch: UPDATE_BATCH = JSON array
    batch_json = os.environ.get("UPDATE_BATCH")
    if batch_json:
        updates = json.loads(batch_json)
        print(f"Modo batch: {len(updates)} actualizaciones")
        write_cells(updates)
        return

    # Modo single: UPDATE_RANGE + UPDATE_VALUE
    update_range = os.environ.get("UPDATE_RANGE")
    update_value = os.environ.get("UPDATE_VALUE")
    if update_range and update_value is not None:
        print(f"Actualizando {update_range} -> \"{update_value}\"")
        write_cells([{"range": update_range, "value": update_value}])
        return

    print("Nada que actualizar. Define FIND_FECHA+FIND_CONCEPTO+FIND_IMPORTE+FIND_COLUMN+FIND_VALUE, UPDATE_RANGE+UPDATE_VALUE, o UPDATE_BATCH.")


if __name__ == "__main__":
    main()
