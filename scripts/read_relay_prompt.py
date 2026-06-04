import json, os
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_JSON = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT'])
SHEET_ID = os.environ['SHEET_ID']

creds = service_account.Credentials.from_service_account_info(
    SA_JSON, scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
service = build('sheets', 'v4', credentials=creds)

result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID,
    range="'prompt relay'!A1:A3"
).execute()

values = result.get('values', [])
prompt = values[1][0] if len(values) > 1 and values[1] else ''
with open('prompt_relay_current.txt', 'w', encoding='utf-8') as f:
    f.write(prompt)
print('Done. Length:', len(prompt))
