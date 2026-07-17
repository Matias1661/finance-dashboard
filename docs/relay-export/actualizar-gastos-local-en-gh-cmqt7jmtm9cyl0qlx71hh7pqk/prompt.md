This automation triggers when a page in the "Gastos del local" Notion database is created or updated in the "Concepto", "Costo", "Fecha", or "Pagado por" fields, and then dispatches a GitHub workflow named "Sync Sociedad Data" on the main branch.

**Apps to connect:**
*   Notion
*   GitHub

**Trigger:**
*   **Event:** Notion page created or updated
*   **Source:** Notion database "Gastos del local"
*   **Fields to monitor for changes:** "Concepto", "Costo", "Fecha", "Pagado por"

**Steps:**

1.  **Dispatch GitHub Workflow:**
    *   **App:** GitHub
    *   **Action:** Run workflow
    *   **Workflow:** "Sync Sociedad Data"
    *   **Branch:** `main`
    *   **Inputs:**
        *   **Concepto:** The "Concepto" value from the Notion page (from Step 1).
        *   **Costo:** The "Costo" value from the Notion page (from Step 1).
        *   **Fecha:** The "Fecha" value from the Notion page (from Step 1).
        *   **Pagado por:** The "Pagado por" value from the Notion page (from Step 1).