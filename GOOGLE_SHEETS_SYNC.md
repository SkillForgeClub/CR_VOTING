# GOOGLE SHEETS ROSTER SYNCHRONIZATION GUIDE

**VIIT CR ELECTIONS 2026**  
**Vignan's Institute of Information Technology — Department of Data Science**  

This document details how the institutional student roster in Google Sheets connects securely to the authoritative **Supabase PostgreSQL** database.

---

## 📊 1. Google Spreadsheet Format Requirements

- **Spreadsheet Name**: `VIIT CR Elections 2026 — Student Roster`
- **Worksheet / Tab Name**: `Students`
- **Required Header Row (Row 1)**:
  ```csv
  roll_number,name,section,eligible
  ```

### Example Rows:
| roll_number | name | section | eligible |
| :--- | :--- | :--- | :--- |
| `24DS0001` | Ananya Sharma | A | `TRUE` |
| `24DS0002` | Rohan Verma | B | `TRUE` |
| `24DS0003` | Priya Patel | C | `FALSE` |

---

## 🔄 2. Roster Sync Workflow

```
 Google Sheet (Students Tab)
            │
            ▼
 Backend API (/api/v1/admin/roster/sync-preview)
            │
    ┌───────┴──────────────────────┐
    │ Validation & Normalization   │
    │ - Uppercase roll_number      │
    │ - Section check (A/B/C/D)    │
    │ - Duplicate detection        │
    └───────┬──────────────────────┘
            │
            ▼
   Sync Preview Generation
   (New / Updated / Unchanged / Invalid / Duplicates)
            │
            ▼
   Admin Confirmation ([CONFIRM SYNC])
            │
            ▼
   Supabase PostgreSQL Update
   (Strict Rule: has_voted and voted_at are NEVER reset)
            │
            ▼
   Audit Log Recorded (`ROSTER_SYNC_GOOGLE_SHEETS`)
```

---

## 🔒 3. Security & Safety Rules Enforced

1. **Supabase is Authoritative**: Google Sheets is strictly an ingestion source for voter identity and eligibility. Live voting transactions, ballot receipts, candidate tallies, and audit logs remain strictly inside Supabase PostgreSQL.
2. **Vote Protection Guarantee**:
   - `has_voted` is **NEVER** reset to `false`.
   - `voted_at` is **NEVER** erased.
   - Historical vote records in `votes` are **NEVER** modified or overwritten.
3. **No Frontend Secrets**: Google credentials / sheet API keys remain strictly server-side.
4. **Student Restriction**: Student accounts cannot access or trigger sync endpoints (`/api/v1/admin/roster/*` endpoints are protected by Admin JWT authorization).
5. **LIVE Election Restrictions**: During a `LIVE` election, roster modifications require `SUPER_ADMIN` confirmation to prevent accidental voter disqualification.

---

## 🛠️ 4. Connection Options & Setup Instructions

To connect your `VIIT CR Elections 2026 — Student Roster` spreadsheet to the platform, choose **either Option A or Option B**:

### Option A: Standard Google Sheet Published CSV (Recommended & Easiest)
1. Open your Google Spreadsheet: **VIIT CR Elections 2026 — Student Roster**.
2. Click **File** $\rightarrow$ **Share** $\rightarrow$ **Publish to web**.
3. Select **Students** worksheet tab, and choose **Comma-separated values (.csv)** format.
4. Click **Publish** and copy the generated link (e.g., `https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv`).
5. Open the Admin Control Console $\rightarrow$ **Settings & Integrations** $\rightarrow$ **Google Sheets Synchronizer**.
6. Paste the URL and click **🔄 SYNC STUDENTS (PREVIEW)**.

---

### Option B: Private Sheet with Google Apps Script Web App Endpoint
If your spreadsheet cannot be published publicly (even as read-only CSV):
1. In your spreadsheet, click **Extensions** $\rightarrow$ **Apps Script**.
2. Paste the following Apps Script code:
   ```javascript
   function doGet() {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Students");
     var data = sheet.getDataRange().getValues();
     var headers = data[0];
     var students = [];
     
     for (var i = 1; i < data.length; i++) {
       if (!data[i][0]) continue;
       students.push({
         roll_number: String(data[i][0]).trim(),
         name: String(data[i][1]).trim(),
         section: String(data[i][2]).trim(),
         eligible: data[i][3] === true || String(data[i][3]).toLowerCase() === "true"
       });
     }
     
     return ContentService.createTextOutput(JSON.stringify({ students: students }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. Click **Deploy** $\rightarrow$ **New deployment**.
4. Select **Web app**, set Executed as: **Me**, Who has access: **Anyone**.
5. Copy the Web App URL and paste it into the Admin Console Roster Synchronizer.
