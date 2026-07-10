"""
Sync finance data to finance_data.json

Fuentes:
  - Movimientos: Notion (DB "Movimientos", via API REST)
  - Inversiones (capital, rendimiento %, ganancia, kpi): Notion (DB "Rendimiento
    Inversiones", via API REST). Migrado desde Google Sheets el 2026-07-10
    (auditoria 2026-07, fila 4) — ver docs/DECISIONS.md para el detalle y las
    limitaciones aceptadas (historial de capital arranca en diciembre 2024,
    el Sheet tenia desde marzo 2024; el % de rendimiento cambia respecto al
    valor historico del Sheet porque esa columna mezclaba depositos y
    rentabilidad real).

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

"ganancia", "kpi", "capital" y "rendimiento" vienen todos de la DB Notion
"Rendimiento Inversiones", agregando por mes calendario (fila Mensual si
existe; si no, suma de filas Semanales de Peerberry). "kpi" reemplaza el
antiguo "Ahorro real 12m": solo rentabilidad porcentual (ultimo mes y TWR 12m
compuesto) y ganancia en EUR — sin descomponer aportado, que requeria
reconciliar Movimientos y no era confiable (ver DECISIONS.md 2026-07-06).
"""

import os, json, re
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

NOTION_TOKEN               = os.environ["NOTION_TOKEN"]
NOTION_DATA_SOURCE_ID      = os.environ["NOTION_MOVIMIENTOS_DATA_SOURCE_ID"]
NOTION_RENDIMIENTO_DS_ID   = os.environ.get("NOTION_RENDIMIENTO_DATA_SOURCE_ID")
NOTION_VERSION             = "2025-09-03"


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

    Rentabilidad mensual = Ganancia(mes) / saldo medio del mes, aproximado
    como promedio entre capital de cierre del mes anterior y capital de
    cierre de este mes. Alineado con la metodologia que MyInvestor usa en
    sus propios mails ("Beneficio (€) entre Saldo medio (€)") y con el
    mismo calculo ya usado en build_rendimiento_mensual() para el grafico
    de rentabilidad mensual del tab Inversiones. Antes se dividia por el
    capital de cierre del mes anterior, lo que generaba valores distintos
    entre el KPI de Resumen y el grafico para el mismo mes. Ver
    DECISIONS.md 2026-07-08.
    El primer mes de la serie no tiene mes anterior y queda fuera del calculo
    de rentabilidad (solo aporta a ganancia/aportes si cae en la ventana 12m).
    """
    if not months:
        return None

    returns = []
    for i in range(1, len(months)):
        prev_capital = months[i - 1]["capital"]
        cur_capital = months[i]["capital"]
        avg_capital = (prev_capital + cur_capital) / 2 if (prev_capital or cur_capital) else 0
        if avg_capital:
            returns.append(months[i]["ganancia"] / avg_capital)

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


def _last_complete_month(by_month, current_month):
    """Devuelve el ultimo mes calendario anterior al actual que ya tiene
    reporte Mensual de MyInvestor (capital no nulo). MyInvestor reporta los
    primeros dias del mes siguiente; hasta que ese reporte llega, el mes
    recien cerrado queda incompleto y no debe mostrarse como 'ultimo mes'
    (mostraria ganancia 0 o parcial). Si ningun mes anterior tiene MyInvestor
    completo, devuelve el ultimo mes anterior al actual disponible (fallback)."""
    anteriores = sorted(mk for mk in by_month if mk < current_month)
    if not anteriores:
        return None
    for mk in reversed(anteriores):
        if by_month[mk]["myinvestor"]["capital"] is not None:
            return mk
    return anteriores[-1]


def _calendar_prev_month(mk):
    y, m = int(mk[:4]), int(mk[5:7])
    if m == 1:
        return f"{y-1}-12"
    return f"{y}-{m-1:02d}"


def build_rendimiento_mensual(by_month):
    """Rentabilidad mensual por plataforma para el grafico de barras agrupadas
    del tab Inversiones (debajo del de Capital), mas curva de TWR acumulado.

    Un mes se incluye solo si MyInvestor ya reporto ese mes (capital no nulo),
    igual criterio que 'mes completo' usado en el KPI de Resumen.

    % MyInvestor = Ganancia del mes / saldo medio del mes, aproximado como
    promedio entre capital de cierre del mes anterior y capital de cierre de
    este mes. Esto replica la metodologia que MyInvestor usa en sus propios
    mails ("Beneficio (€) entre Saldo medio (€)"), en vez de dividir por el
    capital de cierre del mes anterior (que no es lo que ellos reportan y
    distorsiona el % cuando hay aportes grandes a mitad de mes). Ver
    DECISIONS.md 2026-07-08.
    % Peerberry  = misma logica, ya usaba promedio de 2 puntos.

    Acumulado = TWR compuesto del retorno total mensual (ganancia total del
    mes / saldo medio total del mes, mismo promedio de 2 puntos), encadenado
    desde el primer mes incluido.

    total = el mismo retorno total mensual (ganancia Peerberry + MyInvestor
    / saldo medio total del mes) SIN encadenar, para marcar en el grafico
    como indicador de "como fue ese mes en conjunto" independiente del
    acumulado historico.

    acumulado_anio = mismo TWR compuesto que 'acumulado', pero reiniciado a
    0% en enero de cada anio calendario. Permite comparar la forma de la
    curva de un anio contra otro (ej. 2025 vs lo que va de 2026) sin que el
    acumulado historico de anios previos distorsione la comparacion.
    """
    meses_completos = sorted(
        mk for mk, v in by_month.items() if v["myinvestor"]["capital"] is not None
    )

    result = []
    acc = 1.0
    acc_year = 1.0
    current_year = None
    for mk in meses_completos:
        prev_mk = _calendar_prev_month(mk)
        prev = by_month.get(prev_mk)
        cur = by_month[mk]

        year = mk[:4]
        if year != current_year:
            current_year = year
            acc_year = 1.0

        pct_mi = None
        if prev is not None and prev["myinvestor"]["capital"] is not None and cur["myinvestor"]["capital"] is not None:
            avg_capital_mi = (prev["myinvestor"]["capital"] + cur["myinvestor"]["capital"]) / 2
            if avg_capital_mi:
                pct_mi = round(cur["myinvestor"]["ganancia"] / avg_capital_mi * 100, 2)

        pct_pb = None
        if prev is not None and prev["peerberry"]["capital"] is not None and cur["peerberry"]["capital"] is not None:
            avg_capital = (prev["peerberry"]["capital"] + cur["peerberry"]["capital"]) / 2
            if avg_capital:
                pct_pb = round(cur["peerberry"]["ganancia"] / avg_capital * 100, 2)

        acumulado = None
        acumulado_anio = None
        total_mes = None
        if prev is not None:
            prev_capital_total = (prev["peerberry"]["capital"] or 0) + (prev["myinvestor"]["capital"] or 0)
            cur_capital_total = (cur["peerberry"]["capital"] or 0) + (cur["myinvestor"]["capital"] or 0)
            avg_capital_total = (prev_capital_total + cur_capital_total) / 2
            if avg_capital_total:
                ganancia_total = cur["peerberry"]["ganancia"] + cur["myinvestor"]["ganancia"]
                ret_total = ganancia_total / avg_capital_total
                total_mes = round(ret_total * 100, 2)
                acc *= (1 + ret_total)
                acumulado = round((acc - 1) * 100, 2)
                acc_year *= (1 + ret_total)
                acumulado_anio = round((acc_year - 1) * 100, 2)



        sin_aportes_pb = bool(cur["peerberry"]["aportes_known"]) and cur["peerberry"]["aportes"] == 0
        sin_aportes_mi = bool(cur["myinvestor"]["aportes_known"]) and cur["myinvestor"]["aportes"] == 0

        result.append({
            "mes":               mk,
            "peerberry":         pct_pb,
            "myinvestor":        pct_mi,
            "total":             total_mes,
            "acumulado":         acumulado,
            "acumulado_anio":    acumulado_anio,
            "sin_aportes_pb":    sin_aportes_pb,
            "sin_aportes_mi":    sin_aportes_mi
        })

    return result


def build_kpi_inversiones(by_month):
    """KPI de rentabilidad para el tab Resumen: % ultimo mes, % 12m (TWR) y
    descomposicion aportado/generado, a nivel total con desglose por
    plataforma (reemplaza 'Ahorro real 12m', ver DECISIONS.md 2026-07-06).

    El 'ultimo mes' siempre es el ultimo mes calendario completo (nunca el
    mes en curso, aunque Peerberry ya haya cargado reportes semanales de
    ese mes), y solo una vez que MyInvestor reporto ese mes. Ver
    DECISIONS.md 2026-07-07 (mes completo vs mes en curso)."""
    if not by_month:
        return None
    current_month = datetime.now(ZoneInfo("Europe/Madrid")).strftime("%Y-%m")
    target = _last_complete_month(by_month, current_month)
    if target is None:
        return None
    filtered = {mk: v for mk, v in by_month.items() if mk <= target}
    series = _monthly_totals(filtered)
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


def build_inversiones(by_month):
    """
    Migrado de Google Sheets a Notion el 2026-07-10 (auditoria 2026-07, fila 4).
    Antes leia la hoja "Inversiones" del Sheet con parseo posicional fragil.
    Ahora deriva capital y rendimiento (%) de `by_month`, la misma estructura
    que ya construye `_aggregate_rendimiento_by_month()` desde la DB Notion
    "Rendimiento Inversiones" para `ganancia`/`kpi`/`rendimiento_mensual`.

    Capital: ultimo valor de "Capital total" reportado por plataforma en cada
    mes calendario (ya resuelto en by_month[mes][plataforma]["capital"]).

    Rendimiento %: ganancia del mes / saldo medio (promedio entre capital de
    cierre del mes anterior y el actual) — misma metodologia que
    `build_rendimiento_mensual()` y que MyInvestor usa en sus propios mails.
    Reemplaza la columna "Rendimiento %" del Sheet, que mezclaba depositos y
    retiros con la rentabilidad real (ver docs/PROJECT_MEMORY.md, seccion
    "Migracion Inversiones"). Los valores historicos cambian respecto a la
    version anterior porque esa columna nunca fue un % de retorno puro.

    Limitacion aceptada (ver DECISIONS.md 2026-07-10): el backfill de Notion
    solo llega hasta diciembre 2024 (el Sheet tenia historial desde marzo
    2024); el grafico de Capital arranca en diciembre 2024, 9 meses mas tarde
    que antes. Decision explicita del usuario, sin backfill adicional.
    """
    if not by_month:
        return {"capital": [], "rendimiento": []}

    capital = []
    for mk in sorted(by_month.keys()):
        pb_val = by_month[mk]["peerberry"]["capital"] or 0
        mi_val = by_month[mk]["myinvestor"]["capital"] or 0
        if pb_val == 0 and mi_val == 0:
            continue
        capital.append({"mes": mk, "peerberry": round(pb_val, 2), "myinvestor": round(mi_val, 2)})

    rendimiento = []
    for mk in sorted(by_month.keys()):
        prev_mk = _calendar_prev_month(mk)
        prev = by_month.get(prev_mk)
        cur = by_month[mk]

        pct_pb = None
        if prev and prev["peerberry"]["capital"] is not None and cur["peerberry"]["capital"] is not None:
            avg = (prev["peerberry"]["capital"] + cur["peerberry"]["capital"]) / 2
            if avg:
                pct_pb = round(cur["peerberry"]["ganancia"] / avg * 100, 2)

        pct_mi = None
        if prev and prev["myinvestor"]["capital"] is not None and cur["myinvestor"]["capital"] is not None:
            avg = (prev["myinvestor"]["capital"] + cur["myinvestor"]["capital"]) / 2
            if avg:
                pct_mi = round(cur["myinvestor"]["ganancia"] / avg * 100, 2)

        if pct_pb is None and pct_mi is None:
            continue
        rendimiento.append({
            "mes":        mk,
            "peerberry":  pct_pb if pct_pb is not None else 0,
            "myinvestor": pct_mi if pct_mi is not None else 0
        })

    return {"capital": capital, "rendimiento": rendimiento}


def sanity_check(movimientos, inversiones):
    """Guard de sanidad (ver DECISIONS.md 2026-07-09 y 2026-07-10): aborta
    antes de escribir finance_data.json si el resultado es sospechoso, para
    no publicar un JSON vacio o degradado. Al abortar, el workflow falla,
    no se comitea nada y el dashboard conserva el ultimo JSON bueno.
    Guards:
      A) 0 movimientos generados.
      B) el conteo de movimientos cae mas de 10% vs. el JSON anterior
         (los movimientos historicos solo deberian crecer).
      C) el JSON anterior tenia inversiones.ganancia con datos y el
         nuevo viene vacio (antes esto se degradaba en silencio).
      D) el JSON anterior tenia inversiones.capital con datos y el nuevo
         viene vacio — capital y ganancia comparten fuente (Notion
         Rendimiento Inversiones) desde 2026-07-10, asi que un fallo de
         lectura de esa DB ahora afectaria a ambos a la vez."""
    prev = None
    try:
        with open("finance_data.json", encoding="utf-8") as f:
            prev = json.load(f)
    except Exception:
        pass  # primera ejecucion o JSON previo ilegible: solo guard A

    if not movimientos:
        raise RuntimeError("Guard A: 0 movimientos generados — sync abortado.")

    if prev:
        prev_n = len(prev.get("movimientos", []))
        if prev_n and len(movimientos) < prev_n * 0.9:
            raise RuntimeError(
                f"Guard B: movimientos caen de {prev_n} a {len(movimientos)} "
                f"(mas de 10%) — sync abortado.")
        prev_gan = (prev.get("inversiones") or {}).get("ganancia") or []
        if prev_gan and not inversiones.get("ganancia"):
            raise RuntimeError(
                "Guard C: inversiones.ganancia vacia pero el JSON anterior "
                "tenia datos — sync abortado.")
        prev_cap = (prev.get("inversiones") or {}).get("capital") or []
        if prev_cap and not inversiones.get("capital"):
            raise RuntimeError(
                "Guard D: inversiones.capital vacio pero el JSON anterior "
                "tenia datos — sync abortado.")


if __name__ == "__main__":
    try:
        print("Leyendo Movimientos (Notion)...")
        mov_pages = fetch_movimientos_notion()
        print(f"  {len(mov_pages)} paginas")
        movimientos = build_movimientos(mov_pages)
        print(f"  {len(movimientos)} registros validos")

        print("Leyendo Rendimiento Inversiones (Notion: capital, rendimiento, ganancia, kpi)...")
        try:
            if not NOTION_RENDIMIENTO_DS_ID:
                raise RuntimeError("falta env var NOTION_RENDIMIENTO_DATA_SOURCE_ID")
            rend_pages = fetch_rendimiento_inversiones_notion()
            print(f"  {len(rend_pages)} paginas (Semanal + Mensual)")
            by_month = _aggregate_rendimiento_by_month(rend_pages)
            inversiones = build_inversiones(by_month)
            inversiones["ganancia"] = build_ganancia_inversiones(by_month)
            inversiones["kpi"] = build_kpi_inversiones(by_month)
            inversiones["rendimiento_mensual"] = build_rendimiento_mensual(by_month)
            print(f"  {len(inversiones['capital'])} meses de capital")
            print(f"  {len(inversiones['rendimiento'])} meses de rendimiento")
            print(f"  {len(inversiones['ganancia'])} meses agregados")
        except Exception as rend_err:
            print(f"  AVISO: no se pudo leer Rendimiento Inversiones: {rend_err}")
            inversiones = {"capital": [], "rendimiento": [], "ganancia": [], "kpi": None, "rendimiento_mensual": []}

        sanity_check(movimientos, inversiones)

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



