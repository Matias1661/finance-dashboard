import json, os, sys, urllib.request, urllib.error

token  = os.environ["NOTION_TOKEN"]
db_id  = os.environ.get("NOTION_DB_ID", "38933ce50e6880b9899beedec9156145")
out    = "sociedad_data.json"

print(f"token={token[:12]}... db={db_id}", flush=True)

rows, cursor, page = [], None, 0
while True:
    page += 1
    body = {"page_size": 100}
    if cursor:
        body["start_cursor"] = cursor
    req = urllib.request.Request(
        f"https://api.notion.com/v1/databases/{db_id}/query",
        data=json.dumps(body).encode(), method="POST"
    )
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            d = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", flush=True); sys.exit(1)
    results = d.get("results", [])
    print(f"page {page}: {len(results)} rows, has_more={d.get('has_more')}", flush=True)
    for p in results:
        props = p["properties"]
        fecha = ((props.get("Fecha") or {}).get("date") or {}).get("start", "")[:10]
        costo = (props.get("Costo") or {}).get("number") or 0
        pagado = ((props.get("Pagado por") or {}).get("select") or {}).get("name") or "Otro"
        concepto = (((props.get("Concepto") or {}).get("title") or [{}])[0]).get("plain_text", "")
        if fecha:
            rows.append({"fecha": fecha, "costo": costo, "pagado": pagado, "concepto": concepto})
    if d.get("has_more"):
        cursor = d["next_cursor"]
    else:
        break

rows.sort(key=lambda r: r["fecha"])
with open(out, "w") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
print(f"Done: {len(rows)} rows -> {out}", flush=True)
