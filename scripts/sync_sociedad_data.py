import os, json, urllib.request, urllib.error, traceback, sys
try:
    token = os.environ["NOTION_TOKEN"]
    db_id = "38933ce50e6880b9899beedec9156145"
    print(f"START token={token[:12]}...", flush=True)
    body = json.dumps({"page_size": 5}).encode()
    req = urllib.request.Request(f"https://api.notion.com/v1/databases/{db_id}/query", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")
    print("Sending request...", flush=True)
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
    print(f"Got {len(d['results'])} rows", flush=True)
    with open("sociedad_data.json", "w") as f:
        json.dump(d["results"], f)
    print("Done", flush=True)
except Exception as ex:
    traceback.print_exc()
    sys.exit(1)
