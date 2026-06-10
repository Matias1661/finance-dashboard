import os, json, subprocess
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

output_lines = [f"Total rows: {len(rows)}", "First 25 rows:"]
for i, row in enumerate(rows[:25]):
    output_lines.append(f"  [{i+1}] {row[:4] if len(row)>=4 else row}")

# Find target
updates = []
for i, row in enumerate(rows[:25]):
    fecha    = row[0] if len(row) > 0 else ""
    concepto = row[1] if len(row) > 1 else ""
    importe  = row[2] if len(row) > 2 else ""
    if "AMAZON" in concepto.upper():
        output_lines.append(f"AMAZON row {i+1}: fecha={fecha!r} importe={importe!r}")
        imp_norm = importe.replace(".", "").replace(",", ".").replace(" ", "").replace("€", "")
        try:
            imp_f = abs(float(imp_norm))
        except:
            imp_f = 0
        if abs(imp_f - 63.99) < 0.05:
            updates.append({"range": f"Movimientos!K{i+1}", "values": [["Proyector Portatil 1920x1080P"]]})
            output_lines.append(f"  -> UPDATING K{i+1}")

with open("tmp_sheet_debug.txt", "w") as f:
    f.write("\n".join(output_lines))

if updates:
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": updates}
    ).execute()
    print(f"Updated {len(updates)} cells")

subprocess.run(["git", "config", "user.email", "action@github.com"])
subprocess.run(["git", "config", "user.name", "GitHub Action"])
subprocess.run(["git", "add", "tmp_sheet_debug.txt"])
subprocess.run(["git", "commit", "-m", "temp: sheet debug output"])
subprocess.run(["git", "push"])
print("Done")
