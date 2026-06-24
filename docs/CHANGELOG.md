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