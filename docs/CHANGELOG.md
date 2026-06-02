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
