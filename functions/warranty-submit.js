const { getDb, json, admin, SUPPORT } = require('./_shared');
const W = require('./_warranty');

/* =========================================================
   SAFE ESCAPE — WARRANTY REGISTRATION SUBMIT

   POST /.netlify/functions/warranty-submit
   JSON body: form fields + photo { name, type, data(base64) }

   1. Validate all fields (server side — cannot be bypassed)
   2. Serial must exist in "serialNumbers", be active and not
      already registered  (one Firestore transaction)
   3. Save "warrantyRegistrations" doc  (status: pending)
   4. Apps Script -> photo to Google Drive, row in Google Sheet,
      "we received your details" email to customer + admin copy
========================================================= */

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // after browser compression
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fail(statusCode, message, field) {
    return json(statusCode, { success: false, message, field, support: SUPPORT });
}

exports.handler = async (event) => {

    if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed');

    let body;
    try {
        const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
        body = JSON.parse(raw || '{}');
    } catch {
        return fail(400, 'Invalid request.');
    }

    const t = v => String(v ?? '').trim();

    const data = {
        customerName: t(body.customerName).slice(0, 120),
        mobile: t(body.mobile).replace(/\D/g, ''),
        email: t(body.email).toLowerCase().slice(0, 120),
        serialNumber: W.cleanSerial(body.serialNumber),
        wireLength: t(body.wireLength).slice(0, 10),
        purchasedFrom: t(body.purchasedFrom).slice(0, 150),
        installationAddress: t(body.installationAddress).slice(0, 600),
        purchaseDate: t(body.purchaseDate),
        installedBy: t(body.installedBy).slice(0, 120)
    };

    /* ---------- FIELD VALIDATION ---------- */

    if (!data.customerName) return fail(400, 'Please enter the customer / company name.', 'customerName');
    if (!W.validMobile(data.mobile)) return fail(400, 'Please enter a valid 10-digit mobile number.', 'mobile');
    if (!W.validEmail(data.email)) return fail(400, 'Please enter a valid email address.', 'email');
    if (!W.validSerial(data.serialNumber)) return fail(400, 'Please enter a valid device serial number.', 'serialNumber');
    if (!data.wireLength) return fail(400, 'Please select the wire length.', 'wireLength');
    if (!data.purchasedFrom) return fail(400, 'Please enter where you purchased the device from.', 'purchasedFrom');
    if (!data.installationAddress) return fail(400, 'Please enter the installation address.', 'installationAddress');
    if (!data.installedBy) return fail(400, 'Please enter who installed the device.', 'installedBy');
    if (body.termsAccepted !== true && body.termsAccepted !== 'yes') {
        return fail(400, 'Please accept the warranty terms and conditions.', 'termsAccepted');
    }

    const purchase = W.parseDay(data.purchaseDate);
    if (!purchase) return fail(400, 'Please enter a valid purchase date.', 'purchaseDate');

    const days = W.daysBetween(purchase, W.todayIST());
    if (days < 0) return fail(400, 'Purchase date cannot be in the future.', 'purchaseDate');
    if (days > 3650) return fail(400, 'Please check the purchase date.', 'purchaseDate');

    /* ---------- PHOTO ---------- */

    const photo = body.photo || {};
    const photoData = String(photo.data || '').replace(/^data:[^;]+;base64,/, '');
    const photoBytes = Math.floor(photoData.length * 3 / 4);

    if (!photoData) return fail(400, 'Please upload the installed device photo.', 'photo');
    if (!ALLOWED_TYPES.includes(photo.type)) return fail(400, 'Please upload a JPG, PNG or WEBP image.', 'photo');
    if (photoBytes > MAX_PHOTO_BYTES) return fail(400, 'Photo is too large. Please upload a smaller image.', 'photo');

    try {
        const db = getDb();
        const key = W.serialKey(data.serialNumber);
        const serialRef = db.collection('serialNumbers').doc(key);
        const regRef = db.collection('warrantyRegistrations').doc();
        const now = admin.firestore.FieldValue.serverTimestamp();

        /* ---------- SERIAL CHECK + RESERVE (atomic) ---------- */

        const serialCheck = await db.runTransaction(async (tx) => {
            const snap = await tx.get(serialRef);

            if (!snap.exists) return { ok: false, code: 'not-found' };

            const serial = snap.data() || {};
            if (serial.active === false) return { ok: false, code: 'inactive' };
            if (serial.registered === true) return { ok: false, code: 'already-registered', status: serial.warrantyStatus };

            tx.set(regRef, {
                ...data,
                serialKey: key,
                registrationId: regRef.id,
                termsAccepted: true,
                daysSincePurchase: days,
                lateRegistration: days > W.REGISTRATION_DAYS,
                warrantyYears: W.WARRANTY_YEARS,
                status: 'pending',
                photoStatus: 'uploading',
                emailStatus: 'pending',
                source: 'website',
                userAgent: String(event.headers?.['user-agent'] || '').slice(0, 200),
                createdAt: now,
                updatedAt: now
            });

            tx.set(serialRef, {
                registered: true,
                warrantyStatus: 'pending',
                warrantyRegistrationId: regRef.id,
                registeredAt: now
            }, { merge: true });

            return { ok: true };
        });

        if (!serialCheck.ok) {
            const messages = {
                'not-found': 'Invalid Serial Number. The serial number entered does not match our records. Please check the serial number printed on your SAFE ESCAPE device and try again.',
                'inactive': 'This Serial Number is currently inactive and cannot be registered. Please contact SAFE ESCAPE support.',
                'already-registered': serialCheck.status === 'approved'
                    ? 'Warranty for this Serial Number is already registered and approved. Duplicate registration is not permitted.'
                    : 'A warranty registration for this Serial Number has already been submitted and is under review.'
            };
            return fail(409, messages[serialCheck.code], 'serialNumber');
        }

        /* ---------- PHOTO -> DRIVE, SHEET, EMAILS ---------- */

        const script = await W.warrantyScript('warrantySubmit', {
            registration: { ...data, registrationId: regRef.id, daysSincePurchase: days, lateRegistration: days > W.REGISTRATION_DAYS },
            photo: { name: String(photo.name || 'photo.jpg').slice(0, 80), type: photo.type, data: photoData }
        }, 9000);

        if (script.status === 'failed' || script.status === 'not_configured') {
            // Photo could not be stored -> undo, so customer can try again
            await Promise.all([
                regRef.delete(),
                serialRef.set({
                    registered: false,
                    warrantyStatus: admin.firestore.FieldValue.delete(),
                    warrantyRegistrationId: admin.firestore.FieldValue.delete()
                }, { merge: true })
            ]);
            console.error('WARRANTY APPS SCRIPT ERROR:', script.message || script.status);
            return fail(502, 'We could not upload your photo right now. Please try again in a minute, or contact our support team.');
        }

        await regRef.set({
            photoStatus: script.status === 'done' ? 'saved' : 'submitted',
            photoFileId: script.fileId || '',
            photoUrl: script.fileUrl || '',
            sheetStatus: script.sheetStatus || script.status,
            emailStatus: script.emailStatus || script.status,
            updatedAt: now
        }, { merge: true });

        return json(200, {
            success: true,
            registrationId: regRef.id,
            serialNumber: data.serialNumber,
            email: data.email,
            support: SUPPORT
        });

    } catch (error) {
        console.error('WARRANTY SUBMIT ERROR:', error);
        return fail(500, 'Could not submit the warranty registration. Please try again.');
    }
};
