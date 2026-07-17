This automation triggers when an email is received from MyInvestor with a subject related to portfolio profitability, then extracts key financial data from the email using AI, and finally creates a new entry in a Notion database with the extracted information.

**Apps to connect:**

*   Gmail
*   Notion

**Trigger:**

*   **Gmail - New Email:**
    *   **From:** `comunicaciones@myinvestor.es` OR `notificaciones@myinvestor.es`
    *   **Subject:** Contains `Rentabilidad de tu cartera en`
    *   **Only trigger for first email in conversation:** Off

**Steps:**

1.  **AI - Prompt Object:**
    *   **Model:** `relay.gpt-5.4-mini`
    *   **Prompt:**
        "Extrae los datos del informe mensual de rentabilidad de MyInvestor a partir del correo adjunto.

        - Ganancias del mes: importe del bloque 'GANANCIAS ... En [mes]' (la ganancia del mes indicado).
        - Aportaciones del mes: aportaciones netas del mes.
        - Valor de la cartera: valor total actual de la cartera.
        - Fecha reporte: ultimo dia natural del mes al que corresponde el informe (indicado en el asunto o cuerpo), en formato AAAA-MM-DD.
        - Titulo: 'MyInvestor AAAA-MM' usando el ano y mes del informe.

        Los importes son numeros: elimina simbolos de moneda y separadores de miles y usa punto decimal."
    *   **Attachments:** The email from Step 1.
    *   **Output Mode:** `object`
    *   **Review:** Off
    *   **Web Access:** Auto
    *   **Reasoning Effort:** None
    *   **Max Output Tokens:** None
    *   **Knowledge Sources:** None
    *   **Output:** This step will output structured data including:
        *   `Titulo` (string, e.g. 'MyInvestor 2026-06')
        *   `Ganancias del mes` (number)
        *   `Aportaciones del mes` (number)
        *   `Valor de la cartera` (number)
        *   `Fecha reporte` (date, format YYYY-MM-DD)

2.  **Notion - Create Database Page:**
    *   **Data Source:** `Finance Tracker · Rendimiento Inversiones` (Notion database)
    *   **Fecha:** `Titulo` from Step 2.
    *   **Plataforma:** `MyInvestor`
    *   **Periodo:** `Mensual`
    *   **Ganancia:** `Ganancias del mes` from Step 2.
    *   **Aportes:** `Aportaciones del mes` from Step 2.
    *   **Capital total:** `Valor de la cartera` from Step 2.
    *   **Fecha reporte:** `Fecha reporte` from Step 2 (as start date).