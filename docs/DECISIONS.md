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


