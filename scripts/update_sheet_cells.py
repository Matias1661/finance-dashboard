"""
update_sheet_cells.py

Escribe valores en celdas del Google Sheet de finanzas.
Uso desde GitHub Actions o línea de comandos.

Variables de entorno requeridas:
  GOOGLE_SERVICE_ACCOUNT  — JSON del service account (string)
  SHEET_ID                — ID del spreadsheet
  SHEET_NAME              — Nombre de la hoja (default: Movimientos)

Variables de entorno opcionales (para un único cambio):
  UPDATE_RANGE            — Rango A1 (ej: Movimientos!D13)
  UPDATE_VALUE            — Valor a escribir (ej: Departamento)

O bien, pasar un JSON de actualizaciones múltiples:
  UPDATE_BATCH            — JSON array: [{"range": "Movimientos!D13", "value": "Departamento"}, ...]

Ejemplo de uso en un step de workflow:
  env:
    UPDATE_RANGE: "Movimientos!D13"
    UPDATE_VALUE: "Departamento"
  run: python scripts/update_sheet_cells.py
"""

import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID   = os.environ["SHEET_ID"]
SHEET_NAME = os.environ.get("SHEET_NAME", "Movimientos")
SA_JSON    = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])

# Escritura requiere el scope completo (no readonly)
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_service():
    creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


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

    print("Nada que actualizar. Define UPDATE_RANGE+UPDATE_VALUE o UPDATE_BATCH.")


if __name__ == "__main__":
    main()
