## 2026-06-04 — Flujo "Organizar Movimientos"

**Trigger:** escribir "Organizar Movimientos" en el chat de Claude.

**Fases en orden:**
1. **PayPal** — cruza cada movimiento PayPal no revisado con `from:servicio@paypal.es` en Gmail por fecha; extrae nombre del comercio real; propone categoría
2. **Uber** — distingue Uber Rides (`from:noreply@uber.com subject:viaje`) de Uber Eats (`subject:Eats`); propone Salidas vs Comer afuera
3. **Amazon** — cruza `AMAZON*/AMZN/WWW.AMAZON` con `from:auto-confirm@amazon.es`; extrae producto; propone categoría
4. **Viajes** — cruza movimientos en categorías evaluables con TRIP_WINDOWS (±buffer); propone reclasificación a Viajes agrupada por viaje

**Registro de revisados:** `reviewed_movements.json` en el repo. Clave = `fecha|concepto|monto`. Todo movimiento presentado al usuario (aprobado o rechazado) se marca como revisado.

**KPI en dashboard:** card "Sin analizar por Claude" en el tab Resumen. Muestra en ámbar con borde si hay pendientes, verde si está al día. Incluye el trigger como recordatorio.

**Categorías candidatas por fase:**
- PayPal: cualquier `PAYPAL*` no en Suscripciones/Viajes/Guille
- Uber: cualquier `UBR*` o `UBER *` en Comer afuera, Otros, Compras, Salidas
- Amazon: cualquier `AMAZON*/AMZN/WWW.AMAZON` en Compras, Otros, A revisar
- Viajes: Otros, A revisar, Combustible, Comer afuera, Salidas, Compras, Tarjeta

---

## 2026-06-04 — Buffer de 3 días en ventanas de viaje

**Decisión:** `getTripForDate()` extiende el `end` de cada viaje 3 días hacia adelante al evaluar si un movimiento pertenece al viaje.

**Motivo:** Los cargos de tarjeta suelen aparecer 1-3 días después de la fecha real del gasto. Sin buffer, transacciones legítimas del viaje quedan fuera de la ventana.

**Tradeoff:** Puede capturar gastos cotidianos en los días inmediatos post-viaje. Aceptable dado que el flujo de revisión es manual de todos modos.

**Complemento:** Las fechas `end` en `TRIP_WINDOWS` deben reflejar el último día real del viaje (no el buffer). El buffer es solo lógica de matching, no parte de la definición del viaje.

---

## 2026-06-04 — Vista ampliada de Viajes

**Decisión:** Los viajes se definen como constante `TRIP_WINDOWS` hardcodeada en `app.js`, no consultando el calendar en runtime.

**Motivo:** El dashboard es estático (GitHub Pages). No hay backend. El calendar solo es accesible via MCP desde el chat de Claude.

**Mantenimiento:** Al identificar un nuevo viaje (via el flujo de análisis en el chat), añadir una entrada a `TRIP_WINDOWS` manualmente.

**Subcategorías:** inferidas del concepto via regex en `tripSubcategory()`. Suficiente para el nivel de detalle requerido.

---

## 2026-06-03 — Análisis de viajes: flujo manual via chat + workflow

**Decisión:** El análisis de reclasificación de movimientos a categoría Viajes se ejecuta manualmente desde el chat de Claude, no como GitHub Action autónomo.

**Motivo:** El cruce con Google Calendar requiere OAuth del usuario, que no está disponible en el service account del repo. Claude tiene acceso al calendar via MCP y puede hacer el análisis directamente. Los cambios aprobados se escriben al sheet via el workflow `update-sheet-cells.yml` existente.

**Flujo establecido:**
1. Claude lee `finance_data.json` del repo y el calendar via MCP
2. Genera propuestas agrupadas por viaje
3. Usuario aprueba/rechaza viaje a viaje en el chat
4. Claude dispara `update-sheet-cells.yml` en batch con los aprobados
5. Usuario pulsa Actualizar en el dashboard para sincronizar el JSON

**Resultado sesión 2026-06-03:** 11 movimientos reclasificados a Viajes en 5 viajes (Gijón, Spain Run, Hotel Natursun oct-25, Bagger Racing, Toledo).

**Observación:** El algoritmo genera ruido con SERVIMATIC (~0.50€), Amazon y gastos cotidianos que coinciden en fechas de viaje. El buffer ±1 día amplifica el ruido en viajes de 1 día. Para próximas ejecuciones conviene filtrar conceptos con importe < 2€ y Amazon salvo que sea claramente equipaje/viaje.

---

## 2026-06-03 — Gasto neto en categorías reembolsables

**Decisión:** Los ingresos categorizados en categorías reembolsables restan al gasto de esa categoría. El dashboard muestra siempre gasto neto (no bruto).

**Categorías reembolsables:** Viajes, Club, Combustible, Comer afuera, Salidas, Gastos en conjunto.

**Motivo:** Es habitual pagar por el grupo en estas categorías y recibir reembolsos posteriores (bizum, transferencia). Sin netting, el gasto aparece inflado y el ingreso distorsiona el total de ingresos reales.

**Implementación:**
- `reimbursableCategories` añadido a `window.FINANCE_STATE` en `state.js`
- `netExpenseByCategory(data)` en `charts.js`: función centralizada que calcula gasto neto por categoría
- `renderMonthly`, `renderDonut` y `renderKPIs` en `charts.js` usan la lógica de netting
- `renderCategorias` en `app.js` delega en `netExpenseByCategory` en lugar del map manual
- Los ingresos de categorías reembolsables NO se suman a los ingresos totales en KPIs ni en el gráfico mensual
- La tabla de transacciones (`renderCatTxTable`) muestra los movimientos individuales sin modificar — el netting es solo visual en los agregados

---

## 2026-06-02 — Tab Categorías: click en barra filtra tabla de transacciones

**Decisión:** Al hacer click en una barra del gráfico horizontal de categorías, la tabla de transacciones inferior se filtra a los movimientos de esa categoría. Click en la misma barra (o en área vacía) limpia el filtro.

**Motivo:** El gráfico ya mostraba el total por categoría; el siguiente nivel de detalle natural son las transacciones individuales. Hacerlo interactivo elimina la necesidad de ir al tab Transacciones y aplicar filtros manualmente.

**Implementación:**
- Variable `activeCatBarFilter` (módulo-level) en `app.js` almacena la categoría activa o `null`
- `onClick` handler en Chart.js: toggle — si se hace click en la barra ya activa, limpia el filtro
- Barras no seleccionadas se atenúan (opacidad 0.25) para reforzar visualmente la selección
- Header del card de transacciones muestra la categoría activa + contador + botón "Ver todas"
- La tabla de resumen por categoría también actúa como selector (click en fila)
- Al cambiar el mes o al cambiar de tab, `activeCatBarFilter` se resetea a `null`

---

## 2026-06-02 — Inversiones: migración a datos dinámicos

**Decisión revertida:** Los datos de inversión ya no están embebidos en el JS. Se leen del sheet diariamente.

**Motivo del cambio:** El modelo de datos hardcodeados requería intervención manual con cada nuevo mes. El workflow ya tenía credenciales de servicio con acceso al sheet, por lo que la automatización no tenía costo adicional.

**Detalles de implementación:**
- El script `sync_finance_data.py` lee la hoja `Inversiones` (nombre exacto de la pestaña en el Google Sheet) además de `Movimientos`
- `finance_data.json` ahora es un objeto `{ movimientos, inversiones }` en lugar de un array plano
- El frontend tiene retrocompatibilidad: si detecta un array, asume formato legado
- La hoja de inversiones tiene datos semanales; el script toma el último registro de cada mes

**Nombre de la pestaña:** `Inversiones` (con mayúscula). El nombre `finanzas` era incorrecto — causó el fallo inicial.

---

## 2026-06-02 — Tab Inversiones: datos embebidos vs. lectura dinámica del sheet

**Decisión:** Los datos de la hoja `finanzas` se embeben directamente en `renderInversiones()` como arrays JS, en lugar de leerlos dinámicamente desde `finance_data.json`.

**Motivo:** La hoja `finanzas` tiene una estructura diferente a la hoja `Movimientos` (registros semanales, no transacciones). El script `sync_finance_data.py` solo exporta `Movimientos`. Agregar una segunda exportación requeriría cambiar el workflow y el schema del JSON. Para el volumen de datos actual (12 puntos mensuales), el embebido es más simple y sin riesgo de regresión.

**Implicación:** Cuando se agreguen nuevos meses a la hoja `finanzas`, hay que actualizar manualmente los arrays en `renderInversiones()`. Considerar automatizar si el volumen crece.

---

## 2026-06-02 — Tab Inversiones: estructura de gráficos

**Decisión:** Dos gráficos separados en lugar de uno combinado.

**Motivo:** El capital (escala 0–20k€) y el rendimiento % (escala -60% a +25%) son incompatibles en un doble eje Y sin perder claridad, especialmente en mobile. Dos cards separadas son más legibles.

---

## 2026-06-02 — Gráfico Guille: ventana de 12 meses

**Decisión:** Limitar el gráfico de barras del tab Guille a los últimos 12 meses disponibles en los datos.

**Motivo:** Con más de 12 meses de datos, el gráfico se comprimía demasiado en mobile y resultaba ilegible. 12 meses es el horizonte relevante para el seguimiento mensual.

**Detalle técnico:** El saldo acumulado (línea, eje Y derecho) se calcula sobre todos los meses históricos y luego se recorta al slice de los últimos 12. Así el valor mostrado es correcto (no reinicia a 0) pero el gráfico solo muestra 12 puntos.

---

## 2026-06-02 — Mobile responsive audit

**Decisión:** Aplicar mejoras de responsive al CSS sin cambiar la arquitectura ni los módulos JS.

**Motivo:** En pantallas de 375–390px (iPhone estándar) el dashboard presentaba tabs cortadas, selects desbordando el ancho, tablas con texto apretado y gráficos demasiado altos.

**Cambios clave:**
- Tabs `width:100%` con `flex:1`: es la solución más sencilla para que funcionen en cualquier ancho sin necesidad de scroll horizontal
- `select` con `flex:1; min-width:0`: patrón estándar para evitar que un flex child desborde su contenedor
- Chart heights reducidas en mobile: las alturas desktop (340/320/260px) son excesivas en una pantalla de 390px; se reducen a 260/240/200px

---

# Decisions Log

## 2026-06-02 (mejora visual Guille)

### Decision
Reimplementar el gráfico de Guille con eje Y dual: barras en eje izquierdo, línea de saldo en eje derecho.

### Reason
Los datos lo requieren. Las barras mensuales están en el rango 300–2000€ mientras el saldo acumulado oscila entre -2.700€ y +11.000€. En un eje compartido las barras quedan aplastadas en la parte inferior y pierden toda legibilidad. El eje dual fue el diseño correcto desde el principio; los intentos anteriores fallaron por bugs de implementación de Chart.js, no por el concepto.

---

### Decision
Tooltip unificado con `mode: 'index'` en el gráfico de Guille.

### Reason
Con tres datasets en el mismo gráfico, el tooltip por hover individual obliga a pasar el cursor por cada serie. Con mode: index se muestran los tres valores (Depositado, Gastado, Saldo) al posicionarse en cualquier punto del mes, que es la unidad de análisis natural.

---

### Decision
Área rellena bajo la línea de saldo acumulado (fill: true).

### Reason
La línea sola sobre barras es difícil de seguir visualmente. El área rellena en azul suave da presencia a la serie sin competir con las barras.

---

### Decision
Altura del gráfico de Guille aumentada a 420px (.chart-wrap-xtall).

### Reason
Con 18 meses en el eje X, a 320px las etiquetas y barras quedan comprimidas. 420px da el espacio mínimo para que el gráfico sea legible sin scroll horizontal.

---

## 2026-06-02 (auditoría)

### Decision
`renderMonthly` consume `filteredData()` en lugar de `getLast12MonthsData()`.
### Reason
Los filtros de periodo y mes deben afectar a todos los componentes del tab Resumen.

### Decision
`formatEUR` vive únicamente en `charts.js`.
### Reason
Una sola definición evita divergencias. charts.js se carga antes que app.js.

### Decision
Los gastos en KPIs se muestran como valor positivo con color rojo.
### Reason
Más legible. El color ya comunica el signo.

### Decision
Añadir "Tasa de ahorro" como cuarto KPI.
### Reason
Es el indicador más accionable del tab Resumen.

### Decision
Tabla resumen por categoría va encima de la lista de transacciones en tab Categorías.
### Reason
Mayor densidad informativa primero; el detalle después.

### Decision
El filtro de categoría en Transacciones es un selector independiente del de mes.
### Reason
Permite combinar ambos filtros sin complejidad adicional de UI.

---

## 2026-06-02

### Decision
Tab Categorías usa gráfico de barras horizontales (indexAxis: 'y').
### Reason
Con múltiples categorías permite leer etiquetas sin rotación.

### Decision
Cada tab tiene su propio selector de mes independiente.
### Reason
Evita que el cambio de filtro en un tab afecte a los demás.

### Decision
Eliminar bloque <script> inline de index.html.
### Reason
Duplicaba init() y no cargaba switchTab().

---

## 2026-06-01

### Decision
Create a project memory framework inside the repository.
### Reason
Allow future AI agents and developers to reconstruct project state without relying on chat history.

### Decision
renderDonut() consumes filteredData() directly.
### Reason
Ensures the donut chart always reflects the active period and month filter.

