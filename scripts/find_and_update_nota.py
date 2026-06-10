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

summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "/dev/stdout")
with open(summary_path, "a") as f:
    f.write(f"## Sheet rows: {len(rows)}\n\n")
    f.write("### Last 20 rows\n\n")
    for i, row in enumerate(rows[-20:]):
        idx = len(rows) - 20 + i
        f.write(f"Row {idx+1}: `{row[:4] if len(row)>=4 else row}`\n\n")

print(f"Total rows: {len(rows)}")
for i, row in enumerate(rows[-20:]):
    idx = len(rows) - 20 + i
    print(f"Row {idx+1}: {row[:4] if len(row)>=4 else row}")
