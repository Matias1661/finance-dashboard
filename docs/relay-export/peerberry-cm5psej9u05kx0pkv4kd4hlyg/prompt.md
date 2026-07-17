This workflow triggers when an email from `info@peerberry.com` with "Account" in the subject is received. It then uses an AI model to extract specific financial data from the email, calculate a total, and finally adds a new row to a Google Sheet with the extracted and calculated information.

**Apps to connect:**
*   Gmail
*   Google Sheets

**Trigger:**
*   **Gmail:** When an email is received.
    *   **Filter:**
        *   The sender's email address is exactly `info@peerberry.com`.
        *   The email subject contains the word "Account".

**Steps:**

1.  **AI Prompt (Gemini 3.1 Flash-Lite):**
    *   **Model:** `relay.gemini-3.1-flash-lite`
    *   **Prompt:**
        ```
        El correo que estas analizando es el estado de mi cuenta en Peerberry.

        Quiero que extraigas el valor "Invested funds", el de "Available
        balance" y la fecha de "Portfolio updated".

        Y quiero que me crees una cuarta variable llamada "Total" que sea la
        suma de "Invested funds" y "Available balance".
        ```
    *   **Output Mode:** `object`
    *   **Attachments:** Use the received email from the trigger step.
    *   **Output Schema:** Define the output as an object with the following properties:
        *   `Invested Funds` (number)
        *   `Available balance` (number)
        *   `Fecha` (string, format: date)
        *   `Total` (number)

2.  **Google Sheets: Add row to sheet:**
    *   **Sheet:** "Inversiones" (using the specific sheet ID `1c0pyDHR_vvb_HD7LqH8Z5rCZ-W2DKVB7pNqAMKZ__OI`)
    *   **Insert at:** Bottom of sheet (or Append to table)
    *   **Fecha:** Use the `Fecha` value from Step 1.
    *   **Peerberry:** Use the `Total` value from Step 1.