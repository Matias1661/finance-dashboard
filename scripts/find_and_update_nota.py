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

output_lines = [f"Total rows: {len(rows)}"]
output_lines.append("Last 20 rows:")
for i, row in enumerate(rows[-20:]):
    idx = len(rows) - 20 + i
    output_lines.append(f"  [{idx+1}] {row[:4] if len(row)>=4 else row}")

with open("tmp_sheet_debug.txt", "w") as f:
    f.write("\n".join(output_lines))

# Commit the file
subprocess.run(["git", "config", "user.email", "action@github.com"])
subprocess.run(["git", "config", "user.name", "GitHub Action"])
subprocess.run(["git", "add", "tmp_sheet_debug.txt"])
subprocess.run(["git", "commit", "-m", "temp: sheet debug output"])
subprocess.run(["git", "push"])
print("Done")
