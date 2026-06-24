import os, json, urllib.request, urllib.error, traceback, sys
try:
    token = os.environ["NOTION_TOKEN"]
    db_id = "38933ce50e6880b9899beedec9156145"
    print(f"START token={token[:12]}...", flush=True)
    body = json.dumps({"page_size": 100}).encode()
    req = urllib.request.Request(f"https://api.notion.com/v1/databases/{db_id}/query", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")
    print("Sending request...", flush=True)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        print(f"Response length: {len(raw)}", flush=True)
        d = json.loads(raw)
    results = d.get("results", [])
    print(f"Got {len(results)} rows", flush=True)
    if results:
        props = results[0].get("properties", {})
        print(f"Properties: {list(props.keys())}", flush=True)
        for k, v in list(props.items())[:5]:
            print(f"  {k}: type={v.get('type')}", flush=True)

    rows = []
    for page in results:
        props = page.get("properties", {})
        row = {}
        for key, val in props.items():
            t = val.get("type")
            if t == "title":
                row[key] = "".join(rt.get("plain_text","") for rt in val.get("title",[]))
            elif t == "rich_text":
                row[key] = "".join(rt.get("plain_text","") for rt in val.get("rich_text",[]))
            elif t == "number":
                row[key] = val.get("number")
            elif t == "date":
                row[key] = (val.get("date") or {}).get("start")
            elif t == "select":
                row[key] = (val.get("select") or {}).get("name")
            elif t == "multi_select":
                row[key] = [o.get("name") for o in val.get("multi_select",[])]
            elif t == "checkbox":
                row[key] = val.get("checkbox")
            elif t == "formula":
                fv = val.get("formula",{})
                row[key] = fv.get(fv.get("type"), None)
            else:
                row[key] = None
        rows.append(row)

    print(f"Parsed {len(rows)} rows", flush=True)
    if rows:
        print(f"Sample: {json.dumps(rows[0], ensure_ascii=False)[:300]}", flush=True)

    with open("sociedad_data.json", "w") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print("Done", flush=True)
except Exception as ex:
    traceback.print_exc()
    sys.exit(1)
