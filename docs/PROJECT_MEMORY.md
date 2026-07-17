# Finance Dashboard — Project Memory

## Propósito
Memoria técnica central del proyecto. Cualquier agente de IA o desarrollador debe poder reconstruir el estado completo del proyecto leyendo solo este documento y los demás archivos en `docs/`.

Última actualización: 2026-07-17

---

## Continuidad entre agentes

Distintos agentes de IA pueden trabajar sobre este proyecto en sesiones separadas. Ninguno debe asumir acceso al historial de conversaciones previas: la documentación en `docs/` debe alcanzar por sí sola para reconstruir el estado del proyecto.

**Jerarquía de fuentes:** si algo dicho en una conversación contradice `docs/PROJECT_MEMORY.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md` o `docs/CHANGELOG.md`, prevalece la documentación del repositorio.

**Proceso obligatorio antes de un cambio significativo:**
1. Revisar `PROJECT_MEMORY.md`, `DECISIONS.md`, `ROADMAP.md` y `CHANGELOG.md`.
2. Registrar la decisión relevante en `DECISIONS.md`.
3. Implementar el cambio.
4. Actualizar `CHANGELOG.md`.
5. Actualizar `ROADMAP.md` si corresponde.
6. Actualizar este archivo si cambió el contexto general del proyecto.

Ante cualquier duda sobre alcance, preguntar antes de asumir.

---

## Repositorio

- Repo: `Matias1661/finance-dashboard`
- GitHub Pages: `https://matias1661.github.io/finance-dashboard/`
- **Deployment de Pages: Source = "GitHub Actions"** (cambiado desde "Deploy from a branch" el 30/06/2026). Workflow `.github/workflows/deploy-pages.yml` arma una carpeta `_site/` con solo los archivos que el dashboard necesita (`index.html`, `js/`, `finance_data.json`, `sociedad_data.json`, `.nojekyll`) y la publica — `docs/`, `scripts/`, `prompt_relay_current.txt` y `reviewed_movements.json` ya no se exponen en el sitio público. Se dispara en cada push humano a `main`, y explícitamente vía `gh workflow run` desde los workflows de sync cuando comitean cambios (los pushes con `GITHUB_TOKEN` automático no disparan otros workflows por triggers `push`). No usar el campo `status` de `GET /repos/.../pages` como fuente de verdad — puede quedar en `errored` aunque el deploy real haya sido exitoso; verificar contra el run del workflow `Deploy Pages`. Si el log de un run muestra `deployment_queued` en loop indefinido, no es un problema de configuración del workflow — borrar y dejar recrear el environment `github-pages` desde Settings → Environments. Detalle completo en `docs/DECISIONS.md`, entradas del 30/06/2026 sobre Pages.
- Rama principal: `main`
- Frontend: HTML/CSS/JavaScript estático modularizado
- Librería de gráficos: Chart.js 4.4.1 (CDN)

---

---

## 🔄 MIGRACIÓN EN CURSO: Relay → GitHub Actions (iniciada 17/07/2026)

**Motivo:** Relay.app cierra el 15/08/2026 (plan gratuito) o 14/09/2026 (plan de pago). Todos los flujos de Relay siguen corriendo hasta esa fecha.

**Plan completo:** DB Notion "Plan de migración Relay → nueva plataforma" (bajo Finance Tracker). Filas: 0 (export, Completado) → 1 Movimientos → 2 Peerberry → 3 MyInvestor → 4 Nóminas → 4.5 Talho Argentino/Sync Sociedad Data → 5 validación en paralelo → 6 apagado de Relay.

**DECISIÓN DE ARQUITECTURA FINAL (17/07/2026), no volver a evaluar Make para esto:** los 4 flujos de email/Drive van **todos a GitHub Actions**, no a Make. Se probó un escenario real en Make (Peerberry funcionó bien, prompt validado) pero se encontró un límite de tamaño de mensaje en el trigger de Gmail de Make (`MaxFileSizeExceededError`, sin workaround conocido) que bloqueaba MyInvestor (email de marketing con HTML pesado). Se decidió consolidar todo en GitHub Actions: evita el límite de raíz (la API de Gmail se puede pedir en `text/plain` puro), el repo es público así que los minutos de Actions son gratis e ilimitados, y deja Make completamente libre para uso futuro. Detalle completo y tabla de estado por flujo en `docs/DECISIONS.md`, entrada `[2026-07-17] DECISIÓN FINAL`.

**Estado de implementación por flujo (repasar esto primero al retomar):**
| Flujo | Estado |
|---|---|
| **Movimientos** | ✅ Implementado (`scripts/process_bank_statements.py` + paso en `sync-finance-data.yml`) y validado con un extracto real en paralelo con Relay (0 duplicados, categorización idéntica). Falta: seguir en paralelo unos días más antes de apagar este flujo específico en Relay. |
| **Peerberry** | ✅ Implementado (`scripts/process_peerberry_emails.py` + paso en `sync-finance-data.yml`), autenticación Gmail vía OAuth con refresh_token (no cuenta de servicio — Gmail personal no soporta domain-wide delegation, ver `docs/DECISIONS.md` 2026-07-17). Validado con datos reales: la primera corrida detectó 5 filas duplicadas heredadas de un bug del propio flujo de Relay (Ganancia = Interest income en vez de Profit, fecha de Balance on en vez de Portfolio updated on); corregido borrando las filas viejas en Notion, `finance_data.json` verificado contra suma manual. **Flujo de Relay "Peerberry a Notion" dado de baja por el usuario el 17/07** (el de Movimientos sigue activo, en validación paralela). |
| **MyInvestor** | Prompt escrito (en el mismo escenario de Make de prueba) pero nunca se pudo ejecutar por el límite de tamaño. Falta escribir el script Python (pedir `text/plain` a la API de Gmail evita el problema) y probar con el próximo informe mensual real. |
| **Nóminas** | **Cambio de diseño:** Matías sube el PDF a mano a la carpeta Drive "Nominas" (ID `1pt9WGS3nzR8t1NIS5egrL0OMm2QGUKGj`) en vez de que el flujo lea el email de Beatriz automáticamente. Falta escribir el script (vigila esa carpeta, mismo patrón que Movimientos). |
| **Talho Argentino / Gastos del local (paso 4.5)** | Decidido GitHub Actions desde antes, cubre 2 sub-flujos (comprobante en Drive + cambios en DB "Gastos del local" → dispara Sync Sociedad Data). Sin implementar todavía. |

**Export de Relay (paso 0, completado):** los 14 workflows originales de Relay revisados y documentados en `docs/relay-export/README.md`, con los JSON/CSV de cada uno en `docs/relay-export/<nombre-flujo>/`.

**Hallazgos clave que cualquier reemplazo debe replicar:**
- El flujo de Movimientos dispara GitHub Actions "Sync Finance Data" (286832931) además de escribir en Notion — ya replicado en `process_bank_statements.py`.
- Los flujos de Gastos Talho Argentino disparan GitHub Actions "Sync Sociedad Data" (301444283) — dos caminos (comprobante en Drive, o página editada en Notion) que convergen en el mismo dispatch.
- El prompt de categorización de Movimientos se lee en vivo de la DB Notion "Prompts para Relay" en cada corrida (no está embebido) — ya replicado igual en `process_bank_statements.py`.

**Credenciales:**
- `GOOGLE_SERVICE_ACCOUNT` (GitHub secret): scope de Drive, sin cambios — se usa para Movimientos y (cuando se implemente) Nóminas.
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` (GitHub secrets nuevos, 2026-07-17): OAuth 2.0 con refresh_token para leer Gmail. Confirmado que la cuenta de servicio NO puede leer un Gmail personal (domain-wide delegation solo existe en Google Workspace). El refresh_token se generó una única vez de forma interactiva con `scripts/get_gmail_refresh_token.py` (corrido localmente por el usuario). Reusar los mismos 3 secrets para MyInvestor.
- `ANTHROPIC_API_KEY` (GitHub secret): ya en uso por Movimientos y Peerberry, reusar.
- `NOTION_TOKEN` (GitHub secret): ya en uso.

**Idea pendiente de evaluar (propuesta por el usuario, no implementada):** alerta en el dashboard que detecte si falta subir la nómina de un mes (por tiempo transcurrido, o cruzando contra el ingreso de nómina esperado en Movimientos). En `docs/ROADMAP.md`.

**Notas sobre Make (exploración, no se usa en producción):** se armaron 2 escenarios de prueba en la cuenta de Make de Matías vía API (sin usar la interfaz, que tuvo una caída puntual el 17/07): "Emails financieros" (id 9538432, Peerberry+MyInvestor) y "Nóminas" (id 9538741). Ambos quedan creados pero **desactivados**. Conexiones creadas en Make sin uso: Gmail+Drive combinado (id 14438625), Anthropic Claude propio de Make (id 14438562, key distinta a la de GitHub). No hace falta tocarlos, pero tampoco borrarlos — sirven de referencia si en el futuro se reconsidera Make para otra cosa.

**Pendiente general:** escribir los 2 scripts que faltan (MyInvestor, Nóminas — reusar la autenticación Gmail OAuth ya resuelta para Peerberry), agregar los pasos a `sync-finance-data.yml`, validar cada uno con datos reales comparando los agregados mensuales de `finance_data.json` contra una suma manual de las filas fuente (no alcanza con el log de "creado/duplicado" del script — lección del incidente de Peerberry, ver `DECISIONS.md` 2026-07-17), y recién ahí seguir con el paso 4.5 (Talho Argentino) y los pasos 5-6 (validación en paralelo, apagado de Relay).

---

---

## 🔄 MIGRACIÓN EN CURSO: Google Sheets → Notion (Movimientos)

**Estado: 8 de 8 pasos completados (30/06/2026). Migración de Movimientos terminada.**

### Decisión de secuencia (30/06/2026)
Se saltó deliberadamente el paso 4 original ("probar en paralelo, comparar JSON") y se fue directo a producción: el script reescrito se desplegó en el workflow real y se validó corriendo contra datos reales (2473 movimientos generados correctamente, Inversiones intacta desde Sheets con 28 meses de capital / 11 de rendimiento). Justificación del usuario: confianza alta tras la verificación manual de salud de Notion (ver entrada `[2026-06-30] verificación salud Notion` más abajo). Riesgo aceptado: sin comparación lado a lado de ambos JSON antes del corte; mitigado por el hecho de que `finance_data.json` se generó con éxito y su estructura fue inspeccionada directamente.

También se saltó la validación de 1-2 semanas con ambos destinos activos (pasos 5-6 originales): el usuario confirmó que Relay ya escribe **solo** en Notion (no en paralelo con Sheets), y eligió entrar en producción con seguimiento manual de fallas en vez de la fase de validación progresiva. Esto implica que Sheets dejó de recibir movimientos nuevos desde el 30/06/2026 — queda como archivo histórico de solo lectura hasta nueva decisión.

### Motivación
`update-sheet-cells.yml` (escritura via GitHub Actions) es lento para escrituras individuales: requiere espaciado de 30s entre dispatches y pausar Relay antes de cualquier batch. El sandbox de Claude tiene bloqueados a nivel de red `sheets.googleapis.com` y `script.google.com` (`host_not_allowed`), así que GitHub Actions es hoy el único canal de escritura al Sheet. Notion es accesible directamente vía MCP — sin intermediarios, sin espaciado.

### Qué NO cambia (verificado)
El frontend completo (`app.js`, `charts.js`, `filters.js`, `state.js`, `index.html`) no requiere ningún cambio. `finance_data.json` sigue siendo el contrato único: `{ movimientos: [{fecha, concepto, monto, categoria, nota}], inversiones: {...} }`. Las columnas E–J del Sheet (Ingreso, Gastos, Módulo monto, Ingreso/Gasto, Mes, Año) son ornamentales — nunca se exportaron al JSON, el dashboard siempre las recalculó desde `monto`/`fecha`.

### Decisión sobre Inversiones
La hoja `Inversiones` de Google Sheets quedó obsoleta el 10/07/2026: `build_inversiones()` ahora deriva capital y rendimiento (%) de la DB Notion "Rendimiento Inversiones", igual que el resto de Inversiones. Ver sección "Migración Inversiones: Sheets → Notion" más abajo (estado: COMPLETA).

### DB Movimientos en Notion — ya creada

- **Data source ID:** `367d58ce-928b-4e31-832d-07707f876365`
- **URL:** https://app.notion.com/p/46a204b1ad5a464593ca739648123569
- **Parent:** página Finance Tracker (`19833ce5-0e68-804c-9693-d4f2f2592968`)
- **Schema:** Concepto (title), Fecha (date), Monto (number), Categoria (select — 20 opciones, coinciden exacto con las categorías válidas del prompt de Relay), Nota (rich text)
- **Datos:** 2.465 movimientos históricos importados manualmente por el usuario vía CSV (export del Sheet → decode base64 → parseo Python → CSV con fecha ISO y monto float → importación manual en Notion UI)
- **Verificación de integridad:** conteo exacto 2.465/2.465; las 19 categorías presentes coinciden en conteo y suma de montos a centavo exacto contra el origen; patrón de duplicados (fecha+concepto+monto repetidos) idéntico entre CSV fuente y Notion (2.253 combinaciones distintas / 2.465 filas — confirma que no hubo duplicación introducida)
- **Corrección aplicada post-importación:** nota residual "TEST — borrar" en AMAZON.ES (4/06/2026, -6,49€) corregida a "Libro Kindle 'Inside Delta Force'"

### Plan completo (8 pasos)

1. ✅ Crear DB Movimientos en Notion
2. ✅ Importar 2.465 movimientos históricos (vía CSV manual, no por MCP batch — más confiable para este volumen)
3. ✅ Reescribir `sync_finance_data.py`: Movimientos se lee de Notion vía API REST (`POST /v1/data_sources/{id}/query`, paginado por `start_cursor`/`has_more`). Output JSON verificado con la misma estructura: `{fecha, concepto, monto, categoria, nota}`. (Inversiones migró de Sheets a Notion por separado el 10/07/2026, ver sección "Migración Inversiones".)
4. ✅ Desplegado directo a producción (sin fase de comparación en paralelo, ver "Decisión de secuencia" arriba). Workflow `sync-finance-data.yml` actualizado con secrets `NOTION_TOKEN` (ya existía en el repo) y env var `NOTION_MOVIMIENTOS_DATA_SOURCE_ID`. Validado con 3 dispatches manuales: 2 fallos diagnosticados y corregidos, 1 éxito confirmado generando 2473 movimientos.
5. ✅ Relay configurado para escribir solo en Notion (no en paralelo — el usuario decidió cortar Sheets como destino directamente)
6. ⬜ (Omitido por decisión del usuario) Validación de 1-2 semanas con ambos destinos activos — no aplica porque Sheets dejó de recibir escrituras de Relay
7. ✅ Workflows `update-sheet-cells.yml` y `find-update-nota.yml` eliminados del repo (30/06/2026). **Relay.app sigue activo** escribiendo en Notion (corrección 09/07/2026: una versión anterior de este documento afirmaba erróneamente que fue dado de baja). `update-relay-prompt.yml` y `read-relay-prompt.yml` quedaron obsoletos porque el prompt de categorización ya no vive en `prompt_relay_current.txt` — se migró a una base de datos de Notion (https://app.notion.com/p/39833ce50e68801ab5a1fb9d6effa10f) que unifica todos los prompts de uso frecuente y es su única fuente activa (09/07/2026, ver `docs/DECISIONS.md`).
8. ✅ Flujo "Organizar Movimientos" actualizado: la escritura de categoría/nota ahora usa `notion-update-page` vía MCP, localizando la página por fecha+concepto+monto (`notion-query-data-sources`). Detalle completo en la sección "Flujo Organizar Movimientos" más abajo en este documento.

### Problemas encontrados y resueltos durante el despliegue del paso 4
1. **Notion-Version incorrecta**: el endpoint `/v1/data_sources/{id}/query` requiere el header `Notion-Version: 2025-09-03`. Usar la versión antigua `2022-06-28` con este endpoint nuevo devuelve error de schema/no reconocido. Corregido en el script.
2. **404 en la query pese a versión correcta**: la integración de Notion asociada al secret `NOTION_TOKEN` de GitHub (identificada como "Notion Talho", creada 24/06/2026 según fecha de creación del secret) no estaba conectada a la página Finance Tracker / DB Movimientos. Solo Relay.app y Zapier tenían conexión. Se resolvió conectándola manualmente desde Notion: `···` → Conexiones → Añadir conexión → Notion Talho. Lección: cualquier integración nueva que vaya a leer/escribir una DB de Notion debe conectarse explícitamente a esa página, no basta con tener el token.

### Lo que desaparece al completar la migración
Workflow `update-sheet-cells.yml` (eliminado), workflow `find-update-nota.yml` (eliminado), el protocolo de pausar Relay antes de cualquier batch de escrituras (ya no aplica — las escrituras directas vía MCP no disparan runs de GitHub Actions). Relay.app sigue activo (escribe Movimientos y Rendimiento Inversiones directamente en Notion). `update-relay-prompt.yml` y `read-relay-prompt.yml` quedaron obsoletos porque el prompt de categorización se migró a una base de datos de Notion (09/07/2026), dejando de vivir en `prompt_relay_current.txt`.

### Estado de Sheets tras la migración
El Google Sheet (`1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI`) deja de recibir movimientos nuevos de Relay desde el 30/06/2026. Queda como archivo histórico de solo lectura para la hoja Movimientos. La hoja Inversiones sigue activa y en uso normal (Peerberry/MyInvestor, actualización manual mensual) — su migración a Notion es una fase futura sin fecha definida, según decisión explícita del usuario.

### Lo que NO se toca
`sync-sociedad-data.yml` (ya usa Notion, sin relación con esta migración). El botón "Actualizar" de `index.html` sigue disparando el mismo workflow de sync, solo cambia qué lee internamente.

### Notas operativas para continuar
- El rate limit de la API de Notion para queries SQL (`notion-query-data-sources`) es agresivo — esperar 30-60s entre llamadas consecutivas durante validaciones masivas.
- **API REST de Notion vía `requests` (no MCP)**: usa `Notion-Version: 2025-09-03` con el endpoint `/v1/data_sources/{id}/query`. Versiones de API anteriores no reconocen este endpoint.
- **Integraciones nuevas necesitan conexión explícita por página**: tener el token (secret) no alcanza. Hay que ir a la página en Notion → `···` → Conexiones → Añadir conexión → seleccionar la integración. Sin esto, la API devuelve 404 aunque el token sea válido.
- Pendiente de limpieza manual del usuario: una página vacía titulada `[BORRAR — creada por error]` quedó en la DB Movimientos por un error de tooling durante la importación — no hay herramienta de borrado de páginas vía MCP, eliminar manualmente desde Notion.
- Ver `docs/DECISIONS.md` entrada `[2026-06-30]` para el detalle completo del análisis de impacto componente por componente que precedió a esta migración.


## Pipeline de datos

```
Extracto bancario (banco) + correos Peerberry/MyInvestor
        ↓
   Relay (categorización automática / extracción de reportes)
        ↓
   Notion: DB Movimientos (367d58ce...) y DB Rendimiento Inversiones (93eda06b...)
        ↓
   GitHub Action diario (sync-finance-data, 07:00) → genera finance_data.json en el repo
        ↓
   Dashboard (index.html consume finance_data.json en runtime)
```

Actualizado 10/07/2026: el pipeline anterior (Relay→Google Sheets, más una GitHub Action de verificación) quedó obsoleto — Sheets ya no es destino de Relay ni fuente de ningún dato del sync. `build_inversiones()` lee capital/rendimiento (%) de la DB Notion "Rendimiento Inversiones" desde el 10/07/2026 (ver sección "Migración Inversiones"). El script ya no depende de Google Sheets API ni del secret GOOGLE_SERVICE_ACCOUNT.

Una sola cuenta bancaria. Relay extrae: concepto, fecha (YYYY-MM-DD), importe (negativo=gasto, positivo=ingreso), categoría.

---

## Schema de finance_data.json

| Campo | Descripción |
|---|---|
| fecha | Fecha del movimiento (YYYY-MM-DD) |
| concepto | Descripción del movimiento |
| monto | Negativo=gasto, positivo=ingreso |
| categoria | Categoría asignada por Relay |
| nota | Texto libre por movimiento (col K de la hoja). Identifica qué fue la compra. Editable a mano; enriquecido por Claude solo en Compras |
| categoria_relay | Categoría original de Relay |
| verificado_claude | true / false |
| categoria_sugerida | Sugerencia de reclasificación por Claude |
| confianza | alta / media / baja |
| razon_verificacion | Explicación del criterio usado |
| fecha_verificacion | Fecha en que Claude verificó |

Claude solo escribe las últimas 5 columnas.

### Layout de columnas en la hoja Movimientos (importante)

- **A** fecha · **B** concepto · **C** importe · **D** categoría · **E** filtro de positivos (= importe si >0, si no 0; uso interno para gráficos de la hoja, NO se usa en el dashboard).
- **F–J** en uso (otros auxiliares). **La primera columna libre es K**, donde vive **Nota**.
- Regla: nunca escribir en E–J asumiendo que están libres. Cualquier campo nuevo va de K en adelante. El sync mapea por nombre de cabecera, no por letra.

---

## Categorías

### Excluidas del análisis principal
`Guille` e `Inversion` — ver `js/state.js` → `excludedCategories`.

### Lista completa de categorías válidas
Salidas, Comer afuera, Combustible, Guille, Gastos coche, Compras, Gastos moto, Departamento, Club, Suscripciones, Gastos en conjunto, Inversion, Viajes, Nomina, Otros, Tarjeta, Supermercado, A revisar, Salud y Belleza

---

## Arquitectura del frontend

### Regla crítica de carga de scripts

```html
<script src="js/state.js"></script>
<script src="js/filters.js"></script>
<script src="js/insights.js"></script>
<script src="js/charts.js"></script>
<script src="js/app.js"></script>
```

`insights.js` debe cargar antes de `charts.js`: `renderKPIs` consume sus helpers (`getRendimientoLastMonths`, `getAportesLastMonths`).

Sin bloques `<script>` inline con lógica de negocio.

### Módulos

**js/state.js**
- `window.FINANCE_STATE`: raw, excludedCategories, activePeriod, activeMonth

**js/filters.js**
- `filteredData()` — filtra por periodo, mes y categorías excluidas. Consumida por charts.js y app.js.
- `setPeriod(m, el)` — actualiza activePeriod. "Todo" usa valor `999`.
- `setMonthFilter(m)` — actualiza activeMonth
- `populateMonthSelector(RAW)` — selector del tab Resumen

**js/insights.js** (añadido 2026-07-03)
- `detectRecurring()` — cargos recurrentes: concepto+importe exacto, ≥3 cobros, mediana de intervalo 25–35 días. Estado activa/inactiva con ventana de 45 días desde `lastTxDate`.
- `SUB_ALIASES` / `SUB_KEYWORDS` / `SUB_KEYWORDS_AMT` — clasificación y nombres legibles de suscripciones. Verificar alias periódicamente (los precios cambian).
- `renderSuscripciones()` — sección en Resumen (`#subs-card`).
- `computeInsights()` / `renderInsights()` — último mes completo vs. previo, top variaciones, alertas media+2σ (`#insights-card`).
- `getRendimientoLastMonths(n)` — suma `inversiones.ganancia` (EUR, Notion "Rendimiento Inversiones") de los últimos n meses. `getAportesLastMonths(n)` — helpers del KPI Ahorro real.
- Detalle de reglas en `docs/DECISIONS.md`, entrada `[2026-07-03] Fase 2 analítica`.

**js/charts.js**
- `formatEUR(v)` — fuente única del formateador EUR. No duplicar en otros módulos.
- `renderKPIs()` — tarjetas del Resumen: Última transacción, Patrimonio invertido, Ahorro real 12m (balance + rendimiento, desglose de aportes), Sin analizar por Claude.
- `renderMonthly()` — barras ingresos/gastos por mes. Consume `filteredData()`. Eje Y en EUR.
- `renderDonut()` — donut de gastos por categoría. Consume `filteredData()`.

**js/app.js**
- `init()` — carga finance_data.json, inyecta en FINANCE_STATE, puebla selectores, rellena #last-updated, llama renderResumen()
- `renderResumen()` → renderKPIs + renderMonthly + renderDonut
- `renderCategorias()` — barras horizontales + tabla resumen (cat/movimientos/total/%) + lista transacciones
- `renderTransacciones()` — tabla filtrable por mes y categoría (ingresos y gastos)
- `renderGuille()` — KPIs (3) + chart mixto + tabla filtrable por mes
- `switchTab(tab, el)` — activa panel, llama render correspondiente
- Selectores: `populateTxMonthSelector`, `populateTxCatSelector`, `populateCatMonthSelector`, `populateGuilleMonthSelector`
- `populateCatMonthSelector` se llama también en `switchTab('categorias')` por compatibilidad con Safari

**index.html**
- Solo estructura HTML e imports. Sin lógica inline.
- Clases de altura de chart: `.chart-wrap` (260px), `.chart-wrap-tall` (320px), `.chart-wrap-xtall` (420px)

---

## Gráfico de Guille — especificación técnica

El gráfico mixto de Guille requiere configuración específica por la diferencia de escala entre datasets:

- Barras (Depositado, Gastado): rango típico 300–2000€/mes → eje Y izquierdo (`y`)
- Línea (Saldo acumulado): rango típico -2700 a +11000€ → eje Y derecho (`y2`)
- Ambos ejes formateados en EUR con `maximumFractionDigits: 0`
- `type: 'bar'` obligatorio a nivel raíz del chart (Chart.js 4 lo requiere aunque los datasets lo declaren individualmente)
- `interaction: { mode: 'index', intersect: false }` para tooltip unificado por mes
- Línea con `fill: true` y `backgroundColor: rgba(37,99,190,0.08)` para área bajo la curva
- Puntos con borde azul y fondo blanco para visibilidad sobre las barras
- Canvas en `.chart-wrap-xtall` (420px) para acomodar 18 meses sin compresión

---

## Tabs

| Tab | Función de render | Contenido |
|---|---|---|
| Resumen | renderResumen() | KPIs (4), periodo pills, selector mes, gráfico mensual EUR, donut categorías |
| Categorías | renderCategorias() | Selector mes, barras horizontales, tabla resumen por cat, lista transacciones |
| Transacciones | renderTransacciones() | Selector mes + categoría, tabla completa |
| Guille | renderGuille() | KPIs (3), chart mixto dual-Y, selector mes, tabla movimientos |

---

## Design system

- Fondo: `#f8f8f6` / Superficie: `#ffffff` / Max-width: 1100px
- Fuentes: DM Sans + DM Mono (Google Fonts)
- Verde: `#0d8a52` / Rojo: `#c94a30` / Ámbar: `#9a6200` / Azul: `#2563be`
- Border: `rgba(0,0,0,0.08)` / Shadow: `0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)`
- Border radius: 12px
- KPI values: `font-size:22px; font-weight:600` con color semántico
- Gastos siempre en positivo con color rojo
- Tooltips: `backgroundColor: #ffffff`, `borderColor: rgba(0,0,0,0.12)`, `borderWidth: 1`
- Mobile: KPI grid 2 columnas en ≤640px

---

## Flujo "Organizar Movimientos" — implementado 2026-06-04, migrado a Notion 2026-06-30

**Trigger:** escribir "Organizar Movimientos" en el chat de Claude.

**Qué hace Claude al recibir el trigger:**
1. Lee `finance_data.json` del repo (GitHub API) — ya generado desde Notion por `sync_finance_data.py`
2. **Verifica ediciones manuales pendientes de sync** (auditoría 2026-07, fila 1, agregado 2026-07-13): consulta `MAX("Last edited time")` de la DB Notion Movimientos (`367d58ce-928b-4e31-832d-07707f876365`, columna nativa `Last edited time` añadida a tal efecto) y la compara contra el campo `generated_at` de `finance_data.json`. Si Notion tiene ediciones más recientes que `generated_at`, dispara el workflow `sync-finance-data` (`POST .../actions/workflows/286832931/dispatches` con `{"ref":"main"}`) y espera a que termine antes de continuar, para no operar sobre un `finance_data.json` desactualizado.
3. Lee `reviewed_movements.json` del repo — lista de claves `fecha|concepto|monto` ya revisadas
4. Filtra candidatos no revisados por fase (PayPal, Uber, Amazon, Viajes)
5. Para PayPal/Uber/Amazon: busca en Gmail el recibo por fecha y remitente
6. Presenta propuestas al usuario fase a fase, una por una en el chat
7. Aplica aprobados escribiendo directo en Notion vía MCP (`notion-update-page`): localizar la página en la data source Movimientos (`367d58ce-928b-4e31-832d-07707f876365`) filtrando por Fecha+Concepto+Monto exactos (`notion-query-data-sources`, SQL), luego `notion-update-page` sobre la propiedad Categoria (select).
8. **Enriquecimiento de Nota** — para los movimientos procesados (prioridad *Compras*), genera la nota descriptiva y la escribe en la propiedad Nota (rich text) de la misma página:
   a. Si es Amazon → buscar el producto en Gmail (`auto-confirm@amazon.es`, `confirmar-envio@amazon.es`, `order-update@amazon.es`, `digital-no-reply@amazon.es` para Kindle) y casar por fecha/importe.
   b. Si no es Amazon → buscar recibo del comercio en Gmail por ventana de fecha (±pocos días).
   c. Si no hay nada en Gmail → búsqueda web para identificar la tienda/marca.
   d. Si nada concluyente → dejar la nota en blanco (no inventar).
9. Actualiza `reviewed_movements.json` con todos los presentados (aprobados y rechazados)

**Cambio respecto al flujo anterior (basado en Sheets):** ya no hay concepto de "row" ni rango A1. La página de Notion se localiza por fecha+concepto+monto (misma clave que `reviewed_movements.json`, sin cambios en su formato) y se edita directo con `notion-update-page`, sin GitHub Actions ni `update-sheet-cells.yml` (eliminado el 30/06/2026). Esto elimina el espaciado de 30s entre dispatches y el protocolo de pausar Relay antes de escrituras batch — las escrituras MCP son inmediatas y no disparan workflows.

**Caso de fechas/montos duplicados:** si la query SQL devuelve más de una página con la misma combinación fecha+concepto+monto, Claude debe pedir confirmación al usuario indicando ambas antes de escribir, en vez de asumir cuál corresponde (paralelo al caso NYX*AIRservSpain documentado en el CHANGELOG bajo el flujo anterior).

**Registro:** `reviewed_movements.json` — `{ "reviewed": ["fecha|concepto|monto", ...] }`

**KPI:** card "Sin analizar por Claude" en tab Resumen — cuenta movimientos candidatos no en `reviewed_movements.json`

## Vista ampliada de Viajes — implementado 2026-06-04

**Trigger para iniciar:** "Implementa la vista ampliada de Viajes en el tab Categorías"

**Contexto:** Al filtrar por categoría "Viajes" en el tab Categorías, debe aparecer una sección adicional debajo del gráfico que agrupa los movimientos por viaje y muestra el desglose por subcategoría.

**Fuente de datos de viajes:** Los viajes se definen por eventos del Google Calendar. Para el dashboard (sin acceso al calendar en runtime), los viajes se hardcodean como constante `TRIP_WINDOWS` en `app.js` — lista de objetos `{ name, start, end }`. Se actualiza manualmente cuando se añaden viajes nuevos. Viajes confirmados a incluir (con movimientos reales en el dataset):

```js
const TRIP_WINDOWS = [
  { name: 'Gijón',         start: '2025-07-06', end: '2025-07-11' },
  { name: 'Spain Run',     start: '2025-09-12', end: '2025-09-14' },
  { name: 'Hotel Natursun (oct)', start: '2025-10-25', end: '2025-10-26' },
  { name: 'Bagger Racing', start: '2025-11-07', end: '2025-11-09' },
  { name: 'Toledo',        start: '2025-12-08', end: '2025-12-14' },
  { name: 'Alojamiento en Francia', start: '2026-03-25', end: '2026-03-29' },
  { name: '45 Aniversario París',   start: '2026-04-18', end: '2026-04-18' },
  { name: 'Málaga',        start: '2026-05-01', end: '2026-05-03' },
  { name: 'Viaje a Portugal', start: '2026-05-08', end: '2026-05-10' },
];
```

**Subcategorías** (inferidas del concepto, función `tripSubcategory(concepto)`):
- Combustible: repsol, shell, esso, moeve, sanse, ballenoil, p.serv, certif, galp
- Peajes: autopista, bidegi, cofiroute, atlandes, autoroutes, ap-
- Alojamiento: hotel, airbnb, hostal, apartamento, booking
- Transporte: iberia, vueling, ryanair, renfe, ouigo, blabla, uber, parking
- Comida: (resto de gastos negativos)
- Otros: lo que no encaje

**Comportamiento UI:**
- Solo visible cuando `activeCatBarFilter === 'Viajes'` en `renderCategorias()`
- Selector de mes existente aplica también a esta sección
- Por cada viaje dentro del período filtrado: card con nombre, fechas, total y tabla de subcategorías (nombre + importe)
- Debajo de cada card: lista colapsable de transacciones individuales del viaje
- Viajes sin movimientos en el período filtrado no se muestran
- Estilo: mismas cards del design system, sin librerías nuevas

**Archivos a modificar:** solo `js/app.js` (añadir `TRIP_WINDOWS`, `tripSubcategory()`, y sección en `renderCategorias()`) e `index.html` si hace falta un contenedor HTML nuevo.

---

## Categorías reembolsables

Las categorías listadas en `reimbursableCategories` (state.js) aplican netting: los ingresos de esa categoría restan al gasto bruto para calcular el gasto neto. Estas categorías son: Viajes, Club, Combustible, Comer afuera, Salidas, Gastos en conjunto.

La función canónica es `netExpenseByCategory(data)` en `charts.js`. No duplicar esta lógica en otros módulos.

Los ingresos de categorías reembolsables **no** se suman a los ingresos totales en KPIs ni en el gráfico mensual.

La tabla de transacciones individuales siempre muestra los movimientos sin modificar — el netting es solo en los agregados.

---

## Convenciones importantes

- `formatEUR` vive solo en `charts.js`. No duplicar.
- `filteredData()` es la función canónica para obtener datos filtrados en el tab Resumen.
- El periodo "Todo" usa valor numérico `999` en `setPeriod`.
- Los gastos en KPIs se muestran como positivos — el color rojo comunica el signo.
- `populateCatMonthSelector()` se llama en `init()` Y en `switchTab('categorias')`.
- El gráfico de Guille necesita `type: 'bar'` a nivel raíz aunque use datasets mixtos.

---

## Estado actual del sistema

Dashboard sin bugs conocidos. Todos los tabs operativos, incluido el tab Inversiones (ya implementado, ver especificación de "Tab Inversiones" en este documento).

Próxima fase posible:
- Insights automáticos vía Claude API — ya implementado en js/insights.js (2026-07-03)
- Detección de anomalías — ya implementado (alertas media+2σ, js/insights.js)
- Capa de verificación (verification_data.json) — pendiente, sin implementar
- Ver docs/ROADMAP.md para el resto de pendientes

---

## Regla de trabajo obligatoria

1. Revisar todos los docs/ antes de implementar
2. Registrar decisiones en DECISIONS.md
3. Implementar
4. Actualizar CHANGELOG.md
5. Actualizar ROADMAP.md si aplica
6. Actualizar este documento si el contexto general cambia

---

## Mobile responsive (estado actual)

Breakpoints activos:
- `@media(max-width:640px)` — layout principal mobile
- `@media(max-width:380px)` — pantallas muy pequeñas (oculta header-meta)

Alturas de charts:
| Clase | Desktop | Mobile (≤640px) |
|---|---|---|
| `.chart-wrap` | 260px | 200px |
| `.chart-wrap-tall` | 320px | 240px |
| `.chart-wrap-xtall` | 340px | 260px |

Patrones CSS establecidos:
- Tabs: `width:100%`, cada `.tab` con `flex:1`
- Filtros: `flex-wrap:wrap` en `.filter-row`
- Selects: `flex:1; min-width:0; max-width:220px`
- KPIs con valores monetarios: `font-size: clamp(16px, 4vw, 22px)`

---

## Gráfico Guille — especificación actual

- **Ventana temporal:** últimos 12 meses disponibles en los datos
- **Saldo acumulado:** calculado desde el origen histórico completo, recortado a los últimos 12 para visualización
- **Ejes:** Y izquierdo = barras (dep/gas), Y derecho = línea saldo acumulado
- **Tipo raíz Chart.js:** `type:'bar'` obligatorio


---

## Migración Inversiones: Sheets → Notion (COMPLETA, 10/07/2026)

**Objetivo (cumplido):** reemplazar la hoja `Inversiones` del Sheet por la DB Notion `Rendimiento Inversiones` (data source `93eda06b-9207-4589-b3f0-66be10ab9caf`, dentro de Finance Tracker), como única fuente de capital y rendimiento del tab Inversiones.

**Schema:** Fecha (título), Plataforma (select: Peerberry/MyInvestor), Periodo (select: Semanal/Mensual), Ganancia (number, €), Capital total (number, € — capital de esa plataforma específica, no combinado), Fecha reporte (date).

**Fuente de los datos — correos, NO la antigua columna "Rendimiento %" del Sheet:**
- Peerberry: `info@peerberry.com`, asunto "Account summary overview", semanal. Campo "Interest income" = rendimiento de esa semana en €. Campo "Profit" (bloque Portfolio) = acumulado desde el origen de la cuenta. Capital de Peerberry en un momento = Invested funds + Available balance.
- MyInvestor: `comunicaciones@myinvestor.es`, asunto "Rentabilidad de tu cartera en [mes]", mensual. Campo "GANANCIAS ... En [mes]" = rendimiento neto de aportaciones de ese mes en €, directo, sin cálculo. Campo "VALOR DE TU CARTERA" = capital.

**Por qué no la columna "Rendimiento %" del Sheet:** mezclaba depósitos y rentabilidad real — el valor mensual que cargaba era el balance total de la cartera, no un % de retorno puro. Verificado empíricamente el 10/07/2026 comparando ambos cálculos mes a mes: diferencias de decenas de puntos porcentuales en varios meses (ej. junio 2026 Peerberry: 126,42% en el Sheet vs. 0,31% con la fórmula correcta).

**Backfill:** MyInvestor 19 meses (dic 2024–jun 2026), Peerberry 18 meses (dic 2024–may 2026), ambos sin huecos, sin cambios respecto a la carga inicial.

**Migración de `build_inversiones()` (10/07/2026, auditoría fila 4):** reescrita para derivar `capital` y `rendimiento` de `by_month` (la misma estructura que ya construye `_aggregate_rendimiento_by_month()` para `ganancia`/`kpi`/`rendimiento_mensual`), en vez de leer la hoja Sheets. Eliminados del script: `get_service()`, `read_range()`, `SHEET_ID`, `FINANZAS_SHEET`, `GOOGLE_SERVICE_ACCOUNT`/`SA_JSON`, los imports `google.oauth2`/`googleapiclient`, y las funciones de parseo posicional (`parse_amount`, `parse_pct`, `parse_mes_label`, `parse_date`) que solo servían para leer el Sheet. El workflow `sync-finance-data.yml` ya no instala `google-auth`/`google-api-python-client` ni pasa `GOOGLE_SERVICE_ACCOUNT`/`SHEET_ID`.

**Rendimiento %:** ahora usa la misma fórmula que `build_rendimiento_mensual()` (ganancia del mes / saldo medio, promedio entre capital de cierre del mes anterior y el actual) — metodología de MyInvestor, ya usada en el KPI de Resumen. Los valores históricos cambiaron respecto a la versión anterior por el motivo explicado arriba.

**Limitación aceptada (decisión explícita del usuario, 10/07/2026):** el backfill de Notion solo llega hasta diciembre 2024; el Sheet tenía historial de capital desde marzo 2024. El gráfico de Capital del tab Inversiones ahora arranca en diciembre 2024 (9 meses menos de historial). No se hizo backfill adicional a Notion para esos 9 meses.

**Validación pre-despliegue:** capital y rendimiento generados por la nueva función se compararon mes a mes contra el `finance_data.json` de producción (fuente Sheets) antes de desplegar. Detalle completo en `docs/DECISIONS.md`, entrada `[2026-07-10]`.

**Secret `GOOGLE_SERVICE_ACCOUNT_JSON`:** ya no se usa en ningún workflow del repo (verificado). Pendiente de borrado manual por el usuario desde GitHub → Settings → Secrets (acción de configuración de seguridad, no delegable).

---

## Tab Inversiones — especificación actual

**Fuente de datos:** `window.FINANCE_STATE.inversiones`, populado en `init()` desde `finance_data.json`. Se actualiza automáticamente con el sync diario — no requiere intervención manual.

**KPIs (4):**
- Capital total = Peerberry + MyInvestor último mes
- MyInvestor capital (último mes)
- Peerberry capital (último mes, muestra '—' si es 0)
- Rendimiento acumulado MyInvestor: producto de (1 + r/100) para todos los meses con % disponible

**Gráfico 1 — Capital apilado:**
- Tipo: `bar` apilado (`stack: 'capital'`)
- Datasets: Peerberry (ámbar), MyInvestor (verde)
- Tooltip muestra total apilado en footer
- Peerberry: activa, con reportes semanales vía Notion — capital de 11.720,08 € reportado el 05/07/2026 (no liquidada; corregido 10/07/2026)

**Gráfico 2 — Rendimiento %:**
- Tipo: `bar` agrupado
- MyInvestor negativo → rojo; MyInvestor positivo → verde
- Peerberry negativo → ámbar tenue; positivo → ámbar sólido
- Eje Y formateado con signo (+/-)
- Desde 10/07/2026: % = ganancia del mes / saldo medio (promedio capital mes anterior/actual), fuente DB Notion "Rendimiento Inversiones". Antes venía de la columna "Rendimiento %" del Sheet (mezclaba depósitos con rentabilidad real).

**Ventana temporal:** dinámica — todos los meses disponibles en la DB Notion "Rendimiento Inversiones" (desde diciembre 2024). Se extiende automáticamente con cada sync.

---

## Escritura de notas en Movimientos — obsoleto (migrado a Notion)

Esta sección describía el flujo antiguo por Google Sheets (`update-sheet-cells.yml`, modo `FIND_AND_UPDATE`, columna K). Ese workflow se eliminó el 30/06/2026. El flujo vigente escribe directo en la DB Notion "Movimientos" vía `notion-update-page` (propiedad Nota, rich text), localizando la página por Fecha+Concepto+Monto exactos. Ver sección "Flujo Organizar Movimientos" más arriba para el detalle completo, incluida la identificación de compras Amazon vía Gmail y el criterio de nota para cuotas/pagos fraccionados.

