This automation sends a weekly account summary from Peerberry to Notion.

**Apps to connect:**
*   Gmail
*   Anthropic (or another AI provider)
*   Notion

**Trigger:**
*   **Gmail - Email Received:** Trigger when an email is received from `info@peerberry.com` with the subject containing "Account summary overview".

**Steps:**

1.  **AI - Prompt Object Easy (Anthropic - Claude Haiku 4.5):**
    *   **Model:** `anthropic.claude-haiku-4-5`
    *   **User Prompt:** "Este correo es el resumen semanal de mi cuenta en Peerberry. Extrae los siguientes valores del cuerpo del mail: - Fecha fin periodo: el mail muestra "Balance on [inicio] - [fin]". Devuelve SOLO la fecha de FIN del periodo, en formato YYYY-MM-DD. - Interest income: el importe de intereses de la semana (número). - Deposit: importe depositado. Si no aparece, usa 0. - Withdrawals: importe retirado. Si no aparece, usa 0. - Invested funds: del bloque Portfolio. - Available balance: del bloque Portfolio. Devuelve solo los números sin símbolos de moneda."
    *   **Output Mode:** `object`
    *   **Input:** The content of the received email from Step 1.
    *   **Output:** Structured data including `Fecha fin periodo` (date), `Interest income` (number), `Deposit` (number), `Withdrawals` (number), `Invested funds` (number), and `Available balance` (number).

2.  **Transform - Calculate:**
    *   **Aportes:** Calculate `Deposit` (from Step 2) minus `Withdrawals` (from Step 2).
    *   **Capital total:** Calculate `Invested funds` (from Step 2) plus `Available balance` (from Step 2).

3.  **Notion - Create Page in Database:**
    *   **Database:** `Finance Tracker · Rendimiento Inversiones` (ID: `93eda06b-9207-4589-b3f0-66be10ab9caf`)
    *   **Fecha:** "Peerberry " followed by the `Fecha fin periodo` from Step 2, formatted as `yyyy-MM-dd`.
    *   **Plataforma:** `Peerberry`
    *   **Periodo:** `Semanal`
    *   **Ganancia:** `Interest income` from Step 2.
    *   **Aportes:** The calculated `Aportes` from Step 3.
    *   **Capital total:** The calculated `Capital total` from Step 3.
    *   **Fecha reporte (Start):** `Fecha fin periodo` from Step 2.
    *   **Fecha reporte (End):** `Fecha fin periodo` from Step 2.