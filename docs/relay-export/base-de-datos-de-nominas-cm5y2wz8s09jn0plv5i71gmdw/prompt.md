This automation starts when a file is added to the "Nominas" folder in Google Drive. It then checks if the file is a PDF. If it is, it extracts company name, payment date, and total amount using an AI, and creates a new page in a Notion database called "Finance Tracker · Nominas" with this information. If the file is not a PDF, it moves the file to the trash.

**Apps to connect:**

*   Google Drive
*   Notion
*   Google Account

**Trigger:**

A file is added to the "Nominas" folder in Google Drive.

**Steps:**

1.  **Check File Type:** Determine if the added file's MIME type is "application/pdf".
2.  **If PDF:**
    *   **Extract Data with AI:** Use GPT 5.4 mini to process the PDF file. The AI should extract the following information:
        *   Company Name
        *   Payment Date (as a date-time)
        *   Total Amount Deposited (as a number)
    *   **Create Notion Page:** In the "Finance Tracker · Nominas" Notion database, create a new page using the extracted data. The fields to populate are:
        *   "Empresa" will be the Company Name from the AI.
        *   "Archivo" will be the URL of the added Google Drive file.
        *   "Fecha de pago" will be the Payment Date from the AI.
        *   "Total" will be the Total Amount Deposited from the AI.
3.  **If Not PDF:**
    *   **Move File to Trash:** Move the added file to the trash in Google Drive.