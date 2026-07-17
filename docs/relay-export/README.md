# Export de Relay — inventario de flujos (2026-07-17)

Exportado por Matías desde Relay (`docs.relay.app/workspace-and-account/export-your-relay.app-data`) antes del cierre de la cuenta (plan gratuito: 15/08/2026 / plan de pago: 14/09/2026). Este documento es la referencia para reconstruir cada flujo en la plataforma de reemplazo (paso 0 del plan de migración en Notion).

El export original del workspace incluía 14 workflows; se descartaron 5 sin relación con el dashboard financiero (Powertrain DB, Poster Open House, Articulos Holy Death, Weekly automotive news digest, Archivar documentos importantes). Quedan los 9 flujos siguientes.

## 1. Pasar extracto bancario a Notion (VIGENTE) — Paso 1 del plan
- **Carpeta:** `pasar-extracto-bancario-a-notion-cm70adnqi059w0pm6bwhedq4t/`
- **Trigger:** archivo nuevo en Drive, carpeta "Extractos para Notion".
- **Procesamiento:** lee el prompt de categorización **en vivo** desde la DB Notion "Prompts para Relay" (busca por `Nombre = "Pasar extracto bancario a Notion"`, campo `Texto`). Pasa el PDF adjunto y el prompt a `relay.gpt-5.4-mini`, que devuelve un JSON con lista de "Movimientos" (Concepto, Monto, Category, Date).
- **Escritura:** crea una página en DB Movimientos (`367d58ce-928b-4e31-832d-07707f876365`) por cada movimiento (Concepto, Monto, Categoria, Fecha).
- **Post-acción:** dispara GitHub Actions "Sync Finance Data" (workflow ID `286832931`) al terminar. **Importante:** cualquier reemplazo debe replicar este dispatch, no solo la escritura en Notion.
- **Credenciales:** Gmail (owner), Notion, GitHub.
- **Nota sobre el prompt:** no hay copia embebida que pueda desactualizarse — se lee de Notion en cada corrida. La DB "Prompts para Relay" ya es la fuente de verdad hoy.

## 2. Peerberry a Notion (VIGENTE) — Paso 2 del plan
- **Carpeta:** `peerberry-a-notion-cmrafzoi3anhr0qkp9vrvcetw/`
- **Trigger:** email de `info@peerberry.com`, asunto contiene "Account summary overview".
- **Procesamiento:** IA (Claude, conexión Anthropic) extrae datos del mail.
- **Escritura:** DB Rendimiento Inversiones (`93eda06b-9207-4589-b3f0-66be10ab9caf`).
- **Última corrida real:** 2026-07-13.
- Reemplaza a `peerberry-cm5psej9u05kx0pkv4kd4hlyg` (legacy, incluido abajo solo como referencia histórica).

## 2b. Peerberry (LEGACY, no vigente)
- **Carpeta:** `peerberry-cm5psej9u05kx0pkv4kd4hlyg/`
- Última corrida real: 2026-07-06. Superada por el flujo anterior. Se conserva solo para comparar lógica si hace falta.

## 3. MyInvestor: Rentabilidad cartera → Notion (VIGENTE) — Paso 3 del plan
- **Carpeta:** `myinvestor-rentabilidad-cartera-notion-cmragm3th0me90oko6nou1qnv/`
- **Trigger:** email de MyInvestor.
- **Escritura:** DB Rendimiento Inversiones.
- **Atención:** solo tiene corridas de **test** (2026-07-07 x2). Nunca corrió en producción todavía — verificar en la plataforma nueva que funciona con un email real antes de dar el paso por validado.
- Reemplaza a `my-investor-a-sheets-cm74uo2vq02550plzbya060vp` (legacy, incluido abajo).

## 3b. My Investor a Sheets (LEGACY, no vigente)
- **Carpeta:** `my-investor-a-sheets-cm74uo2vq02550plzbya060vp/`
- Última corrida real: 2026-07-01. Escribía a Google Sheets (obsoleto). Se conserva solo como referencia.

## 4. Guardar nóminas de Beatriz en Drive + Base de datos de nóminas — Paso 4 del plan
Son dos flujos encadenados:
- **`guardar-nminas-de-beatriz-en-drive-cmpvag7gu00f60okw55nna3cd/`**: trigger = email de `beatriz.matos@luzagroup.com` (RRHH) con adjunto. Filtra solo PDFs y los sube a la carpeta Drive "Nominas".
- **`base-de-datos-de-nominas-cm5y2wz8s09jn0plv5i71gmdw/`**: trigger = archivo nuevo en esa misma carpeta Drive "Nominas". Extrae los datos de la nómina (propia, de Matías) y los escribe en DB Nominas (`19833ce5-0e68-81d5-9230-d35570dc532e`).

## 5. Gastos de Talho Argentino de Drive en Notion — Paso 4.5 del plan (nuevo)
- **Carpeta:** `gastos-de-talho-argentino-de-drive-en-notion-cmqs4cv0x23zy0pm3678rdfqo/`
- **Trigger:** comprobante subido a Drive, carpeta "Gastos Talho Argentino".
- **Procesamiento:** IA (`relay.gemini-3.5-flash`, prompt fijo embebido, no vive en Notion) extrae Concepto, Costo y Fecha del comprobante.
- **Escritura:** crea página en DB "Gastos del local" (`38933ce5-0e68-80ba-9e03-000b001f2431`) — **no** completa el campo "Pagado por".
- **Post-acción:** dispara GitHub Actions "Sync Sociedad Data" (workflow ID `301444283`).

## 6. Actualizar gastos local en GH — Paso 4.5 del plan (nuevo)
- **Carpeta:** `actualizar-gastos-local-en-gh-cmqt7jmtm9cyl0qlx71hh7pqk/`
- **Trigger:** página creada/editada en DB "Gastos del local", cambios en campos Concepto/Costo/Fecha/Pagado por.
- **Acción:** dispara el mismo GitHub Actions "Sync Sociedad Data" (`301444283`).
- Es el mecanismo que cubre los gastos cargados manualmente en Notion (con "Pagado por" incluido), a diferencia del flujo 5 que solo cubre lo subido por Drive.

## Hallazgos para tener en cuenta en la migración
1. El plan original en Notion no cubría los flujos 5 y 6 (Gastos Talho Argentino / Sync Sociedad Data) — se agregó la fila "4.5" al plan el 2026-07-17.
2. El flujo de Movimientos (1) dispara "Sync Finance Data" además de escribir en Notion; cualquier reemplazo tiene que hacer ambas cosas.
3. El flujo de MyInvestor a Notion (3) nunca corrió en producción — validar con un caso real antes de apagar el legacy a Sheets.
4. Modelos de IA usados varían por flujo: Movimientos usa `relay.gpt-5.4-mini`, Talho Argentino usa `relay.gemini-3.5-flash`, Peerberry usa Claude vía Anthropic. Si la plataforma nueva estandariza en un solo modelo, revisar que la calidad de extracción se mantenga en los tres casos.
