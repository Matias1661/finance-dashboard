import os, json, urllib.request, urllib.error, traceback, sys

try:
    token = os.environ["NOTION_TOKEN"]
    db_id = "38933ce50e6880b9899beedec9156145"
    rows = []
    cursor = None

    while True:
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

        with urllib.request.urlopen(req) as r:
            d = json.loads(r.read())

        for page in d.get("results", []):
            props = page.get("properties", {})
            rows.append({
                "fecha":    (props.get("Fecha", {}).get("date") or {}).get("start"),
                "concepto": "".join(rt.get("plain_text", "") for rt in props.get("Concepto", {}).get("title", [])),
                "costo":    props.get("Costo", {}).get("number"),
                "pagado":   (props.get("Pagado por", {}).get("select") or {}).get("name"),
            })

        if not d.get("has_more"):
            break
        cursor = d.get("next_cursor")

    print(f"Fetched {len(rows)} rows", flush=True)
    with open("sociedad_data.json", "w") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print("Done", flush=True)

except Exception:
    traceback.print_exc()
    sys.exit(1)
