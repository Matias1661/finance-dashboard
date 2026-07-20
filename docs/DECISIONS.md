## [2026-07-20] Corregido bug critico: Ganancia acumulada de Peerberry sumada como si fuera semanal (inflaba mes y rentabilidad)

**Contexto:** Matias reporto que la rentabilidad de Peerberry en el tab Inversiones parecia distorsionada por los aportes y pidio mejorarla. Al verificar contra la DB Notion "Rendimiento Inversiones" antes de tocar el repo, se encontro un bug mas grave que la distorsion por aportes: el campo "Ganancia" de las filas Semanal de Peerberry es el Profit acumulado desde el origen de la cuenta (confirmado por la entrada 2026-07-06 de este mismo archivo, que valido la cadena 737,82 -> 745,70 -> 751,33 -> 752,99 contra los correos), no la ganancia de esa semana. `_aggregate_rendimiento_by_month()` sumaba esas filas crudas cuando no habia fila Mensual de respaldo (mayo 2026 en adelante), inflando el mes.

**Efecto en produccion (verificado contra Notion antes del fix):** mayo 2026 mostraba 2.841,92€ de ganancia y 55,06% de rentabilidad mensual; junio, 3.714,93€ y 44,04%. La ganancia real (delta de Profit acumulado entre reportes consecutivos) es de 31-34€/mes, coherente con el resto del historico (35-45€/mes tipico).

**Correccion previa erronea:** la entrada del 09/07 de este archivo etiqueto el salto de mayo (23,63€ -> 2.841,92€) como "esperado, no un bug", y el CHANGELOG del 2026-07-17 (11) dio por "verificado" el valor de 2.841,92€ sumando las semanas individuales -- esa verificacion sumaba el mismo campo acumulado contra si mismo, sin detectar el problema de fondo. Ambas conclusiones quedan corregidas por esta entrada.

**Fix implementado en `scripts/sync_finance_data.py`:**
1. Nueva funcion `_peerberry_semanal_con_retorno()`: ordena las filas Semanal de Peerberry por Fecha reporte y calcula `ganancia_real` (delta del Profit acumulado contra la fila anterior de la serie, None en la primera sin referencia) y `retorno` (ganancia_real / saldo medio semanal).
2. `_aggregate_rendimiento_by_month()`: usa `ganancia_real` en vez del campo crudo para sumar la Ganancia mensual de Peerberry cuando el mes viene de filas Semanal; guarda la lista de retornos semanales en `retornos_semanales`.
3. `build_rendimiento_mensual()` y `build_inversiones()`: el % de Peerberry ahora encadena (TWR) los retornos semanales cuando estan disponibles, en vez de promediar solo capital de cierre de mes anterior/actual. Esto tambien resuelve, de forma secundaria, la distorsion por aportes grandes a mitad de mes que motivo el pedido original (ej. junio 2026: 0,58% encadenando semanas vs 0,41% con el promedio de 2 puntos sobre la ganancia ya corregida). Meses con fila Mensual de respaldo (historico verificado, sin datos semanales) siguen usando el promedio de 2 puntos, sin cambios.

**Validado:** recalculo local contra los datos reales de Notion (todas las filas Peerberry, dic 2024-jul 2026) antes de subir el fix. Mayo: 31,09€ / 0,60%. Junio: 34,21€ / 0,58%. Julio (parcial, mes en curso): 34,19€. Meses feb-abr 2026 (con fila Mensual) sin cambios: 46,79€/24,87€/43,86€.

**Limitacion conocida:** la primera fila Semanal de la serie (2026-03-02) no tiene referencia previa dentro del regimen acumulado, asi que su `ganancia_real` es `None` (contribuye 0 al mes) -- sin impacto porque marzo 2026 tiene fila Mensual de respaldo. Si en el futuro un mes sin Mensual arrancara justo en la primera fila Semanal disponible, esa semana quedaria subestimada; no aplica hoy.

---



**Que paso:** la primera corrida real de `process_myinvestor_emails.py` encontro 29 emails historicos (Gmail tenia desde enero 2024, mas atras que el backfill oficial de dic 2024). Para abril y mayo de 2024 hubo 2-3 emails cada uno con el mismo cierre de mes pero Capital total muy distinto (ej. mayo 2024: 15.545e, 4.229e y 10.207e) -- confirmado por el usuario (2026-07-17): tuvo varias cuentas/carteras distintas en MyInvestor antes de dic 2024. El control de duplicados (por fecha exacta) no detecta esto como "distintas cuentas", elige arbitrariamente el primer email que procesa (el mas reciente, por el orden de Gmail) y descarta los demas como si fueran duplicados -- perdiendo datos reales de las otras cuentas. Se crearon 6 filas nuevas fuera de la ventana de backfill decidida (dic 2024-jun 2026): 2024-01, 04, 05, 09, 10, 11.

**Correccion:** acotado el query de Gmail en `process_myinvestor_emails.py` con `after:2024/11/25`, respetando la ventana de backfill ya decidida en `docs/DECISIONS.md` (Migracion Inversiones, dic 2024 en adelante). El usuario borra manualmente las 6 filas creadas fuera de ventana.

**Leccion:** al portar un flujo con historial largo, no asumir que "mas historia es mejor" -- verificar contra decisiones de scope ya tomadas (la ventana dic-2024 no fue arbitraria, reflejaba un cambio real de estructura de cuentas) antes de dejar que el script traiga todo lo que encuentre en Gmail.

**Estado:** Corregido y validado. Usuario borro las 6 filas; segunda corrida confirmo los 19 meses conocidos (dic 2024-jun 2026) identicos a la serie previa, sin meses adicionales de 2024. Flujo MyInvestor dado por cerrado.

---

## [2026-07-17] Implementado: flujo de MyInvestor en GitHub Actions (reemplaza a Relay/Make)

**Que se construyo:** `scripts/process_myinvestor_emails.py`, nuevo paso en `sync-finance-data.yml` ("Process MyInvestor emails"), corre despues del paso de Peerberry y antes de generar `finance_data.json`. Busca emails de `comunicaciones@myinvestor.es` / `notificaciones@myinvestor.es` (asunto "Rentabilidad de tu cartera"), pide solo la parte `text/plain` (evita el HTML pesado que bloqueaba a Make con `MaxFileSizeExceededError`), manda el texto a Claude con el prompt ya documentado (Ganancia, Aportes, Capital total, Fecha reporte = ultimo dia del mes), y crea una fila en Notion "Rendimiento Inversiones" (Plataforma=MyInvestor, Periodo=Mensual). Reusa las credenciales OAuth de Gmail ya generadas para Peerberry (`GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`) — no hizo falta un secret nuevo. Control de duplicados por Plataforma+Periodo+Fecha reporte. Registro en `processed_myinvestor_emails.json`.

**Diferencia con el incidente de Peerberry:** antes de implementar se verifico contra Notion que el flujo de Relay/Make para MyInvestor nunca corrio en produccion (`docs/relay-export/README.md`: "solo tiene corridas de test, 2026-07-07 x2"). Los 19 meses ya cargados (dic 2024-jun 2026) vienen del backfill manual + esas 2 corridas de test, sin huecos ni duplicados verificado por SQL antes de la primera corrida real de este script — bajo riesgo de repetir el patron de fechas corridas que afecto a Peerberry, pero se valida igual comparando agregados antes de cerrar el paso.

**Pendiente para validar:** correr el workflow, comparar `finance_data.json` resultante contra los 19 meses ya conocidos (mismos valores, sin duplicados) y confirmar si aparece un mes nuevo (julio 2026, si el reporte ya llego).

**Estado:** Codigo escrito y desplegado. Validacion con corrida real pendiente.

---

## [2026-07-17] Incidente y correccion: filas duplicadas de Peerberry en Rendimiento Inversiones (validacion del flujo GitHub Actions)

**Que paso:** la primera corrida real de `process_peerberry_emails.py` proceso 20 emails historicos de Peerberry (Gmail no tenia mas atras en la bandeja) y creo filas correctas para cada semana desde 2026-03-02. Para las semanas del 2026-06-07 al 2026-07-05, ya existian filas viejas cargadas antes del fix de prompt del 13/07 (bug documentado: tomaban "Interest income" en vez de "Profit", y la fecha de "Balance on" en vez de "Portfolio updated on", que cae un dia distinto). Como el control de duplicados compara por fecha exacta, no detecto esas filas viejas (fecha corrida un dia) y creo filas nuevas al lado, duplicando la Ganancia de esas 5 semanas en la agregacion mensual. El sync corrio automaticamente despues y publico `finance_data.json` con Ganancia de junio y julio infladas en 15,17€ y 17,09€ respectivamente.

**Deteccion:** se detecto ANTES de dar el paso por cerrado, comparando la Ganancia mensual del `finance_data.json` generado contra la suma manual de las filas semanales correctas — la diferencia coincidia exactamente con la suma de las filas viejas.

**Correccion:** el usuario borro las 5 filas viejas y erroneas en Notion (identificadas por titulo: "Peerberry semana 2026-06-07/14/21/28" y "Peerberry July 5, 2026"). El primer intento de borrado no tomo efecto de inmediato en la API (posible demora de la papelera de Notion); tras confirmar y reintentar, un segundo sync mostro las cifras ya correctas: mayo 2.841,92€, junio 3.714,93€, julio 1.548,24€ — todas coinciden exacto con la suma manual de las semanas individuales correctas, sin rastro de las filas viejas.

**Efecto secundario (esperado, no un bug):** mayo paso de 23,63€ a 2.841,92€ porque antes no habia datos semanales reales de Peerberry cargados para marzo-mayo 2026 en Notion (el backfill documentado como "completo hasta mayo 2026, sin huecos" en `PROJECT_MEMORY.md` no era exacto para Peerberry semanal — habia un hueco real que este flujo lleno correctamente).

**Leccion para los proximos flujos (MyInvestor, Nominas):** el control de duplicados por fecha exacta es fragil si el pipeline anterior guardo una fecha ligeramente distinta por un bug de extraccion. Antes de dar una corrida real por valida, comparar la Ganancia/Ganancia mensual agregada resultante contra una suma manual de las filas fuente, no solo confiar en el log de "creado/duplicado" del script.

**Estado:** Corregido y validado. `finance_data.json` regenerado y republicado con datos correctos. Paso 2 del plan Relay (Peerberry) dado por cerrado.

---

## [2026-07-17] Peerberry no puede usar la cuenta de servicio: Gmail personal requiere OAuth con refresh_token

**Contexto:** al implementar el paso 2 del plan Relay (Peerberry en GitHub Actions), la nota "agregar el scope de Gmail readonly a la cuenta de servicio de Google ya usada para Drive" no es viable. Una cuenta de servicio solo puede leer un Gmail ajeno via domain-wide delegation, que solo existe en Google Workspace (dominio con panel de administracion). `matiaso81@gmail.com` es una cuenta personal, sin ese mecanismo disponible.

**Decision:** usar OAuth 2.0 con refresh_token en vez de cuenta de servicio para todo lo que necesite leer Gmail (Peerberry, y despues MyInvestor). Consentimiento interactivo una unica vez (`scripts/get_gmail_refresh_token.py`, corrido localmente por el usuario) para obtener un refresh_token de larga duracion; cada corrida del workflow lo cambia por un access_token nuevo via el endpoint estandar `oauth2.googleapis.com/token`, sin volver a pedir login. Nuevos secrets de GitHub: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`. La cuenta de servicio existente (`GOOGLE_SERVICE_ACCOUNT`) sigue sin cambios, se usa solo para Drive.

**Estado:** Decidido e implementado en `scripts/process_peerberry_emails.py`. Pendiente: usuario debe crear el OAuth Client ID en Google Cloud Console, correr el helper localmente para obtener el refresh_token, y cargar los 3 secrets nuevos antes de la primera corrida real.

---

## [2026-07-17] Implementado: flujo de Peerberry en GitHub Actions (reemplaza a Make)

**Que se construyo:** `scripts/process_peerberry_emails.py`, nuevo paso en `sync-finance-data.yml` ("Process Peerberry emails"), corre despues del paso de Movimientos y antes de generar `finance_data.json`. Busca emails nuevos de `info@peerberry.com` (asunto "Account summary overview") via Gmail API, pide solo la parte `text/plain` (no el HTML completo), manda el texto a Claude con el prompt ya validado en Make el 13/07 (distingue la seccion "resumen de cuenta" de la seccion "Portfolio", usa Invested funds + Available balance como capital y Profit como ganancia), y crea una fila en la DB Notion "Rendimiento Inversiones" (Plataforma=Peerberry, Periodo=Semanal). Control de duplicados por Plataforma+Periodo+Fecha reporte antes de crear cada fila. Registro de mensajes ya procesados en `processed_peerberry_emails.json` (mismo patron que `processed_bank_statements.json`).

**Pendiente para que funcione:**
1. Crear OAuth Client ID (tipo Desktop app) en el proyecto de Google Cloud ya usado para la cuenta de servicio de Drive.
2. Correr `scripts/get_gmail_refresh_token.py` localmente, iniciar sesion como `matiaso81@gmail.com`, aceptar el scope `gmail.readonly`.
3. Cargar `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` como secrets del repo.
4. Antes de la primera corrida real, listar los emails de Peerberry ya existentes en el inbox y pre-cargar sus IDs en `processed_peerberry_emails.json` (mismo criterio que la prueba de humo de Movimientos) para no reprocesar el historico completo de una sola vez.
5. Validar con una corrida manual (`workflow_dispatch`) antes de dar el paso por cerrado.

**Riesgo/duda abierta:** el contenido exacto de la propiedad "Fecha" (title) de la DB no esta documentado en `PROJECT_MEMORY.md` mas alla de "Fecha (titulo)". Este script usa el mismo string que "Fecha reporte" (ej. "2026-07-13"). Confirmar contra como quedaron cargadas las filas historicas antes de dar el flujo por validado, y corregir si no coincide.

**Estado:** Codigo escrito. Sin desplegar ni validar contra un email real todavia — depende de los 3 secrets nuevos.

---

## [2026-07-17] DECISIÓN FINAL: los 4 flujos de email/Drive de la migración Relay van a GitHub Actions, Make queda libre

**Contexto:** después de armar y probar un escenario real en Make (Peerberry + MyInvestor + Nóminas), se encontró un límite de tamaño de mensaje en el trigger de Gmail de Make (`MaxFileSizeExceededError`) que bloqueaba MyInvestor (email de marketing con HTML muy pesado, sin adjuntos) y potencialmente Nóminas. Es una limitación conocida de Make sin workaround simple (confirmado en su comunidad de soporte).

**Decisión:** consolidar **Movimientos + Peerberry + MyInvestor + Nóminas** en GitHub Actions, reusando el patrón ya construido para Movimientos (`scripts/process_bank_statements.py` + paso en `sync-finance-data.yml`). Motivos:
1. Evita el límite de tamaño de Make de raíz — el script propio pide a la API de Gmail solo la parte `text/plain`, sin el HTML pesado.
2. El repo es público, así que los minutos de GitHub Actions son gratis e ilimitados — sin restricción de volumen.
3. Un solo lugar para monitorear (logs de Actions, alertas por Issue si falla), un solo set de credenciales (ya en GitHub Secrets).
4. Deja **Make completamente libre (0 escenarios activos)** para lo que surja en el futuro, en vez de "medio usado" por un solo flujo — mejor alineado con el objetivo original del usuario de minimizar herramientas.

**Cambio de diseño en Nóminas:** en vez de que el flujo lea el email de Beatriz y su adjunto automáticamente (lo que compartía el mismo problema de tamaño de Gmail), **Matías sube el PDF de la nómina a mano** a la carpeta Drive "Nominas" cuando le llega. El flujo en GitHub Actions solo vigila esa carpeta.

**Lo que queda de la exploración en Make (no se descarta, sirve de referencia para escribir los scripts):**
- Escenario "Emails financieros" (id 9538432, desactivado): Peerberry validado con email real; prompt de extracción probado y funcionando (evita confundir la sección "resumen de cuenta" con "Portfolio" del email de Peerberry). MyInvestor: prompt escrito pero nunca llegó a ejecutar por el límite de tamaño.
- Escenario "Nóminas" (id 9538741, desactivado): lógica de extracción (Empresa/Total/Fecha de pago) y subida a Drive escrita, nunca ejecutada.
- Conexiones creadas en Make (quedan ahí, sin uso): Gmail+Drive combinado (id 14438625), Anthropic Claude propio de Make (id 14438562).

**Idea pendiente de evaluar (propuesta por el usuario, no implementada):** alerta en el dashboard que detecte si falta subir la nómina de un mes — por tiempo transcurrido, o cruzando contra el ingreso de nómina esperado en Movimientos. Agregada a `ROADMAP.md`.

**Estado del plan completo tras esta decisión:**
| Flujo | Plataforma | Estado |
|---|---|---|
| Movimientos | GitHub Actions | Implementado y validado con extracto real |
| Peerberry | GitHub Actions (migrar prompt ya probado en Make) | Por implementar |
| MyInvestor | GitHub Actions | Por implementar |
| Nóminas | GitHub Actions (carga manual a Drive) | Por implementar |
| Talho Argentino / Gastos del local (paso 4.5) | GitHub Actions | Decidido, por implementar |

**Próximo paso concreto:** escribir `scripts/process_peerberry_emails.py`, `scripts/process_myinvestor_emails.py` y `scripts/process_nominas.py` (o consolidar en un único script con sub-comandos), agregar los pasos correspondientes a `sync-finance-data.yml`, y agregar el scope de Gmail readonly a la cuenta de servicio de Google ya usada para Drive (o crear una nueva cuenta de servicio dedicada).

**Prompts ya escritos y probados (Peerberry funcionando; MyInvestor y Nóminas escritos pero sin ejecutar) — reusar tal cual en los scripts Python:**

*Peerberry (probado y funcionando):*
```
Extrae del email semanal de Peerberry: Capital total = Invested funds + Available balance de la seccion Portfolio (NUNCA Balance on), Ganancia del periodo, Fecha reporte (YYYY-MM-DD).

Este email de Peerberry tiene DOS secciones con fechas y montos distintos: (1) un resumen de cuenta arriba, con varias lineas 'Balance on <fecha>' e 'Interest income'; (2) una seccion 'Portfolio' mas abajo, con 'Portfolio updated on <fecha>', 'Invested funds', 'Available balance' y 'Profit'. IGNORA COMPLETAMENTE la seccion (1). Usa UNICAMENTE la seccion Portfolio: Capital total = Invested funds + Available balance. Ganancia = el valor de 'Profit' (NO 'Interest income'). Fecha reporte = la fecha de 'Portfolio updated on' (NO ninguna fecha 'Balance on'), formato YYYY-MM-DD.
```
Salida JSON esperada: `{"ganancia": number, "capital_total": number, "fecha_reporte": "YYYY-MM-DD"}`. Filtro Gmail: `from:info@peerberry.com subject:"Account summary overview"`.

*MyInvestor (escrito, sin ejecutar):*
```
Extrae del email mensual de MyInvestor (asunto 'Rentabilidad de tu cartera en <mes>'): Ganancia del mes, Aportes (si aplica), Capital total, Fecha reporte (YYYY-MM-DD, ultimo dia del mes que informa). Si el email tiene mas de una fecha, usa la fecha de cierre del informe/reporte, no fechas de otros movimientos.
```
Salida JSON esperada: `{"ganancia": number, "aportes": number, "capital_total": number, "fecha_reporte": "YYYY-MM-DD"}`. Filtro Gmail: `from:(comunicaciones@myinvestor.es OR notificaciones@myinvestor.es) subject:"Rentabilidad de tu cartera"`.

*Nóminas (escrito, sin ejecutar):*
```
Extrae de esta nomina en PDF: nombre de la empresa, total neto a cobrar, y fecha de pago (YYYY-MM-DD).
```
Salida JSON esperada: `{"empresa": string, "total": number, "fecha_pago": "YYYY-MM-DD"}`. Con el cambio de diseño (carga manual a Drive), ya no hace falta filtro de Gmail — el trigger pasa a ser la carpeta Drive "Nominas".

---

## [2026-07-17] Implementado (parcial): escenarios de Make para Peerberry, MyInvestor y Nóminas

**Qué se construyó vía API de Make (sin depender de la interfaz, que tuvo una caída puntual):**
- Escenario "Emails financieros" (id 9538432): trigger Gmail único (`from:(info@peerberry.com OR comunicaciones@myinvestor.es OR notificaciones@myinvestor.es)`) + router con 2 rutas (Peerberry, MyInvestor), cada una con filtro de asunto además del remitente (para no procesar promociones/notificaciones), extracción con Claude (`claude-sonnet-5`, salida JSON estructurada) y escritura en Rendimiento Inversiones.
- Escenario "Nóminas" (id 9538741): separado del anterior tras detectar que un adjunto de email de Beatriz superaba el límite de tamaño de Make para el trigger de Gmail, lo cual tumbaba las 3 ramas por compartir el mismo trigger. Ahora aislado: su propio trigger, Claude extrae Empresa/Total/Fecha de pago del PDF adjunto, sube el PDF a Drive (carpeta "Nominas") y crea página en DB Nominas con el link de Drive en el campo Archivo.
- 2 escenarios en total, dentro del cupo gratis de Make (quedaba margen para 2).

**Validación real:** Peerberry probado con el email real del 13/07 — la primera pasada extrajo los valores equivocados (confundió la sección "resumen de cuenta" del email con la sección "Portfolio"; tomó "Interest income" en vez de "Profit", y una fecha de "Balance on" en vez de "Portfolio updated on"). Se corrigió el prompt para diferenciar explícitamente ambas secciones y se corrigió a mano la página ya creada en Notion.

**Pendiente:**
- Validar MyInvestor con una corrida real limpia (el email de prueba disponible es más viejo que el cursor interno del trigger; no se pudo forzar sin acceso a la opción "elegir punto de partida" de la interfaz).
- Resolver el límite de tamaño de adjunto para Nóminas antes de poder validar esa rama — evaluar módulo de descarga de adjunto como acción separada en vez de que el trigger cargue el archivo completo automáticamente.
- Conexiones de Make usadas: Gmail+Drive combinado (id 14438625, reemplaza dos conexiones viejas con token inválido), Anthropic Claude propio de Make (id 14438562, independiente de la key usada en GitHub Actions), Notion ya existente.

**Estado:** Peerberry funcional y validado. MyInvestor y Nóminas con código implementado, validación real pendiente.

---

## [2026-07-17] Implementado: flujo de Movimientos en GitHub Actions (reemplaza a Relay)

**Qué se construyó:** `scripts/process_bank_statements.py`, nuevo paso en `sync-finance-data.yml` (corre antes de generar `finance_data.json`, dentro del mismo cron diario 07:00 / dispatch manual). Revisa la carpeta Drive "Extractos para Notion" (ID `1tDJJ8iJJ5SR5pFQdmp-vKO52x9uc_3Cs`), compara contra `processed_bank_statements.json` (nuevo archivo de estado, mismo patrón que `reviewed_movements.json`) para no reprocesar el mismo PDF, manda cada PDF nuevo a Claude (modelo `claude-sonnet-5`) junto con el prompt de categorización leído en vivo de la DB Notion "Prompts para Relay" (mismo mecanismo que usaba Relay — sin copia local que se desactualice), y crea una página por movimiento en DB Movimientos. Incluye control de duplicados (Fecha+Concepto+Monto) antes de crear cada página, que el flujo original de Relay no tenía.

**Autenticación con Google Drive:** cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT`, JSON completo como secret), scope de solo lectura. Requiere compartir la carpeta "Extractos para Notion" con el email de la cuenta de servicio.

**Pendiente para que funcione:**
1. ~~Crear la cuenta de servicio en Google Cloud Console y compartir la carpeta con su email.~~ Hecho.
2. ~~Agregar el secret `GOOGLE_SERVICE_ACCOUNT` al repo.~~ Hecho.
3. Probar con el próximo extracto real en paralelo con Relay antes de apagarlo (paso 5 del plan).

**Prueba de humo (2026-07-17):** primer intento falló por 403 (Google Drive API deshabilitada en el proyecto `finance-dashboard-498109`); habilitada por el usuario. Los 25 PDFs históricos ya en la carpeta (todos ya procesados por Relay en su momento) se pre-cargaron en `processed_bank_statements.json` para que el flujo nuevo no los reprocese. Run [29571518185](https://github.com/Matias1661/finance-dashboard/actions/runs/29571518185) corrió limpio de punta a punta (0 archivos nuevos, como se esperaba).

**Validación con extracto real (2026-07-17):** primer extracto real subido después de la prueba de humo, procesado en paralelo con Relay (run [29572494978](https://github.com/Matias1661/finance-dashboard/actions/runs/29572494978)). Extrajo 7 movimientos; los 7 coincidieron exactamente (Fecha+Concepto+Monto) con lo que Relay ya había creado — 0 duplicados creados, categorización idéntica. Primera validación en paralelo exitosa (paso 5 del plan, en curso — falta repetir con más extractos antes de apagar este flujo específico en Relay).

**Estado:** Código funcionando en producción, primera validación real exitosa. Seguir en paralelo con Relay unos extractos más antes de considerar el paso 1 completado.

---

## [2026-07-17] Seguridad: token de GitHub expuesto en index.html — se descarta el parche rápido, se pasa al arreglo de fondo

**Hallazgo:** un Personal Access Token de GitHub estaba hardcodeado en texto plano en el `<script>` de `index.html` (botón "Actualizar", dispara `Sync Finance Data` y `Sync Sociedad Data` vía `workflow_dispatch`). Al ser servido públicamente por GitHub Pages, era legible por cualquiera desde "Ver código fuente". El usuario revocó el token expuesto.

**Parche rápido intentado y descartado:** se generó un token fine-grained nuevo (acotado a este repo, permiso único Actions: Read/write, expiración 90 días) para reemplazar al anterior directo en `index.html`. **GitHub bloqueó el push por secret scanning / push protection** — no permite comitear ningún patrón de token reconocible en el código, acotado o no. Ese commit nunca llegó a `main`. El token fine-grained generado para este intento quedó sin usar — **hay que revocarlo también**, ya que se pegó en el chat y no tiene ningún otro uso.

**Decisión:** ir directo al arreglo de fondo, descartado el parche. El botón "Actualizar" va a llamar a un webhook de Make (sin secretos visibles en el cliente) en vez de tener un token embebido. El escenario de Make que reciba ese webhook guarda el token del lado del servidor y dispara los workflows de GitHub.

**Estado actual (importante):** `index.html` en `main` todavía tiene el token **viejo y ya revocado** hardcodeado — el botón "Actualizar" está roto en producción hasta que se implemente el webhook de Make. No es un riesgo de seguridad (el token no funciona), pero sí una funcionalidad caída.

**Pendiente (roadmap, alta prioridad):** implementar el webhook de Make y actualizar `index.html` para que llame a esa URL en vez de a la API de GitHub directamente.

**Estado:** Hallazgo documentado. Arreglo de fondo pendiente de implementación.

---

## [2026-07-17] Reparto final de herramientas para toda la migración Relay

**Objetivo del usuario:** reemplazar todos los flujos de Relay con la menor cantidad de herramientas posible, sin pagar o pagando lo mínimo.

**Verificación hecha antes de decidir:** Make (plan gratis) permite máximo 2 escenarios activos, y cada escenario admite un solo trigger de entrada. Se confirmó (comunidad de Make, ver búsqueda del 17/07) que el módulo de Google Drive "Watch Files in a Folder" no vigila subcarpetas ni se puede combinar con otro tipo de trigger (Notion, otra carpeta) dentro del mismo escenario. Los flujos con trigger de email (Gmail) sí pueden compartir un único escenario con un router.

**Reparto final:**
- **Make (1 de 2 escenarios, "Emails financieros"):** Peerberry, MyInvestor y Nóminas — los tres con trigger Gmail, un solo trigger + router de 3 rutas. Nóminas se simplifica respecto al diseño original de Relay (2 workflows encadenados vía Drive): se resuelve en un solo salto (adjunto del email → IA → Notion), sin pasar por Drive.
- **GitHub Actions (comparte infraestructura con Movimientos):** Gastos Talho Argentino + Actualizar gastos local en GH (paso 4.5) — ambos triggers (Drive y cambios en Notion) no entran en el cupo de Make sin gastar el segundo escenario, y reusan el mismo patrón de cron + archivo de estado que se construye para Movimientos.
- **GitHub Actions (ya decidido):** Movimientos.

**Resultado:** 2 herramientas en total (Make + GitHub Actions), ambas dentro de plan gratis, con margen libre en Make (queda 1 de 2 escenarios disponible).

**Estado:** Decidido. Plan de Notion actualizado (filas 2, 3, 4, 4.5). Implementación pendiente.

---

## [2026-07-17] Paso 1 del plan Relay: Movimientos se reconstruye en GitHub Actions, no Make

**Contexto:** paso 1 del plan ("Pasar extracto bancario a Notion") recomendaba Make en Notion. Se evaluaron las dos opciones antes de implementar.

**Hallazgo que cambió la recomendación original:** se chequeó la cuenta real de Make (conector activo) — plan Free confirmado con máximo **2 escenarios activos** (`license.scenarios: 2`), 1.000 operaciones/mes, intervalo mínimo de disparo 15 min, 0 escenarios creados hasta ahora. El plan completo de migración tiene más de 2 flujos con trigger propio (Movimientos, Peerberry, MyInvestor, Nóminas ×2, Talho Argentino ×2), así que el cupo de 2 escenarios es un recurso escaso a repartir entre todos los flujos, no una decisión aislada por flujo.

**Comparación (Movimientos):**
- Make: trigger de Drive nativo sin código, pero consume 1 de los 2 escenarios disponibles; ejecuciones y errores visibles directo por el conector MCP de Make.
- GitHub Actions: sin límite de escenarios (usa minutos de Actions, ya disponibles y sin costo adicional real); reutiliza el patrón que el repo ya tiene (secrets, script Python, workflow) usado en `sync-finance-data.yml` y `sync-sociedad-data.yml`; requiere gestionar un service account de Google para leer Drive; los logs de Actions no son legibles directo por Claude (se redirigen a Azure Blob) — hay que inferir del YAML + conclusión del step.

**Decisión:** GitHub Actions para Movimientos, reservando los 2 escenarios de Make para los flujos con trigger por email en tiempo real (Peerberry, MyInvestor, Nóminas), que se benefician más de reacción instantánea y no tienen alternativa sencilla de polling.

**Estado:** Decidido. Implementación (workflow + script) pendiente.

---

## [2026-07-17] Inicio migración Relay: export guardado en docs/relay-export/, fila 4.5 agregada al plan

**Contexto:** Relay.app cierra el 15/08/2026 (plan gratuito) o 14/09/2026 (plan de pago). Paso 0 del plan de migración ("Plan de migración Relay → nueva plataforma" en Notion): exportar y documentar todos los flujos antes de tocar nada.

**Hecho:**
- Export completo del workspace de Relay (14 workflows) revisado; se descartaron 5 sin relación con el dashboard (Powertrain DB, Poster Open House, Articulos Holy Death, Weekly automotive news digest, Archivar documentos importantes).
- Los 9 flujos restantes (2 vigentes de Peerberry/MyInvestor + 2 legacy que reemplazan + Movimientos + Nóminas [2 flujos encadenados] + Gastos Talho Argentino [2 flujos]) se guardaron en `docs/relay-export/`, con `README.md` documentando trigger, procesamiento, escritura y post-acciones de cada uno.
- Se detectó que el plan de Notion no cubría el par "Gastos Talho Argentino / Actualizar gastos local en GH" (ambos disparan GitHub Actions "Sync Sociedad Data", 301444283) — se agregó como fila "4.5" al plan.
- Se detectó que el flujo de Movimientos no solo escribe en Notion: también dispara GitHub Actions "Sync Finance Data" (286832931) al final. Cualquier reemplazo debe replicar ambas acciones.
- Se detectó que el flujo de MyInvestor a Notion nunca corrió en producción (solo test runs) — validar con un email real antes de apagar el legacy a Sheets.
- El prompt de categorización de Movimientos no tiene copia embebida en el workflow: se lee en vivo de la DB Notion "Prompts para Relay" en cada corrida, así que no hay drift que corregir ahí.

**Estado:** Hecho (documentación). Reconstrucción de cada flujo en la plataforma nueva: pendiente (pasos 1-6 del plan).

---

## [2026-07-14] Card "Incrementos" (tab Inversiones): estimar mes en curso con aportes/retiros si falta reporte de plataforma

**Problema detectado por el usuario:** el segundo renglón de la card "Incrementos" (mes-1 → mes actual) toma su valor del gráfico de capital, que depende del fill-forward de `finance_data.json`. Cuando el reporte mensual de MyInvestor todavía no llegó (valor 0 para el mes en curso), el fill-forward arrastra el valor del mes anterior y el incremento mostrado no refleja el mes en curso (queda en 0 o solo con el delta de Peerberry).

**Solución implementada:** en `renderInversiones()` (`js/app.js`), se detecta si el mes en curso tiene reporte real de ambas plataformas (`peerberry` y `myinvestor` != 0 en el array `capital` sin fill-forward). Si falta alguno, `inc2Val` se reemplaza por el neto de aportes − retiros del mes (categoría "Inversion"), mismo criterio que usa el insight `renderInvAportesRetiros()`. Se marca con la nota "(estimado por aportes)" junto al label del período, para dejar claro que no incluye la ganancia generada, solo el movimiento de fondos.

**Alcance:** solo afecta el segundo renglón (mes-1 → mes actual). El primer renglón (mes-2 → mes-1) siempre usa datos ya cerrados y no se modificó.

**Estado:** Hecho.

---

## [2026-07-14] Implementado: promedio móvil "consciente de etapa" + excepción IRPF en panel de outliers (auditoria 2026-07, orden 9)

**Problema detectado por el usuario:** el promedio móvil de 12 meses arrastraba meses de la etapa anterior tras un cambio de ingresos (paro→Between, Between→Luzutania), marcando como "anómalo" el salto normal de nivel de sueldo en los primeros meses de la etapa nueva, en vez de detectar solo anomalías reales.

**Solución implementada:** el promedio móvil se reinicia en cada cambio de `etapa` — para el mes `i`, la ventana retrocede como máximo hasta el inicio de la etapa actual (o 12 meses, lo que sea menor). Esto elimina el falso positivo del cambio de etapa, y sigue detectando anomalías reales dentro de la misma etapa (IRPF, dobles pagos).

**Efecto secundario identificado y resuelto:** el primer mes de una etapa nueva siempre tiene desvío 0% contra sí mismo (es su propio promedio) — si ese mes además tiene una devolución IRPF (como junio 2026, primer mes de Luzutania), el criterio estadístico por sí solo nunca lo iba a marcar como atípico, ni ahora ni en sync futuros (el promedio de ese mes específico no se recalcula retroactivamente cuando se agregan meses posteriores a la misma etapa).

**Fix:** los meses con `irpf:true` se incluyen siempre en el panel de outliers, independientemente del umbral de 15% — se detectan con certeza vía la Nota "IRPF" en Movimientos, no hace falta inferirlos por desvío estadístico. Cuando el desvío es ~0 (coincide con el inicio de etapa), no se muestra el "+X%" para no mostrar un dato engañoso.

**Cambio implementado (`js/charts.js`):**
- `movingAvg`: ventana retrocede solo dentro de la misma etapa (`etapas[start-1] === etapas[i]`), máximo 12 meses.
- Dataset renombrado a "Promedio móvil (por etapa)"; tooltip actualizado.
- Panel de outliers: condición `irpfFlags[i] || delta > 0.15` en vez de solo el umbral; oculta el porcentaje cuando es ~0.

**Estado:** Hecho.

---

## [2026-07-14] Corrección: gráfico de nómina vuelve a un corte (enero 2025), Ford/Valeo pasan a ser referencia textual (auditoria 2026-07, orden 9)

**Contexto:** el histórico completo 2022-2026 implementado antes no convenció al usuario. Solución intermedia: cortar en enero 2025 (paro real ene-feb, marzo combinado paro+primer Between, resto 100% real desde fuentes vivas) y sacar del gráfico los tramos 100% estimados de memoria (Ford, mudanza, Valeo, paro sin cobrar sep-nov 2024).

**Cambio implementado:**
- `scripts/sync_finance_data.py`: `NOMINA_INICIO = "2025-01"` (filtro aplicado al final de `build_nominas()`). `HISTORICO_MANUAL` queda reducido a un solo override (2025-03, paro+primer Between combinado). Se eliminan los overrides de Ford/mudanza/Valeo/paro-sin-cobrar (ya no se grafican). `etapa_for_month()` simplificado: solo distingue "Paro" (2024-09 a 2025-02) vs. empresa real -- las etapas Ford/Mudanza/Valeo ya no aplican con este corte pero la función las soporta si se decide extender el rango en el futuro.
- Nuevas constantes de referencia (no graficadas): `FORD_PROMEDIO_MENSUAL = 1115.47`, `VALEO_PROMEDIO_MENSUAL = round(1680.56 * 14 / 12, 2) = 1960.65` -- corregido para reflejar las 14 pagas anuales de Valeo (el promedio mensual equivalente no es la paga normal sola, sino paga_normal × 14 ÷ 12).
- `index.html`: nota de texto fija debajo de la card de nómina: "Referencia histórica (no incluida en el gráfico): Ford Argentina ~1.115€/mes promedio (ene–oct 2022) · Valeo España ~1.961€/mes promedio equivalente (14 pagas/año, ene 2023–ago 2024)".
- `js/charts.js`: la leyenda "Estimado (de memoria)" ahora solo se muestra si hay al menos un mes con `estimado:true` en los datos (con este corte no hay ninguno, así que no aparece).

**Estado:** Hecho.

---

## [2026-07-14] Implementado: histórico completo de nómina 2022-2026 con etapas y sombreado (auditoria 2026-07, orden 9)

**Contexto:** tras validar en el chat (widgets de preview con datos hardcodeados) el histórico completo de ingresos desde enero 2022, el usuario confirmó llevarlo a producción, reemplazando el corte anterior que arrancaba en abril 2025.

**Fuentes combinadas por prioridad:**
1. DB Notion "Nominas" (real) donde tiene cobertura: Valeo feb/abr/may/jun/jul/ago 2024, todo desde abril 2025.
2. Movimientos (real, fallback) para meses sin cobertura en la DB Nominas: paro dic 2024–feb 2025, filtrando por Concepto conteniendo "NOMINA" o "DESEMPLEO" — **no alcanza con `categoria == "Nomina"` sola**, porque diciembre 2024 tiene varios movimientos ajenos mal categorizados como Nomina (transferencias, pago de tarjeta de crédito, venta de fondos) que inflaban el mes a 5.399,33€ en vez de 1.101,40€. Bug detectado y corregido el mismo día antes de publicar.
3. `HISTORICO_MANUAL` (valores hardcodeados, confirmados explícitamente por el usuario) para los meses sin ninguna fuente real: Ford Argentina ene-oct 2022 (flat, promedio de las 10 conversiones blue→EUR = 1.115,47€), mudanza nov-dic 2022 (0, real), Valeo ene 2023-ene 2024 y marzo 2024 (flat, promedio de los meses reales conocidos = 1.680,56€, estimado), paro sin cobrar sep-nov 2024 (0, real — el primer pago de paro fue recién el 2024-12-10), marzo 2025 (1.016,94€ = último pago de paro 477,14€ + primer pago parcial de Between Technology 539,80€, reemplaza el parcial que traía la DB Nominas).

**Nuevo campo `etapa`** (función `etapa_for_month()`): banda de vida calculada por rango de fechas fijo + empresa real fuera de esos rangos — Ford Argentina S.C.A. / Mudanza / Valeo España, S.A.U. / Paro / empresa real (Between Technology S.L, Luzutania Group SLU, etc.).

**Nuevo campo `estimado`** (booleano): `true` solo para los tramos de memoria sin recibo verificable (Ford, Valeo ene23-ene24 y mar24). Los tramos en 0 (mudanza, paro sin cobrar) son `estimado:false` porque son hechos reales confirmados, no una suposición de monto.

**Frontend (`js/charts.js`):**
- Sombreado de fondo (`nominaBandsPlugin`) agrupado por `etapa` en vez de por empresa, con un color por etapa.
- Puntos: círculo relleno = real: círculo hueco (borde de color, relleno blanco) = estimado; rombo grande = incluye devolución IRPF (sin cambios).
- Nueva leyenda `#nomina-etapas-legend` dentro de la card, mostrando qué significa cada color de sombreado + el marcador de "estimado".
- Nota de períodos (`#nomina-empresa-note`) ahora agrupa por etapa en vez de por empresa.

**Limitación aceptada:** los tramos estimados son de memoria del usuario, no verificables contra recibos; si en el futuro se cargan los recibos reales de esa época a la DB Nominas, los valores estimados quedarían desactualizados y habría que quitar el override correspondiente de `HISTORICO_MANUAL`.

**Estado:** Hecho.

---

## [2026-07-14] Implementado: layout de dos columnas en gráfico de nómina + panel de meses atípicos (auditoria 2026-07, orden 9)

**Contexto:** el usuario pidió que el gráfico de nómina no use el 100% del ancho del card, sino que deje espacio para un panel con explicación de los meses que están muy por encima del promedio (dio como ejemplo junio y julio). Umbral acordado: más de 15% por encima del promedio móvil 12m.

**Cambio implementado:**
- `index.html`: la card de nómina pasa a un layout flex de dos columnas — `chart-wrap` (flex 7, min 480px) a la izquierda, panel `#nomina-outliers` (flex 2, min 170px/max 260px) a la derecha. Se apila en una columna en pantallas angostas por el `flex-wrap`.
- `js/charts.js`: `renderNominaTrend()` agrega `maintainAspectRatio: false` (el canvas ahora sí llena el 100% de su columna en vez de quedar limitado por el aspect ratio por defecto de Chart.js). Nueva lógica: para cada mes con `monto > promedio móvil 12m × 1.15`, se lista en el panel lateral con el % de exceso y un motivo — "incluye devolución de Hacienda (IRPF)" si el mes tiene `irpf:true`, o "pago adicional (revisar Nota en Notion)" como motivo genérico si no hay explicación automática disponible.

**Limitación aceptada:** el motivo genérico no distingue automáticamente entre bono, finiquito, pago doble u otro ajuste — solo el caso IRPF está identificado con certeza. Si se quiere detalle mayor a futuro, haría falta un criterio de Nota adicional en Movimientos (similar al de IRPF) para otros tipos de pago extra.

**Estado:** Hecho.

---

## [2026-07-14] Implementado: devoluciones de Hacienda (IRPF) en el gráfico de nómina (auditoria 2026-07, orden 9)

**Contexto:** el usuario pidió incluir en el gráfico de nómina las devoluciones anuales de Hacienda (IRPF), que hoy están cargadas en Movimientos bajo la categoría "Nomina" mezcladas con el sueldo, sin ninguna marca que las distinga.

**Criterio de identificación acordado:** marcar manualmente el campo Nota del movimiento con el texto exacto "IRPF" (una vez al año, cuando se cobra la devolución). El script las detecta buscando `categoria == "Nomina"` y `nota == "IRPF"` (case-insensitive) en Movimientos.

**Movimientos identificados y marcados (2026-07-14):**
- 2025-04-10, "DEVOLUCION HACIENDA", 173,57€ → Nota = "IRPF"
- 2026-06-06, "TRANSF. A SU FAVOR", 619,54€ → Nota = "IRPF" (confirmado por el usuario como la devolución de ese año)

No se encontraron devoluciones anteriores a 2025 porque Movimientos solo tiene datos desde 2024-12-01.

**Cambio implementado:**
- `scripts/sync_finance_data.py`: `build_nominas()` ahora recibe también `movimientos` (ya se leen en `main()` para Movimientos). Cruza los movimientos con Nota="IRPF" y categoría Nomina, y suma el monto al mes correspondiente en la serie de nómina. Cada mes queda marcado con `irpf: true/false` en el output.
- `js/charts.js`: puntos del mes con IRPF se dibujan más grandes y con forma de rombo (`rectRot`) en vez de círculo; tooltip agrega "(incluye devolución IRPF)"; nueva leyenda de texto fija `#nomina-irpf-note` con la lista de meses que incluyen devolución.
- `index.html`: nuevo contenedor `#nomina-irpf-note` debajo de la nota de períodos por empresa.

**Decisión sobre el tratamiento:** se suma al mes de cobro (no se muestra aparte ni se excluye del promedio móvil 12m), tal como pidió el usuario — sí afecta la tendencia, con la aclaración visual como contexto.

**Estado:** Hecho.

---

## [2026-07-14] Corrección: gráfico de nómina arranca en abril 2025, se descarta el histórico Ford (auditoria 2026-07, orden 9)

**Contexto:** tras ver el gráfico con el histórico completo (Ford Argentina 2022 convertido + huecos de 15 y 6 meses entre etapas), el usuario decidió que no tenía sentido mostrar un histórico con tanta falta de datos y una conversión de moneda de por medio.

**Decisión del usuario:** el gráfico arranca en abril 2025 (primer mes con datos limpios y continuos, ya con Between Technology) y se va poblando hacia adelante con cada sync. Se descarta por completo la conversión de Ford Argentina (dólar blue → EUR) — no se muestra en el dashboard.

**Cambio implementado:**
- `scripts/sync_finance_data.py`: se eliminó `FORD_HISTORICO_EUR` y toda la conversión asociada. Nueva constante `NOMINA_INICIO = "2025-04"`; `build_nominas()` descarta meses anteriores a ese corte y sigue excluyendo las filas de Ford Argentina de la DB Nominas (quedan fuera de alcance, no se reemplazan por nada).
- `js/charts.js`: `renderNominaTrend()` sin referencias a "estimado"/conversión aproximada — ya no aplica.
- La sección "Implementado" del 2026-07-14 más abajo (con la conversión Ford) queda parcialmente obsoleta: la lógica de combinación DB Nominas + Movimientos y el resto del diseño del gráfico se mantienen, pero el tramo Ford descrito ahí ya no existe en el código.

**Estado:** Hecho.

---

## [2026-07-14] Implementado: evolución de ingresos (nómina YoY) combinando DB Nominas + Movimientos (auditoria 2026-07, orden 9)

**Contexto:** el orden 9 de la auditoría pedía un indicador de tendencia de ingresos (variación interanual, promedio móvil 12m) sobre la categoría "Nomina" de Movimientos. El usuario señaló que existe una DB Notion separada "Nominas" (`19833ce5-0e68-8121-8f95-000bddffaaea`, 39 registros) con detalle de Empresa y archivo del recibo por cada pago, y pidió combinarla con Movimientos para dar más contexto (empresa, períodos sin nómina) al gráfico.

**Hallazgo:** la DB Nominas mezcla dos eras incompatibles: 13 registros de Ford Argentina S.C.A. (2022, en pesos argentinos, ~178k-323k ARS/pago) y 26 registros desde 2024-02 en adelante (ya en euros, empresas Valeo España → Between Technology → Luzutania Group, con un hueco real de 7 meses entre Valeo y Between por cambio de empleo).

**Decisión del usuario:**
1. Incluir el último año de Ford (ene-oct 2022) convertido a euros.
2. Conversión en dos pasos: ARS → USD con el dólar **blue** del día exacto de cada pago (no el oficial, por la brecha cambiaria de esa época), luego USD → EUR con la cotización del mismo día.
3. No hace falta aclaración visual especial para el tramo Ford — alcanza con que el nombre de la empresa quede identificado en el gráfico/tooltip.
4. Empresa nueva (cambio de trabajo) se considera comparable para el cálculo de YoY — no se corta la serie histórica en cada cambio de empresa.
5. Gráfico en el tab Resumen.

**Fuentes de conversión usadas (2026-07-14):**
- Dólar blue histórico diario: `api.argentinadatos.com/v1/cotizaciones/dolares/blue/{yyyy}/{mm}/{dd}` (venta).
- EUR/USD histórico diario: Yahoo Finance `EURUSD=X` (mismo patrón que el benchmark IWDA.AS del tab Inversiones).
- Los 12 pagos de Ford (2022-01 a 2022-10, agregados por mes calendario — marzo y octubre tuvieron 2 pagos cada uno) se convirtieron una única vez y quedaron hardcodeados como `FORD_HISTORICO_EUR` en `scripts/sync_finance_data.py` — son datos históricos fijos, no se recalculan en cada sync. Total convertido: ~11.155€ en los 10 meses.

**Cambio implementado:**
- `scripts/sync_finance_data.py`: nueva función `fetch_nominas_notion()` (mismo patrón REST que Movimientos/Rendimiento) + `build_nominas()`, que agrega la DB Nominas por mes calendario (suma de Total, última Empresa vista en el mes), normaliza variantes de nombre de empresa (mayúsculas/tipeo: "VALEO ESPAÑA..." vs "Valeo España...", "LUZUTANIAESP..." vs "LUZUTANIAES..."), excluye las filas de Ford (pesos) y las reemplaza por `FORD_HISTORICO_EUR`. Nuevo campo `nominas` en `finance_data.json`: `[{mes, empresa, monto, estimado}]`.
- ID de la data source Nominas hardcodeado con fallback (`NOTION_NOMINAS_DATA_SOURCE_ID` opcional) en vez de agregar un secret nuevo de GitHub Actions — no es información sensible, es solo el identificador de la data source.
- `js/state.js`: `FINANCE_STATE.nominas` (default `[]`).
- `js/app.js`: carga `rawData.nominas` en `init()`; `renderResumen()` llama a `renderNominaTrend()`.
- `js/charts.js`: nueva función `renderNominaTrend()`. Construye un eje mensual continuo (sin huecos) entre el primer y último mes con datos; los meses sin registro se tratan como ingreso real 0 (período sin nómina, ej. cambio de empleo), no como hueco de datos a excluir — se incluyen en el promedio móvil 12m según el criterio ya definido en la ficha de la auditoría. Line chart: ingreso mensual (puntos coloreados por empresa, gris para meses sin nómina) + promedio móvil 12m (línea punteada). Debajo del gráfico, nota de texto autogenerada con los períodos por empresa. Encima, label con el último mes y su variación interanual (o "N/D" si hace 12 meses no hubo nómina).
- `index.html`: nueva card "Evolución de ingresos (nómina) · interanual" en el tab Resumen, con `#chart-nomina`, `#nomina-yoy-label` y `#nomina-empresa-note`.

**Limitación aceptada:** la conversión de Ford usa el dólar blue como aproximación de poder adquisitivo real; no es una cifra oficial ni auditable con precisión centavo a centavo, y el usuario lo confirmó explícitamente como aceptable para este uso (contexto de tendencia, no contabilidad formal).

**Estado:** Hecho. Marcar orden 9 de la DB "Auditoría 2026-07 — Mejoras sugeridas" como Estado=Hecho.

---

## [2026-07-14] Implementado: separar aportes brutos de retiros en la categoría Inversion (auditoria 2026-07, fila 7)

**Contexto:** la categoría Inversion mezclaba depósitos y retiros (liquidación parcial de Peerberry), con un neto positivo (+398€) que no sirve como medida de aporte real al mes.

**Decisión del usuario (confirmada explícitamente antes de implementar):** distinguir depósitos de retiros por el signo del Monto (opción automática, sin marcar Nota en Notion): monto negativo = aporte, monto positivo = retiro.

**Cambio implementado:**
- `js/app.js`: nueva función `renderInvAportesRetiros()`, llamada al inicio de `renderInversiones()`. Filtra `FINANCE_STATE.raw` por `categoria === 'Inversion'` y separa aportes (suma de `abs(monto)` donde `monto < 0`) de retiros (suma de `monto` donde `monto > 0`), mostrando ambos para el mes actual y los últimos 12 meses. El neto nunca se muestra como "ahorro".
- `index.html`: nueva card "Aportes y retiros (categoría Inversion)" en el tab Inversiones, entre "Capital invertido por plataforma" y "Rentabilidad mensual por plataforma", con contenedor `#inv-aportes-retiros`.

**Estado:** Hecho. Marcar fila 7 de la DB "Auditoría 2026-07 — Mejoras sugeridas" como Estado=Hecho.

---

## [2026-07-14] Implementado: KPI de coste anualizado de suscripciones y ahorro por cancelaciones (auditoria 2026-07, fila 5)

**Contexto:** la seccion de suscripciones (`#subs-card`) mostraba el total mensual de suscripciones activas pero no el coste anualizado ni el ahorro conseguido por las cancelaciones de julio 2026, cifra que motivo esas cancelaciones en un analisis manual previo.

**Decision:** en `js/insights.js`, `renderSuscripciones()` calcula `totalAnualSubs = totalSubsAct * 12` (todas las suscripciones activas ya son de cadencia mensual por construccion de `detectRecurring()`, gap 25-35 dias) y lo muestra junto al total mensual existente. Se agrega la constante `CANCELLED_SUBS` con el importe del ultimo cargo mensual real (verificado en `finance_data.json`, no de lista de precios) de las tres suscripciones canceladas: Microsoft 365 Personal (10,00€, ultimo cargo normal 03/06/2026 — el cargo de 32,94€ del 12/06 fue un error de Relay ya documentado), Kindle Unlimited (9,99€, ultimo cargo 22/06/2026) y Wellhub (22,99€, concepto "Wellhub Matias Or", ultimo cargo 04/06/2026 — cancelacion confirmada por el usuario para junio 2026, corrigiendo la fecha de julio 2026 que figuraba en la fila de auditoria). Ahorro anual conseguido = suma de esos tres importes × 12 = 515,76€/año.

**Estado:** Hecho. Marcar fila 5 de la DB "Auditoría 2026-07 — Mejoras sugeridas" como Estado=Hecho.

---

## [2026-07-13] Implementado: monitoreo de huecos en la carga automática de Relay (auditoria 2026-07, fila 2)

**Contexto:** Relay carga Movimientos y Rendimiento Inversiones en Notion automaticamente, pero un fallo silencioso (lunes sin fila Semanal de Peerberry, mes sin Mensual de MyInvestor, o Movimientos sin altas nuevas) pasaba desapercibido hasta que alguien miraba el dashboard.

**Decision:** agregar `check_relay_gaps()` en `sync_finance_data.py` con tres guards (E, F, G): Peerberry Semanal con "Fecha reporte" de los ultimos 10 dias; si el dia del mes es >=10, MyInvestor Mensual del mes calendario anterior; movimiento mas reciente en Movimientos con menos de N=5 dias (confirmado por el usuario 2026-07-13). Cualquier guard que falle levanta `RuntimeError` con prefijo "HUECO RELAY:", saliendo con codigo de error para que el workflow `sync-finance-data.yml` falle y dispare la alerta existente (guard de sanidad, auditoria fila 2 previa). El chequeo se omite si la lectura de Rendimiento Inversiones fallo por otro motivo (fallo de sync propiamente dicho, ya reportado como AVISO), para no confundir ambos casos.

**Estado:** Hecho.

---

## [2026-07-13] Implementado: verificación de ediciones manuales antes de Organizar Movimientos (auditoria 2026-07, fila 1)

**Contexto:** el flujo "Organizar Movimientos" opera sobre `finance_data.json`, que puede estar desactualizado si hubo correcciones manuales en Notion después del último sync diario (07:00).

**Decision:** agregar la columna nativa `Last edited time` a la DB Notion Movimientos y comparar su MAX contra el `generated_at` de `finance_data.json` como paso 2 del flujo. Si Notion tiene ediciones más recientes, disparar `sync-finance-data` (workflow 286832931) y esperar a que termine antes de continuar. No se requiere ningun valor de configuracion adicional: `Last edited time` es una propiedad nativa de Notion, se calcula sola.

**Estado:** Hecho. Columna agregada vía `notion-update-data-source`. Flujo actualizado en `docs/PROJECT_MEMORY.md`, sección "Flujo Organizar Movimientos".

---

## [2026-07-10] Implementado: benchmark MSCI World en tab Inversiones (auditoria fila 8)

**Contexto:** la auditoria del 09/07/2026 (fila 8) senalaba que el TWR de la cartera no tenia referencia de mercado para saber si el rendimiento es bueno o malo.

**Decision del usuario (confirmada explicitamente antes de implementar):**
- Fuente automatica (no carga manual en Notion) via fetch directo a la API publica de Yahoo Finance, sin libreria nueva (`requests`, ya usado en el script).
- Benchmark: iShares Core MSCI World UCITS ETF, ticker `IWDA.AS` (Euronext Amsterdam, cotiza en EUR — coherente con que las inversiones son en euros). Verificado que la API devuelve precios reales antes de implementar.
- Base de comparacion fija en enero 2025 (no se mueve con filtros de fecha del dashboard).
- Grafico nuevo y separado (no se mezcla con el grafico de rentabilidad mensual por plataforma ni con el de acumulado por año), posicionado entre ambos en el tab Inversiones.

**Cambio implementado:**
- `scripts/sync_finance_data.py`: nueva funcion `fetch_benchmark_monthly()` — pide a `query1.finance.yahoo.com/v8/finance/chart/IWDA.AS` el cierre ajustado mensual desde diciembre 2024 (mes base). Si el fetch falla, devuelve `{}` sin abortar el resto del sync (Yahoo no tiene API oficial documentada, puede cambiar sin aviso).
- `build_rendimiento_mensual()`: nueva firma `(by_month, benchmark_prices=None)`. Agrega `benchmark` (% mensual del ETF) y `benchmark_acumulado` (TWR compuesto encadenado desde enero 2025, base independiente del `acumulado` de la cartera) a cada entrada de `rendimiento_mensual`.
- Bloque `__main__`: llama `fetch_benchmark_monthly()` y lo pasa a `build_rendimiento_mensual()`.
- `index.html`: nueva card "Acumulado vs Benchmark (MSCI World, desde ene-2025)" con `<canvas id="chart-inv-benchmark">`, entre la card de rentabilidad mensual y la de acumulado por año.
- `js/app.js`: nueva funcion `renderInvBenchmark()` — grafico de lineas, "Cartera" (`acumulado`) vs "MSCI World (IWDA.AS, EUR)" (`benchmark_acumulado`), llamada entre `renderInvRendimiento()` y `renderInvAcumuladoAnual()`.

**Riesgo aceptado:** dependencia de un endpoint no documentado de Yahoo Finance. Si deja de responder o cambia de formato, el benchmark queda en `None` (el resto del dashboard sigue funcionando) hasta que se detecte y corrija.

**Pendiente de validacion:** correr `sync-finance-data.yml` manualmente contra produccion y confirmar visualmente el grafico antes de darlo por cerrado en `ROADMAP.md`.

---

## [2026-07-10] Implementado: migración capital/rendimiento Inversiones de Sheets a Notion (auditoria fila 4)

**Contexto:** continuación de la entrada "Plan: migrar capital/rendimiento..." de hoy mismo, tras validar los números.

**Cambio implementado:**
- `scripts/sync_finance_data.py`: `build_inversiones()` reescrita, ahora recibe `by_month` (agregado de la DB Notion "Rendimiento Inversiones") en vez de `rows` (filas del Sheet). Eliminados `get_service()`, `read_range()`, `SHEET_ID`, `FINANZAS_SHEET`, `SA_JSON`/`GOOGLE_SERVICE_ACCOUNT`, imports `google.oauth2`/`googleapiclient`, y las funciones `parse_amount`/`parse_pct`/`parse_mes_label`/`parse_date` (solo usadas para parsear el Sheet). El bloque `__main__` ahora hace una sola lectura a Notion Rendimiento Inversiones que alimenta `capital`, `rendimiento`, `ganancia`, `kpi` y `rendimiento_mensual`.
- `sanity_check()`: nuevo Guard D — aborta si el JSON anterior tenia `inversiones.capital` con datos y el nuevo viene vacio. Necesario porque capital y ganancia ahora comparten la misma fuente/lectura; antes un fallo de Sheets no afectaba a `ganancia` (Notion) y viceversa.
- `.github/workflows/sync-finance-data.yml`: quitados `GOOGLE_SERVICE_ACCOUNT`/`SHEET_ID` del step de env vars y la instalacion de `google-auth google-auth-httplib2 google-api-python-client` (queda solo `requests`).

**Validacion realizada antes de desplegar:**
1. Replique la logica de agregacion (`_aggregate_rendimiento_by_month`) en un script standalone contra las 43 filas reales de la DB Notion (fetch via MCP), comparando capital y rendimiento mes a mes contra el `finance_data.json` de produccion (fuente Sheets, generado 10/07/2026 10:29). Capital: coincide dentro de pocos euros en todos los meses desde dic-2024 (diferencia esperada por fecha de carga distinta). Rendimiento %: difiere sustancialmente en varios meses porque la columna del Sheet mezclaba depositos con rentabilidad real (confirmado, no es un bug de calculo) — ej. jun-2026 Peerberry 126.42% (Sheet) vs 0.31% (formula correcta).
2. Cargue el modulo real `sync_finance_data.py` con datos de prueba (mismas 43 filas simuladas como paginas de Notion) y confirme que `build_inversiones()` produce el mismo resultado que la replica manual (una sola diferencia esperada: `0` vs `None` para un mes sin dato de MyInvestor, comportamiento correcto y consistente con la convencion previa).
3. Con el codigo ya commiteado, dispare `sync-finance-data.yml` manualmente (`gh workflow run` via API) contra produccion real: exito, 2530 movimientos, 20 meses de capital (dic-2024 a jul-2026), 19 meses de rendimiento, KPI generado correctamente (pct_12m 20.35%, capital_actual 20.566,99€). `deploy-pages.yml` se disparo automaticamente y publico el dashboard actualizado.

**Decisiones del usuario (confirmadas explicitamente antes de implementar):**
- Historial de capital: se acepta el corte en diciembre 2024 (el Sheet tenia desde marzo 2024, 9 meses menos de historial en el grafico de Capital). Sin backfill adicional a Notion.
- Rendimiento %: se usa el valor correcto (formula ganancia/saldo medio) en vez de mantener el valor historico del Sheet, aunque cambie visualmente todo el grafico historico.

**Pendiente de accion manual del usuario:** borrar el secret `GOOGLE_SERVICE_ACCOUNT_JSON` del repo (Settings → Secrets) — confirmado que ya no lo usa ningun workflow, pero es una accion de configuracion de seguridad que no se realiza automaticamente.

**Impacto:** el tab Inversiones ya no depende de Google Sheets ni de ningun secret de Google. Rendimiento % del grafico historico cambia de valor respecto a lo publicado antes del 10/07/2026 (era incorrecto). Capital: sin cambios de fondo salvo el recorte de 9 meses al inicio del historial.

---

## [2026-07-10] Plan: migrar capital/rendimiento del tab Inversiones de Sheets a Notion (auditoria fila 4)

**Contexto:** la auditoria del 09/07/2026 (fila 4 de la DB Notion "Auditoria 2026-07 — Mejoras sugeridas") senalaba que `build_inversiones()` en scripts/sync_finance_data.py sigue leyendo capital y rendimiento (%) del tab Inversiones desde la hoja Google Sheets "Inversiones", con parseo fragil (deteccion de cabecera por texto). Verificado contra el codigo real del repo (10/07/2026, no solo la documentacion): confirmado, `build_inversiones(fin_rows)` efectivamente lee `read_range(service, FINANZAS_SHEET)` via Google Sheets API y es la unica fuente de `inversiones.capital` e `inversiones.rendimiento`, que alimentan los 2 graficos y 4 KPIs del tab Inversiones. Esto es independiente de `inversiones.ganancia`/`kpi`/`rendimiento_mensual`, que ya vienen de la DB Notion "Rendimiento Inversiones" desde el 2026-07-06/08 y alimentan otro KPI (Resumen), no el tab Inversiones.

**Hallazgo clave que simplifica la migracion:** `by_month` (ya construido desde Notion en `_aggregate_rendimiento_by_month()`) ya contiene el capital de cierre por plataforma y mes (`by_month[mes]["peerberry"]["capital"]`, `["myinvestor"]["capital"]`), y `build_rendimiento_mensual()` ya calcula el % mensual por plataforma con la metodologia correcta (ganancia del mes / saldo medio, promedio entre capital de cierre del mes anterior y el actual). No hace falta ningun fetch nuevo a Notion: los datos que necesita el tab Inversiones ya estan disponibles en memoria durante la ejecucion del sync.

**Plan:**
1. Nueva funcion (ej. `build_inversiones_from_notion(by_month)`) que derive:
   - `capital`: lista `{mes, peerberry, myinvestor}` a partir de `by_month[mes][plataforma]["capital"]` (0 si no hay dato), omitiendo meses sin ningun capital — mismo formato que el actual basado en Sheets.
   - `rendimiento`: lista `{mes, peerberry, myinvestor}` en %, reusando la misma logica de promedio de capital de `build_rendimiento_mensual()` (evaluar extraer esa logica a un helper compartido en vez de duplicarla).
2. Generar `finance_data.json` en local con la funcion nueva y comparar campo a campo (capital y rendimiento, mes a mes, ambas plataformas) contra el `finance_data.json` actual (fuente Sheets) antes de tocar produccion. Investigar y documentar cualquier discrepancia — los origenes de capital son distintos (Sheets = carga manual mensual; Notion = capital reportado en cada envio semanal/mensual de Peerberry/MyInvestor) y podrian no coincidir exactamente en meses con varios reportes.
3. Solo tras validar: reemplazar la llamada a `build_inversiones(fin_rows)` por la nueva funcion, eliminar `get_service()`, `read_range()`, `SHEET_ID`, `FINANZAS_SHEET`, `GOOGLE_SERVICE_ACCOUNT`/`SA_JSON` y el import de `google.oauth2`/`googleapiclient` del script.
4. Actualizar `.github/workflows/sync-finance-data.yml`: quitar el env var `GOOGLE_SERVICE_ACCOUNT`/`SHEET_ID` y la instalacion de `google-auth google-auth-httplib2 google-api-python-client`. Evaluar borrar el secret `GOOGLE_SERVICE_ACCOUNT_JSON` del repo tras confirmar que ningun otro workflow lo usa.
5. Actualizar `docs/PROJECT_MEMORY.md` (secciones "Tab Inversiones — especificacion actual" y "Migracion Inversiones: Sheets → Notion") y `docs/ROADMAP.md` si aplica.

**Riesgo aceptado:** ninguno de codigo hasta pasar el paso 2 (validacion). Riesgo de datos: capital via Sheets es una foto manual mensual (un solo numero por mes, cargado a mano); capital via Notion es el ultimo reporte disponible en ese mes (puede variar segun cuando llego el ultimo correo de esa plataforma ese mes). Los valores podrian no ser identicos a los que ya se ven en el dashboard historico — se documentara el criterio final en la entrada que registre la implementacion.

---

## [2026-07-10] Sincronizar docs/ con la realidad del sistema (auditoria fila 3)

**Contexto:** la auditoria del 09/07/2026 (fila 3 de la DB Notion "Auditoria 2026-07 — Mejoras sugeridas") detecto contradicciones adicionales entre PROJECT_MEMORY.md/ROADMAP.md y el estado real del sistema:
1. Seccion "Escritura de notas en columna K" seguia describiendo el flujo por `update-sheet-cells.yml`, eliminado el 30/06/2026; el flujo real (escritura directa en Notion via `notion-update-page`) ya estaba documentado aparte en "Flujo Organizar Movimientos".
2. ROADMAP.md tenia una tarea de Alta prioridad ("Panel de revision de transacciones") que dependia explicitamente del mismo workflow eliminado.
3. "Estado actual del sistema" listaba "Tab Inversiones" como fase futura cuando ya esta implementado desde julio 2026, y listaba como pendientes dos items (insights automaticos, deteccion de anomalias) que ya estaban hechos (js/insights.js, 2026-07-03).
4. La especificacion del tab Inversiones afirmaba "Peerberry = 0 desde diciembre 2025 (liquidada)". Verificado contra la DB Notion "Rendimiento Inversiones": Peerberry esta activa, con capital de 11.720,08 EUR reportado el 05/07/2026 y reportes semanales continuos.

(El punto de pipeline Relay/Sheets de esta misma fila ya habia sido corregido el 09/07/2026, ver entrada de esa fecha mas abajo — no requirio cambios adicionales.)

**Cambio:**
- `docs/PROJECT_MEMORY.md`: seccion "Escritura de notas en columna K" reemplazada por un puntero corto a "Flujo Organizar Movimientos"; "Estado actual del sistema" actualizado (Inversiones ya no es fase futura, insights/anomalias marcados como hechos); linea de Peerberry corregida con la cifra verificada.
- `docs/ROADMAP.md`: la tarea "Panel de revision de transacciones" ya no referencia `update-sheet-cells.yml` como mecanismo; se marca que el mecanismo de escritura debe replantearse (no hay endpoint HTTP directo del navegador a Notion) y se remite a evaluarlo en DECISIONS.md antes de implementar.

**Verificacion:** cifra de capital Peerberry confirmada por query SQL directa a la DB Notion "Rendimiento Inversiones" (data source 93eda06b-9207-4589-b3f0-66be10ab9caf) antes de escribir la correccion.

**Impacto:** solo documentacion, sin cambios de codigo ni datos. Hallazgo registrado en la DB Notion "Auditoria 2026-07 — Mejoras sugeridas" (fila 3, marcada Hecho tras este cambio).

---

## [2026-07-09] Guard de sanidad en sync_finance_data.py y alerta de fallo del workflow

**Contexto:** la auditoria del 09/07/2026 (fila 2 de la DB Notion "Auditoria 2026-07 — Mejoras sugeridas") detecto dos riesgos silenciosos: (1) si Notion devolvia un resultado vacio o parcial, el script escribia igualmente finance_data.json y el dashboard quedaba en blanco o degradado; el fallo de Rendimiento Inversiones incluso se tragaba con un AVISO y seguia; (2) un fallo del cron diario de las 07:00 no notificaba a nadie.

**Cambio:**
- `scripts/sync_finance_data.py`: nueva funcion `sanity_check(movimientos, inversiones)` llamada antes de escribir el JSON. Aborta (exit != 0) si: (A) 0 movimientos; (B) el conteo de movimientos cae mas de 10% respecto al finance_data.json anterior; (C) el JSON anterior tenia `inversiones.ganancia` con datos y el nuevo viene vacio. Al abortar no se comitea nada y el dashboard conserva el ultimo JSON bueno.
- `.github/workflows/sync-finance-data.yml`: permiso `issues: write` y paso final `Alert on failure` (`if: failure()`) que crea una issue en el repo con el link al run fallido.

**Trade-off:** el umbral del 10% es arbitrario pero conservador (los movimientos historicos solo crecen); un borrado masivo intencional en Notion requerira borrar tambien finance_data.json local en el runner o ajustar el umbral puntualmente.

**Impacto:** un sync roto ahora falla ruidosamente (issue automatica) en vez de publicar datos vacios.

---

## [2026-07-09] Correccion documental: Relay.app sigue activo (no fue dado de baja)

**Contexto:** una auditoria del flujo (09/07/2026) detecto que PROJECT_MEMORY.md afirmaba en varias secciones que "Relay.app fue dado de baja", y el diagrama "Pipeline de datos" aun describia Relay→Google Sheets con una GitHub Action de verificacion que ya no existe. Matias confirmo la realidad: Relay sigue activo, escribe Movimientos en la DB Notion y puebla Rendimiento Inversiones automaticamente desde los correos de Peerberry y MyInvestor. Sheets si quedo obsoleto como destino. El prompt de categorizacion vive unicamente en la DB Notion "Prompts para Relay".

**Cambio:** corregidas en PROJECT_MEMORY.md: paso 7 del plan de migracion, seccion "Lo que desaparece al completar la migracion", diagrama "Pipeline de datos" (ahora Relay→Notion→sync diario→dashboard, con la excepcion vigente de la hoja Inversiones de Sheets) y los parrafos de automatizacion pendiente de la migracion de Inversiones (la carga via Relay ya esta operativa).

**Impacto:** solo documentacion, sin cambios de codigo ni datos. Cualquier agente que lea docs/ ya no concluira erroneamente que Relay no existe. Hallazgo registrado en la DB Notion "Auditoria 2026-07 — Mejoras sugeridas" (fila 1).

---

## [2026-07-09] Otros cargos recurrentes: aplicar el mismo corte de 180 dias sin cobro que Suscripciones

**Contexto:** en `js/insights.js`, `RECURRING_HIDE_DAYS` (180 dias) solo se aplicaba a la lista de Suscripciones; la lista "Otros cargos recurrentes" (financiacion, recibos, cuotas) no tenia limite y mostraba cargos inactivos indefinidamente.

**Cambio:** `renderSuscripciones()` ahora filtra `otros` con la misma condicion `diasSinCobro <= RECURRING_HIDE_DAYS` que ya usaba `subs`.

**Impacto:** cargos recurrentes (no suscripcion) sin cobro hace mas de 180 dias dejan de listarse. No se toco el umbral (se evaluo bajarlo a 90 dias pero Matias confirmo mantener 180 para ambas listas).

---

## [2026-07-09] Prompt de categorizacion Relay migrado de Sheets a base de datos Notion

**Contexto:** el prompt de categorizacion que usa Relay para clasificar movimientos vivia en la hoja "prompt relay" del Google Sheet historico (file ID 1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI). Matias creo una base de datos nueva en Notion para unificar todos los prompts de uso frecuente.

**Cambio:** el prompt de categorizacion ahora vive en la base de datos de Notion: https://app.notion.com/p/39833ce50e68801ab5a1fb9d6effa10f

**Impacto:** la hoja "prompt relay" de Sheets deja de ser la fuente activa para reglas de categorizacion. Cualquier consulta sobre reglas de categorizacion debe hacerse contra esta DB de Notion en vez de Sheets. El resto del Google Sheet (Movimientos, Inversiones historico) no se ve afectado, sigue como solo lectura.

---

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



