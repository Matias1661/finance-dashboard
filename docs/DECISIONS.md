## [2026-07-08] Rentabilidad mensual: acumulado vuelve a eje propio, con zona negativa sombreada y linea de cero

**Contexto:** con el eje único (decisión previa del mismo día), el acumulado histórico (hasta +20%) aplastaba visualmente los tramos negativos de marzo-junio 2025 (entre -0.3% y -1.93%) contra el cero, dificultando ver cuándo el acumulado cruzaba a territorio negativo. Matias pidió volver a un eje propio para el acumulado, sombrear la zona negativa, y además resaltar la línea del cero en ese eje para ubicarla aunque la escala llegue a +20%.

**Cambio:** `js/app.js`, `renderInvRendimiento()`:
- La línea "Acumulado" vuelve a usar `yAxisID: 'y1'` (eje derecho), mientras que las barras de Peerberry/MyInvestor y el rombo "Total del mes" se mantienen en `yAxisID: 'y'` (eje izquierdo). Esto es una excepción puntual a la regla general de "un solo eje" adoptada más temprano — se aplica solo a este gráfico porque el acumulado histórico y los retornos mensuales tienen rangos muy distintos (hasta 20 puntos porcentuales de diferencia).
- El área bajo la curva de Acumulado se sombrea en rojo claro (`rgba(226,74,74,0.15)`) cuando el valor cae por debajo de 0%, usando `fill: { target: { value: 0 }, above: 'transparent', below: ... }`.
- Se agrega un dataset auxiliar "Cero (acumulado)" — una línea punteada gris constante en 0, en el eje `y1` — para marcar visualmente dónde está el cero en ese eje. Se excluye de la leyenda y del tooltip (`filter`) para no generar ruido.

**Trade-off:** el gráfico vuelve a tener eje dual únicamente para esta línea; las barras y el rombo comparten el eje único. No es una reversión completa a la versión con eje dual original (esa tenía las barras también en `y1`/`y` separados).

---

## [2026-07-08] Nuevo gráfico: acumulado por año (tab Inversiones)

**Contexto:** Matias preguntó cuánto habría rendido cada plataforma si hubiera dejado todo el dinero en una sola desde enero 2025, tanto para el período completo como solo para 2025. La respuesta reveló que la ventaja de MyInvestor se concentra casi enteramente en el rally de mercado de 2026 (2025 estuvo casi empatado: 8.93% MyInvestor vs 8.05% Peerberry). A partir de ahí pidió una forma de comparar visualmente la forma de la curva de un año contra otra, reiniciando en 0% cada enero — en vez de una sola curva de acumulado histórico que arrastra el resultado de años previos.

**Cambio:** `scripts/sync_finance_data.py`, `build_rendimiento_mensual()` agrega el campo `acumulado_anio`: mismo TWR compuesto que `acumulado`, pero la cadena (`acc_year`) se reinicia a 1.0 cada vez que cambia el año calendario de `mk`.

**Dashboard:** `js/app.js`, nueva función `renderInvAcumuladoAnual()` (llamada desde `renderInversiones()`): agrupa `rendimiento_mensual` por año, arma un dataset por año alineado por mes-del-año (Ene-Dic), y grafica una línea por año — el año más reciente en trazo punteado para distinguir el año en curso (incompleto) de los años cerrados. `index.html`: nuevo canvas `chart-inv-acumulado-anual` debajo del gráfico de rentabilidad mensual, tercer gráfico del tab Inversiones.

**Impacto:** ninguno en campos existentes; `acumulado_anio` es un campo nuevo, `acumulado` (histórico sin reiniciar) se mantiene sin cambios para el gráfico de rentabilidad mensual.

---

## [2026-07-08] Eje unico y rombo de rentabilidad total del mes en el grafico de rentabilidad

**Contexto:** Matias probó una vista previa con eje único (en vez de eje dual) para las barras y el acumulado, y le gustó — decisión de UX confirmada tras comparar ambas versiones. Además pidió un indicador que resuma "cómo fue ese mes en conjunto" (Peerberry + MyInvestor combinados), ya que las dos barras por separado no dejan ver fácil el resultado combinado ponderado por capital.

**Cambio 1 — eje único:** `js/app.js`, `renderInvRendimiento()`: barras y curva de Acumulado comparten `yAxisID: 'y'` (antes la curva usaba un eje secundario `y1`). También se filtró `rendimiento_mensual` para excluir diciembre 2024 (`mes >= '2025-01'`), ya que ese mes no tiene datos (no hay mes anterior para calcular retorno) y no aporta al eje X.

**Cambio 2 — indicador "Total del mes":** `scripts/sync_finance_data.py`, `build_rendimiento_mensual()` expone el campo `total`: el mismo retorno total mensual ponderado por capital (ganancia Peerberry + MyInvestor / saldo medio total del mes) que ya se usaba internamente como paso previo a encadenar el `acumulado`, pero ahora sin encadenar — para mostrar el resultado de ese mes en particular, no el histórico. `js/app.js` lo grafica como un dataset `scatter` con `pointStyle: 'rectRot'` (rombo), mismo lenguaje visual que el rombo de "promedio 3 meses" del gráfico mensual en Resumen.

**Trade-off aceptado:** con eje único, los meses fuertes de MyInvestor (5-7%) hacen que las barras de Peerberry (0.2-1%) se vean chicas en comparación. Matias lo revisó con una vista previa (Visualizer) antes de aplicar el cambio y prefirió la lectura más rápida del eje único a la precisión visual del eje dual.

---

## [2026-07-08] Nota "sin aportes ese mes" en tooltip de rentabilidad mensual

**Contexto:** Matias detectó que el acumulado del gráfico de rentabilidad daba negativo en marzo-junio 2025 y preguntó si era un error de cálculo. Verificación: en marzo y abril 2025 el capital de MyInvestor cayó de 14.372€ a 13.763€ sin ningún aporte ni retiro (`aportes = 0` en ambos meses) — es una caída real del valor de los fondos, no un artefacto del cálculo.

**Cambio:** `scripts/sync_finance_data.py`, `build_rendimiento_mensual()` agrega `sin_aportes_pb` y `sin_aportes_mi` (booleanos) a cada mes de `rendimiento_mensual`: `true` cuando `aportes_known` es `True` y `aportes == 0` para esa plataforma ese mes. `js/app.js`, `renderInvRendimiento()`: el tooltip agrega "(sin aportes ese mes)" cuando corresponde, para distinguir a simple vista una variación por rendimiento puro de mercado de una que involucra aportes/retiros.

**Limitación:** el flag depende de que `aportes_known` sea `True` (dato de "Aportes" cargado en Notion); en meses históricos donde ese campo no se cargó, el flag queda en `False` aunque no haya habido aporte real (no se puede distinguir "sin aportes" de "dato no disponible").

---

## [2026-07-08] Rentabilidad mensual MyInvestor: usar saldo medio en vez de capital mes anterior

**Contexto:** el mail mensual "Rentabilidad de tu cartera" de MyInvestor confirma su propia metodología: "Cuánto dinero has ganado o perdido por cada 100€ invertidos. Beneficio (€) entre Saldo medio (€)". El cálculo original de `build_rendimiento_mensual` usaba Ganancia / Capital del mes calendario anterior, que no coincide con esa metodología y se distorsiona cuando hay aportes grandes a mitad de mes (un depósito de fin de mes cuenta como si hubiera generado rendimiento todo el mes).

**Verificación:** búsqueda en Gmail (`from:comunicaciones@myinvestor.es`) confirmó que las transferencias/nóminas van directo a la Cartera RED sin paso intermedio por cuenta corriente (confirmado por Matias), y que el mail de junio 2026 reporta 1,8% de rentabilidad mensual.

**Cambio:** `scripts/sync_finance_data.py`, `build_rendimiento_mensual()`:
- `% MyInvestor` ahora = Ganancia del mes / promedio entre capital de cierre del mes anterior y capital de cierre de este mes (mismo método de 2 puntos que ya usaba Peerberry), en vez de Ganancia / Capital del mes anterior.
- `acumulado` (curva TWR) actualizado para usar el mismo promedio de 2 puntos a nivel de capital total (Peerberry + MyInvestor), por consistencia.

**Limitación conocida:** el promedio de 2 puntos no es un verdadero saldo medio diario (Modified Dietz completo), que requeriría la fecha exacta de cada aporte dentro del mes. Esa fecha existe en los mails transaccionales de Gmail (`notificaciones@myinvestor.es`, asuntos "TRANSFERENCIA SEPA"/"ABONO NOMINA SEPA"), pero `sync_finance_data.py` corre en GitHub Actions sin credenciales de Gmail, así que no puede leerlos en cada sync automático. Verificado contra el mail de junio: 1,76% calculado vs 1,8% reportado por MyInvestor — diferencia menor, aceptable como aproximación.

**Pendiente evaluado y descartado por ahora:** agregar campo "Fecha aporte" a la DB Notion para permitir Modified Dietz real sin depender de Gmail en el sync. Queda como mejora futura si la diferencia se vuelve significativa.

---

## [2026-07-08] Corregida "Fecha reporte" de Peerberry febrero 2026: aparecía como marzo por error de fecha

**Contexto:** Matias reportó que el gráfico de rentabilidad mensual mostraba Peerberry en `null` para febrero 2026, y preguntó si se podía reconstruir desde los mails. Al revisar Gmail (`from:info@peerberry.com`), los 4 reportes semanales de febrero existían y permitían reconstruir el mes (ganancia ≈43,74€, aportes -500€, capital de cierre ≈5.064€). Pero antes de crear una fila nueva se verificó la DB Notion "Rendimiento Inversiones" y se encontró que **los datos de febrero ya estaban cargados**: la fila `"Peerberry febrero 2026"` (Ganancia 46,79€, Aportes -500€, Capital 5.084,73€) tenía su campo **"Fecha reporte" en 2026-03-02** en vez de dentro de febrero.

**Causa raíz:** `_aggregate_rendimiento_by_month()` en `sync_finance_data.py` agrupa por el mes calendario de "Fecha reporte", no por el título "Fecha" de la página. Con "Fecha reporte" = 2026-03-02, esta fila se sumaba al mes de marzo junto con la fila `"Peerberry marzo 2026"` (Ganancia 24,87€, Fecha reporte 2026-03-30), dando una ganancia de marzo inflada (46,79+24,87=71,66€) y febrero vacío.

**Cambio:** corregido el campo "Fecha reporte" de la página `"Peerberry febrero 2026"` (Notion) de 2026-03-02 a 2026-02-23 (fecha del último reporte semanal real dentro de febrero). No se tocó Ganancia/Aportes/Capital total — esos valores ya cargados se mantienen, solo se corrigió la clasificación de mes.

**Impacto:** tras regenerar `finance_data.json`, `rendimiento_mensual` ahora muestra febrero 2026 con datos (`peerberry: 0.88`) y marzo 2026 recalculado sin la duplicación (`peerberry: 0.49` en vez del valor inflado anterior).

**Aprendizaje para el flujo de carga:** al cargar filas Mensuales de Peerberry vía Relay o manualmente, "Fecha reporte" debe caer dentro del mes que la fila representa (usar el último reporte semanal real de ese mes), no la fecha en que se cargó el dato a Notion.

---

## [2026-07-08] Nuevo gráfico: rentabilidad mensual por plataforma (tab Inversiones)

**Contexto:** el tab Inversiones solo tenía el gráfico de Capital (barras apiladas en euros). Se pidió un gráfico similar pero de rentabilidad, que no admite apilado porque un % de una plataforma y un % de otra no son aditivos.

**Cambio:** `scripts/sync_finance_data.py`, nueva función `build_rendimiento_mensual(by_month)` que agrega a `inversiones` el campo `rendimiento_mensual`: lista `{mes, peerberry, myinvestor, acumulado}` por mes calendario.
- Un mes se incluye solo si MyInvestor ya reportó ese mes (mismo criterio de "mes completo" que usa `build_kpi_inversiones`/`_last_complete_month`).
- `% MyInvestor` = Ganancia del mes / Capital total del mes calendario anterior.
- `% Peerberry` = Ganancia del mes / promedio entre capital de cierre del mes anterior y capital de cierre de este mes (aproximación de 2 puntos: no se conserva el detalle semanal agregado dentro del mes, solo la última lectura de capital).
- `acumulado` = TWR compuesto del retorno total mensual (ganancia total del mes / capital total del mes anterior), encadenado desde el primer mes incluido.

**Dashboard:** `js/app.js`, nueva función `renderInvRendimiento()` (llamada desde `renderInversiones()`), gráfico de barras agrupadas (no apiladas) por plataforma con curva de acumulado en eje secundario. `index.html`: nuevo `<canvas id="chart-inv-rendimiento">` debajo del gráfico de Capital.

**Impacto:** ninguno en campos existentes de `finance_data.json`; `rendimiento_mensual` es un campo nuevo, no reemplaza `rendimiento` (Sheet histórico, sin tocar).

---

## [2026-07-07] KPI rentabilidad inversiones: usar siempre el último mes calendario completo

**Contexto:** el KPI "% último mes" tomaba directamente el último mes presente en la serie de `Rendimiento Inversiones`. Como Peerberry carga reportes Semanales durante todo el mes en curso, ese mes aparecía en la serie antes de estar cerrado, mostrando rentabilidad parcial del mes actual en vez del último mes completo (ej. 7 de julio mostrando julio en vez de junio).

**Cambio:** `scripts/sync_finance_data.py`:
- Nueva función `_last_complete_month(by_month, current_month)`: busca, entre los meses anteriores al mes en curso, el último que ya tiene reporte Mensual de MyInvestor cargado (`capital` no nulo). MyInvestor reporta los primeros días del mes siguiente, así que un mes recién cerrado puede no tener aún su dato — en ese caso se usa el mes anterior a ese, evitando mostrar ganancia 0 o parcial.
- `build_kpi_inversiones()` calcula el mes actual (zona Europe/Madrid), obtiene el mes objetivo con `_last_complete_month()` y filtra `by_month` a `mes <= objetivo` antes de armar la serie. Así "último mes" y el TWR de 12m siempre terminan en un mes calendario completo y con dato de ambas plataformas.

**Impacto:** ninguno en el schema de `finance_data.json` (mismo objeto `kpi`, mismos campos). `js/charts.js` no requiere cambios: sigue leyendo `periodo_ultimo_mes` para el título de la card.

---

## [2026-07-07] Rendimiento Inversiones: eliminado campo "Profit acumulado"

**Contexto:** revision de la DB Notion "Rendimiento Inversiones" (data source 93eda06b-9207-4589-b3f0-66be10ab9caf) para confirmar que todos los campos siguen siendo necesarios.

**Hallazgo:** `_extract_rendimiento_row()` en `scripts/sync_finance_data.py` solo lee Fecha reporte, Plataforma, Periodo, Ganancia, Aportes y Capital total. El campo "Profit acumulado" (agregado el 2026-07-06 para Peerberry) se usaba unicamente como verificacion manual de la cadena de backfill contra los correos, no lo consume el script ni el dashboard.

**Cambio:** columna "Profit acumulado" eliminada de la DB Notion via `DROP COLUMN`. Schema actual: Fecha (titulo), Plataforma, Periodo, Ganancia, Aportes, Capital total, Fecha reporte.

**Impacto:** ninguno en el dashboard (no se leia). Reduce el mapping que Relay tiene que completar en los flujos de Peerberry y MyInvestor.

---

## [2026-07-07] Card "Rentabilidad inversiones": mostrar nombre del mes en vez de "último mes"

**Contexto:** el título de la card decía "Rentabilidad inversiones · último mes", sin indicar a qué mes correspondía el dato.

**Cambio:**
- `scripts/sync_finance_data.py`: `_kpi_from_series()` agrega `periodo_ultimo_mes` (formato "YYYY-MM", tomado de `months[-1]["mes"]") al objeto kpi (total y por plataforma).
- `js/charts.js`: `renderKPIs()` traduce `periodo_ultimo_mes` a nombre de mes en español (array `MESES`) y arma el título "Rentabilidad inversiones · {mes}". Si no hay dato, cae a "· último mes" como antes.

**Verificado:** `sync-finance-data.yml` disparado manualmente; `finance_data.json` confirma `periodo_ultimo_mes: "2026-06"`.

---

## [2026-07-07] Revertir a dos cards separadas: "Patrimonio invertido" y "Rentabilidad inversiones"

**Contexto:** la unificación en una sola card (entrada anterior del mismo día) quedó demasiado grande visualmente. Se pidió volver a separarlas.

**Cambio:** en `renderKPIs()` (js/charts.js), cada bloque vuelve a su propio `<div class="card">`, sin reintroducir la línea "Rentabilidad 12m (compuesta)" que ya se había quitado. Contenido de cada card idéntico al de la versión unificada, solo cambia el contenedor.

---

## [2026-07-07] Unificar cards "Patrimonio invertido" y "Rentabilidad inversiones" (Resumen)

**Contexto:** en el tab Resumen, "Patrimonio invertido" y "Rentabilidad inversiones · último mes" eran dos cards separadas. Se pidió fusionarlas en una sola y quitar la línea "Rentabilidad 12m (compuesta)".

**Cambio:** en `renderKPIs()` (js/charts.js) ambos bloques ahora comparten un único `<div class="card">`, separados por un borde interno. Se elimina la fila de `pct_12m`. El cálculo del dato (`getKpiInversiones()`, `pct_ultimo_mes`, `ganancia_12m`) no cambia, solo la presentación.

**Verificado:** diff revisado antes de subir; no afecta `finance_data.json` ni sync.

---

## [2026-07-07] Suscripciones inactivas: dejar de mostrarse tras 6 meses sin cobros

**Contexto:** `detectRecurring()` en `js/insights.js` marca una suscripción como inactiva cuando pasan más de 45 días sin cobro (`RECURRING_ACTIVE_DAYS`), pero seguía mostrándola indefinidamente en la sección colapsable "Inactivas" del bloque Suscripciones.

**Cambio:** nueva constante `RECURRING_HIDE_DAYS = 180`. Cada registro recurrente ahora guarda `diasSinCobro`. En `renderSuscripciones()`, las suscripciones (`esSuscripcion: true`) con más de 180 días sin cobro se excluyen del listado (activas e inactivas), sin afectar "otros cargos recurrentes" ni la detección en sí.

**Verificado:** `node --check` sobre `js/insights.js` antes de subir.

---

## [2026-07-06] Unificar cálculo de capital invertido entre Resumen e Inversiones

**Contexto:** la card "Patrimonio invertido" (Resumen) y la card "Capital total" (Inversiones) leen ambas de `inversiones.capital`, pero con lógica distinta: Inversiones aplicaba fill-forward (arrastra el último valor > 0 si un mes no tiene reporte de una plataforma) y Resumen tomaba el último registro tal cual. Cuando MyInvestor (carga mensual) todavía no reportó el mes en curso, esto producía cifras distintas entre ambas tabs para el mismo concepto.

**Cambio:** se extrajo la función de fill-forward a `js/state.js` como `fillForwardCapital()`, reemplazando la copia local en `renderInversiones()` (app.js) y aplicándola también en la card de Resumen (charts.js). Ambas cards ahora parten del mismo dato procesado.

---

## [2026-07-06] KPI rentabilidad inversiones: se retira "Aportado (12m)"

**Contexto:** la linea "Aportado (12m)" dependia de reconciliar la categoria "Inversion" de Movimientos (Notion) contra los emails de cada plataforma para saber que transferencias eran aportes reales. Se detecto que esa categoria mezcla conceptos no relacionados (nomina redirigida a MyInvestor via "PAG NOMINAS", traspasos, prestamos, donativos, crypto) y que reconciliarla mes a mes consume tiempo desproporcionado al valor que aporta el dato. Se decidio simplificar el KPI en vez de automatizar esa reconciliacion.

**Cambio:**
- `scripts/sync_finance_data.py`: `_kpi_from_series()` ya no calcula `aportes_12m` ni `aportes_12m_incompleto`. El objeto `kpi` (total y por plataforma) queda con `pct_ultimo_mes`, `pct_12m`, `ganancia_12m`, `capital_actual`.
- `js/charts.js`: se quita la fila "Aportado (12m)" y la nota de pie sobre dato incompleto de la tarjeta "Rentabilidad inversiones".
- El calculo de aportes en `build_ganancia_inversiones()` (usado en el grafico de barras del tab Inversiones, no en el KPI) no se toca.

**Verificado:** sync-finance-data.yml disparado manualmente tras el push. `node -c` y `py_compile` sobre ambos archivos antes de subir.

**No se automatiza (por ahora):** la idea alternativa de leer directamente los emails de cada plataforma (sin pasar por Movimientos) para reconstruir Aportes queda en el roadmap si en el futuro se vuelve a necesitar ese dato.

---

## [2026-07-06] Backfill Aportes historico MyInvestor (19 meses, dic 2024 - jun 2026)

Se revisaron los 19 mails "Rentabilidad de tu cartera en [mes]" (comunicaciones@myinvestor.es) y se completo el campo `Aportes` en las 19 filas Mensuales de la DB Rendimiento Inversiones, extraido directo del bloque APORTACIONES de cada mail (sin calculo derivado).

Valores cargados (EUR, mes: aportes):
dic24: 771 | ene25: 0 | feb25: 0 | mar25: 0 | abr25: 0 | may25: 0 | jun25: 0 | jul25: 657 | ago25: 0 | sep25: 281 | oct25: -2139 | nov25: 992 | dic25: 199 | ene26: -9783 | feb26: 0 | mar26: 480 | abr26: 448 | may26: 438 | jun26: 444 (ya cargado).

**Nota sobre enero 2026:** el aporte de -9.783€ explica el salto de capital de 15.491€ (dic25) a 6.276€ (ene26) que se veia en la serie — fue un retiro grande, no un error de datos.

**Efecto en el KPI (verificado tras sync):** `myinvestor.aportes_12m_incompleto` paso de `true` a `false` (los 12 meses de la ventana ya tienen Aportes conocido). El total combinado (`aportes_12m`) sigue en `true` (incompleto) porque Peerberry solo tiene Aportes conocido para junio 2026 (unico mes con datos Semanales backfilleados) — se resuelve cuando el histórico de Peerberry tambien tenga Aportes, o naturalmente a medida que pasen los meses con el flow de Relay activo.

**Verificado:** sync-finance-data.yml run exitoso, finance_data.json con `aportes_12m` = 6.944€ (Peerberry 6.500 + MyInvestor 444, único mes con ambas plataformas conocidas).

---

## [2026-07-06] KPI rentabilidad inversiones: reemplaza Ahorro real 12m

**Implementado (steps 3-4 del rediseno de KPI, ver entrada anterior 2026-07-06 sobre Aportes/Profit acumulado):**

- `scripts/sync_finance_data.py`: `fetch_rendimiento_inversiones_notion()` ya no filtra por Periodo (trae Semanal+Mensual). Nueva `_aggregate_rendimiento_by_month()` agrega por mes calendario y plataforma (Mensual si existe, si no suma de Semanales — sin ajuste de atribucion, `Fecha reporte` ya es fecha de cierre real). `build_ganancia_inversiones()` ahora recibe ese dict agregado y agrega campos `*_aportes` y `*_capital` a cada mes. Nueva `build_kpi_inversiones()`: calcula `pct_ultimo_mes` y `pct_12m` (TWR compuesto, encadenando retornos mensuales = Ganancia/Capital cierre mes anterior) mas `ganancia_12m`/`aportes_12m`, total y por plataforma (`por_plataforma.peerberry`/`.myinvestor`). `aportes_12m` total es `null` si algun mes de la ventana no tiene Aportes conocido en ambas plataformas (evita subestimar sumando un 0 implicito).
- `js/insights.js`: `getRendimientoLastMonths()`/`getAportesLastMonths()` (obsoletos) reemplazados por `getKpiInversiones()`, que solo lee `inversiones.kpi` ya calculado.
- `js/charts.js`: tarjeta "Ahorro real · ultimos 12 meses" reemplazada por "Rentabilidad inversiones · ultimo mes" — % ultimo mes destacado, % 12m compuesto, generado por intereses (12m) y aportado (12m) en EUR, con desglose de % mensual por plataforma debajo. Si `aportes_12m` es null se muestra nota de dato incompleto.
- `js/app.js`: fallback de `FINANCE_STATE.inversiones` incluye `kpi: null`.

**Validacion:** `pct_ultimo_mes` de MyInvestor calculado (1.83%) coincide contra el 1.8% que MyInvestor reporta en su propio mail de junio 2026 (formula propia: Ganancia/Capital cierre mes anterior, vs la de MyInvestor que usa saldo medio — la cercania confirma que el proxy es razonable).

**Limitacion conocida:** `aportes_12m` sera `null` hasta que MyInvestor tambien tenga Aportes cargado por Relay (las filas Mensuales historicas no lo tienen). Por plataforma, Peerberry ya tiene Aportes desde el backfill de junio 2026.

**Verificado:** sync-finance-data.yml run exitoso (dispatch manual), finance_data.json con `inversiones.kpi` poblado, deploy-pages.yml exitoso.

**Pendiente:** flow de Relay Peerberry/MyInvestor → Notion (usuario), que ademas resolvera el `aportes_12m_incompleto` una vez ambas plataformas informen Aportes mensualmente.

---

## [2026-07-06] Rendimiento Inversiones: modelo semanal Peerberry, campos Aportes y Profit acumulado

**Contexto:** el usuario confirmo que Peerberry NO emite reportes mensuales — solo el mail semanal de los lunes ("Account summary overview", info@peerberry.com). Las 18 filas Mensual historicas son construcciones del backfill (deltas de Profit entre lunes elegidos). La fila "Semanal" del 28/06 quedo validada como reporte real: Capital 11.702,99 = Invested funds 8.360,91 + Available balance 3.342,08 del mail del 29/06; los depositos de junio (1.500 el 10/06 + 5.000 el 18/06) explican el salto de capital.

**Contenido verificado de los mails (para el flow de Relay):**
- Peerberry semanal: Balance on [inicio/fin] con fechas del periodo, Interest income (ganancia semanal directa, sin deltas), Principal repayment, Investment, Deposit, Withdrawals, y bloque Portfolio (Invested funds, Available balance, Profit acumulado).
- MyInvestor mensual ("Rentabilidad de tu cartera en [mes]", comunicaciones@myinvestor.es, dia 1-2): Valor de cartera, Aportaciones (mes/anio), Ganancias (mes/anio/desde inicio), Rentabilidad % (mes/anio/desde inicio).

**Decisiones:**
1. Schema DB Rendimiento Inversiones (93eda06b-9207-4589-b3f0-66be10ab9caf): +2 campos number, `Aportes` y `Profit acumulado`.
2. Convencion nueva: Peerberry se carga como Periodo=Semanal (una fila por lunes, Fecha reporte = fecha FIN del periodo del mail, no la fecha de envio). MyInvestor sigue Mensual.
3. Mapping Relay: Peerberry → Ganancia=Interest income, Aportes=Deposit−Withdrawals, Capital total=Invested funds+Available balance, Profit acumulado=Profit. MyInvestor → Ganancia=Ganancias mes, Aportes=Aportaciones mes, Capital total=Valor de cartera, Profit acumulado vacio.
4. Historico Mensual de Peerberry (dic24-may26) se conserva tal cual. Regla de agregacion futura en sync: por mes, si existe fila Mensual se usa esa; si no, se suman las Semanal del mes (sin doble conteo). Filas Mensual viejas no tienen Aportes → el sync puede derivarlo como delta Capital − Ganancia (aproximado).

**Backfill junio 2026 Peerberry (desde mails reales de Gmail):** 3 filas Semanal creadas (fin 07/06, 14/06, 21/06) + fila 28/06 completada con Aportes=0 y Profit=752,99. Cadena de Profit validada extremo a extremo: 737,82 → 745,70 → 751,33 → 752,99 (cada delta = Interest income de la semana). Totales junio: Ganancia 25,90 EUR, Aportes 6.500 EUR (coincide con depositos confirmados).

**Decision KPI (usuario):** reemplazar "Ahorro real 12m" del tab Resumen por: rentabilidad % ultimo mes, rentabilidad % 12m (TWR compuesto), y descomposicion aportado vs generado — nivel total cartera con desglose por plataforma. Implementacion pendiente en sync_finance_data.py e insights.js/charts.js.

**Pendiente:** usuario crea flow Relay→Notion con el mapping de arriba (recordar conectar la DB a la conexion de Notion que use Relay, independiente de "Notion Talho").

---

## [2026-07-04] Fix atribucion de mes Peerberry en build_ganancia_inversiones

**Causa confirmada por el usuario:** Peerberry envia su reporte todos los lunes, cadencia semanal fija sin relacion al calendario mensual (no el "primeros dias del mes" que se especulaba). El informe que cierra febrero 2026 llego el lunes 2026-03-02.

**Fix:** en `build_ganancia_inversiones()`, si Plataforma=Peerberry y el dia de "Fecha reporte" es <=3, se atribuye al mes anterior. Regla acotada a Peerberry — MyInvestor no la necesita (reporte mensual, llega dentro del mes que informa).

**Verificado:** re-sync exitoso. `2026-02` paso de 0 a 46.79EUR, `2026-03` paso de 71.66 a 24.87EUR (46.79+24.87=71.66, confirma que no se perdio ni duplico nada, solo se corrigio la atribucion). Resto de los 19 meses sin cambios.

---

## [2026-07-04] KPI "Ahorro real 12m": fuente cambiada de % Sheet a Ganancia EUR Notion

**Motivacion:** el KPI usaba `inversiones.rendimiento` (%, hoja Sheets), que mezcla depositos con rentabilidad real (ver entrada de migracion 2026-07-03). Con el backfill de Peerberry completo, ambas plataformas tienen Ganancia EUR limpia en la DB Notion "Rendimiento Inversiones" para todo el rango dic2024-may2026.

**Decision:** cambio quirurgico, no la migracion completa de build_inversiones() que documenta la seccion "Migracion Inversiones" de PROJECT_MEMORY. Se agrega un campo nuevo `inversiones.ganancia` (EUR) sourced de Notion, dejando `capital` y `rendimiento` (%) intactos y sourced de Sheets como antes — el tab Inversiones (KPIs, ambos graficos) no se toco y sigue funcionando igual.

**Cambios:**
- `scripts/sync_finance_data.py`: nueva `fetch_rendimiento_inversiones_notion()` (data source `93eda06b-9207-4589-b3f0-66be10ab9caf`, filtro Periodo=Mensual en la query) y `build_ganancia_inversiones()` — agrupa por mes calendario de "Fecha reporte", suma Ganancia por plataforma.
- `.github/workflows/sync-finance-data.yml`: env var nueva `NOTION_RENDIMIENTO_DATA_SOURCE_ID`.
- `js/insights.js`: `getRendimientoLastMonths(months)` reescrita — suma directa de `inversiones.ganancia` en la ventana, sin multiplicar por capital (ya viene en EUR).
- `js/app.js`: fallback de `FINANCE_STATE.inversiones` incluye `ganancia: []`.

**Bloqueo encontrado y resuelto:** la integracion "Notion Talho" (secret `NOTION_TOKEN` de GitHub Actions) no estaba conectada a la pagina "Rendimiento Inversiones" — mismo patron que el bloqueo de Movimientos documentado el 30/06/2026. Resuelto conectando manualmente desde Notion (pagina → ··· → Conexiones → Notion Talho).

**Verificado:** dispatch manual de `sync-finance-data.yml` exitoso, `finance_data.json` con 19 meses en `inversiones.ganancia` (dic2024-jun2026), deploy de Pages exitoso.

**Limitacion conocida, no corregida:** al agrupar Ganancia por mes calendario de "Fecha reporte", los informes de Peerberry que llegan los primeros dias de un mes (cadencia no fija al 1ro) se atribuyen al mes de recepcion en vez del mes que cubren. Caso detectado: informe de febrero 2026 llego 2026-03-02 → su Ganancia (46.79€) quedo en el bucket "2026-03" junto con la de marzo, dejando "2026-02" en 0 para Peerberry. El total acumulado no se pierde, solo se corre de mes. No afecta MyInvestor (cadencia mas estable dentro del mes). Pendiente decidir si vale la pena un offset de atribucion si se repite.

---

## [2026-07-03] Backfill Peerberry Rendimiento Inversiones: COMPLETO (dic 2024 - may 2026, 18 meses)

**Contexto:** cierre del backfill iniciado en sesiones anteriores. Se cargaron los 9 meses restantes: sep 2025 - may 2026.

**Meses cargados en esta tanda final:**

| Mes | Ganancia EUR | Capital EUR | Fecha reporte |
|---|---|---|---|
| Ene 2026 | 35.86 | 5537.94 | 2026-01-26 |
| Feb 2026 | 46.79 | 5084.73 | 2026-03-02 |
| Mar 2026 | 24.87 | 5109.60 | 2026-03-30 |
| Abr 2026 | 43.86 | 5153.46 | 2026-04-27 |
| May 2026 | 23.63 | 5177.09 | 2026-05-25 |

(Sep-Dic 2025 registrados en la entrada anterior.)

**Estado final:** Peerberry cubre dic 2024 - may 2026, 18 meses consecutivos verificados sin huecos. Cadena de Profit acumulado validada extremo a extremo contra los correos (ningun salto inconsistente). MyInvestor ya estaba completo desde una sesion anterior (dic 2024 - jun 2026). `Rendimiento Inversiones` queda al dia para ambas plataformas salvo una fila suelta "Semanal" de Peerberry en jun 2026 (fecha 2026-06-28, capital 11702.99) que no forma parte de este backfill mensual y no fue tocada — su origen no esta documentado, revisar en sesion futura si genera inconsistencias en el grafico.

**Backfill de Rendimiento Inversiones: cerrado.** Proximo paso relacionado: auditoria de la categoria "Inversion" en Movimientos (pendiente, ver seccion "Estado actual").

---

## [2026-07-03] Backfill Peerberry Rendimiento Inversiones (sesion 2): sep 2025 - dic 2025 cargados, correccion de duplicados

**Contexto:** continuacion del backfill Peerberry. Verificacion previa del rango dic2024-ago2025 confirmo consistencia (cadena de Profit acumulado sin errores). Se detectaron y corrigieron 3 filas duplicadas en feb 2025 (renombradas y movidas fuera de la DB) y un titulo vacio en mar 2025.

**Meses cargados esta sesion:**

| Mes | Ganancia EUR | Capital EUR | Fecha reporte |
|---|---|---|---|
| Sep 2025 | 43.63 | 5487.21 | 2025-09-22 |
| Oct 2025 | 42.86 | 5530.07 | 2025-10-27 |
| Nov 2025 | 34.90 | 5464.97 | 2025-11-24 |
| Dic 2025 | 37.11 | 5502.08 | 2025-12-29 |

Profit acumulado en dic 2025 = 552.08EUR (verificado contra correo).

**Peerberry pendiente:** ene 2026 (19c1d1589067a4fc), feb 2026 (19cd152854bfba34), mar 2026 (19d618588e7b80bb), abr 2026 (19df1b616daf6650), may 2026 (19e81edf88fed371). Metodo igual a sesiones anteriores: Ganancia = Profit(mes) - Profit(mes anterior, ultimo Profit conocido = 552.08 dic 2025). Capital = Invested funds + Available balance.

---

## [2026-07-03] Backfill Peerberry Rendimiento Inversiones (sesión 1 de tandas): Enero 2025 cargado

**Contexto:** continuación de entrada anterior. Iniciado backfill de Peerberry en tandas de 1-2 meses por sesión para no repetir problema de contexto (cada correo trae HTML de 20-30k tokens).

**Estado:** Enero 2025 completamente cargado en Notion `Rendimiento Inversiones`.

| Mes | Profit € | Ganancia € | Capital € | Fecha reporte |
|---|---|---|---|---|
| Ene 2025 | 249,64 | 20,24 | 2.799,64 | 2025-01-27 |

Cálculo ganancia: 249,64 (ene) − 229,40 (dic 2024, baseline) = 20,24€. Capital = Invested funds (2.796,35) + Available balance (3,29).

**Método utilizado:**
1. `Gmail:get_thread(threadId: "194c983652a9860c")` → `plaintextBody` con tabla Portfolio
2. Parseo manual: extraer "Profit: € X.XXX,XX", "Invested funds: € X.XXX,XX", "Available balance: € X.XXX,XX"
3. Descarte HTML después de extracción (no reutilizar en procesamiento posterior)
4. `Notion:notion-create-pages` con `data_source_id: 93eda06b-9207-4589-b3f0-66be10ab9caf`

**Pendiente — 16 meses restantes:**

| Mes | Thread ID | Estado |
|---|---|---|
| Feb 2025 | 19559b284f96ed37 | Pendiente |
| Mar 2025 | 195a1cb8fc2004d3 | Pendiente |
| Abr 2025 | 1969f321835d18a1 | Pendiente |
| May 2025 | 1972f63864403a88 | Pendiente |
| Jun 2025 | 1979b88bd3d4af2e | Pendiente |
| Jul 2025 | 19873d4a21aa829e | Pendiente |
| Ago 2025 | 198dff85b09f3076 | Pendiente |
| Sep 2025 | 19994354bf624765 | Pendiente |
| Oct 2025 | 19a4873578c81c0b | Pendiente |
| Nov 2025 | 19ad8ae2d3ecf34f | Pendiente |
| Dic 2025 | 19b8ce3ea0e07d10 | Pendiente |
| Ene 2026 | 19c1d1589067a4fc | Pendiente |
| Feb 2026 | 19cd152854bfba34 | Pendiente |
| Mar 2026 | 19d618588e7b80bb | Pendiente |
| Abr 2026 | 19df1b616daf6650 | Pendiente |
| May 2026 | 19e81edf88fed371 | Pendiente |

Próxima sesión: febrero - marzo 2025 (2 meses). Contexto estimado: 2 correos × 20-30k tokens/HTML = ~50-60k tokens consumidos, amplio margen dentro del límite.

---

## [2026-07-03] Backfill Rendimiento Inversiones: MyInvestor completo (19 meses), Peerberry solo 2 meses por costo de contexto

**Contexto:** continuación de la sesión anterior (ver entrada siguiente, "13 meses MyInvestor cargados"). Objetivo: completar el backfill de `Rendimiento Inversiones` desde diciembre 2024.

**MyInvestor: COMPLETO.** Se cargaron los 6 meses que faltaban (dic 2025 – may 2026), sumando a los 13 ya cargados = 19 meses consecutivos sin huecos, dic 2024 a may 2026 (jun 2026 ya estaba cargado de la sesión anterior, así que MyInvestor cubre dic 2024 – jun 2026 completo).

| Mes | Capital € | Ganancia € |
|---|---|---|
| Dic 2025 | 15.491 | 151 |
| Ene 2026 | 6.276 | 568 |
| Feb 2026 | 6.434 | 158 |
| Mar 2026 | 6.439 | -476 |
| Abr 2026 | 7.404 | 518 |
| May 2026 | 8.269 | 427 |

Nota: la caída de capital entre dic 2025 (15.491) y ene 2026 (6.276) corresponde a un reembolso de -9.783€ en aportaciones ese mes ("APORTACIONES en enero"), no a una pérdida — la ganancia de enero siguió siendo positiva (568€).

**Peerberry: solo 2 meses cargados (nov 2024 baseline + dic 2024).** Motivo: cada correo de Peerberry, a diferencia de MyInvestor, no tiene snippet útil para el campo `Profit` — hay que traer el `plaintextBody` completo vía `Gmail:get_thread`, y el `htmlBody` (que no se puede omitir en la respuesta) pesa decenas de miles de tokens por correo. Con ~17 meses pendientes a un correo por mes, el costo de contexto para completar todo Peerberry en una sola sesión es prohibitivo. Se decidió cargar solo lo necesario para dejar un baseline verificado (Profit nov 2024 = 206,73€) y el primer mes calculado (dic 2024), y pausar aquí en vez de hacer un backfill a medias con datos inconsistentes.

Datos del único mes Peerberry cargado esta sesión:
- Nov 2024 (baseline, no se carga como fila): Profit 206,73€, Invested funds 2.747,65€, Available balance 9,08€.
- Dic 2024: Profit 229,40€ → Ganancia = 229,40 − 206,73 = 22,67€. Invested funds 2.759,76€ + Available balance 19,64€ = Capital total 2.779,40€.

**Peerberry pendiente — anchors ya identificados (thread IDs), solo falta fetch + cálculo de Profit:**

| Mes | Balance más cercano a cierre | Thread ID |
|---|---|---|
| Ene 2025 | 2025-01-27 | 194c983652a9860c |
| Feb 2025 | 2025-02-24 | 19559b284f96ed37 |
| Mar 2025 | 2025-03-10 (hueco real hasta abr) | 195a1cb8fc2004d3 |
| Abr 2025 | 2025-04-28 | 1969f321835d18a1 |
| May 2025 | 2025-05-26 | 1972f63864403a88 |
| Jun 2025 | 2025-06-16 (hueco real hasta jul) | 1979b88bd3d4af2e |
| Jul 2025 | 2025-07-28 | 19873d4a21aa829e |
| Ago 2025 | 2025-08-18 (hueco real hasta sep) | 198dff85b09f3076 |
| Sep 2025 | 2025-09-22 | 19994354bf624765 |
| Oct 2025 | 2025-10-27 | 19a4873578c81c0b |
| Nov 2025 | 2025-11-24 | 19ad8ae2d3ecf34f |
| Dic 2025 | 2025-12-29 | 19b8ce3ea0e07d10 |
| Ene 2026 | 2026-01-26 | 19c1d1589067a4fc |
| Feb 2026 | 2026-03-02 | 19cd152854bfba34 |
| Mar 2026 | 2026-03-30 | 19d618588e7b80bb |
| Abr 2026 | 2026-04-27 | 19df1b616daf6650 |
| May 2026 | 2026-06-01 | 19e81edf88fed371 |

Método para continuar: `Gmail:get_thread` con cada ID en orden, extraer `Profit:` del `plaintextBody` (formato "Profit: € X.XXX,XX"), calcular Ganancia del mes = Profit(mes actual) − Profit(mes anterior) — el primer cálculo usa Profit dic 2024 = 229,40€ como base. Capital total = Invested funds + Available balance del mismo correo. Escribir en Notion con `notion-create-pages`, parent `data_source_id: 93eda06b-9207-4589-b3f0-66be10ab9caf`, mismo esquema que MyInvestor pero Plataforma=Peerberry, Periodo=Mensual. Recomendación: hacerlo en tandas de 4-5 meses por sesión para no repetir el problema de contexto.

**Automatización Relay:** sigue sin configurar (ver entrada siguiente, sin cambios).

---

## [2026-07-03] Backfill parcial Rendimiento Inversiones: 13 meses MyInvestor cargados, resto pendiente

**Contexto:** verificación de correos históricos de Peerberry y MyInvestor antes de automatizar con Relay. Objetivo: reemplazar por completo la hoja Inversiones de Sheets con la nueva DB de Notion `Rendimiento Inversiones` (data source `93eda06b-9207-4589-b3f0-66be10ab9caf`, dentro de Finance Tracker), alimentando tanto el gráfico de capital como el de rendimiento.

**Verificación de correos — hallazgos:**
1. **Peerberry ("Account summary overview", semanal, `info@peerberry.com`)**: formato estable (Balance/Interest income/Principal repayment/Investment/Deposit/Withdrawals) desde mediados de 2024. Cadencia semanal limpia sin huecos desde diciembre 2025 hasta hoy. Huecos reales entre mayo y noviembre 2025: saltos de hasta 4-6 semanas sin correo. El campo `Profit` del bloque Portfolio es acumulado desde el origen de la cuenta (verificado restando dos correos consecutivos: delta de Profit = Interest income de esa semana exacto), lo que permite calcular rendimiento de cualquier período como `Profit(fin) − Profit(inicio)` sin verse afectado por los huecos. Cuenta abierta ~octubre 2023; formato de campo era "Opening balance" antes de mediados de 2024 (cambia a "Balance on").
2. **MyInvestor ("Rentabilidad de tu cartera en [mes]", mensual, `comunicaciones@myinvestor.es`)**: cadencia mensual perfecta sin huecos, revisado desde abril 2024. Cada correo trae directamente "GANANCIAS ... En [mes]" en euros, ya neto de aportaciones — no requiere cálculo de deltas. Cartera cambió de nombre "GREY" a "RED" en julio 2025 (misma cuenta, ES8315447889726650823242, mismos campos — no afecta parseo). Entre abril-mayo 2024 hubo brevemente 3 carteras simultáneas (POP x2 + GREY); para diciembre 2024 en adelante (alcance del backfill) ya está consolidado a una sola.

**Decisión de alcance del backfill:** hasta diciembre 2024, alineado con el inicio de los datos de Movimientos (no hasta octubre 2023, apertura real de Peerberry).

**Estado del backfill (03/07/2026):** 13 meses de MyInvestor cargados en Notion: diciembre 2024, enero a noviembre 2025, junio 2026.

| Mes | Capital € | Ganancia € |
|---|---|---|
| Dic 2024 | 14.174 | -52 |
| Ene 2025 | 14.292 | 121 |
| Feb 2025 | 14.372 | 80 |
| Mar 2025 | 13.993 | -380 |
| Abr 2025 | 13.763 | -229 |
| May 2025 | 14.040 | 277 |
| Jun 2025 | 14.037 | -4 |
| Jul 2025 | 14.961 | 268 |
| Ago 2025 | 15.075 | 114 |
| Sep 2025 | 15.746 | 389 |
| Oct 2025 | 14.227 | 620 |
| Nov 2025 | 15.140 | -78 |
| Jun 2026 | 8.864 | 151 |

**Pendiente:** dic 2025 – mayo 2026 de MyInvestor (6 meses), y los ~19 meses de Peerberry completos (requieren full-body fetch de cada correo por el campo Profit, no viene en el snippet de búsqueda). Se pausó el backfill exhaustivo por consumo excesivo de contexto en la sesión; el usuario decidió cargar lo ya extraído y continuar en sesión aparte.

**Automatización pendiente (Relay):** reglas para parsear ambos correos hacia esta DB — no configuradas aún en Relay.app (requiere acceso a la UI, fuera del alcance de las herramientas disponibles). Especificación de las 2 reglas:
- Peerberry: trigger `info@peerberry.com` asunto "Account summary overview" → extraer "Interest income" (Ganancia), "Balance on [fecha]" más reciente + "Invested funds" (sumar para Capital total), esa fecha (Fecha reporte). Fijo: Plataforma=Peerberry, Periodo=Semanal.
- MyInvestor: trigger `comunicaciones@myinvestor.es` asunto "Rentabilidad de tu cartera" → extraer "GANANCIAS ... En [mes]" (Ganancia, la cifra del mes, no la YTD), "VALOR DE TU CARTERA" (Capital total), fecha del correo (Fecha reporte). Fijo: Plataforma=MyInvestor, Periodo=Mensual.
- Ambas escriben en Notion, data source `93eda06b-9207-4589-b3f0-66be10ab9caf`. Requiere conectar explícitamente la integración de Relay a esta base (`···` → Conexiones → Añadir conexión), como ya pasó con la DB Movimientos.

**Nota de proceso:** un intento anterior de commitear esta misma entrada falló silenciosamente (el script que escribía los docs nunca se ejecutó por un error en la llamada de herramienta; el commit posterior solo capturó un cambio de código pendiente y quedó con un mensaje que no correspondía al contenido real). Verificar siempre el commit vía la API de contenidos de GitHub después de escribir documentación, no asumir por el mensaje del commit.

---

## [2026-07-03] Fase 2 analítica: Suscripciones, KPI Ahorro real e Insights automáticos

**Contexto:** implementación de la fase 2 del plan de mejoras (evaluación del 03/07/2026). Decisiones del usuario: seguimiento de suscripciones como sección dentro del tab Resumen (no tab nuevo), y ahorro real definido como aportes + rendimiento de inversiones.

**Nuevo módulo `js/insights.js`** (orden de carga: state → filters → **insights** → charts → app; charts.js consume sus helpers):

1. **Detección de cargos recurrentes (`detectRecurring`)**: agrupa gastos por concepto normalizado + importe exacto; requiere ≥3 cobros con mediana de intervalo entre 25 y 35 días (cadencia mensual). Estado "Activa" si el último cobro está a ≤45 días de la última transacción del dataset (se usa `lastTxDate`, no la fecha del navegador, para que el estado no envejezca si el sync se detiene). Excluye Guille, Talho Argentino, Nomina e Inversion.
2. **Clasificación suscripción vs. otros recurrentes**: es suscripción si la categoría modal del grupo es "Suscripciones", o si el concepto matchea la lista `SUB_KEYWORDS` (Wellhub, Apple, Prime, etc.), o `SUB_KEYWORDS_AMT` para comercios ambiguos (AMAZON.ES solo a 9,99€ = Kindle; PAYPAL EUROPE solo a 10€ = M365). El resto (financiaciones PRES./SABADELL/ONEY, recibos, cuotas de tarjeta) se muestra colapsado como "Otros cargos recurrentes".
3. **Alias legibles (`SUB_ALIASES`)**: mapeo concepto+importe → nombre (iCloud+ 2,99, Hevy 3,49, Claude Pro 22, LinkedIn 29,99, Kindle 9,99, M365 10). Verificar periódicamente: los precios cambian con renovaciones. Si no hay alias, se usa la nota más reciente del grupo.
4. **KPI Ahorro real (12 meses)**, cuarta tarjeta del grid de KPIs: `balance líquido + rendimiento de inversiones`. Los aportes a inversión NO se restan del balance porque la categoría Inversion está excluida del cálculo de gastos — el dinero invertido ya cuenta como ahorro dentro del balance. Se muestran como línea informativa ("Aportes netos a inv."), junto con la tasa de ahorro real (ahorro real / ingresos).
5. **Insights automáticos (`computeInsights`)**: compara el último mes COMPLETO contra su previo (si el mes de la última transacción es el mes en curso, se retrocede uno). Muestra variación del gasto total, top 3 variaciones por categoría (delta ≥50€), y alertas de gasto fuera de rango: categoría con gasto >100€ que supere media + 2 desviaciones estándar de los 6 meses previos (mínimo 4 meses de historial y +20% sobre la media, para evitar falsos positivos con desviación cercana a cero).

**Verificación con datos reales (03/07/2026):** 33 grupos recurrentes, 11 clasificados como suscripción, 5 activas (29,96€/mes). Microsoft 365 y Kindle Unlimited aún figuran "Activa" por sus cobros de junio — pasarán a "Sin cobros" pasada la ventana de 45 días, verificando las cancelaciones del 01/07. Wellhub ya figura sin cobros desde enero 2026. Insights: junio vs mayo, −8% de gasto total, sin alertas.

**Caso conocido:** el cargo APPLE.COM/BILL de 22€ (Claude Pro) no se detecta todavía — sus cobros son irregulares (mediana de intervalo 57 días). Aparecerá automáticamente cuando acumule cadencia mensual. No es un bug.

**Contenedores nuevos en index.html:** `#insights-card` (después de #kpis) y `#subs-card` (después del gráfico mensual), ambos con `display:none` hasta que su render tenga datos.

---

## [2026-06-30] Fix: filtrado del artifact rompió el KPI "Sin analizar por Claude"

**Síntoma:** el usuario reportó 241 movimientos "sin verificar por Claude" pese a que el registro real (`reviewed_movements.json`) tenía 2318 entradas cargadas.

**Causa raíz:** al filtrar `deploy-pages.yml` para publicar solo los archivos del dashboard (entrada anterior del mismo día), `reviewed_movements.json` quedó afuera de la lista de `cp`. El archivo no es solo de uso interno de Claude/backend — `js/app.js` lo consume directamente vía `fetch('reviewed_movements.json...')` en `init()` para calcular qué movimientos ya fueron revisados. Sin el archivo publicado, el fetch fallaba (404), `window.FINANCE_STATE.reviewedMovements` quedaba como array vacío, y el KPI contaba **todos** los movimientos candidatos como no revisados.

**Fix:** agregado `cp reviewed_movements.json _site/` al step de armado del artifact en `deploy-pages.yml`.

**Lección:** antes de filtrar qué se publica en un sitio estático, hay que mapear todos los `fetch()` reales del frontend (`grep -n "fetch(" js/*.js index.html`), no asumir por el nombre o ubicación del archivo si es "interno" o "público". Los tres archivos que el frontend consume vía fetch son: `finance_data.json`, `sociedad_data.json`, `reviewed_movements.json` — los tres deben estar siempre en el artifact publicado.

---

## [2026-06-30] Optimización: deploy de Pages filtrado + causa real de deployment_queued resuelta

**Optimización de artifact:** `deploy-pages.yml` ahora arma una carpeta `_site` con solo lo que el dashboard necesita (`index.html`, `js/`, `finance_data.json`, `sociedad_data.json`, `.nojekyll`) antes de subir el artifact, en vez de publicar el root completo del repo. Esto deja de exponer públicamente `docs/` (incluye `DECISIONS.md` y `CHANGELOG.md`, ~90 KB de detalle interno), `scripts/`, `prompt_relay_current.txt` y `reviewed_movements.json` (87 KB, contiene movimientos personales en texto plano). Tamaño del artifact recortado a la mitad aproximadamente, aunque el impacto en velocidad de deploy es menor — el costo dominante no era el tamaño del artifact.

**Limpieza:** eliminados `debug_log.txt` y `tmp_sheet_debug.txt`, dos archivos sueltos en la raíz con volcados de movimientos personales, resabios de sesiones de diagnóstico anteriores que nunca se borraron.

**Causa real de `deployment_queued` indefinido (las dos entradas anteriores, "Fix definitivo" y la del trigger, no la resolvían del todo):** el environment `github-pages` del repo quedó en un estado corrupto tras la sucesión de deployments cancelados a medio aplicar durante esta misma sesión de debugging. Ni el cambio de Source a "GitHub Actions" ni el filtrado del artifact tenían efecto sobre esto — el síntoma seguía reproduciéndose intermitentemente con cualquier configuración.

**Fix definitivo real:** borrar el environment desde Settings → Environments → github-pages → Delete environment, y dejar que el siguiente deploy lo recree desde cero. Verificado: el primer deploy tras el borrado completó en segundos, sin cola. Verificado también el ciclo completo (botón Actualizar → `Sync Finance Data` → commit → `Deploy Pages` disparado automático → success) de punta a punta.

**Lección para diagnósticos futuros:** si vuelve a aparecer `deployment_queued` indefinido en el log de "Deploy to GitHub Pages" (reconocible por el loop de "Getting Pages deployment status..." / "Current status: deployment_queued" sin avanzar nunca), no perder tiempo ajustando el workflow — ir directo a borrar y recrear el environment `github-pages`.

---

## [2026-06-30] Fix: botón "Actualizar" no disparaba deploy tras el cambio a GitHub Actions

**Síntoma:** tras migrar correctamente a Source "GitHub Actions" (ver entrada anterior) y confirmar que un deploy manual funcionaba bien, el usuario probó el flujo real (botón Actualizar → dispara `Sync Finance Data` y `Sync Sociedad Data`) y el commit se generó correctamente, pero ningún `Deploy Pages` se disparó después.

**Causa raíz:** comportamiento documentado de GitHub Actions — los pushes hechos con el `GITHUB_TOKEN` automático del workflow (como hacen `sync-finance-data.yml` y `sync-sociedad-data.yml` al comitear `finance_data.json`/`sociedad_data.json` con usuario `github-actions[bot]`) **no disparan otros workflows** por triggers de tipo `push`, a propósito, para evitar loops de automatización infinitos. Esto es independiente del problema de `deployment_queued` documentado en la entrada anterior — son dos bugs distintos que coincidieron en la misma sesión de debugging.

**Fix:** se agregó un step `Trigger Pages deploy` al final de ambos workflows de sync, que ejecuta `gh workflow run deploy-pages.yml --ref main` usando el CLI de GitHub (preinstalado en `ubuntu-latest`), condicionado a que el step de commit haya detectado cambios (`steps.commit.outputs.changed == 'true'`, vía `git diff --cached --quiet` capturado en `$GITHUB_OUTPUT`). Se agregó el permiso `actions: write` a ambos workflows, requerido para que `gh workflow run` funcione.

**Resultado:** verificado con un ciclo real — `Sync Finance Data` corrió, comiteó `finance_data.json`, y disparó `Deploy Pages` automáticamente sin intervención manual, terminando en `success`.

**Patrón a futuro:** cualquier workflow nuevo que comitee datos generados automáticamente (vía `GITHUB_TOKEN`) y dependa de que el dashboard se actualice debe replicar este mismo patrón (`id: commit` con output `changed`, seguido de un step condicional que dispare `deploy-pages.yml`), no asumir que el push solo lo hace.

---

## [2026-06-30] Fix definitivo: GitHub Pages cambiado a "GitHub Actions" como Source

**Contexto:** el fix anterior (agregar `.nojekyll`) resultó insuficiente. El deployment seguía trabándose indefinidamente en estado `deployment_queued`, confirmado con captura del log del job "Deploy to GitHub Pages" del usuario (6+ minutos sin avanzar, reintentando "Getting Pages deployment status..." en loop).

**Causa raíz real:** el repo tenía **Source: "Deploy from a branch"** en Settings → Pages (sistema legacy), pero el deployment efectivo corría a través de un workflow interno automático (`pages build and deployment`) que GitHub genera implícitamente para ese modo. Cuando varios commits se sucedían rápido (sync-finance-data, sync-sociedad-data, commits de docs casi simultáneos), este modo legacy gestionaba mal la cola de deployments encadenados y se trababa sin recuperarse — el campo `.nojekyll` no tiene ningún efecto sobre este problema de concurrencia, solo afecta si se usa o no el procesador Jekyll.

**Fix:** cambiar Source de "Deploy from a branch" a **"GitHub Actions"**, y agregar un workflow propio `.github/workflows/deploy-pages.yml` (trigger: push a `main` + `workflow_dispatch`, usa `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`, con `concurrency: group: pages, cancel-in-progress: true`). Publica todo el root del repo, igual que el modo anterior.

**Resultado:** verificado con un ciclo completo real — disparo manual de `Sync Finance Data` → commit automático → `Deploy Pages` disparado automáticamente → `success` en segundos, sin colas. El antiguo `pages build and deployment` ya no aparece en runs nuevos tras el cambio de Source.

**Nota sobre el campo `status` de la API de Pages:** `GET /repos/.../pages` puede reportar `status: errored` de forma persistente incluso después de deployments exitosos confirmados — no es confiable como fuente de verdad. Verificar siempre contra `GET /repos/.../actions/runs` (workflow `Deploy Pages`, `conclusion: success`) en su lugar.

---

## [2026-06-30] Fix: GitHub Pages bloqueado por build de Jekyll fallido — agregado .nojekyll (insuficiente, ver entrada siguiente)

**Síntoma:** tras una prueba manual (movimiento de prueba agregado en Notion → botón Actualizar), el deployment de GitHub Pages quedó casi 4 minutos en estado "queued" sin avanzar.

**Causa raíz:** el repo tenía `build_type: legacy` en la configuración de Pages, que procesa todo el contenido con Jekyll antes de publicarlo. El sitio es HTML/CSS/JS estático puro — nunca necesitó ese procesamiento. Algunos commits recientes (de documentación en `docs/*.md`) produjeron builds en estado `errored` ("Page build failed"), y esos fallos bloquearon la cola de deployments siguientes, incluido el del `finance_data.json` actualizado tras la prueba.

**Diagnóstico:** confirmado vía API (`GET /repos/.../pages/builds`) — varios builds consecutivos en `errored` con commits de docs, seguidos de uno en `building` indefinidamente.

**Fix:** se agregó un archivo `.nojekyll` vacío en la raíz del repo. Esto le indica a GitHub Pages que sirva los archivos tal cual, sin pasarlos por Jekyll. Es la solución estándar para sitios estáticos puros alojados en Pages.

**Resultado:** el build bloqueado pasó a `built` inmediatamente tras el commit de `.nojekyll`, y el build siguiente (con el archivo ya presente) completó en ~30 segundos sin errores. Verificado que `finance_data.json` servido coincide con el del repo (movimiento de prueba presente, luego confirmado eliminado por el usuario).

**Impacto a futuro:** cualquier commit (incluidos los de `docs/*.md` que se hacen tras cada cambio, según el proceso obligatorio del proyecto) ya no debería poder bloquear el deployment del dashboard. Si vuelve a aparecer un build en `errored`, no es por falta de `.nojekyll` — investigar otra causa.

---

## [2026-06-30] Migración Sheets → Notion: completada (8/8 pasos). Sheets deja de recibir escrituras.

**Decisión:** saltar también la fase de validación de 1-2 semanas con ambos destinos activos (pasos 5-6 originales). El usuario configuró Relay para escribir **solo** en Notion, sin paralelo con Sheets, y prefirió entrar en producción con seguimiento manual de fallas en vez de la validación progresiva planificada originalmente.

**Implicación:** el Google Sheet Movimientos deja de recibir escrituras de Relay desde el 30/06/2026. Queda como archivo histórico de solo lectura. Ningún workflow lo escribe más.

**Workflows eliminados:** `update-sheet-cells.yml`, `find-update-nota.yml`.

**Workflows conservados:** `update-relay-prompt.yml`, `read-relay-prompt.yml` — siguen vigentes porque Relay continúa activo (cambió el destino de escritura, no se desactivó) y el prompt sigue centralizado en `prompt_relay_current.txt`.

**Flujo "Organizar Movimientos" actualizado:** la escritura de categoría (propiedad Categoria, select) y nota (propiedad Nota, rich text) pasa de `update-sheet-cells.yml` (FIND_AND_UPDATE por fecha+concepto+monto en el Sheet) a `notion-update-page` vía MCP, localizando la página de Notion con la misma clave fecha+concepto+monto via `notion-query-data-sources`. La clave de `reviewed_movements.json` no cambia. Se agregó manejo explícito para el caso de duplicados exactos (mismo caso que NYX*AIRservSpain documentado en el flujo anterior): si la query devuelve más de una página candidata, Claude pide confirmación al usuario en vez de asumir.

**Pendiente, fuera de esta migración:** Inversiones (Peerberry/MyInvestor) sigue en Google Sheets, sin fecha definida para su propia migración a Notion — decisión explícita del usuario, fase futura.

---

## [2026-06-30] Migración Sheets → Notion: pasos 3-4 completados, despliegue directo a producción

**Decisión:** saltar la fase de "probar en paralelo y comparar JSON" (paso 4 original) y desplegar directo el script reescrito al workflow de producción, basándose en la verificación de salud de Notion realizada antes (8/8 movimientos de prueba correctos, ver verificación manual del mismo día) y en validar contra datos reales en lugar de una comparación sintética.

**Implementación del paso 3:** `sync_finance_data.py` reescrito. Movimientos se lee con `requests` contra la API REST de Notion (`POST /v1/data_sources/{id}/query`, paginado), Inversiones sin cambios (sigue leyendo Sheets con `google-api-python-client`). El output mantiene exactamente el mismo schema de `finance_data.json`.

**Implementación del paso 4 (adaptado):** workflow `sync-finance-data.yml` actualizado con env vars `NOTION_TOKEN` (secret ya existente, creado 24/06/2026) y `NOTION_MOVIMIENTOS_DATA_SOURCE_ID`. Validado con dispatches manuales directos contra producción.

**Problemas encontrados y resueltos:**
1. `Notion-Version: 2022-06-28` no es compatible con el endpoint `/v1/data_sources/{id}/query` — ese endpoint requiere `2025-09-03`. Corregido.
2. 404 persistente pese al fix anterior: la integración del token guardado en `NOTION_TOKEN` (identificada como "Notion Talho" por fecha de creación coincidente) no estaba conectada a la página Finance Tracker en Notion — solo Relay.app y Zapier lo estaban. El usuario conectó la integración manualmente desde el menú de conexiones de la página. Resuelto.

**Resultado:** workflow corre exitosamente, genera `finance_data.json` con 2473 movimientos (2465 históricos + movimientos de la prueba del 29/06), Inversiones intacta (28 meses de capital, 11 de rendimiento).

**Riesgo aceptado:** no hubo comparación lado a lado del JSON generado por Sheets vs. Notion antes del corte. Mitigado por inspección directa del JSON resultante y por la verificación de salud previa de la base de Notion.

---

## [2026-06-30] Migración Sheets → Notion: arrancada, paso 1-2 completos

**Decisión:** Migrar la hoja `Movimientos` del Google Sheet a una base de datos en Notion, para permitir escritura directa via MCP (sin GitHub Actions, sin espaciado de 30s, sin pausar Relay).

**Motivación:** `update-sheet-cells.yml` (GitHub Actions) es lento y aparatoso para escrituras individuales (notas, categorías). El sandbox de Claude tiene bloqueados a nivel de red `sheets.googleapis.com` y `script.google.com` (confirmado con `host_not_allowed`), así que GitHub Actions es el único canal de escritura posible hoy. Notion, en cambio, es accesible directamente via MCP.

**Análisis de impacto realizado:** las columnas E–J del Sheet (Ingreso, Gastos, Módulo monto, Ingreso/Gasto, Mes, Año) son ornamentales — `finance_data.json` solo exporta 5 campos (fecha, concepto, monto, categoria, nota) y el dashboard recalcula todo desde `monto`/`fecha`. El frontend (app.js, charts.js, filters.js, state.js) no requiere ningún cambio si el schema del JSON se mantiene.

**Relay tiene integración nativa con Notion** (verificado vía búsqueda web, octubre 2025). No es más frágil que el destino Sheets actual.

**Decisión sobre Inversiones:** la hoja `Inversiones` del Sheet (datos manuales de Peerberry/MyInvestor, no provienen de Relay) se mantiene en Google Sheets en esta primera fase. El script de sync lee Movimientos de Notion e Inversiones de Sheets simultáneamente.

**Plan de 8 pasos:**
1. ✅ Crear DB Movimientos en Notion (Fecha, Concepto, Monto, Categoría, Nota)
2. ✅ Importar 2.465 movimientos históricos
3. ⬜ Reescribir `sync_finance_data.py` para leer Notion + Sheets (Inversiones)
4. ⬜ Probar sync en paralelo, verificar JSON idéntico
5. ⬜ Configurar Relay para escribir en Notion en paralelo (mantener Sheets activo)
6. ⬜ Validar 1-2 semanas con ambos destinos activos
7. ⬜ Apagar escritura en Sheets y workflows de update-sheet-cells
8. ⬜ Actualizar flujo "Organizar Movimientos" para escribir vía MCP

**Workflows que desaparecen al completar la migración:** `update-sheet-cells.yml`, `find-update-nota.yml`, `update-relay-prompt.yml`, `read-relay-prompt.yml` (este último deja de tener sentido si el prompt vive solo en `prompt_relay_current.txt`).

**Workflows sin impacto:** `sync-sociedad-data.yml` (ya usa Notion). Frontend completo. Botón Actualizar de index.html.

---

## [2026-06-30] DB Movimientos creada en Notion

**Database ID (data source):** `367d58ce-928b-4e31-832d-07707f876365`
**URL:** https://app.notion.com/p/46a204b1ad5a464593ca739648123569
**Parent:** Finance Tracker (`19833ce5-0e68-804c-9693-d4f2f2592968`)

**Schema:**
- Concepto (title)
- Fecha (date)
- Monto (number)
- Categoria (select, 20 opciones con colores asignados — coincide exacto con las categorías válidas del prompt de Relay)
- Nota (rich text)

**Importación:** 2.465 movimientos importados manualmente por el usuario vía CSV exportado del Google Sheet (descarga vía Google Drive MCP en formato CSV, decodificado de base64, parseado con Python: fechas `d/M/yyyy` → ISO `yyyy-MM-dd`, montos formato español `-65,58 €` → float `-65.58`).

**Verificación de la importación (vía `notion-query-data-sources`, SQL contra el data source):**
- Conteo total: 2.465 / 2.465 — exacto
- Distribución por categoría (19 categorías encontradas en los datos): conteo y suma de montos coinciden a centavo exacto contra el CSV de origen, sin excepciones
- Patrón de duplicados (fecha+concepto+monto repetidos, ej. SERVIMATIC -0,50€ varias veces el mismo día): 2.253 combinaciones distintas / 2.465 filas totales — patrón idéntico entre CSV fuente y Notion, confirmando que no hubo duplicación introducida por la importación
- Único hallazgo: nota residual "TEST — borrar" en el movimiento AMAZON.ES del 4/06/2026 (-6,49€) — arrastrada del test del Apps Script de la sesión anterior, que no se había limpiado antes de exportar el CSV. Corregida directamente en Notion a "Libro Kindle 'Inside Delta Force'".

**Nota operativa:** el rate limit de la API de Notion para queries SQL es agresivo — se necesitaron pausas de 30-60s entre llamadas de `notion-query-data-sources` durante la verificación.

**Pendiente de limpieza manual del usuario:** una página vacía quedó creada por error de tooling durante la sesión, titulada `[BORRAR — creada por error]` en la DB Movimientos — eliminar manualmente desde Notion (no hay herramienta de borrado de páginas vía MCP).

## [2026-06-29] Auditoría de notas (col K) y causa raíz del desfase

**Problema detectado:** ~17 de 52 notas de la columna K estaban en el movimiento equivocado (peajes, transferencias a Guille, cafés, SERVIMATIC, suscripciones Apple), con la nota correcta a una fila de distancia.

**Causa raíz:** el desfase proviene de escribir notas con el modo `batch` (rango A1 explícito `Movimientos!Kxx`) de `update-sheet-cells.yml`. El número de fila se calcula fuera del workflow; cuando varios movimientos comparten la misma fecha, el orden intra-día del JSON (fecha desc) no coincide con el del Sheet, y la fila calculada cae en el vecino contiguo.

**Decisión:** las notas (col K) se escriben **siempre con FIND_AND_UPDATE**, nunca con batch por rango A1. FIND_AND_UPDATE ancla por fecha+concepto+importe exactos y es inmune al desfase. Es más lento (una invocación por celda) pero correcto.

**Corrección aplicada:** 19 escrituras FIND_AND_UPDATE (14 CLEAR + 5 SET), espaciado 30s, trigger de Relay pausado. Verificado contra JSON regenerado: todas correctas, sin desfases residuales. Notas con valor: 52 → 43.

**Verificaciones Gmail destacadas:** APPLE.COM/BILL -29,99€ = LinkedIn Premium Career (no "Farmacia"); APPLE -3,49€ = Hevy; cargos Amazon recientes confirmados por email de pedido.

## [2026-06-25] Categoría Salud y Belleza

- Nueva categoría añadida al prompt de Relay, al Sheet y a PROJECT_MEMORY.md.
- Keywords semi-duras: KRUSS, WELLHUB, GYMPASS, VIVAGYM, FARMACIA, BARBERIA/BARBERÍA, ADENTIS, DENTIST, Suplementos.
- Wellhub y Gympass movidos de Suscripciones → Salud y Belleza.
- GROUPON → A revisar (ambiguo).
- 42 movimientos históricos recategorizados en batch vía `update-sheet-cells.yml`.

## [2026-06-25] Protocolo para operaciones batch en el Sheet

**Problema:** Relay tiene un trigger que se activa ante cualquier cambio en la hoja Movimientos y dispara el sync `Sync Finance Data` (`finance_data.yml`). Un batch de 41 escrituras generó 41 runs innecesarios del sync.

**Protocolo obligatorio antes de cualquier batch de escrituras al Sheet:**
1. Pausar el trigger de Relay en Relay.app (el que detecta cambios en Movimientos y dispara el sync).
2. Ejecutar el batch.
3. Reactivar el trigger en Relay.app.
4. Disparar manualmente el sync una sola vez si se necesita actualizar el dashboard de inmediato.

**Aplica a:** recategorizaciones masivas, backfills de notas, correcciones en lote, cualquier operación que genere más de ~5 escrituras al Sheet.

## [2026-06-25] Formato de fecha en update-sheet-cells.yml

El Sheet almacena las fechas en columna A **sin zero-padding**: `6/12/2024`, no `06/12/2024`.
El JSON (`finance_data.json`) las almacena con zero-padding: `2024-12-06`.

Al llamar al workflow `update-sheet-cells.yml` en modo FIND_AND_UPDATE, el campo `find_fecha` debe usar el formato del Sheet: `d/M/yyyy` sin ceros a la izquierda.

Conversión correcta en Python:
```python
from datetime import datetime
dt = datetime.strptime(fecha_iso, '%Y-%m-%d')
fecha_sheet = f"{dt.day}/{dt.month:02d}/{dt.year}"  # d/MM/yyyy: día sin cero, mes con cero
```

## [2026-06-23] Tab Talho Argentino

- Gráfico de barras verticales (Jan–mes actual) con gasto mensual. Eje X: meses; eje Y: EUR.
- Lista de transacciones con selector de mes a la derecha del gráfico.
- Categoría `Talho Argentino` **no** se modifica en el resto del dashboard (no se excluye de totales principales).
- Rango del gráfico: enero–mes actual del año en curso; se ajustará en julio para mostrar solo desde el inicio del proyecto (jun 2025).

## 2026-06-05 — Mejoras prompt de categorización Relay

Basado en análisis de 2393 movimientos reales. Cambios aplicados a `prompt_relay_current.txt` y despachados vía `update-relay-prompt.yml` → `'prompt relay'!A2` del Sheet.

| # | Tipo | Cambio |
|---|---|---|
| 1 | Defecto | SANSE I quitado de Supermercado; añadido como Caso especial con regla de desambiguación por contexto |
| 2 | Defecto | MOVILIDAD ACM movido de Suscripciones → Gastos coche |
| 3 | Faltante | SANITAS añadido a Suscripciones |
| 4 | Faltante | DIGI SPAIN añadido a Suscripciones |
| 5 | Faltante | CUSTODIA.FONDOS añadido a Inversion |
| 6 | Faltante | PAYPAL EUROPE: Caso especial — ≤15€ recurrente → Suscripciones; variable → Compras |

Pendiente (requiere decisión sobre nueva categoría): Salud (FARMACIA, ADENTIS, ESTETICA).

---

## 2026-06-05 — Enriquecimiento de Nota dentro del flujo "Organizar Movimientos"

El paso de generar la **Nota (col K)** pasa a ser parte del flujo "Organizar Movimientos" (paso 7), no solo un backfill puntual. Para cada movimiento procesado (prioridad *Compras*): Amazon→producto en Gmail; si no, recibo del comercio en Gmail; si no, búsqueda web de la tienda; si nada, dejar en blanco. Se escribe en `Movimientos!K{row}` con RAW.

**Corrección puntual:** el movimiento `PAYPAL EUROPE` -10,00 (Microsoft 365 Personal, fila 279) se recategorizó de *Compras* a **Suscripciones**.

---

## 2026-06-05 — Campo Nota en movimientos

**Qué:** nueva columna **K = "Nota"** en la hoja Movimientos, texto libre y editable a mano. Se muestra en las tablas de transacciones (tab Categorías y explorador), pensada sobre todo para identificar qué fue cada compra al filtrar por *Compras*.

**Alcance:** el campo aplica a todas las categorías. El enriquecimiento automático (lo rellena Claude) aplica solo a *Compras*.

**Lógica de enriquecimiento (Compras):**
1. Si el cargo es Amazon → buscar el producto en Gmail (`from:auto-confirm@amazon.es` / `confirmar-envio@amazon.es` / `digital-no-reply@amazon.es`) por fecha y casar por importe.
2. Si no es Amazon → buscar recibo del comercio en Gmail por ventana de fecha.
3. Si no hay nada en Gmail → búsqueda web de la tienda para identificarla.
4. Si nada concluyente → dejar la nota en blanco (no inventar).

**Columna E (importante):** E NO es libre. Es un filtro de valores positivos (= importe si es positivo, si no 0) usado para gráficos dentro de la hoja; no se usa en el dashboard. En esta sesión se sobrescribió E por error y se restauró por cálculo (importe>0 ? importe : 0). **La primera columna libre es K.** Cualquier campo nuevo va de K en adelante, nunca E–J.

**Sync:** `build_movimientos` mapea la cabecera "nota"/"notas"/"note"/"detalle" a `nota` en cada registro del JSON. El mapeo es por nombre de cabecera, no por letra de columna.

---

## 2026-06-04 — Flujo "Organizar Movimientos"

**Trigger:** escribir "Organizar Movimientos" en el chat de Claude.

**Fases en orden:**
1. **PayPal** — cruza cada movimiento PayPal no revisado con `from:servicio@paypal.es` en Gmail por fecha; extrae nombre del comercio real; propone categoría
2. **Uber** — distingue Uber Rides (`from:noreply@uber.com subject:viaje`) de Uber Eats (`subject:Eats`); propone Salidas vs Comer afuera
3. **Amazon** — cruza `AMAZON*/AMZN/WWW.AMAZON` con `from:auto-confirm@amazon.es`; extrae producto; propone categoría
4. **Viajes** — cruza movimientos en categorías evaluables con TRIP_WINDOWS (±buffer); propone reclasificación a Viajes agrupada por viaje
5. **Notas (col K)** — enriquece la nota descriptiva de cada movimiento procesado, con prioridad en *Compras*. Lógica en cascada:
   a. **Amazon** → buscar el producto en Gmail (`auto-confirm@amazon.es`, `confirmar-envio@amazon.es`, `order-update@amazon.es`, `digital-no-reply@amazon.es` para Kindle); casar por fecha/importe; nota = nombre del producto.
   b. **No-Amazon** → buscar recibo del comercio en Gmail por ventana de fecha (±pocos días); nota = descripción del recibo.
   c. **Sin recibo** → búsqueda web del comercio para identificar qué es; nota = identificación de la tienda/marca.
   d. **Nada concluyente** → nota en blanco (no inventar).
   Escritura: `update-sheet-cells.yml`, rango `Movimientos!K{row}`, texto plano (RAW). Movimientos no-compra (transferencias, reintegros, Bizum P2P) reciben nota descriptiva breve cuando aporta ("Reintegro en cajero", "Transferencia recibida").

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


