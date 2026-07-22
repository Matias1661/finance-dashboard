#!/usr/bin/env python3
"""
Encuentra movimientos pendientes de revisar para el flujo "Organizar Movimientos".

Lee finance_data.json + reviewed_movements.json + TRIP_WINDOWS (extraído de js/app.js)
del repo finance-dashboard y hace TODO el cruce mecánicamente:
  1. Movimientos no presentes en reviewed_movements.json (clave fecha|concepto|monto)
  2. Exclusión de categorías Guille / Inversion / Talho Argentino / Suscripciones
  3. Flag forzado para PAYPAL, UBR*, UBER *, AMAZON, AMZN, WWW.AMAZON (aunque estén en categoría excluida)
  4. Cruce contra TRIP_WINDOWS (con buffer de 3 días) -> marca cuáles caen dentro de un viaje

Uso:
    python3 find_pending.py --github-token TOKEN
    (o dejar GITHUB_TOKEN en variable de entorno; sin token también funciona para repos públicos,
    pero con más riesgo de rate limit)

No escribe nada. Solo genera el listado para que el agente lo presente al usuario antes de tocar Notion.
"""
import argparse
import base64
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta

REPO = "Matias1661/finance-dashboard"
API = f"https://api.github.com/repos/{REPO}/contents"

EXCLUDE_CATS = {"Guille", "Inversion", "Talho Argentino", "Suscripciones"}
FLAG_ALWAYS = ["PAYPAL", "UBR", "UBER ", "AMAZON", "AMZN", "WWW.AMAZON"]
CARD_BUFFER_DAYS = 3


def gh_get(path, token=None):
    req = urllib.request.Request(f"{API}/{path}")
    if token:
        req.add_header("Authorization", f"token {token}")
    with urllib.request.urlopen(req) as r:
        d = json.load(r)
    return base64.b64decode(d["content"]).decode("utf-8"), d.get("sha")


def parse_trip_windows(app_js_content):
    """Extrae el array TRIP_WINDOWS de js/app.js sin necesitar un parser JS completo."""
    m = re.search(r"const TRIP_WINDOWS\s*=\s*\[(.*?)\];", app_js_content, re.S)
    if not m:
        return []
    block = m.group(1)
    windows = []
    for row in re.finditer(
        r"name:\s*'([^']*)'.*?start:\s*'([^']*)'.*?end:\s*'([^']*)'", block
    ):
        windows.append({"name": row.group(1), "start": row.group(2), "end": row.group(3)})
    return windows


def get_trip_for_date(fecha, trip_windows):
    for t in trip_windows:
        if fecha < t["start"]:
            continue
        end_dt = datetime.strptime(t["end"], "%Y-%m-%d") + timedelta(days=CARD_BUFFER_DAYS)
        end_buffered = end_dt.strftime("%Y-%m-%d")
        if fecha <= end_buffered:
            return t["name"]
    return None


def make_key(m):
    return f"{m['fecha']}|{m['concepto']}|{float(m['monto'])}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--github-token", default=None)
    args = parser.parse_args()
    token = args.github_token

    finance_raw, _ = gh_get("finance_data.json", token)
    reviewed_raw, _ = gh_get("reviewed_movements.json", token)
    app_js_raw, _ = gh_get("js/app.js", token)

    finance_data = json.loads(finance_raw)
    reviewed = set(json.loads(reviewed_raw))
    trip_windows = parse_trip_windows(app_js_raw)

    movs = finance_data["movimientos"]
    pending = []

    for m in movs:
        key = make_key(m)
        if key in reviewed:
            continue
        cat = m.get("categoria") or ""
        concepto_upper = (m.get("concepto") or "").upper()
        always_flag = any(f in concepto_upper for f in FLAG_ALWAYS)
        if cat in EXCLUDE_CATS and not always_flag:
            continue
        trip = get_trip_for_date(m["fecha"], trip_windows)
        pending.append({**m, "flag_always": always_flag, "trip": trip})

    print(f"Movimientos pendientes: {len(pending)}\n")
    print(f"{'Fecha':<12} {'Concepto':<22} {'Monto':>10}  {'Categoria':<20} {'Nota':<30} {'Flag':<6} Viaje")
    for m in pending:
        print(
            f"{m['fecha']:<12} {m['concepto'][:22]:<22} {m['monto']:>10.2f}  "
            f"{(m['categoria'] or ''):<20} {(m.get('nota') or ''):<30} "
            f"{'SI' if m['flag_always'] else '':<6} {m['trip'] or ''}"
        )

    en_viaje = [m for m in pending if m["trip"]]
    if en_viaje:
        print(f"\n⚠ {len(en_viaje)} movimiento(s) caen dentro de una ventana de viaje (TRIP_WINDOWS). Revisar antes de categorizar.")

    with open("pending_movements.json", "w", encoding="utf-8") as f:
        json.dump(pending, f, ensure_ascii=False, indent=2)
    print("\nGuardado en pending_movements.json")


if __name__ == "__main__":
    main()
