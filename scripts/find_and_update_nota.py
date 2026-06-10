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
print(f"Total rows in sheet: {len(rows)}")

updates = []
for i, row in enumerate(rows):
    fecha    = row[0] if len(row) > 0 else ""
    concepto = row[1] if len(row) > 1 else ""
    importe  = row[2] if len(row) > 2 else ""
    # Match: WWW.AMAZON in concepto AND fecha contains 09, 06, 2026
    if "WWW.AMAZON" in concepto.upper() and "09" in fecha and "06" in fecha and "2026" in fecha:
        nota = row[10] if len(row) > 10 else ""
        print(f"FOUND row {i+1}: fecha={fecha!r} concepto={concepto!r} importe={importe!r} nota={nota!r}")
        updates.append({"range": f"Movimientos!K{i+1}", "values": [["Proyector Portatil 1920x1080P"]]})

print(f"Updates to apply: {len(updates)}")
if updates:
    r = service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": updates}
    ).execute()
    print(f"Done: {r.get('totalUpdatedCells')} cells updated")
else:
    print("Nothing to update - no matching row found")
    # Print a few rows around row 2415 for reference
    for i in range(max(0, 2410), min(len(rows), 2420)):
        print(f"  row {i+1}: {rows[i][:3] if len(rows[i])>=3 else rows[i]}")
