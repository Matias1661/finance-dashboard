"""
Sync finance data to finance_data.json

Fuentes:
  - Movimientos: Notion (DB "Movimientos", via API REST)
  - Inversiones: Google Sheets (col A=fecha, D=Peerberry, E=MyInvestor, F=CaixaBank)
    Cada fuente puede estar en filas separadas del mismo mes.
    Toma el ultimo valor no-nulo de cada columna por mes.

Output finance_data.json:
  {
    "movimientos": [...],
    "inversiones": {
      "capital": [
        { "mes": "2025-07", "peerberry": 13011, "myinvestor": 4926 },
        ...
      ],
      "rendimiento": [
        { "mes": "2025-08", "peerberry": -9.80, "myinvestor": 0.76 },
        ...
      ],
      "ganancia": [
        { "mes": "2025-08", "peerberry": 32.58, "myinvestor": 14.20,
          "peerberry_aportes": 0, "myinvestor_aportes": null,
          "peerberry_capital": 4932.59, "myinvestor_capital": 14961 },
        ...
      ],
      "kpi": {
        "pct_ultimo_mes": 1.8, "pct_12m": 15.2,
        "ganancia_12m": 1650.4, "capital_actual": 20567.08,
        "por_plataforma": { "peerberry": {...}, "myinvestor": {...} }
      }
    }
  }

"ganancia" y "kpi" vienen de la DB Notion "Rendimiento Inversiones", agregando
por mes calendario (fila Mensual si existe; si no, suma de filas Semanales de
Peerberry). "kpi" reemplaza el antiguo "Ahorro real 12m": solo rentabilidad
porcentual (ultimo mes y TWR 12m compuesto) y ganancia en EUR — sin descomponer
aportado, que requeria reconciliar Movimientos y no era confiable (ver
DECISIONS.md 2026-07-06). "capital" y "rendimiento" (%) siguen viniendo del
Sheet sin cambios (tab Inversiones, no tocado).
"""

import os, json, re
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID          = os.environ["SHEET_ID"]
FINANZAS_SHEET    = "Inversiones"
SA_JSON           = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT"])

NOTION_TOKEN               = os.environ["NOTION_TOKEN"]
NOTION_DATA_SOURCE_ID      = os.environ["NOTION_MOVIMIENTOS_DATA_SOURCE_ID"]
NOTION_RENDIMIENTO_DS_ID   = os.environ.get("NOTION_RENDIMIENTO_DATA_SOURCE_ID")
NOTION_VERSION             = "2025-09-03"

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

MESES_ES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
}


def get_service():
    creds = service_account.Credentials.from_service_account_info(SA_JSON, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def read_range(service, sheet_name, cell_range="A:Z"):
    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range=f"{sheet_name}!{cell_range}"
    ).execute()
    return result.get("values", [])


def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    if m:
        return raw
    return None


def parse_amount(raw):
    if raw is None or str(raw).strip() == "":
        return None
    raw = str(raw).strip().replace("€", "").replace("$", "").replace(" ", "")
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_pct(raw):
    if raw is None or str(raw).strip() in ("", "-", "0"):
        return None
    raw = str(raw).strip().replace("%", "").replace(",", ".").replace(" ", "")
    try:
        return round(float(raw), 4)
    except ValueError:
        return None


def parse_mes_label(raw):
    """-agosto-25 o ago-25 -> 2025-08"""
    raw = raw.strip().lower()
    raw = re.sub(r"[^a-z0-9 ]", " ", raw).strip()
    parts = raw.split()
    mes_num = None
    year_2d = None
    for p in parts:
        if p in MESES_ES:
            mes_num = MESES_ES[p]
            continue
        for k, v in MESES_ES.items():
            if len(p) >= 3 and k.startswith(p):
                mes_num = v
                break
        if re.match(r"^\d{2}$", p):
            year_2d = p
        if re.match(r"^\d{4}$", p):
            return f"{p}-{mes_num}" if mes_num else None
    if mes_num and year_2d:
        return f"20{year_2d}-{mes_num}"
    return None


def fetch_movimientos_notion():
    """Lee todas las paginas de la data source Movimientos via API REST de Notion."""
    url = f"https://api.notion.com/v1/data_sources/{NOTION_DATA_SOURCE_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }

    results = []
    payload = {"page_size": 100}
    while True:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data["next_cursor"]

    return results


def fetch_rendimiento_inversiones_notion():
    """Lee todas las paginas de la DB Notion 'Rendimiento Inversiones' via API REST,
    sin filtrar por Periodo. Desde 2026-07-06, Peerberry se carga como filas
    Semanales (un reporte real por lunes) y MyInvestor como Mensual; el filtro
    anterior por Periodo=Mensual descartaba las semanas de Peerberry, que ahora
    son la fuente primaria para meses sin backfill Mensual (ver DECISIONS.md)."""
    url = f"https://api.notion.com/v1/data_sources/{NOTION_RENDIMIENTO_DS_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }
    payload = {"page_size": 100}

    results = []
    while True:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data["next_cursor"]

    return results


def _extract_rendimiento_row(page):
    """Extrae los campos relevantes de una pagina de 'Rendimiento Inversiones'."""
    props = page.get("properties", {})

    fecha_prop = props.get("Fecha reporte", {}).get("date")
    fecha = fecha_prop["start"][:10] if fecha_prop and fecha_prop.get("start") else None

    plataforma_select = props.get("Plataforma", {}).get("select")
    plataforma = plataforma_select["name"] if plataforma_select else None

    periodo_select = props.get("Periodo", {}).get("select")
    periodo = periodo_select["name"] if periodo_select else None

    if not fecha or plataforma not in ("Peerberry", "MyInvestor"):
        return None

    return {
        "fecha":      fecha,
        "plataforma": plataforma,
        "periodo":    periodo,
        "ganancia":   props.get("Ganancia", {}).get("number"),
        "aportes":    props.get("Aportes", {}).get("number"),
        "capital":    props.get("Capital total", {}).get("number"),
    }


def _aggregate_rendimiento_by_month(pages):
    """Agrega filas de 'Rendimiento Inversiones' por mes calendario y plataforma.

    Regla de agregacion (ver DECISIONS.md 2026-07-06):
    - Si existe una fila Mensual para esa plataforma/mes, se usa tal cual
      (backfill historico ya verificado contra los mails de resumen).
    - Si no existe fila Mensual, se suman las filas Semanales cuyo
      'Fecha reporte' (fin del periodo semanal) cae en ese mes calendario.
      No hace falta ningun ajuste de atribucion: 'Fecha reporte' ya es la
      fecha de cierre real de cada semana, a diferencia de las fechas de
      envio usadas en el backfill Mensual antiguo.
    - Capital de cada mes/plataforma: el valor de la fila mas reciente
      (Semanal o Mensual) dentro de ese mes.
    - Aportes: se suman igual que Ganancia. Las filas Mensuales cargadas
      antes de este cambio no tienen Aportes (aportes_known=False); el
      consumidor puede aproximarlo como delta de capital menos ganancia.

    Devuelve { mes: { "peerberry": {...}, "myinvestor": {...} } }.
    """
    rows = [r for r in (_extract_rendimiento_row(p) for p in pages) if r]
    mensual = [r for r in rows if r["periodo"] == "Mensual"]
    semanal = [r for r in rows if r["periodo"] == "Semanal"]

    by_month = {}
    mensual_keys = set()

    def plat_key(p):
        return "peerberry" if p == "Peerberry" else "myinvestor"

    def ensure(mk):
        if mk not in by_month:
            by_month[mk] = {
                "peerberry":  {"ganancia": 0.0, "aportes": 0.0, "aportes_known": False, "capital": None, "capital_fecha": None},
                "myinvestor": {"ganancia": 0.0, "aportes": 0.0, "aportes_known": False, "capital": None, "capital_fecha": None},
            }
        return by_month[mk]

    for r in mensual:
        mk = r["fecha"][:7]
        pk = plat_key(r["plataforma"])
        entry = ensure(mk)[pk]
        entry["ganancia"] += r["ganancia"] or 0.0
        if r["aportes"] is not None:
            entry["aportes"] += r["aportes"]
            entry["aportes_known"] = True
        if r["capital"] is not None:
            entry["capital"] = r["capital"]
            entry["capital_fecha"] = r["fecha"]
        mensual_keys.add((mk, pk))

    for r in semanal:
        mk = r["fecha"][:7]
        pk = plat_key(r["plataforma"])
        if (mk, pk) in mensual_keys:
            continue
        entry = ensure(mk)[pk]
        entry["ganancia"] += r["ganancia"] or 0.0
        if r["aportes"] is not None:
            entry["aportes"] += r["aportes"]
            entry["aportes_known"] = True
        if r["capital"] is not None:
            if entry["capital_fecha"] is None or r["fecha"] >= entry["capital_fecha"]:
                entry["capital"] = r["capital"]
                entry["capital_fecha"] = r["fecha"]

    return by_month


def build_ganancia_inversiones(by_month):
    """Serializa by_month a la lista { mes, peerberry, myinvestor, ... } que
    consume el grafico de Ganancia del tab Inversiones (formato retrocompatible,
    con aportes y capital agregados como campos nuevos)."""
    result = []
    for mk in sorted(by_month.keys()):
        pb, mi = by_month[mk]["peerberry"], by_month[mk]["myinvestor"]
        result.append({
            "mes":                mk,
            "peerberry":          round(pb["ganancia"], 2),
            "myinvestor":         round(mi["ganancia"], 2),
            "peerberry_aportes":  round(pb["aportes"], 2) if pb["aportes_known"] else None,
            "myinvestor_aportes": round(mi["aportes"], 2) if mi["aportes_known"] else None,
            "peerberry_capital":  pb["capital"],
            "myinvestor_capital": mi["capital"],
        })
    return result


def _monthly_totals(by_month):
    """Serie mensual ordenada de {mes, capital, ganancia, aportes} a nivel
    total cartera y por plataforma, para el calculo de KPIs."""
    out = {"total": [], "peerberry": [], "myinvestor": []}
    for mk in sorted(by_month.keys()):
        pb, mi = by_month[mk]["peerberry"], by_month[mk]["myinvestor"]
        pb_cap = pb["capital"] or 0
        mi_cap = mi["capital"] or 0
        out["peerberry"].append({
            "mes": mk, "capital": pb_cap, "ganancia": pb["ganancia"],
            "aportes": pb["aportes"] if pb["aportes_known"] else None
        })
        out["myinvestor"].append({
            "mes": mk, "capital": mi_cap, "ganancia": mi["ganancia"],
            "aportes": mi["aportes"] if mi["aportes_known"] else None
        })
        # Solo se suma si AMBAS plataformas tienen Aportes conocido: sumar con
        # un 0 implicito para la plataforma sin dato subestimaria el total
        # (ej. mientras MyInvestor historico no tenga Aportes cargado).
        aportes_total = None
        if pb["aportes_known"] and mi["aportes_known"]:
            aportes_total = pb["aportes"] + mi["aportes"]
        out["total"].append({
            "mes": mk, "capital": pb_cap + mi_cap,
            "ganancia": pb["ganancia"] + mi["ganancia"],
            "aportes": aportes_total
        })
    return out


def _kpi_from_series(months):
    """A partir de una serie mensual [{mes, capital, ganancia, aportes}]
    calcula: % ultimo mes, % 12m compuesto (TWR encadenando retornos
    mensuales), ganancia y aportes acumulados de los ultimos 12 meses.

    Rentabilidad mensual = Ganancia(mes) / Capital al cierre del mes anterior.
    El primer mes de la serie no tiene mes anterior y queda fuera del calculo
    de rentabilidad (solo aporta a ganancia/aportes si cae en la ventana 12m).
    """
    if not months:
        return None

    returns = []
    for i in range(1, len(months)):
        prev_capital = months[i - 1]["capital"]
        if prev_capital:
            returns.append(months[i]["ganancia"] / prev_capital)

    pct_ultimo_mes = round(returns[-1] * 100, 2) if returns else None

    last12_returns = returns[-12:]
    pct_12m = None
    if last12_returns:
        acc = 1.0
        for r in last12_returns:
            acc *= (1 + r)
        pct_12m = round((acc - 1) * 100, 2)

    last12_months = months[-12:]
    ganancia_12m = round(sum(m["ganancia"] for m in last12_months), 2)

    return {
        "pct_ultimo_mes":        pct_ultimo_mes,
        "pct_12m":               pct_12m,
        "ganancia_12m":          ganancia_12m,
        "capital_actual":        months[-1]["capital"],
        "periodo_ultimo_mes":    months[-1]["mes"]
    }


def build_kpi_inversiones(by_month):
    """KPI de rentabilidad para el tab Resumen: % ultimo mes, % 12m (TWR) y
    descomposicion aportado/generado, a nivel total con desglose por
    plataforma (reemplaza 'Ahorro real 12m', ver DECISIONS.md 2026-07-06)."""
    series = _monthly_totals(by_month)
    total = _kpi_from_series(series["total"])
    if total is None:
        return None
    total["por_plataforma"] = {
        "peerberry":  _kpi_from_series(series["peerberry"]),
        "myinvestor": _kpi_from_series(series["myinvestor"]),
    }
    return total


def build_movimientos(pages):
    """Convierte paginas de Notion (propiedades Fecha/Concepto/Monto/Categoria/Nota) a records."""
    records = []
    for page in pages:
        props = page.get("properties", {})

        fecha_prop = props.get("Fecha", {}).get("date")
        fecha = fecha_prop["start"][:10] if fecha_prop and fecha_prop.get("start") else None

        concepto_title = props.get("Concepto", {}).get("title", [])
        concepto = "".join(t.get("plain_text", "") for t in concepto_title).strip()

        monto = props.get("Monto", {}).get("number")

        categoria_select = props.get("Categoria", {}).get("select")
        categoria = categoria_select["name"] if categoria_select else None

        nota_rich = props.get("Nota", {}).get("rich_text", [])
        nota = "".join(t.get("plain_text", "") for t in nota_rich).strip()

        if not fecha or monto is None:
            continue

        records.append({
            "fecha":     fecha,
            "concepto":  concepto,
            "monto":     monto,
            "categoria": categoria or None,
            "nota":      nota or None
        })

    records.sort(key=lambda r: r["fecha"], reverse=True)
    return records


def build_inversiones(rows):
    """
    Capital: col A=fecha, D=Peerberry (idx 3), E=MyInvestor (idx 4).
    Cada fuente puede estar en filas separadas dentro del mismo mes.
    Se acumula el ultimo valor no-nulo de cada columna por mes.

    Rendimiento %: busca fila cabecera con 'peerberry' y '%',
    lee columnas Mes / Peerberry% / MyInvestor%.
    """
    if not rows:
        return {"capital": [], "rendimiento": []}

    # Capital: acumular el ultimo valor no-nulo de cada columna por mes
    # estructura: { "2025-07": {"pb_fecha": "2025-07-31", "pb": 13011, "mi_fecha": "2025-07-31", "mi": 4926} }
    month_data = {}

    for row in rows:
        fecha = parse_date(row[0]) if len(row) > 0 else None
        if not fecha:
            continue
        mk = fecha[:7]

        pb = parse_amount(row[3]) if len(row) > 3 else None
        mi = parse_amount(row[4]) if len(row) > 4 else None

        if pb is None and mi is None:
            continue

        if mk not in month_data:
            month_data[mk] = {"pb": None, "pb_fecha": None, "mi": None, "mi_fecha": None}

        # Actualizar Peerberry si esta fila tiene valor y es mas reciente
        if pb is not None:
            if month_data[mk]["pb_fecha"] is None or fecha >= month_data[mk]["pb_fecha"]:
                month_data[mk]["pb"] = pb
                month_data[mk]["pb_fecha"] = fecha

        # Actualizar MyInvestor si esta fila tiene valor y es mas reciente
        if mi is not None:
            if month_data[mk]["mi_fecha"] is None or fecha >= month_data[mk]["mi_fecha"]:
                month_data[mk]["mi"] = mi
                month_data[mk]["mi_fecha"] = fecha

    capital = []
    for mk in sorted(month_data.keys()):
        e = month_data[mk]
        pb_val = e["pb"] if e["pb"] is not None else 0
        mi_val = e["mi"] if e["mi"] is not None else 0
        if pb_val == 0 and mi_val == 0:
            continue
        capital.append({"mes": mk, "peerberry": pb_val, "myinvestor": mi_val})

    # Rendimiento %: detectar fila cabecera
    pct_header_idx = None
    pct_mes_col = pct_pb_col = pct_mi_col = None

    for i, row in enumerate(rows):
        row_lower = [str(c).lower().strip() for c in row]
        if any("peerberry" in c and "%" in c for c in row_lower):
            pct_header_idx = i
            for j, c in enumerate(row_lower):
                if c == "mes":
                    pct_mes_col = j
                elif "peerberry" in c and "%" in c:
                    pct_pb_col = j
                elif ("myinvestor" in c or ("my" in c and "investor" in c)) and "%" in c:
                    pct_mi_col = j
            break

    rendimiento = []
    if pct_header_idx is not None and pct_mes_col is not None:
        for row in rows[pct_header_idx + 1:]:
            if pct_mes_col >= len(row):
                continue
            mes_raw = str(row[pct_mes_col]).strip()
            if not mes_raw:
                continue
            mes_iso = parse_mes_label(mes_raw)
            if not mes_iso:
                continue
            pb_pct = parse_pct(row[pct_pb_col] if pct_pb_col is not None and pct_pb_col < len(row) else None)
            mi_pct = parse_pct(row[pct_mi_col] if pct_mi_col is not None and pct_mi_col < len(row) else None)
            if pb_pct is None and mi_pct is None:
                continue
            rendimiento.append({
                "mes":        mes_iso,
                "peerberry":  pb_pct if pb_pct is not None else 0,
                "myinvestor": mi_pct if mi_pct is not None else 0
            })

    rendimiento.sort(key=lambda r: r["mes"])
    return {"capital": capital, "rendimiento": rendimiento}


if __name__ == "__main__":
    try:
        print("Leyendo Movimientos (Notion)...")
        mov_pages = fetch_movimientos_notion()
        print(f"  {len(mov_pages)} paginas")
        movimientos = build_movimientos(mov_pages)
        print(f"  {len(movimientos)} registros validos")

        service = get_service()

        print("Leyendo Inversiones (Sheets)...")
        try:
            fin_rows = read_range(service, FINANZAS_SHEET)
            print(f"  {len(fin_rows)} filas")
            inversiones = build_inversiones(fin_rows)
            print(f"  {len(inversiones['capital'])} meses de capital")
            print(f"  {len(inversiones['rendimiento'])} meses de rendimiento")
        except Exception as fin_err:
            print(f"  AVISO: no se pudo leer hoja Inversiones: {fin_err}")
            inversiones = {"capital": [], "rendimiento": []}

        print("Leyendo Rendimiento Inversiones (Notion, Ganancia/Aportes/Capital)...")
        try:
            if not NOTION_RENDIMIENTO_DS_ID:
                raise RuntimeError("falta env var NOTION_RENDIMIENTO_DATA_SOURCE_ID")
            rend_pages = fetch_rendimiento_inversiones_notion()
            print(f"  {len(rend_pages)} paginas (Semanal + Mensual)")
            by_month = _aggregate_rendimiento_by_month(rend_pages)
            inversiones["ganancia"] = build_ganancia_inversiones(by_month)
            inversiones["kpi"] = build_kpi_inversiones(by_month)
            print(f"  {len(inversiones['ganancia'])} meses agregados")
        except Exception as rend_err:
            print(f"  AVISO: no se pudo leer Rendimiento Inversiones: {rend_err}")
            inversiones["ganancia"] = []
            inversiones["kpi"] = None

        output = {
            "generated_at": datetime.now(ZoneInfo("Europe/Madrid")).strftime("%Y-%m-%d %H:%M"),
            "movimientos": movimientos,
            "inversiones": inversiones
        }

        with open("finance_data.json", "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print("finance_data.json actualizado.")
    except Exception as e:
        print(f'Error: {e}')
        raise


