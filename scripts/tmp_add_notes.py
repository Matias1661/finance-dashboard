
import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = "1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI"
SA_JSON = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
service = build("sheets", "v4", credentials=creds)

result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID, range="Movimientos!A:K").execute()
rows = result.get("values", [])

targets = [
    ("12/6/2026", "PAYPAL EUROPE S.", -197.37, "Relay anual — pago por error, reembolso solicitado"),
    ("3/6/2026",  "PAYPAL EUROPE S.", -10.0,   "Microsoft 365"),
    ("6/5/2026",  "PAYPAL EUROPE S.", -10.0,   "Microsoft 365"),
    ("29/5/2026", "UBER RIDES",       -9.97,   "Trayecto urbano"),
    ("12/6/2026", "WWW.AMAZON",       -15.99,  "Limpiador de mosquitos"),
]

updates = []
for fecha, concepto, monto_target, nota in targets:
    for i, row in enumerate(rows):
        f = row[0] if len(row) > 0 else ""
        c = row[1] if len(row) > 1 else ""
        imp = row[2] if len(row) > 2 else ""
        if f != fecha or concepto.upper() not in c.upper():
            continue
        try:
            imp_f = float(imp.replace(".", "").replace(",", ".").replace(" ", "").replace("€", "").replace("-", "").strip())
            if abs(imp_f - abs(monto_target)) > 0.05:
                continue
        except:
            continue
        # Check K column (index 10) — only write if empty
        k_val = row[10] if len(row) > 10 else ""
        if k_val:
            print(f"Row {i+1}: already has nota: {k_val!r}")
            break
        updates.append({"range": f"Movimientos!K{i+1}", "values": [[nota]]})
        print(f"Row {i+1}: {f} | {c} | {imp} -> {nota}")
        break

if updates:
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": updates}
    ).execute()
    print(f"Updated {len(updates)} cells")
else:
    print("Nothing to update")
