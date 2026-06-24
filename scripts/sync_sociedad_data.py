"""
sync_sociedad_data.py
Lee la DB de Notion "Gastos del local" y genera sociedad_data.json.
"""
import json
import os
import sys
import urllib.request
import urllib.error

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_DB_ID = os.environ.get("NOTION_DB_ID", "38933ce50e6880b9899beedec9156145")
OUT_FILE = "sociedad_data.json"

print(f"DB ID  : {NOTION_DB_ID}", flush=True)
print(f"Token  : {NOTION_TOKEN[:15]}...", flush=True)


def notion_query(cursor=None):
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    body = {
        "page_size": 100,
        "sorts": [{"property": "Fecha", "direction": "ascending"}],
    }
    if cursor:
        body["start_cursor"] = cursor

    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {NOTION_TOKEN}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            print(f"Notion HTTP 200, bytes={len(raw)}", flush=True)
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        print(f"Notion HTTP {e.code}: {body_bytes.decode()}", flush=True)
        sys.exit(1)
    except Exception as ex:
        print(f"Notion request error: {ex}", flush=True)
        sys.exit(1)


def parse_row(page):
    props = page["properties"]
    fecha_raw = (props.get("Fecha") or {}).get("date") or {}
    fecha = fecha_raw.get("start") or ""
    if fecha:
        fecha = fecha[:10]
    costo = (props.get("Costo") or {}).get("number") or 0
    pagado_sel = (props.get("Pagado por") or {}).get("select") or {}
    pagado = pagado_sel.get("name") or "Otro"
    title_arr = (props.get("Concepto") or {}).get("title") or []
    concepto = title_arr[0]["plain_text"] if title_arr else ""
    return {"fecha": fecha, "costo": costo, "pagado": pagado, "concepto": concepto}


def main():
    rows = []
    cursor = None
    page_num = 0

    while True:
        page_num += 1
        print(f"Fetching page {page_num}...", flush=True)
        data = notion_query(cursor)
        results = data.get("results", [])
        print(f"  Got {len(results)} rows, has_more={data.get('has_more')}", flush=True)
        for page in results:
            row = parse_row(page)
            if row["fecha"]:
                rows.append(row)
        if data.get("has_more"):
            cursor = data["next_cursor"]
        else:
            break

    rows.sort(key=lambda r: r["fecha"])

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"Done — {len(rows)} registros escritos en {OUT_FILE}.", flush=True)


if __name__ == "__main__":
    main()
