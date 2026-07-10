# Roadmap

## Completado
- [x] KPIs: ingresos, gastos, balance, tasa de ahorro
- [x] Gráfico mensual ingresos vs gastos (respeta filtros activos)
- [x] Donut de gastos por categoría
- [x] Filtros de periodo (6m / 12m / Todo) y mes en Resumen
- [x] Tab Categorías: barras horizontales, tabla resumen, lista transacciones, selector mes
- [x] Tab Transacciones: filtro por mes y categoría
- [x] Tab Guille: KPIs, chart mixto bar+line, tabla filtrable
- [x] Gasto neto en categorías reembolsables (Viajes, Club, Combustible, Comer afuera, Salidas, Gastos en conjunto)
- [x] Header con fecha de última actualización
- [x] KPI grid responsive (mobile 2 columnas)
- [x] Eje Y del gráfico mensual en EUR
- [x] Gráfico de rentabilidad mensual por plataforma en tab Inversiones (barras agrupadas + acumulado TWR, 2026-07-08)

## Alta prioridad
- [x] Flujo "Organizar Movimientos": PayPal+Gmail, Uber, Amazon, Viajes — trigger en chat, registro en reviewed_movements.json, KPI en dashboard
- [ ] Panel de revisión de transacciones: vista filtrable de movimientos con categoría "A revisar" o baja confianza, con acción de reclasificación directa desde el dashboard que escriba en Notion vía `notion-update-page` (el workflow `update-sheet-cells.yml` del que dependía esta tarea fue eliminado el 30/06/2026; replantear el mecanismo de escritura, no hay endpoint HTTP directo desde el navegador a Notion — evaluar en DECISIONS.md antes de implementar)
- [x] Vista ampliada de Viajes en tab Categorías (desglose por viaje, subcategorías, transacciones colapsables)
- [x] Campo Nota (col K) por movimiento + enriquecimiento automático de Compras (Amazon/Gmail/web); backfill últimos 3 meses
- [x] Insights automáticos: comparación vs mes anterior, alertas de gasto por categoría (js/insights.js, 2026-07-03)
- [ ] Enriquecimiento de Nota como fase del flujo "Organizar Movimientos" (de aquí en adelante, no solo backfill)
- [x] KPI de ahorro real incluyendo inversiones (tarjeta en Resumen: balance + rendimiento, 2026-07-03)

## Prioridad media
- [ ] Dashboard de vivienda (desglose Departamento)
- [ ] Dashboard de movilidad (Combustible + Gastos coche + Gastos moto)
- [x] Seguimiento de suscripciones con histórico (sección en Resumen, detección por recurrencia, 2026-07-03)
- [x] Detección de anomalías (alertas media+2σ en bloque Insights, 2026-07-03)

## Futuro
- [ ] Seguimiento de patrimonio neto
- [ ] Forecast financiero
- [ ] Vista consolidada personal + negocio
- [ ] Capa de verificación de transacciones (verification_data.json)
