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

## Alta prioridad
- [x] Flujo "Organizar Movimientos": PayPal+Gmail, Uber, Amazon, Viajes — trigger en chat, registro en reviewed_movements.json, KPI en dashboard
- [ ] Panel de revisión de transacciones: vista filtrable de movimientos con categoría "A revisar" o baja confianza, con acción de reclasificación directa desde el dashboard que dispara el workflow `update-sheet-cells.yml`
- [x] Vista ampliada de Viajes en tab Categorías (desglose por viaje, subcategorías, transacciones colapsables)
- [ ] Insights automáticos: comparación vs mes anterior, alertas de gasto por categoría
- [ ] KPI de ahorro real incluyendo inversiones (tab Inversiones)

## Prioridad media
- [ ] Dashboard de vivienda (desglose Departamento)
- [ ] Dashboard de movilidad (Combustible + Gastos coche + Gastos moto)
- [ ] Seguimiento de suscripciones con histórico
- [ ] Detección de anomalías (gasto fuera de rango histórico)

## Futuro
- [ ] Seguimiento de patrimonio neto
- [ ] Forecast financiero
- [ ] Vista consolidada personal + negocio
- [ ] Capa de verificación de transacciones (verification_data.json)
