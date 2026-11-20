# SAFE ESCAPE — Warranty Setup (10 minutes)

## How it works

```
Customer fills warranty.html
   └─► /.netlify/functions/warranty-submit
         ├─ checks mobile / email / purchase date / photo
         ├─ serial must exist in Firestore "serialNumbers", active, not already registered
         ├─ saves Firestore "warrantyRegistrations" (status: pending)
         └─ Apps Script ─► photo saved in Google Drive
                         ─► row added in Google Sheet "Warranty Registrations"
                         ─► email to customer: "We received your details"
                         ─► email to ADMIN_EMAIL: "New warranty registration" (with photo link)

Admin → Warranty tab
   ├─ pending on top, Pending / Approved / Rejected counts, filters
   ├─ View Image (opens Drive photo in new tab)
   ├─ View → Approve  ─► email: "5-year warranty approved from DATE to DATE" (copy to admin)
   │        Reject   ─► email with reason (copy to admin); serial is freed so customer can re-submit
   └─ Bulk Upload Serials (CSV / Excel) · Sample CSV · View Serials (search, delete unregistered)
```

Warranty period = **purchase date → purchase date + 5 years − 1 day**
(e.g. 20 Nov 2026 → 19 Nov 2031).

Registrations submitted more than 15 days after purchase are still accepted but marked
**LATE** in admin, so you can decide (and reject with the "after 15 days" reason).

---

## Step 1 — Google Apps Script

1. Go to <https://script.google.com> → **New project** → name it `SAFE ESCAPE Warranty`.
   (Or open your Google Sheet → Extensions → Apps Script, so the sheet is used automatically.)
2. Delete the sample code, paste everything from `google-apps-script/warranty.gs`, **Save**.
3. **Project Settings (⚙) → Script Properties → Add**:

   | Property | Value |
   |---|---|
   | `SECRET` | any long random text (never write it in any file in the repo) |
   | `ADMIN_EMAIL` | `safeescapesolutions@gmail.com` |
   | `SHEET_ID` | *(optional)* your Google Sheet ID |
   | `DRIVE_FOLDER_ID` | *(optional)* Drive folder ID for photos |

4. In the editor choose function **`setup`** → **Run** → allow permissions
   (Drive, Sheets, Gmail). This creates the sheet + "SAFE ESCAPE Warranty Photos" folder.
5. **Deploy → New deployment → ⚙ Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → copy the **Web app URL** (ends with `/exec`).

> After any change in the script: Deploy → **Manage deployments** → ✏ → Version: **New version** → Deploy
> (the URL stays the same).

## Step 2 — Netlify environment variables

Netlify → Site configuration → Environment variables → Add:

| Key | Value |
|---|---|
| `WARRANTY_APPS_SCRIPT_URL` | the `/exec` URL from step 1 |
| `WARRANTY_APPS_SCRIPT_SECRET` | same text as `SECRET` in step 1 |

Then **Deploys → Trigger deploy → Deploy site**.

(`FIREBASE_SERVICE_ACCOUNT_JSON` is already set for orders — warranty uses the same.)

## Step 3 — Upload serial numbers

Admin → **Warranty** → **⬇ Sample CSV** → fill column A with serial numbers
(`SAFE/ESCAPE/IIZG/006` …) → **⬆ Bulk Upload Serials** → choose file → Upload.

Only uploaded serials can be registered by customers.

## Step 4 — Test

1. Upload serial `SAFE/ESCAPE/IIZG/006`.
2. Open `warranty.html`, fill the form with your own email, submit → popup appears,
   "received" email arrives, row appears in Google Sheet, photo in Drive.
3. Admin → Warranty → row is on top as **Pending** → View → Approve → approval email arrives.

## Notes

- Free Gmail accounts can send about **100 emails/day** from Apps Script
  (Google Workspace: 1,500/day). Each registration uses 2, each approve/reject uses 2.
- Serial numbers with `/` are stored in Firestore with `_` in the document ID
  (`SAFE_ESCAPE_IIZG_006`) because Firestore IDs cannot contain `/`.
  The real serial is kept in the `serialNumber` field and shown everywhere.
- Photos are compressed in the browser (max 1600 px) before upload, so submission is fast.
- No Firestore rule changes are needed — warranty reads/writes go through Netlify functions
  (Firebase Admin SDK). Customers no longer read `serialNumbers` directly.
