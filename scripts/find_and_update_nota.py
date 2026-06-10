import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = "1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI"
SA_JSON  = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])
SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]
creds    = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
service  = build("sheets", "v4", credentials=creds)

result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID, range="Movimientos!A:K").execute()
rows = result.get("values", [])
print(f"Total rows: {len(rows)}")

# Print last 15 rows for debugging
print("Last 15 rows:")
for i, row in enumerate(rows[-15:]):
    idx = len(rows) - 15 + i
    print(f"  [{idx+1}] {row[:4] if len(row)>=4 else row}")

# Find target
updates = []
for i, row in enumerate(rows):
    fecha    = row[0] if len(row) > 0 else ""
    concepto = row[1] if len(row) > 1 else ""
    importe  = row[2] if len(row) > 2 else ""
    # Flexible match: AMAZON in concepto, 09 and 06 and 2026 in fecha
    if ("AMAZON" in concepto.upper() and 
        "09" in fecha and "06" in fecha and "2026" in fecha):
        nota = row[10] if len(row) > 10 else ""
        print(f"CANDIDATE row {i+1}: fecha={fecha!r} concepto={concepto!r} importe={importe!r} nota={nota!r}")
        imp_norm = importe.replace(".", "").replace(",", ".").strip()
        try:
            imp_f = float(imp_norm)
        except:
            imp_f = 0
        print(f"  Parsed importe: {imp_f}")
        if abs(imp_f - 63.99) < 0.05:
            updates.append({"range": f"Movimientos!K{i+1}", "values": [["Proyector Portátil 1920x1080P"]]})
            print(f"  -> WILL UPDATE K{i+1}")

if updates:
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": updates}
    ).execute()
    print(f"Updated {len(updates)} cell(s)")
else:
    print("No matching row found")
