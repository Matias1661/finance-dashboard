This automation triggers when an email containing attachments is received from beatriz.matos@luzagroup.com. It then iterates through each attachment, checks if it's a PDF, and if it is, uses AI to determine if it's a payroll receipt (nómina). If the AI confirms it's a payroll receipt, the file is uploaded to a specific folder in Google Drive.

**Apps to connect:**
*   Gmail
*   Google Drive

**Trigger:**
*   **Gmail:** An email is received.
    *   **Conditions:**
        *   The sender must be `beatriz.matos@luzagroup.com`.
        *   The email must have at least one attachment.

**Steps:**

1.  **Iterate through attachments:**
    *   **App:** Gmail (or your automation tool's iteration capability)
    *   **Action:** Loop through each item in the `Attachments` from the received email (Step 1).
    *   **Execution:** Parallel

2.  **Check if PDF:**
    *   **App:** Paths (or your automation tool's conditional logic)
    *   **Action:** Evaluate the `mimeType` of the current attachment from the loop (Step 1).
    *   **Conditions:**
        *   **Path 1 (Es PDF):** If `mimeType` is `application/pdf`.
        *   **Path 2 (No es PDF):** If no other path matches.

3.  **AI - Is it a payroll receipt? (Inside the "Es PDF" path):**
    *   **App:** AI / Language Model (e.g., Gemini, Claude, GPT)
    *   **Action:** Analyze the PDF attachment from the loop (Step 1).
    *   **Prompt:** "Analiza el PDF adjunto y determina si es una nómina (recibo de sueldo / pago salarial). Responde true solo si claramente es una nómina."
    *   **Output:** Structured data with a boolean field named `Es nomina` and a string field named `Motivo`.
    *   **Attachment:** The current PDF attachment from the loop (Step 1).

4.  **Check if confirmed as payroll receipt:**
    *   **App:** Paths (or your automation tool's conditional logic)
    *   **Action:** Evaluate the `Es nomina` field from the AI step (Step 3).
    *   **Conditions:**
        *   **Path 1 (Sí es nómina):** If `Es nomina` is `true`.
        *   **Path 2 (No es nómina):** If no other path matches.

5.  **Upload to Google Drive (Inside the "Sí es nómina" path):**
    *   **App:** Google Drive
    *   **Action:** Upload File.
    *   **File:** The current attachment from the loop (Step 1).
    *   **Parent folder:** `Nominas` (with ID `1pt9WGS3nzR8t1NIS5egrL0OMm2QGUKGj`).