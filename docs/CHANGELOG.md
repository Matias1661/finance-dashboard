# Changelog

## 2026-06-02 (auditoría completa)

### Bugs corregidos
- fix: `renderMonthly` usaba `getLast12MonthsData()` ignorando los filtros activos. Ahora consume `filteredData()` — el gráfico mensual responde al selector de periodo y de mes.
- fix: `formatEUR` estaba definida en `charts.js` y duplicada en `app.js`. Eliminada la copia de `app.js`. Fuente única en `charts.js`.
- fix: El pill "Todo" llamaba `setPeriod(24, this)` en lugar de `setPeriod(999, this)` — cortaba en 24 meses en lugar de mostrar todo el histórico.
- fix: El header `#last-updated` existía en el HTML pero nunca se rellenaba. Ahora muestra la fecha del movimiento más reciente en el dataset.

### Mejoras de visualización
- feat: KPIs de Resumen con `font-size:22px`, `font-weight:600` y color semántico (verde/rojo). Los gastos se muestran en positivo con color rojo.
- feat: Nuevo KPI "Tasa de ahorro" (balance / ingresos %) en el tab Resumen.
- feat: Eje Y del gráfico mensual formateado en EUR.
- feat: Media query para grid de KPIs en mobile: 4 columnas → 2 columnas en pantallas ≤640px.

### Nuevas funcionalidades
- feat: Filtro por categoría en el tab Transacciones (selector independiente del de mes).
- feat: Tabla resumen por categoría en el tab Categorías (categoría, nº movimientos, total, % del gasto) encima de la lista de transacciones.

## 2026-06-02
- fix: index.html no cargaba js/app.js — switchTab() no estaba definida al hacer click en los tabs desde Safari. Eliminado bloque <script> inline duplicado.
- feat: tab Categorías — selector de mes + gráfico de barras horizontales + tabla de transacciones.
- feat: tab Guille — gráfico mixto barras+línea en un único chart con eje Y compartido.

## 2026-06-01
- Created technical memory system. Added PROJECT_MEMORY.md.
- fix: added renderDonut() to charts.js.
- feat: Guille tab — KPIs, gráfico barras, línea acumulada, tabla filtrable por mes.
