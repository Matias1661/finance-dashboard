"""
sync_sociedad_data.py
Lee la DB de Notion "Gastos del local" y genera sociedad_data.json.
"""
import json
import os
import urllib.request
import urllib.error

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_DB_ID = os.environ.get("NOTION_DB_ID", "38933ce50e6880b9899beedec9156145")
OUT_FILE = "sociedad_data.json"


def notion_query(cursor=None):
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    body = {
        "page_size": 100,
        "sorts": [{"property": "Fecha", "direction": "ascending"}],
    }
    if cursor:
        body["start_cursor"] = cursor

    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {NOTION_TOKEN}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def parse_row(page):
    props = page["properties"]
    fecha_raw = (props.get("Fecha") or {}).get("date") or {}
    fecha = fecha_raw.get("start") or ""
    # Keep only date part (YYYY-MM-DD) in case it's a datetime
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

    while True:
        data = notion_query(cursor)
        for page in data.get("results", []):
            row = parse_row(page)
            if row["fecha"]:  # skip rows without date
                rows.append(row)
        if data.get("has_more"):
            cursor = data["next_cursor"]
        else:
            break

    # Sort by date ascending
    rows.sort(key=lambda r: r["fecha"])

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"sociedad_data.json — {len(rows)} registros escritos.")


if __name__ == "__main__":
    main()
