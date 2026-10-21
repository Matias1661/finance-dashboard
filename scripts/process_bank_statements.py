"""
Reemplazo del flujo de Relay "Pasar extracto bancario a Notion".

Revisa la carpeta de Drive "Extractos para Notion" en busca de archivos
nuevos y crea una pagina por movimiento en la DB Movimientos.

Formato soportado: CSV exportado por CaixaBank (columnas
Concepto;Fecha;Importe;Saldo). Parseo deterministico local, sin Claude (ver
parse_csv_extracto()).

Desde el 2026-10-21 el script NO categoriza: cada movimiento nuevo se crea
con Categoria = "A revisar" y la categorizacion la hace Claude en chat, a
pedido del usuario, en la fase 0 del skill "Organizar Movimientos". Ver
docs/DECISIONS.md 2026-10-21.

La rama de extraccion via PDF (Claude leyendo el extracto como documento)
se probo en paralelo y se elimino el 2026-07-23: el CSV es deterministico
y no depende de que Claude lea bien montos/fechas de una imagen. Ver
docs/DECISIONS.md 2026-07-23 (3).

Lleva un registro de que archivos ya proceso en processed_bank_statements.json
(en la raiz del repo) para no reprocesar el mismo archivo dos veces. El
control de duplicados por movimiento (fecha|concepto|monto) contra Notion en
ya_existe_en_notion() es el que evita duplicar entradas cuando el CSV trae
historial solapado entre exports.

Variables de entorno requeridas:
  NOTION_TOKEN            - ya existe como secret
  GOOGLE_SERVICE_ACCOUNT  - JSON completo de la cuenta de servicio (secret nuevo, pendiente)

Ver docs/DECISIONS.md 2026-07-17 (paso 1 del plan de migracion de Relay).
"""

import os, json, csv, io
from datetime import datetime
import requests

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT"]

NOTION_VERSION = "2025-09-03"
MOVIMIENTOS_DS_ID = "367d58ce-928b-4e31-832d-07707f876365"
DRIVE_FOLDER_ID = "1tDJJ8iJJ5SR5pFQdmp-vKO52x9uc_3Cs"  # "Extractos para Notion"
STATE_FILE = "processed_bank_statements.json"

# Categoria provisoria; la asigna Claude en la fase 0 de "Organizar
# Movimientos" (DECISIONS.md 2026-10-21).
CATEGORIA_PROVISORIA = "A revisar"

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}


def get_drive_access_token():
    """Autentica con la cuenta de servicio de Google y devuelve un access token
    con scope de solo lectura sobre Drive."""
    from google.oauth2 import service_account
    import google.auth.transport.requests

    info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.readonly"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def list_new_files(drive_token, already_processed):
    """Lista archivos en la carpeta de Drive que todavia no fueron procesados."""
    url = "https://www.googleapis.com/drive/v3/files"
    params = {
        "q": f"'{DRIVE_FOLDER_ID}' in parents and trashed = false",
        "fields": "files(id,name,mimeType,createdTime)",
        "orderBy": "createdTime",
    }
    headers = {"Authorization": f"Bearer {drive_token}"}
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    if not resp.ok:
        print(f"  Error de la API de Drive ({resp.status_code}): {resp.text}")
    resp.raise_for_status()
    files = resp.json().get("files", [])
    return [f for f in files if f["id"] not in already_processed]


def download_file(drive_token, file_id):
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
    headers = {"Authorization": f"Bearer {drive_token}"}
    resp = requests.get(url, headers=headers, params={"alt": "media"}, timeout=60)
    resp.raise_for_status()
    return resp.content


def _parse_importe(valor):
    """Convierte '+50,00EUR' o '-23,34EUR' a float. El signo ya viene en el texto."""
    return float(valor.strip().replace("EUR", "").replace(",", "."))


def parse_csv_extracto(csv_bytes):
    """Parsea un extracto en CSV (columnas Concepto;Fecha;Importe;Saldo) de
    forma deterministica, sin pasar por Claude. Unico formato soportado desde
    el 2026-07-23 (la rama PDF se elimino); ver docs/DECISIONS.md 2026-07-23 (3).

    El export del banco trae varios dias de historial acumulado (no solo el
    delta), por eso el control de duplicados en ya_existe_en_notion() sigue
    siendo imprescindible para cada movimiento, igual que con el PDF.
    """
    texto = csv_bytes.decode("utf-8-sig")
    filas = list(csv.DictReader(io.StringIO(texto), delimiter=";"))

    movimientos = []
    for r in filas:
        movimientos.append({
            "concepto": r["Concepto"].strip(),
            "monto": _parse_importe(r["Importe"]),
            "fecha": datetime.strptime(r["Fecha"].strip(), "%d/%m/%Y").strftime("%Y-%m-%d"),
            "saldo": _parse_importe(r["Saldo"]),
        })

    # Chequeo de integridad, no bloqueante: saldo[n] - monto[n] debe ser el
    # saldo de la fila siguiente (el banco entrega mas reciente primero).
    for i in range(len(movimientos) - 1):
        esperado = round(movimientos[i]["saldo"] - movimientos[i]["monto"], 2)
        real = movimientos[i + 1]["saldo"]
        if abs(esperado - real) > 0.01:
            print(f"  ADVERTENCIA: discontinuidad de saldo en fila {i} "
                  f"({movimientos[i]['concepto']} {movimientos[i]['fecha']}): "
                  f"esperado {esperado}, real {real}. Puede indicar filas faltantes en el export.")

    return movimientos


def ya_existe_en_notion(concepto, monto, fecha):
    """Control de duplicados: mismo criterio que reviewed_movements.json
    (fecha|concepto|monto)."""
    url = f"https://api.notion.com/v1/data_sources/{MOVIMIENTOS_DS_ID}/query"
    payload = {
        "filter": {"and": [
            {"property": "Concepto", "title": {"equals": concepto}},
            {"property": "Monto", "number": {"equals": monto}},
            {"property": "Fecha", "date": {"equals": fecha}},
        ]}
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return len(resp.json().get("results", [])) > 0


def crear_movimiento_notion(concepto, monto, fecha, categoria):
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"data_source_id": MOVIMIENTOS_DS_ID},
        "properties": {
            "Concepto": {"title": [{"text": {"content": concepto}}]},
            "Monto": {"number": monto},
            "Fecha": {"date": {"start": fecha}},
            "Categoria": {"select": {"name": categoria}},
        }
    }
    resp = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=30)
    resp.raise_for_status()


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"processed_file_ids": []}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    state = load_state()
    processed_ids = set(state["processed_file_ids"])

    print("Autenticando con Google Drive (cuenta de servicio)...")
    drive_token = get_drive_access_token()

    print("Buscando extractos nuevos en Drive...")
    new_files = list_new_files(drive_token, processed_ids)
    print(f"  {len(new_files)} archivo(s) nuevo(s)")

    if not new_files:
        print("Nada que procesar.")
    else:
        for f in new_files:
            print(f"Procesando {f['name']} ({f['id']})...")

            if not f["name"].lower().endswith(".csv"):
                print(f"  AVISO: {f['name']} no es .csv -- formato no soportado "
                      f"(la rama PDF se elimino el 2026-07-23). Volver a exportar "
                      f"el extracto como CSV. Se omite, no se marca como procesado.")
                continue

            try:
                file_bytes = download_file(drive_token, f["id"])
                movimientos = parse_csv_extracto(file_bytes)
            except Exception as e:
                print(f"  ERROR: fallo el procesamiento de {f['name']}: {e}. "
                      f"Se omite, no se marca como procesado (se reintenta en "
                      f"la proxima corrida).")
                continue

            print(f"  {len(movimientos)} movimiento(s) extraido(s)")

            creados, duplicados = 0, 0
            for m in movimientos:
                concepto = m["concepto"]
                monto = float(m["monto"])
                fecha = m["fecha"]
                categoria = CATEGORIA_PROVISORIA

                if ya_existe_en_notion(concepto, monto, fecha):
                    duplicados += 1
                    continue

                crear_movimiento_notion(concepto, monto, fecha, categoria)
                creados += 1

            print(f"  {creados} creado(s), {duplicados} duplicado(s) omitido(s)")

            processed_ids.add(f["id"])

        state["processed_file_ids"] = sorted(processed_ids)
        save_state(state)
        print("processed_bank_statements.json actualizado.")
