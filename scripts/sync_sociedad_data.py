import os, json, urllib.request, urllib.error
token = os.environ["NOTION_TOKEN"]
db_id = "38933ce50e6880b9899beedec9156145"
print(f"token={token[:12]}...")
rows, cursor = [], None
while True:
    body = {"page_size": 100}
    if cursor:
        body["start_cursor"] = cursor
    req = urllib.request.Request(f"https://api.notion.com/v1/databases/{db_id}/query", data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            d = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}"); raise
    print(f"{len(d['results'])} rows, has_more={d['has_more']}")
    for p in d["results"]:
        pr = p["properties"]
        fecha = ((pr.get("Fecha") or {}).get("date") or {}).get("start", "")[:10]
        costo = (pr.get("Costo") or {}).get("number") or 0
        pagado = ((pr.get("Pagado por") or {}).get("select") or {}).get("name") or "Otro"
        concepto = (((pr.get("Concepto") or {}).get("title") or [{}])[0]).get("plain_text", "")
        if fecha:
            rows.append({"fecha": fecha, "costo": costo, "pagado": pagado, "concepto": concepto})
    if d["has_more"]:
        cursor = d["next_cursor"]
    else:
        break
rows.sort(key=lambda r: r["fecha"])
with open("sociedad_data.json", "w") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
print(f"Done: {len(rows)} rows")
