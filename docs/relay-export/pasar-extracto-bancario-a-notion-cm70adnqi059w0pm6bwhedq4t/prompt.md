This workflow adds bank statement entries to Notion. It triggers when a file is added to a specific Google Drive folder.

**Apps to connect:**
* Google Drive
* Notion
* GitHub

**Trigger:**
* **File added to folder** (Google Drive): Triggers when a new file is added to the "Extractos para Notion" folder in Google Drive.

**Steps:**

1.  **Read prompt from Notion** (Notion):
    *   Finds a Notion data source named "Prompts para Relay".
    *   Looks for a page within that data source with the "Nombre" field equal to "Pasar extracto bancario a Notion".
    *   If multiple pages are found, it uses the first one.
    *   If no pages are found, it proceeds without error.
    *   The output is the content of the "Texto" field from the found Notion page.

2.  **Create the JSON file of all movements** (AI - relay.gpt-5.4-mini):
    *   Uses the prompt text from Step 1.
    *   Attaches the new file added in Google Drive (from the trigger).
    *   The expected output is a JSON object containing a list of "Movimientos". Each movement in the list should have "Concepto" (string), "Monto" (number), "Category" (string), and "Date" (string, formatted as YYYY-MM-DD).

3.  **For each item in Movimientos run these steps** (Iterator):
    *   Iterates over the list of "Movimientos" obtained from Step 2.
    *   For each movement, it executes the steps within this loop in parallel.

    *   **Create movement in Notion** (Notion):
        *   Creates a new page in the "Movimientos" Notion database.
        *   Sets the "Concepto" field to the "Concepto" from the current movement in the loop.
        *   Sets the "Monto" field to the "Monto" from the current movement in the loop.
        *   Sets the "Categoria" field to the "Category" from the current movement in the loop.
        *   Sets the "Fecha" field (start date) to the "Date" from the current movement in the loop.

4.  **Trigger GitHub workflow** (GitHub):
    *   Triggers the "Sync Finance Data" workflow in GitHub.
    *   Uses the `main` branch.
    *   Passes an empty object for workflow inputs.