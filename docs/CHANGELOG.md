## 2026-07-17 (2)

- Paso 1 de la migración Relay (Movimientos): decidido GitHub Actions en vez de Make, tras chequear que el plan Free de Make solo permite 2 escenarios activos (se reservan para Peerberry/MyInvestor/Nóminas, con trigger por email). Fila del plan en Notion actualizada. Ver `DECISIONS.md` 2026-07-17.

## 2026-07-17 (1)

- Migración de Relay: export completo del workspace (14 workflows) revisado; 5 descartados por no ser del dashboard. Los 9 relevantes guardados en `docs/relay-export/` con `README.md` documentando trigger/procesamiento/escritura/post-acción de cada uno. Fila "4.5" agregada al plan de Notion (flujo Gastos Talho Argentino / Sync Sociedad Data, no cubierto antes). Ver `DECISIONS.md` 2026-07-17.

## 2026-07-14 (10)

- Card "Incrementos" (tab Inversiones): el renglón del mes en curso se estima con el neto de aportes/retiros (categoría "Inversion") cuando falta el reporte de alguna plataforma (ej. MyInvestor mensual todavía no llegó), en vez de mostrar el delta de capital con fill-forward. Se marca "(estimado por aportes)". Ver `DECISIONS.md` 2026-07-14.

## 2026-07-14 (9)

- Gráfico de nómina: promedio móvil se reinicia por etapa (evita falsos positivos al cambiar de ingresos, ej. paro→Between). Panel de outliers: los meses con IRPF siempre aparecen, sin depender del umbral de 15% (fix del caso junio 2026, que coincide con el primer mes de la etapa Luzutania y por eso el criterio estadístico solo nunca lo iba a detectar). Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (8)

- Corrección: gráfico de nómina vuelve a un corte, ahora en enero 2025 (18 meses, todo real). `scripts/sync_finance_data.py`: `NOMINA_INICIO="2025-01"`, `HISTORICO_MANUAL` reducido al override de marzo 2025. Ford (~1.115€/mes) y Valeo (~1.961€/mes, corregido por 14 pagas/año) pasan a nota de texto fija en `index.html`, fuera del gráfico. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (7)

- Gráfico de nómina: histórico completo 2022-01 a 2026-06 (54 meses), reemplaza el corte de abril 2025. `scripts/sync_finance_data.py`: `HISTORICO_MANUAL` (Ford, Valeo estimado, mudanza, paro sin cobrar, marzo 2025 combinado) + fallback real de Movimientos para paro dic 2024-feb 2025 (filtrado por Concepto, fix de un bug de contaminación de categoría en dic 2024) + nuevos campos `etapa` y `estimado` por mes. `js/charts.js`: sombreado por etapa, puntos huecos para estimado, nueva leyenda `#nomina-etapas-legend`. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (6)

- Card de nómina (tab Resumen): layout de dos columnas, gráfico + panel lateral `#nomina-outliers` con los meses que superan en más de 15% el promedio móvil 12m (motivo: IRPF si aplica, o "pago adicional" genérico). `js/charts.js`: `maintainAspectRatio:false` para que el canvas llene su columna. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (5)

- Gráfico de nómina (tab Resumen): incluye devoluciones de Hacienda (IRPF). `scripts/sync_finance_data.py`: `build_nominas()` recibe `movimientos` y suma al mes de cobro los que tengan categoría Nomina + Nota="IRPF". Marcados en Notion: 2025-04-10 (173,57€) y 2026-06-06 (619,54€). `js/charts.js`: puntos IRPF con forma de rombo más grande, tooltip y nueva leyenda `#nomina-irpf-note` con los meses afectados. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (4)

- Corrección sobre la entrada anterior: el gráfico de nómina descarta el histórico de Ford Argentina (2022, conversión ARS→EUR) y arranca en abril 2025. `scripts/sync_finance_data.py`: eliminado `FORD_HISTORICO_EUR`, nueva constante `NOMINA_INICIO = "2025-04"` en `build_nominas()`. Ver `DECISIONS.md` 2026-07-14 (corrección, auditoría 2026-07, orden 9).

## 2026-07-14 (3)

- Tab Resumen: nueva card "Evolución de ingresos (nómina) · interanual" (`index.html`, `#chart-nomina`). Combina la DB Notion "Nominas" (empresa, período) con conversión histórica de las nóminas de Ford Argentina 2022 (ARS → USD dólar blue → EUR, valores fijos en `FORD_HISTORICO_EUR`). Nuevo campo `nominas` en `finance_data.json`, generado por `fetch_nominas_notion()` / `build_nominas()` en `scripts/sync_finance_data.py`. Nueva función `renderNominaTrend()` en `js/charts.js`: serie mensual continua (huecos = período real sin nómina, no huecos de datos), promedio móvil 12m, variación interanual del último mes, período por empresa en texto. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, orden 9).

## 2026-07-14 (2)

- Tab Inversiones: nueva card "Aportes y retiros (categoría Inversion)" (`index.html`, `#inv-aportes-retiros`) y función `renderInvAportesRetiros()` en `js/app.js`. Separa aportes brutos (monto negativo) de retiros (monto positivo) dentro de la categoría Inversion, mes actual y últimos 12 meses; el neto ya no se usa como medida de ahorro. Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, fila 7).

## 2026-07-14

- Sección "Suscripciones" (`js/insights.js`): agregado total anual proyectado junto al total mensual de suscripciones activas, y "ahorro anual conseguido" por las cancelaciones de Microsoft 365, Kindle Unlimited y Wellhub (515,76€/año, calculado sobre el último cargo real de cada una). Wellhub se canceló en junio 2026 (no julio como figuraba en la auditoría). Ver `DECISIONS.md` 2026-07-14 (auditoría 2026-07, fila 5).

## 2026-07-13 (2)

- `scripts/sync_finance_data.py`: nueva función `check_relay_gaps()` — aborta el sync (exit code distinto de 0) si detecta huecos en la carga de Relay: sin fila Semanal de Peerberry en 10 dias, sin fila Mensual de MyInvestor del mes anterior pasado el dia 10, o sin movimientos nuevos en Movimientos en más de 5 dias. Mensajes con prefijo "HUECO RELAY:" para distinguirlos de un fallo de sync. Ver `DECISIONS.md` 2026-07-13 (auditoria 2026-07, fila 2).

## 2026-07-13

- Flujo "Organizar Movimientos": nuevo paso 2 verifica si hay ediciones manuales en Notion (columna nativa `Last edited time`, agregada a la DB Movimientos) más recientes que el `generated_at` de `finance_data.json`; si las hay, dispara `sync-finance-data` antes de continuar. Ver `DECISIONS.md` 2026-07-13 (auditoria 2026-07, fila 1).

## 2026-07-10 (6)

- Grafico "Acumulado vs Benchmark": sombreado por periodo de cartera MyInvestor (GREY hasta jun-2025, RED desde jul-2025, confirmado por email de rentabilidad mensual). Rangos hardcodeados en js/app.js (no hay campo de cartera en finance_data.json); actualizar manualmente si cambia de nuevo.

## 2026-07-10 (5)

- Grafico "Rentabilidad mensual por plataforma": eliminada la linea "Acumulado" (y su serie auxiliar "Cero (acumulado)") — ahora vive sola en el grafico nuevo "Acumulado vs Benchmark". El grafico mensual queda solo con Peerberry, MyInvestor y el punto "Total del mes".

## 2026-07-10 (4)

- Benchmark MSCI World en tab Inversiones (auditoria fila 8): nuevo grafico "Acumulado vs Benchmark" entre rentabilidad mensual y acumulado por año, comparando el TWR de la cartera contra IWDA.AS (iShares Core MSCI World, EUR) desde enero 2025. Dato del benchmark obtenido automaticamente de la API publica de Yahoo Finance en cada sync (sin carga manual, sin dependencias nuevas). Ver DECISIONS.md.

## 2026-07-10 (3)

- Limpieza de archivos obsoletos (auditoria fila 12): eliminados .github/workflows/read-relay-prompt.yml, update-relay-prompt.yml, prompt_relay_current.txt, scripts/update_sheet_cells.py, scripts/read_relay_prompt.py, scripts/find_and_update_nota.py. El prompt de Relay vive en la DB Notion "Prompts para Relay" desde el 09/07/2026; update-sheet-cells.yml (workflow del que dependian estos scripts) se elimino el 30/06/2026. Verificado: ningun otro workflow los referenciaba. Libera el secret GOOGLE_SERVICE_ACCOUNT para borrado seguro (ya no lo usa nada en el repo).

## 2026-07-10 (2)

- scripts/sync_finance_data.py: `build_inversiones()` migrada de Google Sheets a Notion (DB "Rendimiento Inversiones") — capital y rendimiento (%) del tab Inversiones ya no dependen de Sheets ni de GOOGLE_SERVICE_ACCOUNT. Eliminadas funciones de parseo del Sheet (parse_amount, parse_pct, parse_mes_label, parse_date) y credenciales de Google. Nuevo Guard D en sanity_check(). sync-finance-data.yml simplificado (sin instalar librerias de Google). Validado mes a mes antes de desplegar y ejecutado en produccion con exito (20 meses de capital, dic-2024 a jul-2026). El grafico de Rendimiento % cambia de valores respecto al historico (la columna del Sheet mezclaba depositos con rentabilidad real). El grafico de Capital ahora arranca en dic-2024 en vez de marzo-2024 (decision aceptada por el usuario). Ver DECISIONS.md.
- Pendiente accion manual: borrar secret GOOGLE_SERVICE_ACCOUNT_JSON del repo (ya no se usa).

## 2026-07-10

- docs: sincronizada PROJECT_MEMORY.md con el estado real del sistema — seccion obsoleta de notas por columna K reemplazada por puntero a "Flujo Organizar Movimientos"; "Estado actual del sistema" ya no lista Inversiones/insights/anomalias como pendientes (estan implementados); corregida la afirmacion de que Peerberry esta liquidada (activa, capital 11.720,08€ al 05/07/2026). Sin cambios de codigo. Ver DECISIONS.md.
- docs: ROADMAP.md — la tarea "Panel de revision de transacciones" ya no depende del workflow eliminado `update-sheet-cells.yml`; queda marcada para replantear el mecanismo de escritura antes de implementar.

## 2026-07-09 (3)

- sync_finance_data.py: guard de sanidad antes de escribir finance_data.json (aborta si 0 movimientos, caida >10% del conteo, o ganancia de inversiones vacia teniendo datos previos).
- sync-finance-data.yml: crea una issue automatica si el workflow falla (permiso issues: write). Ver DECISIONS.md.

## 2026-07-09 (2)

- docs: corregido el estado de Relay en PROJECT_MEMORY.md — Relay sigue activo escribiendo en Notion (Movimientos y Rendimiento Inversiones); diagrama de pipeline actualizado (Relay→Notion, sin Sheets ni Action de verificacion); parrafos de automatizacion pendiente de Rendimiento Inversiones marcados como operativos. Sin cambios de codigo. Ver DECISIONS.md.

## 2026-07-09

- js/insights.js: `renderSuscripciones()` aplica el corte `RECURRING_HIDE_DAYS` (180 días sin cobro) también a "Otros cargos recurrentes", antes solo afectaba a Suscripciones. Ver DECISIONS.md.

## 2026-07-08 (8)

- Gráfico de rentabilidad mensual: la línea de Acumulado vuelve a tener eje propio (derecho), mientras que barras y rombo comparten el eje izquierdo. Zona negativa del acumulado sombreada en rojo claro. Línea punteada gris marcando el cero en el eje del acumulado (oculta de leyenda y tooltip). Ver DECISIONS.md.

## 2026-07-08 (7)

- Nuevo gráfico en tab Inversiones: acumulado por año — una curva de TWR compuesto por año calendario (reinicia en 0% cada enero), en vez de un solo acumulado histórico. Permite comparar visualmente 2025 vs 2026 en el mismo tramo del año.
- sync_finance_data.py: nuevo campo `acumulado_anio` en `inversiones.rendimiento_mensual`.
- js/app.js: nueva función `renderInvAcumuladoAnual()`. index.html: nuevo canvas `chart-inv-acumulado-anual`.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-08 (6)

- Gráfico de rentabilidad mensual (tab Inversiones): barras y curva de Acumulado ahora comparten un solo eje Y (antes eje dual). Eje X ya no muestra diciembre 2024 (arranca en enero 2025).
- Nuevo indicador: rombo "Total del mes" (rentabilidad combinada Peerberry + MyInvestor, ponderada por capital) sobre cada mes, mismo estilo visual que el rombo de "promedio 3 meses" del gráfico mensual en Resumen.
- sync_finance_data.py: nuevo campo `total` en `inversiones.rendimiento_mensual`.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-08 (5)

- Fix: corregido "Fecha reporte" de la fila Notion "Peerberry febrero 2026" (estaba en 2026-03-02, ahora en 2026-02-23). Causaba que febrero 2026 apareciera vacío en el gráfico de rentabilidad y que marzo tuviera la ganancia de Peerberry duplicada (71,66€ en vez de 24,87€). Ver DECISIONS.md.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-08 (4)

- Tooltip del gráfico de rentabilidad mensual (tab Inversiones) muestra "(sin aportes ese mes)" cuando la variación de capital de esa plataforma en el mes es puramente de mercado (sin depósitos ni retiros). Confirmado que la caída del acumulado en marzo-abril 2025 fue real (pérdida de -380€ y -229€ en MyInvestor sin aportes), no un error de cálculo. Ver DECISIONS.md.
- sync_finance_data.py: nuevos campos `sin_aportes_pb` y `sin_aportes_mi` en `inversiones.rendimiento_mensual`.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-08 (2)

- Fix: rentabilidad mensual de MyInvestor en el gráfico de Inversiones ahora usa saldo medio (promedio capital mes anterior + capital mes actual) en vez de capital del mes anterior, alineado con la metodología que MyInvestor reporta en sus propios mails. Verificado contra el mail de junio (1,8% reportado vs 1,76% calculado). Ver DECISIONS.md.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-08

- Nuevo gráfico en tab Inversiones: rentabilidad mensual por plataforma (barras agrupadas Peerberry/MyInvestor + curva de acumulado TWR compuesto). Ver DECISIONS.md.
- sync_finance_data.py: nuevo campo `inversiones.rendimiento_mensual` en finance_data.json.
- js/app.js: nueva función `renderInvRendimiento()`. index.html: nuevo canvas `chart-inv-rendimiento`.
- Workflow sync-finance-data disparado manualmente para regenerar finance_data.json.

## 2026-07-07 (6)

- KPI de rentabilidad de inversiones: ahora siempre muestra el último mes calendario completo (no el mes en curso), y espera a que MyInvestor haya reportado ese mes antes de mostrarlo. Ver DECISIONS.md.

## 2026-07-07 (5)

- Eliminado el campo "Profit acumulado" de la DB Notion "Rendimiento Inversiones" (no lo consumía sync_finance_data.py). Ver DECISIONS.md.

## 2026-07-07 (4)

- Card "Rentabilidad inversiones" ahora muestra el mes real ("· junio") en vez de "· último mes". Ver DECISIONS.md.
- sync_finance_data.py: nuevo campo `periodo_ultimo_mes` en `inversiones.kpi` (total y por plataforma).
- Workflow sync-finance-data.yml disparado manualmente para regenerar finance_data.json.

## 2026-07-07 (3)

- Revertida la unificación de cards: "Patrimonio invertido" y "Rentabilidad inversiones · último mes" vuelven a ser dos cards separadas. Se mantiene sin la línea "Rentabilidad 12m (compuesta)". Ver DECISIONS.md.

## 2026-07-07 (2)

- Unificadas las cards "Patrimonio invertido" y "Rentabilidad inversiones · último mes" (tab Resumen) en una sola card. Se quita la línea "Rentabilidad 12m (compuesta)". Ver DECISIONS.md.
- js/charts.js: `renderKPIs()` modificado, sin cambios en el cálculo de datos.

## 2026-07-07

- Suscripciones inactivas dejan de mostrarse pasados 6 meses (180 días) sin cobros. Antes quedaban visibles para siempre en la sección colapsable "Inactivas". Ver DECISIONS.md.
- js/insights.js: nueva constante `RECURRING_HIDE_DAYS`, campo `diasSinCobro` en cada registro recurrente, filtro en `renderSuscripciones()`.

## 2026-07-06 (5)

- Unificado el cálculo de capital invertido entre Resumen ("Patrimonio invertido") e Inversiones ("Capital total"): ambos usan ahora `fillForwardCapital()` (js/state.js), antes solo Inversiones aplicaba fill-forward. Corrige discrepancia cuando MyInvestor todavía no reportó el mes en curso. Ver DECISIONS.md.

## 2026-07-06 (4)

- KPI "Rentabilidad inversiones": se retira la linea "Aportado (12m)" (total y por plataforma). Motivo: dependia de reconciliar Movimientos contra emails plataforma por plataforma, categoria "Inversion" mezclada con nomina/traspasos/prestamos - no daba resultado confiable a tiempo razonable. Ver DECISIONS.md.
- sync_finance_data.py: `_kpi_from_series()` simplificado, ya no devuelve `aportes_12m`/`aportes_12m_incompleto`.
- js/charts.js: tarjeta de rentabilidad sin fila de aportado ni nota de dato incompleto.

## 2026-07-06 (3)

- Backfill de Aportes historico MyInvestor: 19 meses (dic 2024 - jun 2026), extraidos de los mails de rentabilidad.
- KPI ya no marca aportes incompleto para MyInvestor en la ventana de 12m.

## 2026-07-06 (2)

- KPI "Ahorro real 12m" reemplazado por "Rentabilidad inversiones": % ultimo mes, % 12m compuesto (TWR), y descomposicion aportado vs generado, total con desglose por plataforma.
- sync_finance_data.py: agregacion semanal/mensual unificada de Rendimiento Inversiones (Peerberry Semanal + MyInvestor Mensual), nuevo bloque inversiones.kpi en finance_data.json.
- Verificado en produccion: sync + deploy exitosos.

## 2026-07-06

- DB Notion "Rendimiento Inversiones": agregados campos `Aportes` (number) y `Profit acumulado` (number).
- Backfill Peerberry junio 2026 desde mails semanales reales: 3 filas Semanal nuevas (07/06, 14/06, 21/06) y fila 28/06 completada. Cadena de Profit verificada.
- Convencion nueva documentada: Peerberry semanal, MyInvestor mensual (ver DECISIONS.md 2026-07-06).

## [2026-07-04] (fix)
- Corregida atribucion de mes en `inversiones.ganancia` para Peerberry: reportes que llegan el lunes de los primeros dias de un mes (cadencia semanal fija de Peerberry) ahora se atribuyen al mes que cierran, no al de recepcion. Afecto solo feb/mar 2026.

## [2026-07-04]
- KPI "Ahorro real · ultimos 12 meses" (tab Resumen) ahora usa Ganancia EUR real de la DB Notion "Rendimiento Inversiones" en vez del % de rentabilidad del Sheet (que mezclaba depositos con retorno). Nuevo campo `inversiones.ganancia` en finance_data.json. Ver DECISIONS.md para detalle y limitacion conocida de atribucion de mes en Peerberry.

## [2026-07-03] — Backfill Peerberry Rendimiento Inversiones: Enero 2025 completado, 16 meses pendientes

### Añadido
- 1 registro mensual de Peerberry (enero 2025): Ganancia 20,24€, Capital 2.799,64€, Fecha 2025-01-27.
- Método de extracción de correos de Peerberry validado: `Gmail:get_thread` → plaintextBody (descarte HTML posterior).

### Pendiente
- Peerberry: 16 meses (feb 2025 – may 2026). Todos los thread IDs ya identificados, procesamiento iniciado en tandas de 1-2 meses por sesión para gestionar costo de contexto (~20-30k tokens por correo HTML).

Detalle: `docs/DECISIONS.md`, entrada `[2026-07-03] Backfill Peerberry (sesión 1)`.

## [2026-07-03] — Rendimiento Inversiones: MyInvestor completo (19 meses, dic 2024-jun 2026), Peerberry a 2 meses

### Añadido
- 6 registros mensuales de MyInvestor cargados (dic 2025, ene-may 2026), completando el histórico dic 2024 – jun 2026 sin huecos.
- 1 registro mensual de Peerberry (dic 2024), más el baseline de Profit de nov 2024 (206,73€, no cargado como fila, usado solo para el cálculo).

### Pendiente
- Peerberry: 17 meses (ene 2025 – may 2026). Anchors (thread IDs de Gmail) ya identificados, ver `docs/DECISIONS.md` para la lista completa y el método de cálculo (`Profit(mes) − Profit(mes anterior)`). Pausado por costo de contexto de los correos de Peerberry (HTML completo por correo, no hay forma de pedir solo el texto plano).
- Configurar en Relay.app las reglas de parseo de ambos correos hacia esta DB (especificación completa en `docs/DECISIONS.md`).
- Reescribir `build_inversiones()` en `sync_finance_data.py` para leer de esta DB en vez de la hoja Inversiones, una vez el backfill de Peerberry esté completo.

Detalle en `docs/DECISIONS.md`, entrada `[2026-07-03] Backfill Rendimiento Inversiones: MyInvestor completo`.

## [2026-07-03] — Rendimiento Inversiones: DB creada en Notion, backfill parcial (13 meses MyInvestor)

### Añadido
- Nueva DB Notion "Rendimiento Inversiones" (data source `93eda06b-9207-4589-b3f0-66be10ab9caf`, en Finance Tracker): Fecha, Plataforma (Peerberry/MyInvestor), Periodo (Semanal/Mensual), Ganancia, Capital total, Fecha reporte. Reemplazará la hoja Inversiones de Sheets para capital y rendimiento.
- 13 registros mensuales de MyInvestor cargados (dic 2024, ene-nov 2025, jun 2026), extraídos manualmente de los correos "Rentabilidad de tu cartera en [mes]".
- 1 registro semanal semilla de Peerberry (semana cerrada 28/06/2026).
- `js/insights.js`: `getRendimientoLastMonths` corregido para convertir el campo "Rendimiento %" del Sheet a euros multiplicando por el capital del mes correspondiente, en vez de sumarlo como si ya fuera un importe en euros.

### Pendiente
- Backfill: dic 2025 – mayo 2026 de MyInvestor, historial completo de Peerberry (dic 2024 en adelante).
- Configurar en Relay.app las reglas de parseo de ambos correos hacia esta DB (especificación completa en `docs/DECISIONS.md`).
- Reescribir `build_inversiones()` en `sync_finance_data.py` para leer de esta DB en vez de la hoja Inversiones, una vez el backfill esté completo y Relay esté configurado.

Detalle de la verificación de correos y decisiones en `docs/DECISIONS.md`, entrada `[2026-07-03] Backfill parcial Rendimiento Inversiones`.

## [2026-07-03] — Fase 2: Suscripciones, KPI Ahorro real e Insights automáticos

### Añadido
- `js/insights.js` — nuevo módulo (cargado entre `filters.js` y `charts.js`): detección de cargos recurrentes por cadencia mensual, clasificación suscripciones vs. financiación/recibos, alias de suscripciones conocidas, insights mensuales y helpers de ahorro real.
- Sección "Suscripciones" en el tab Resumen (`#subs-card`): suscripciones activas con total €/mes, inactivas en gris (verificación de cancelaciones — M365, Kindle y Wellhub pasarán a "Sin cobros" al cumplirse 45 días sin cargo), y "Otros cargos recurrentes" colapsado.
- Bloque "Insights" en el tab Resumen (`#insights-card`): variación de gasto del último mes completo vs. el previo, top 3 variaciones por categoría (≥50€) y alertas de gasto fuera de rango histórico (media + 2σ de 6 meses).
- Cuarta tarjeta KPI "Ahorro real · últimos 12 meses" en `renderKPIs` (charts.js): balance líquido + rendimiento de inversiones, con desglose de aportes netos y tasa de ahorro real.

### Cambiado
- `index.html`: import de `js/insights.js` y dos contenedores nuevos en el panel Resumen.
- `js/app.js`: `renderResumen()` llama a `renderInsights()` y `renderSuscripciones()`.

### Validado
- `node --check` sobre los 5 módulos JS.
- Lógica ejecutada contra `finance_data.json` real (2.494 movimientos): 11 suscripciones detectadas, 5 activas (29,96€/mes), insights junio vs mayo coherentes.

Detalle de decisiones en `docs/DECISIONS.md`, entrada `[2026-07-03] Fase 2 analítica`.

## [2026-07-01] — Fix: gráfico Talho Argentino, gasto semanal y acumulado en escalas distintas

### Corregido
- `js/app.js`: chart `chart-talho-bars` (tab Talho Argentino) usaba dos ejes Y (`y` para gasto semanal, `y2` para acumulado), cada uno con su propia escala, dificultando la comparación visual. Ambos datasets ahora comparten el eje `y` con la misma escala. Eje `y2` eliminado de `scales`.

## [2026-06-30] — Fix: KPI "Sin analizar por Claude" mostraba 241 en vez del conteo real

### Corregido
- `deploy-pages.yml`: agregado `reviewed_movements.json` a los archivos copiados a `_site/`. Había quedado afuera al filtrar el artifact (entrada anterior del mismo día), rompiendo el `fetch` que el frontend hace a ese archivo y haciendo que el KPI contara todos los candidatos como no revisados. Detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Fix: filtrado del artifact rompió el KPI "Sin analizar por Claude"`.



### Agregado
- `deploy-pages.yml`: nuevo step que arma `_site/` con solo `index.html`, `js/`, `finance_data.json`, `sociedad_data.json`, `.nojekyll` antes de publicar.

### Eliminado
- `debug_log.txt` y `tmp_sheet_debug.txt` — archivos sueltos en la raíz con movimientos personales en texto plano, resabios de sesiones de diagnóstico previas.

### Corregido
- Causa real de `deployment_queued` indefinido (síntoma recurrente durante toda la sesión, sobrevivió al cambio de Source y al fix del trigger): el environment `github-pages` quedó corrupto por la sucesión de deployments cancelados durante el debugging. Borrado manualmente desde Settings → Environments y recreado limpio. Verificado con ciclo completo exitoso. Detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Optimización: deploy de Pages filtrado + causa real de deployment_queued resuelta`.

### Resultado
- El sitio público ya no expone `docs/`, `scripts/`, `prompt_relay_current.txt` ni `reviewed_movements.json`.
- Ciclo botón Actualizar → sync → commit → deploy automático → success, confirmado de punta a punta.



### Cambiado
- `.github/workflows/sync-finance-data.yml` y `.github/workflows/sync-sociedad-data.yml`: agregado step `Trigger Pages deploy` que ejecuta `gh workflow run deploy-pages.yml` tras un commit exitoso. Agregado permiso `actions: write` a ambos.

### Corregido
- El botón "Actualizar" disparaba los syncs y estos comiteaban `finance_data.json`/`sociedad_data.json` correctamente, pero el deploy del sitio nunca se activaba — los pushes hechos con `GITHUB_TOKEN` automático no disparan otros workflows por diseño de GitHub (previene loops de automatización). Verificado con ciclo completo: sync → commit → deploy automático → success. Detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Fix: botón "Actualizar" no disparaba deploy tras el cambio a GitHub Actions`.



### Agregado
- `.github/workflows/deploy-pages.yml` — workflow propio de deploy (trigger: push a `main`, `workflow_dispatch`; usa `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`; `concurrency` con `cancel-in-progress`).

### Cambiado
- Settings → Pages → Source: de "Deploy from a branch" a "GitHub Actions".

### Corregido
- El intento anterior (`.nojekyll`, ver entrada de abajo) resultó insuficiente: el deployment seguía trabándose en `deployment_queued` indefinidamente. La causa real era el modo legacy "Deploy from a branch", que gestionaba mal la concurrencia entre deployments encadenados (varios commits seguidos de los workflows de sync + docs). El nuevo workflow vía Actions resuelve esto de raíz — verificado con un ciclo completo real (sync → commit → deploy → success en segundos, sin colas). Detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Fix definitivo: GitHub Pages cambiado a "GitHub Actions" como Source`.

## [2026-06-30] — Fix (insuficiente, ver entrada de arriba): deployment de GitHub Pages bloqueado por build de Jekyll

### Agregado
- `.nojekyll` (archivo vacío en la raíz) — desactiva el procesamiento Jekyll de GitHub Pages, innecesario para este sitio estático puro.

### Corregido
- El botón "Actualizar" del dashboard quedaba bloqueado ~4 minutos en "deployment queued" por builds de Jekyll fallidos en commits previos de documentación. Con `.nojekyll`, los deployments vuelven a completar en segundos. Detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Fix: GitHub Pages bloqueado por build de Jekyll fallido`.



### Eliminado
- `.github/workflows/update-sheet-cells.yml` — obsoleto, Relay ya no escribe en Sheets.
- `.github/workflows/find-update-nota.yml` — obsoleto por el mismo motivo.

### Cambiado
- Flujo "Organizar Movimientos": la escritura de categoría y nota ahora usa `notion-update-page` vía MCP (localizando la página por fecha+concepto+monto) en vez de `update-sheet-cells.yml`. Detalle completo en `docs/PROJECT_MEMORY.md`, sección "Flujo Organizar Movimientos".
- Relay configurado para escribir solo en Notion (sin paralelo con Sheets, por decisión del usuario — se saltó la fase de validación de 1-2 semanas).

### Sin cambios
- `update-relay-prompt.yml` y `read-relay-prompt.yml` se mantienen activos.
- Hoja Inversiones en Sheets sigue en uso normal — su migración a Notion queda como fase futura sin fecha.

### Estado
- Google Sheet Movimientos deja de recibir escrituras desde hoy. Queda como histórico de solo lectura.
- Migración completa: detalle en `docs/DECISIONS.md`, entrada `[2026-06-30] Migración Sheets → Notion: completada (8/8 pasos)`.



### Añadido
- `sync_finance_data.py` reescrito: la sección Movimientos ahora lee de la API REST de Notion (`POST /v1/data_sources/{id}/query`, `Notion-Version: 2025-09-03`, paginado vía `start_cursor`/`has_more`) en vez de Google Sheets. La sección Inversiones no cambió, sigue leyendo Sheets.
- Workflow `sync-finance-data.yml` actualizado: nuevas env vars `NOTION_TOKEN` (secret existente) y `NOTION_MOVIMIENTOS_DATA_SOURCE_ID`; dependencia `requests` agregada al step de instalación.
- Integración "Notion Talho" (la del secret `NOTION_TOKEN`) conectada manualmente a la página Finance Tracker en Notion — no estaba conectada, causaba 404 en las queries.

### Validado
- 3 dispatches manuales del workflow en producción: 2 fallos diagnosticados (versión de API incorrecta, integración sin conectar) y corregidos, 1 éxito confirmado.
- `finance_data.json` generado con 2473 movimientos (2465 históricos + movimientos del 29/06 cargados en la prueba de Relay→Notion), 28 meses de capital y 11 de rendimiento en Inversiones — estructura idéntica a la versión anterior basada en Sheets.

### Decisión
Se saltó la fase de comparación en paralelo (paso 4 del plan original) y se desplegó directo a producción. Detalle completo en `docs/DECISIONS.md`, entrada `[2026-06-30] Migración Sheets → Notion: pasos 3-4 completados`.

## [2026-06-30] — Verificación de salud: prueba Relay → Notion (29/06/2026)

### Verificado
- 8 movimientos del 29/06/2026 comparados campo por campo entre Google Sheets (origen) y Notion (destino de la prueba del nuevo flujo de Relay): fechas, montos y conceptos coinciden exactos en los 8. Categoría y nota coinciden en 7/8; la discrepancia en "Kerastase" (Compras vs. Salud y Belleza, nota "Regalo Joha" faltante en Notion) se debió a una edición manual posterior en Sheets, no a un fallo del flujo de Relay. Prueba validada como correcta.



### Añadido
- Análisis de los 65 movimientos categorizados como "Otros" entre enero y junio 2025 (35 conceptos únicos).
- Identificación vía búsqueda web de 10 conceptos: SANITAS S A SEG. (seguro médico) → Salud y Belleza; DIGI SPAIN TELEC. y ORANGE JAEN ROLDA (operadores móviles) → Suscripciones; NYX*AIRservSpain (inflado de neumáticos en gasolineras) → Gastos coche; ARBITRADE CENTRO (vending, ya confirmado en lote anterior) → Comer afuera; ESTETICA ECOLOGIC y ROSA CREMA S.L. (cosmética/estética) → Salud y Belleza; JOMISOLEO HOSTALG (gasolinera Repsol, Madridejos) → Combustible; HOTEL PARQUESUR (hotel Leganés) → Salidas; LASER B360 (depilación láser, confianza media) → Salud y Belleza.
- 23 movimientos recategorizados vía `update-sheet-cells.yml` (FIND_AND_UPDATE, columna D), protocolo batch aplicado.
- Caso especial: dos movimientos NYX*AIRservSpain idénticos (misma fecha 10/05/2025, mismo importe -1,50€) requirieron 2 dispatches separados — FIND_AND_UPDATE solo actualiza una coincidencia por llamada cuando hay filas duplicadas exactas.
- Resultado: "Otros" en el rango bajó de 65 a 43 movimientos, y de -881,58€ a -159,31€.

### Sin recategorizar (quedan en "Otros")
25 conceptos sin confirmación suficiente: Ssrr (9 apariciones), BIZUM ENVIADO/RECIBIDO sin comercio identificable (5), HNOS BOLIVAR MAYA, SumUp *Glenhurst, MALAGA EXPESS, Adelanto honorari, PARAISO ESTACION, VALDEPEaAS, OUIGO Espana, Buckaroo *appw, My Investor, CUSTODIA.FONDOS, CA JERO SERVIRED/CAJERO SERVIRED/COSTE USO CA JERO (retiros de cajero), PRECIO SERV.ALERTAS, TRANSF. A SU FAVOR, TRANSFER INMEDIATA, ONE HUNDRED RESTR, MOVILIDAD ACM, TRASPASO, ABON.TARJ.CREDITO (abono sin comercio asociado, correcto como está).

## [2026-06-30] — Recategorización de movimientos "Otros" (últimos 12 meses)

### Añadido
- Análisis de los 39 movimientos categorizados como "Otros" en los últimos 12 meses (22 conceptos únicos, 5 recurrentes investigados una sola vez y aplicados a todas sus apariciones).
- Identificación vía Gmail (cuando había recibo) y búsqueda web (identificación de comercio) de 8 conceptos: MARVIZA (barbería/estética, Sanse) → Salud y Belleza; MYCARD (cuota tarjeta crédito CaixaBank) → Tarjeta; DELIKIA SP y ARBITRADE CENTRO (vending, café/snacks) → Comer afuera; BALCON DEL PARQUE y CASA CARMEN (restaurantes) → Comer afuera; SERICA SUBIRATS S (gasolinera) → Combustible; SOBRIAUTO (taller chapa y pintura, Leganés) → Gastos coche.
- 15 movimientos recategorizados vía `update-sheet-cells.yml` (FIND_AND_UPDATE, columna D), protocolo batch aplicado (Relay pausado antes de los 15 dispatches, reactivado después).
- Movimientos marcados en `reviewed_movements.json` (2318 entradas).
- Movimiento UBER * EATS PEN (29/06/2026, -23,89€) marcado como revisado — ya estaba correctamente categorizado, solo faltaba el registro.

### Sin recategorizar (quedan en "Otros")
14 conceptos sin confirmación suficiente: CAIXABANK PAYMENT (probable cuota DIGI móvil, sin recibo directo), RUKITECH (única empresa con ese nombre encontrada es japonesa, no aplica), DAILY, MADRI, TCB 2025 GIRA 2, COBRO, CUSTODIA.FONDOS, PRECIO SERV.ALERTAS, P.SERV.CERTIF., CAZALEGAS, DONAELIA SL, T214, SARANDRE SL, ESTANCO ALCOBENDA, ESTETICA ECOLOGIC, CRED MA JADAHONDA, AMAZON* ZL2PP1154.

## [2026-06-30] — Migración Sheets → Notion: inicio (pasos 1-2)

### Añadido
- DB `Movimientos` creada en Notion (hija de Finance Tracker), schema: Fecha, Concepto, Monto, Categoria (select, 20 opciones), Nota.
- 2.465 movimientos históricos importados manualmente vía CSV exportado del Sheet.
- Verificación de integridad post-importación: conteo exacto (2.465/2.465), distribución por categoría coincide a centavo en las 19 categorías presentes, patrón de duplicados idéntico al origen.

### Corregido
- Nota residual "TEST — borrar" en AMAZON.ES (4/06/2026, -6,49€) — arrastrada de una prueba anterior no limpiada antes de exportar el CSV. Corregida a "Libro Kindle 'Inside Delta Force'" directamente en Notion.

### Pendiente
- Eliminar manualmente página vacía `[BORRAR — creada por error]` en la DB Movimientos (creada por error de tooling, sin herramienta de borrado vía MCP).
- Pasos 3-8 del plan de migración: reescritura de `sync_finance_data.py`, configuración de Relay→Notion en paralelo, validación, desactivación de Sheets como destino de escritura, actualización del flujo "Organizar Movimientos".

## [2026-06-29] — Auditoría y corrección de notas (col K)

### Corregido
- Auditadas las 52 notas de la columna K cruzando con Gmail, Calendar y verificación de comercios.
- Detectado desfase sistemático: notas de compras Amazon/ropa duplicadas o desplazadas a movimientos vecinos no relacionados.
- 19 correcciones aplicadas vía FIND_AND_UPDATE (14 limpiezas + 5 reubicaciones), trigger Relay pausado, espaciado 30s.
- APPLE.COM/BILL -29,99€ reetiquetado como LinkedIn Premium Career (verificado en factura Apple).
- Notas con valor: 52 → 43. Verificado contra JSON regenerado tras sync.

## [2026-06-24] — Tab Talho: sección Gastos de la sociedad

### Añadido
- Segunda sección en el tab Talho Argentino: `Gastos de la sociedad`.
- Gráfico de barras apiladas por semana: columna Mati (rojo) y Willy (ámbar), sobre eje Y izquierdo.
- Curva de acumulado (azul, eje Y derecho) con relleno, igual que el gráfico de Matias.
- Línea horizontal discontinua en 75.000€ con leyenda `Presupuesto`.
- Tabla de transacciones con columna `Pagado por` y selector de mes.
- Pie de tabla desglosa total Mati / Willy.
- Datos obtenidos en runtime desde Notion DB `Gastos del local` (ID `38933ce50e6880b9899beedec9156145`) vía REST API.
- Constantes `NOTION_TOKEN` y `NOTION_DB_ID` añadidas al bloque `<script>` de `index.html`.
- Función `renderSociedad()` en `app.js`; caché en `_sociedadData` para evitar re-fetch en cada renderizado.
- El gráfico de Matias se renombra visualmente con cabecera de sección `GASTOS DE MATIAS` y el nuevo bloque lleva `GASTOS DE LA SOCIEDAD`.

## [2026-06-23] — Tab Talho Argentino

### Añadido
- Nueva solapa `Talho Argentino` en el dashboard.
- Gráfico de barras (Jan–mes actual) con gasto mensual de la categoría `Talho Argentino`.
- Lista de transacciones con selector de mes para filtrar.
- `renderTalho()` en `app.js`; dispatch en `switchTab`.
- Sin cambios en el tratamiento de `Talho Argentino` en el resto del dashboard.

## 2026-06-23 — Organizar Movimientos

### change
- Movimientos del 22/06/2026 revisados: AMAZON.ES (-9,99€ Compras), Heladeras Talho A (-6.723,97€ Talho Argentino), Gastos conjuntos (-50€), 2x TRANSFER INMEDIATA Guille.
- PAYPAL EUROPE S. del 12/06 (-197,37€) consolidado con reintegro TRANSFER. EN DIV. del 22/06 (+164,43€): fila del reintegro eliminada, fila original actualizada a neto -32,94€. Nota en col K explicando el cobro anual erróneo de Relay.
- Mayo 2026: Amazon Prime (-4,99€, 05/05) y RECIBO VIVAGYM (-34,9€, 04/05) marcados como revisados.
- `reviewed_movements.json`: +8 entradas.

## 2026-06-18 — Organizar Movimientos

### change
- Ejecutadas las 4 fases del flujo: PayPal y Uber sin pendientes (al día). Amazon: 1 movimiento procesado. Viajes: 4 movimientos reclasificados.
- `WWW.AMAZON -6,84` (16/06, Compras): nota añadida en col K tras confirmar en Gmail el pedido (BEAST RAGE Guantes de Fitness, 14/06, importe exacto).
- 4 movimientos de Combustible (12/05: MOEVE TRUJILLO II x2, BP CAIADA, MOEVE ESTREMOZ N) reclasificados a Viajes — corresponden al viaje a Portugal (08-10/05) dentro del buffer de 3 días.
- Verificado Google Calendar hasta 18/06: no hay viajes nuevos pendientes de añadir a `TRIP_WINDOWS`.
- `reviewed_movements.json`: +5 entradas.

## 2026-06-10

### fix: KPI "Sin analizar por Claude" siempre incorrecto
- `js/app.js`: `reviewed_movements.json` es un array plano; el código leía `rrData.reviewed` (undefined) → `reviewedMovements` siempre vacío → KPI nunca marcaba nada como revisado. Corregido a `Array.isArray(rrData) ? rrData : (rrData.reviewed || [])`.

### fix: Update Sheet Cells workflow fallaba por secret incorrecto
- `.github/workflows/update-sheet-cells.yml`: referenciaba `secrets.GOOGLE_SERVICE_ACCOUNT` en lugar de `secrets.GOOGLE_SERVICE_ACCOUNT_JSON`. Causa directa de todos los errores de email de GitHub Actions.
## 2026-06-09 — Fix workflows: control de concurrencia y versiones de actions

### fix
- `sync-finance-data.yml`: añadido bloque `concurrency` (group: sync-finance-data, cancel-in-progress: false) para evitar colisiones en git push cuando se lanzan varias ejecuciones simultáneas. Las ejecuciones concurrentes fallaban con exit code 128 (git push rechazado por no-fast-forward).
- `read-relay-prompt.yml`: ídem concurrencia + actualización de actions obsoletos: `checkout@v3` → `@v4`, `setup-python@v4` → `@v5`, `python-version: '3.11'` → `'3.12'`. Los actions v3/v4 corren sobre Node 20, que GitHub Actions depreca el 16 jun 2026.

### root cause
Los fallos del 4 jun 2026 tuvieron dos causas distintas:
1. **Sync Finance Data**: múltiples ejecuciones manuales simultáneas durante una sesión de desarrollo. La primera en completar el push bloqueaba a las demás (non-fast-forward), provocando exit code 128 en el step "Commit and push".
2. **Read Relay Prompt**: workflow en desarrollo iterativo (3 ejecuciones con errores en 2 minutos) antes de estabilizarse. Mismo patrón de conflicto en push. Adicionalmente, usaba actions Node 20 ya advertidos como deprecados.

---

## 2026-06-05 — Mejoras prompt de categorización Relay

### change
- `Suscripciones`: añadidos SANITAS (seguro médico) y DIGI SPAIN (telco)
- `Suscripciones`: eliminado MOVILIDAD ACM (era incorrecto)
- `Gastos coche`: añadido MOVILIDAD ACM (parking/movilidad)
- `Inversion`: añadido CUSTODIA.FONDOS (comisión custodia de fondos)
- `Supermercado`: eliminado SANSE I (era ambiguo con Combustible)
- `Casos especiales`: SANSE I → Combustible por defecto, Supermercado si contexto de alimentación; PAYPAL EUROPE ≤15€ recurrente → Suscripciones

---

## 2026-06-05 — Notas en el flujo + correcciones

### change
- Fase 5 "Notas (col K)" añadida formalmente al flujo "Organizar Movimientos": enriquecimiento en cascada Amazon→Gmail / recibo→Gmail / tienda→web / blanco
- Movimiento Microsoft 365 (PAYPAL EUROPE, fila 279) reclasificado de Compras a Suscripciones

---

## 2026-06-05 — Nota en el flujo + recategorización Microsoft

### feat
- El enriquecimiento de Nota (col K) se incorpora como paso 7 del flujo "Organizar Movimientos" (Amazon/Gmail → recibo Gmail → web → blanco)

### fix
- `PAYPAL EUROPE -10,00` (Microsoft 365 Personal) recategorizado de Compras a Suscripciones

---

## 2026-06-05 — Campo Nota en movimientos

### feat
- Columna **K "Nota"** en hoja Movimientos: texto libre por movimiento, visible en tablas de transacciones (tab Categorías y explorador principal)
- `sync_finance_data.py` mapea la cabecera "nota" e incluye `nota` en cada movimiento de `finance_data.json`
- Backfill de notas en *Compras* de los últimos 3 meses, enriquecidas cruzando con Gmail (productos Amazon, recibos) y búsqueda web de tiendas

### fix
- Restaurada la columna E (filtro de positivos para gráficos) tras sobrescritura accidental: valores recompuestos como importe>0 ? importe : 0. Documentado que E–J están en uso y K es la primera columna libre

---

## 2026-06-04 — Flujo "Organizar Movimientos" + KPI pendientes

### feat
- Trigger "Organizar Movimientos" en el chat de Claude ejecuta flujo de 4 fases: PayPal+Gmail, Uber, Amazon, Viajes
- `reviewed_movements.json` registra qué movimientos ya fueron presentados al usuario — persiste entre sesiones
- KPI "Sin analizar por Claude" en tab Resumen: muestra en ámbar con borde si hay pendientes, verde si está al día
- Al iniciar el dashboard se carga `reviewed_movements.json` para el cálculo del KPI
- El KPI incluye el trigger como recordatorio inline

---

## 2026-06-04 — Vista ampliada de Viajes en tab Categorías

### feat
- Al filtrar por "Viajes" en el tab Categorías aparece una sección con desglose por viaje
- Cada viaje muestra: nombre, fechas, total gastado, desglose por subcategoría (Combustible, Peajes, Alojamiento, Transporte, Comida y otros) y lista colapsable de transacciones individuales
- `TRIP_WINDOWS` en `app.js` define los viajes conocidos — actualizar manualmente al añadir nuevos
- `tripSubcategory(concepto)` infiere la subcategoría a partir del concepto del movimiento
- `renderTripBreakdown(data)` renderiza las cards, respeta el filtro de mes activo
- Contenedor `#trip-breakdown` añadido en `index.html`, oculto por defecto

---

## 2026-06-03 — Gasto neto en categorías reembolsables

### feat
- Los ingresos categorizados en Viajes, Club, Combustible, Comer afuera, Salidas o Gastos en conjunto restan al gasto de esa categoría
- El gráfico mensual, el donut, la tabla de categorías y los KPIs muestran gasto neto
- Los ingresos de estas categorías no cuentan como ingreso real en los totales
- `netExpenseByCategory()` centraliza el cálculo en `charts.js`
- `reimbursableCategories` declarado en `state.js` — editable sin tocar lógica

---

## 2026-06-03 — Botón Actualizar

### feat
- Botón "↻ Actualizar" en el header: dispara el workflow `Sync Finance Data` via GitHub Actions API
- Muestra countdown de 90s y recarga la página automáticamente al completarse
- Mensaje de estado inline ("Sincronizando · recargando en Xs") durante la espera
- En caso de error muestra mensaje y resetea el botón a los 6s

---

## 2026-06-02 — Click-to-filter en gráfico de categorías

### feat
- Tab Categorías: click en una barra filtra la tabla de transacciones inferior a esa categoría
- Toggle: click en la misma barra (o en área vacía) limpia el filtro
- Barras no seleccionadas se atenúan (opacidad 0.25) para indicar el filtro activo
- Header del card de transacciones actualizado dinámicamente: muestra categoría activa, nº de movimientos y botón "Ver todas"
- Click en fila de la tabla de resumen por categoría también activa el filtro
- `activeCatBarFilter` se resetea al cambiar de mes o al salir del tab

---

## 2026-06-02

### fix
- Gráfico mensual (Ingresos vs Gastos) fijado a los últimos 12 meses del dataset, sin depender de ningún filtro.
- Eliminadas las pills de periodo (6m / 12m / Todo) del tab Resumen — eran redundantes dado el comportamiento fijo.
- Selector de mes en tab Resumen movido al interior del card «Gastos por categoría» y desconectado del gráfico mensual; solo afecta al donut.
- `filteredData()` en `filters.js` simplificado: ya no aplica `activePeriod` (el gráfico mensual usa directamente `getLast12MonthsData()`).

---

## 2026-06-02

### fix
- `sync_finance_data.py`: corregido bug en `build_inversiones` donde Peerberry y MyInvestor se sobreescribían mutuamente al estar en filas separadas del mismo mes. Ahora se acumula el último valor no-nulo de cada columna (D=Peerberry, E=MyInvestor) de forma independiente por mes.
- Corregido nombre de hoja: `finanzas` → `Inversiones`.

---

## 2026-06-02

### fix
- Corregido nombre de hoja en sync_finance_data.py: `FINANZAS_SHEET = "Inversiones"` → `"finanzas"`. El script intentaba leer una hoja inexistente, causando que inversiones (Peerberry y MyInvestor) no se cargaran en finance_data.json.
## [2026-06-04]
### Eliminado
- Gráfico "Rendimiento mensual por plataforma" (chart-inv-pct) eliminado del tab Inversiones. No aportaba valor práctico; se sustituirá en sesión futura por una visualización más útil.

## [2026-06-02] — Inversiones: datos dinámicos desde el sheet

### Cambio arquitectónico
- Los datos de inversión ya **no están hardcodeados** en `renderInversiones()`
- El workflow diario `sync-finance-data.yml` ahora lee también la hoja `Inversiones` del Finance Tracker
- `finance_data.json` pasa a tener estructura `{ movimientos: [...], inversiones: { capital: [...], rendimiento: [...] } }`
- El frontend detecta automáticamente el formato nuevo vs. el legado (array plano)
- `renderInversiones()` lee de `window.FINANCE_STATE.inversiones`

### Detalles técnicos
- Hoja `Inversiones`: col A = fecha, D = Peerberry capital, E = MyInvestor capital
- Script toma el último registro de cada mes (datos semanales)
- Tabla de rendimiento % detectada por cabecera con "peerberry" + "%"
- Lectura de hoja `finanzas` con fallback graceful si falla
- Resultado verificado: 26 meses de capital, 11 meses de rendimiento %

## [2026-06-02] — Tab Inversiones

### Nuevas funcionalidades
- Nuevo tab **Inversiones** con tres secciones:
  - **4 KPIs**: Capital total, MyInvestor capital, Peerberry capital, Rendimiento acumulado MyInvestor
  - **Gráfico de barras apiladas**: evolución mensual del capital por plataforma (Peerberry + MyInvestor), jul-25 → jun-26
  - **Gráfico de rendimiento %**: barras mensuales de % por plataforma; barras negativas en rojo para MyInvestor, en ámbar tenue para Peerberry

### Fuente de datos
- Datos embebidos en `renderInversiones()` desde la hoja `finanzas` del Finance Tracker (lectura 01/06/2026)
- Col D = Peerberry capital (último registro del mes), Col E = MyInvestor capital
- Peerberry liquidó en diciembre 2025 (capital = 0 desde dic-25)
- El rendimiento acumulado se calcula como producto de (1 + r/100) sobre todos los meses con datos de %

## [2026-06-02]

### Gráfico Guille
- El gráfico de barras/línea del tab Guille ahora muestra solo los últimos 12 meses disponibles en los datos
- El saldo acumulado (línea) sigue calculándose desde el origen completo para que el valor sea correcto, pero solo se visualizan los últimos 12 puntos
- El título del card se actualizó para reflejar el filtro

### Mobile responsive
- Header: padding lateral reducido a 24px (desktop) / 14px (mobile); altura 52px
- Tabs: `width:100%` con `flex:1` en cada tab — ocupan todo el ancho en cualquier pantalla
- `.filter-row`: `flex-wrap:wrap` para evitar overflow en pantallas estrechas
- `select`: `flex:1; min-width:0; max-width:220px` — se adapta al espacio disponible
- `.card`: padding reducido a `14px 12px` en mobile
- `.chart-wrap-xtall`: reducido de 420px a 340px (desktop) y 260px (mobile)
- `.chart-wrap-tall`: 240px en mobile; `.chart-wrap`: 200px en mobile
- Tablas: font-size 12px, padding celdas `8px 8px` en mobile
- KPIs Guille: `font-size: clamp(16px, 4vw, 22px)`
- `.cat-badge`: `font-size:11px; white-space:nowrap`
- Media query `@media(max-width:380px)`: oculta header-meta, reduce font de tabs a 11px

# Changelog

## 2026-06-02 (mejora visual gráfico Guille)
- feat: Gráfico Guille — eje Y dual: barras en eje izquierdo (escala depósitos/gastos ~300–2000€), línea de saldo en eje derecho (escala acumulada ~-2700 a +11000€). Ambos ejes formateados en EUR.
- feat: Área rellena bajo la línea de saldo acumulado (fill: true, rgba azul suave).
- feat: Puntos de la línea con borde azul y fondo blanco para mejor legibilidad sobre las barras.
- feat: Tooltip unificado (mode: index) — muestra Depositado, Gastado y Saldo acumulado al pasar por cualquier mes.
- feat: Tooltip con fondo blanco y borde sutil, consistente con el design system.
- feat: Bordes redondeados en barras (borderRadius: 3).
- feat: Grid del eje X oculto; grid del eje Y izquierdo con color suave rgba(0,0,0,0.05).
- feat: Nueva clase CSS `.chart-wrap-xtall` (420px) aplicada al gráfico de Guille para dar espacio a 18 meses.

## 2026-06-02 (auditoría completa)
- fix: renderMonthly usaba getLast12MonthsData() ignorando filtros activos. Ahora consume filteredData().
- fix: formatEUR duplicado en app.js eliminado. Fuente única en charts.js.
- fix: Pill "Todo" llamaba setPeriod(24) en lugar de setPeriod(999).
- fix: Header #last-updated nunca se rellenaba. Ahora muestra fecha del movimiento más reciente.
- feat: KPIs de Resumen con font-size:22px, font-weight:600 y color semántico.
- feat: Nuevo KPI "Tasa de ahorro" (balance / ingresos %).
- feat: Eje Y del gráfico mensual formateado en EUR.
- feat: Media query KPI grid mobile: 4 columnas → 2 columnas en ≤640px.
- feat: Filtro por categoría en tab Transacciones.
- feat: Tabla resumen por categoría en tab Categorías (cat / nº movimientos / total / %).

## 2026-06-02
- fix: index.html no cargaba js/app.js — switchTab() indefinida en Safari.
- feat: tab Categorías — barras horizontales, selector mes, tabla resumen, lista transacciones.
- feat: tab Guille — chart mixto inicial.

## 2026-06-01
- Created technical memory system. Added PROJECT_MEMORY.md.
- fix: renderDonut() añadido a charts.js.
- feat: Guille tab — KPIs, gráfico barras, línea acumulada, tabla filtrable.

