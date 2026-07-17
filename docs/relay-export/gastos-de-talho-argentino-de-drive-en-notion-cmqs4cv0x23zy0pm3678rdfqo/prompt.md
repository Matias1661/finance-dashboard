This workflow adds a new expense to a Notion database and triggers a GitHub workflow when a file is added to a specific Google Drive folder.

**Apps to connect:**
*   Google Drive
*   Notion
*   GitHub

**Trigger:**
*   **Google Drive:** A file is added to the "Gastos Talho Argentino" folder.

**Steps:**

1.  **AI Prompt (Object):** Extract the main expense concept/description, total cost (as a number, removing currency symbols), and the date from the added file.
    *   **Model:** `relay.gemini-3.5-flash`
    *   **Prompt:** "Este es un comprobante de un gasto (factura, ticket o recibo). Extrae el concepto o descripción principal del gasto, el costo total y la fecha del comprobante. Si el costo incluye símbolo de moneda, devuelve solo el número."
    *   **Output Mode:** `object`
    *   **Attachments:** The file added in Step 1.
    *   **Extracted Data:**
        *   `Concepto` (Text)
        *   `Costo` (Number)
        *   `Fecha` (Date)

2.  **Create Notion Page (Database):** Create a new entry in the "Gastos del local" Notion database.
    *   **Data Source:** `Notion #1`
    *   **Fields:**
        *   `Concepto`: Use the `Concepto` extracted in Step 2.
        *   `Costo`: Use the `Costo` extracted in Step 2.
        *   `Fecha` (Start Date): Use the `Fecha` extracted in Step 2.

3.  **Dispatch GitHub Workflow:** Trigger the "Sync Sociedad Data" workflow in GitHub.
    *   **Repository:** `Sync Sociedad Data` (ID: 301444283)
    *   **Branch:** `main`
    *   **Inputs:** None.