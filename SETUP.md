# SAFE ESCAPE — Production Setup

## 1. What this package contains
- Multi-page HTML/CSS/JavaScript website (no React/WordPress dependency)
- Home, About, Products, Applications, Safety & Testing, Dealer, Bulk/Projects, Resources, FAQ, Contact
- Cart, Checkout, Order Success
- Warranty registration
- Privacy Policy and Terms pages
- Firebase Admin login/dashboard
- Firestore enquiry/order/warranty data model
- Razorpay server-side order creation + signature verification
- Optional Shiprocket credential hook
- Fixed WhatsApp button on RIGHT side
- Responsive desktop/tablet/mobile layout

## 2. Firebase project
1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Enable **Firestore Database**.
4. Enable **Storage**.
5. Add a Web App and copy the Firebase config into `assets/js/firebase-config.js`.
6. Install Firebase CLI: `npm i -g firebase-tools`
7. Run `firebase login` and `firebase use --add`.
8. Deploy rules: `firebase deploy --only firestore:rules,storage`

## 3. Bootstrap the first Admin
1. In Firebase Authentication, create the admin user (email/password).
2. Copy that user's UID.
3. In Firestore create collection `admins` and document ID = that UID.
4. Add fields such as `name`, `email`, `role: "admin"`.
5. Open `/admin/` and login.

The Admin dashboard can read:
- `orders`
- `enquiries`
- `warrantyRegistrations`

## 4. Razorpay secure integration
Razorpay must NOT use the Key Secret in browser JavaScript. This package creates and verifies payments in Firebase Functions.

Inside `functions/` run:
`npm install`

Set Firebase secrets:
`firebase functions:secrets:set RAZORPAY_KEY_ID`
`firebase functions:secrets:set RAZORPAY_KEY_SECRET`
`firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET`

Deploy:
`firebase deploy --only functions,hosting`

Then put the public Razorpay Key ID in `assets/js/firebase-config.js` as `razorpayKeyId`.
If Firebase Hosting serves the site and functions rewrite is used, keep `functionsBaseUrl=""`.

In Razorpay Dashboard, add a webhook URL: `https://YOUR_DOMAIN/razorpayWebhook` and subscribe to `payment.captured`. Use the same value you saved as `RAZORPAY_WEBHOOK_SECRET`. This keeps payment status correct even when the buyer closes the browser after a successful payment.

## 5. Google Sheet form integration + email notification
All five public enquiry types use one shared frontend file: `assets/js/form.js`.

1. Create/open the Google Sheet that should receive the leads.
2. In that Sheet, open **Extensions → Apps Script** and replace the default file with `google-apps-script/Code.gs` from this project.
3. Set `SPREADSHEET_ID` (the value between `/d/` and `/edit` in the Sheet URL), `NOTIFY_TO`, `NOTIFY_CC` and, if warranty photos should be saved, `DRIVE_FOLDER_ID`.
4. Click **Deploy → New deployment → Web app**. Select **Execute as: Me** and **Who has access: Anyone**. Copy the final `/exec` URL.
5. Paste the URL into `googleSheetWebAppUrl` in `assets/js/firebase-config.js`.

Each first submission automatically creates its named Sheet tab and formatted headers. Emails have the relevant form subject and all submitted fields. Warranty photo uploads are saved to Drive only when a Drive folder ID is provided.

## 6. Coupons
Coupons are managed in `/admin/` after Firebase Admin login. A coupon can have percentage or flat discount, active status, start/end date, minimum order, maximum discount and usage limit. The checkout calls the backend to validate it and the backend recalculates it again before payment.

Deploy changed backend and rules:
`firebase deploy --only functions,firestore:rules`

## 7. Pricing logic implemented
Base MRP: ₹49,999 for 15 m / 3rd–4th floor.
Every next +5 m option adds ₹1,250.
Floor/length mapping is in `assets/js/store.js` and repeated server-side in `functions/index.js` to stop front-end price tampering.
5+ system quantity gets 10% bulk discount.

## 8. Shiprocket
The brief asks for Shiprocket. Credentials are intentionally not hard-coded. Set:
`firebase functions:secrets:set SHIPROCKET_EMAIL`
`firebase functions:secrets:set SHIPROCKET_PASSWORD`

A health/config hook is included. Before creating live shipments, map your Shiprocket pickup location, product SKU, package dimensions/weight and COD/prepaid rules in `functions/index.js`.

## 9. Images still required from client
The source files state that these will be supplied later:
- 6 "How it works" real photos
- Main product photos / multiple angles
- 5 accessory product photos
- Approx. 6 NABL certificates/reports + exact report metadata
- Client installation photographs
- Recommendation letters
- YouTube testimonial/demo/installation URLs
- Installation manual PDF

The current build uses a custom CSS/SVG visual system instead of fake AI-looking product photos.

## 10. Important legal/content review before launch
The supplied Terms contain broad liability waivers, criminal-liability language and regulatory statements. The site preserves the relevant structure but deliberately flags these areas for qualified legal review before publication. Certificate claims should also be backed by the actual uploaded reports before going live.

## 11. Netlify alternative
Static pages can be hosted on Netlify, but secure Razorpay order creation/verification still needs a server-side endpoint. Firebase Functions can remain the backend even if static HTML is on Netlify; set `functionsBaseUrl` to the deployed Functions/Cloud Run URL and configure CORS appropriately.
