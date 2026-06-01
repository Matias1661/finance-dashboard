# Changelog

## 2026-06-02
- fix: index.html no cargaba js/app.js — switchTab() no estaba definida al hacer click en los tabs desde Safari (o cualquier browser). Eliminado bloque <script> inline duplicado. Ahora index.html carga state.js → filters.js → charts.js → app.js en orden correcto.
- feat: tab Categorías — selector de mes + gráfico de barras horizontales (indexAxis: y) ordenado de mayor a menor gasto. Excluye Guille e Inversion. Tooltip con importe en EUR.
- feat: tab Guille — gráfico de barras (Depositado/Gastado) y línea de saldo acumulado fusionados en un único chart mixto con eje Y dual.

## 2026-06-01
- Created technical memory system.
- Added PROJECT_MEMORY.md.
- Performed architecture review.
- Performed finance_data.json review.
- fix: added renderDonut() to charts.js — aggregates expenses by category using filteredData().
- fix: renderResumen() in index.html and app.js now calls renderDonut(), so the category donut chart updates when the month selector changes.
- feat: Guille tab — KPIs (total depositado, total gastado, saldo), gráfico barras mensual depositado/gastado, línea acumulada, tabla filtrable por mes.
