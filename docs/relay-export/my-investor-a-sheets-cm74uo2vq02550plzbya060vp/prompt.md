This automation triggers when an email is received from "comunicaciones@myinvestor.es" with "Rentabilidad" and "cartera" in the subject. It then extracts the portfolio value and the exact date from the email using an AI model and adds this information as a new row to a Google Sheet.

**Apps to connect:**
*   Gmail
*   Google Sheets

**Trigger:**
*   **Gmail:** An email is received.
    *   **Filter:** The sender is exactly "comunicaciones@myinvestor.es".
    *   **Filter:** The subject contains "Rentabilidad".
    *   **Filter:** The subject contains "cartera".

**Steps:**

1.  **AI Prompt (GPT 5.4 nano):**
    *   **Model:** `relay.gpt-5.4-nano`
    *   **Prompt:** "El correo que estas analizando es un resumen del valor de mi cartera de inversiones. Del correo necesito que extraigas: - El valor de la cartera. - La fecha exacta a la que hacen referencia esos datos (por ejemplo, el correo indica que los datos son "a 30 de junio"). Extrae esa fecha tal como la menciona el correo, no el mes completo."
    *   **Output Mode:** `object`
    *   **Attachments:** The email received in the trigger step.
    *   **User Schema:**
        *   `Valor de la cartera`: number
        *   `Fecha`: string (date format)

2.  **Google Sheets: Add row to sheet:**
    *   **Sheet:** "Inversiones" (ID: `1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI`)
    *   **Insert at:** Bottom of sheet (default)
    *   **Fecha:** The "Fecha" extracted from step 1.
    *   **My Investor:** The "Valor de la cartera" extracted from step 1.