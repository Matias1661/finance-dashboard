import os, json, urllib.request, urllib.error
token = os.environ['NOTION_TOKEN']
db_id = '38933ce50e6880b9899beedec9156145'
print(f"script: token={token[:12]}...")
body = json.dumps({"page_size": 100}).encode()
req = urllib.request.Request(f'https://api.notion.com/v1/databases/{db_id}/query', data=body, method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Notion-Version', '2022-06-28')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
        rows = []
        for p in d.get('results', []):
            pr = p['properties']
            fecha = ((pr.get('Fecha') or {}).get('date') or {}).get('start', '')[:10]
            costo = (pr.get('Costo') or {}).get('number') or 0
            pagado = ((pr.get('Pagado por') or {}).get('select') or {}).get('name') or 'Otro'
            concepto = (((pr.get('Concepto') or {}).get('title') or [{}])[0]).get('plain_text', '')
            if fecha:
                rows.append({'fecha': fecha, 'costo': costo, 'pagado': pagado, 'concepto': concepto})
        print(f"OK: {len(rows)} rows parsed")
        rows.sort(key=lambda r: r['fecha'])
        json.dump(rows, open('sociedad_data.json', 'w'), ensure_ascii=False, indent=2)
        print("Done")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()}")
    raise
