
import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = "1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI"
SA_JSON  = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])
SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]
creds    = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
service  = build("sheets", "v4", credentials=creds)

# Read sheet
result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID, range="Movimientos!A:K").execute()
rows = result.get("values", [])

updates = []
for i, row in enumerate(rows):
    fecha    = row[0] if len(row) > 0 else ""
    concepto = row[1] if len(row) > 1 else ""
    importe  = row[2] if len(row) > 2 else ""
    imp_norm = importe.replace(".", "").replace(",", ".").replace(" ", "").replace("€", "")
    if "AMAZON" in concepto.upper() and "2026" in fecha and "09" in fecha and "06" in fecha:
        try:
            imp_f = float(imp_norm)
        except:
            imp_f = 0
        if abs(imp_f - (-63.99)) < 0.01:
            row_num = i + 1
            nota_col = "K"
            print(f"FOUND row {row_num}: fecha={fecha} concepto={concepto} importe={importe}")
            updates.append({"range": f"Movimientos!{nota_col}{row_num}", "values": [["Proyector Portátil 1920x1080P"]]})

if updates:
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": updates}
    ).execute()
    print(f"Updated {len(updates)} cell(s)")
else:
    print("No matching row found")
