## 2026-06-02

### fix
- `sync_finance_data.py`: corregido bug en `build_inversiones` donde Peerberry y MyInvestor se sobreescribían mutuamente al estar en filas separadas del mismo mes. Ahora se acumula el último valor no-nulo de cada columna (D=Peerberry, E=MyInvestor) de forma independiente por mes.
- Corregido nombre de hoja: `finanzas` → `Inversiones`.

---

## 2026-06-02

### fix
- Corregido nombre de hoja en sync_finance_data.py: `FINANZAS_SHEET = "Inversiones"` → `"finanzas"`. El script intentaba leer una hoja inexistente, causando que inversiones (Peerberry y MyInvestor) no se cargaran en finance_data.json.
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
