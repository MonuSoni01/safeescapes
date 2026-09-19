# SAFE ESCAPE Order Automation Setup
Flow: Checkout -> Razorpay -> signature verification -> Firestore paid order -> Shiprocket -> PDF invoice -> Google Sheet -> customer email.

1. Fill private values in `.env`. Never upload `.env` to GitHub.
2. Firebase: Project Settings > Service accounts > Generate new private key. Convert JSON to ONE LINE and paste as `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Google Sheet > Extensions > Apps Script. Paste `google-apps-script/OrderSheetAndInvoiceMailer.gs`. Change `CONFIG.API_SECRET` and use the SAME value in `.env` as `GOOGLE_APPS_SCRIPT_SECRET`.
4. Apps Script > Deploy > New deployment > Web app. Copy the `/exec` URL to `GOOGLE_APPS_SCRIPT_ORDER_URL` in `.env`.
5. Put Shiprocket API-user email/password and exact pickup-location name in `.env`.
6. Put Razorpay Test Key Secret in `.env`.
7. Run: `cd functions`, `npm install`, `cd ..`, `npx netlify dev`.
8. Test only at `http://localhost:8888/checkout.html`.
9. Before production deploy, add all private `.env` values in Netlify Environment Variables. Do not deploy `.env`.

IMPORTANT: Shiprocket package dimensions/weight in `.env` are placeholders. Replace with actual packed-product values before real shipments.
