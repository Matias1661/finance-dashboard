
import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = os.environ["SHEET_ID"]
SA_JSON = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
service = build("sheets", "v4", credentials=creds)

result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID,
    range="Movimientos!A1:C25"
).execute()

rows = result.get("values", [])
for i, row in enumerate(rows):
    print(f"Row {i+1}: {row}")
