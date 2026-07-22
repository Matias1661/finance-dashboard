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
- [x] Migración de capital/rendimiento del tab Inversiones de Google Sheets a Notion (elimina dependencia de GOOGLE_SERVICE_ACCOUNT, 2026-07-10)

## Alta prioridad
- [x] Botón "Actualizar" en `index.html`: eliminado 21/07 (tenía un token de GitHub hardcodeado, revocado, y seguía expuesto en texto plano en el archivo). Los workflows de sync se disparan manualmente vía `gh workflow run` o la UI de GitHub Actions. Ver `DECISIONS.md` 2026-07-21.
- [ ] Evaluar si conviene reintroducir un botón de refresh con una alternativa server-side (ej. endpoint propio) que no dependa de un token en el cliente. Sin fecha.
- [ ] Migración Relay → GitHub Actions, flujos pendientes de implementar (ver `PROJECT_MEMORY.md`, sección "Migración en curso", y `DECISIONS.md` 2026-07-17 para prompts ya probados):
  - [x] Peerberry: script Python + paso en `sync-finance-data.yml`, validado con datos reales (incidente de duplicados detectado y corregido, ver `DECISIONS.md` 2026-07-17). Flujo de Relay para Peerberry dado de baja.
  - [x] MyInvestor: script Python pidiendo `text/plain` a la API de Gmail, validado con datos reales (incidente de cuentas conflictivas pre-dic-2024 detectado y corregido, ver `DECISIONS.md` 2026-07-17)
  - [x] Nóminas: `scripts/process_nominas.py` implementado (vigila la carpeta Drive "Nominas", carga manual del PDF), prompt de extracción nuevo en la DB Notion "Prompts para Relay", registro `processed_nominas.json` sembrado con los 38 archivos ya existentes. Pendiente de validar con la próxima nómina real (ver `DECISIONS.md` 2026-07-22).
  - [x] Resolver autenticación de Gmail API: OAuth 2.0 con refresh_token (cuenta de servicio no sirve para Gmail personal). Secrets `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN` ya cargados, reusar para MyInvestor.
  - [x] Talho Argentino / Gastos del local (paso 4.5 del plan): `scripts/process_gastos_talho.py` implementado y validado con los 33 comprobantes reales de la carpeta Drive (22/07/2026): 29 duplicados detectados bien, 1 creado bien, 3 cargados a mano tras revision. Bug de manejo de fecha invalida corregido. El sub-flujo de edición manual en Notion no necesita código nuevo, ya lo cubre el cron diario de `sync_sociedad_data.py`. Pendiente: decidir apagado de los 2 flujos de Relay para este paso (ver `DECISIONS.md` 2026-07-22).
  - [ ] Validar cada flujo con datos reales antes de apagar Relay (paso 5 del plan)
- [ ] Alerta en el dashboard cuando falta subir la nómina de un mes (propuesta del usuario, 17/07): detectar por tiempo transcurrido desde la última nómina cargada, o cruzando contra el ingreso de nómina esperado en Movimientos. Sin diseño todavía.
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
