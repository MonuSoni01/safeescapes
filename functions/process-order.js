const {
    getDb,
    json,
    admin,
    secureEqual,
    hashToken,
    verifyAdmin
} = require('./_shared');

const { shiprocket, appsScript, EMPTY_SHIPPING } = require('./_automation');


/* =========================================================
   SAFE ESCAPE — POST-PAYMENT AUTOMATION

   POST /.netlify/functions/process-order
   body: { orderRef, orderToken?, step: 'shipping' | 'documents', force? }

   Called by:
     • Thank You page (with orderToken) right after payment
     • Admin panel "Retry" buttons (with Firebase admin ID token)

   Each step is kept short so it fits inside Netlify's
   function time limit, and is protected against duplicates
   (Shiprocket order is never created twice).
========================================================= */

const PAID_STATES = ['paid', 'processing', 'shipped', 'completed'];
const LOCK_MS = 2 * 60 * 1000;

function ts(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    return new Date(value).getTime() || 0;
}

/* Claim a step so two requests never run it at the same time */
async function claim(db, ref, field, { force = false, doneStates = [] } = {}) {
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const order = snap.data() || {};
        const state = order[`${field}Status`];
        const startedAt = ts(order[`${field}StartedAt`]);

        if (!force && doneStates.includes(state)) return { run: false, reason: 'already_done', order };
        if (state === 'processing' && Date.now() - startedAt < LOCK_MS) return { run: false, reason: 'in_progress', order };

        tx.set(ref, {
            [`${field}Status`]: 'processing',
            [`${field}StartedAt`]: admin.firestore.Timestamp.now()
        }, { merge: true });

        return { run: true, order };
    });
}


async function runShipping(db, ref, order, force) {
    // Never create a duplicate Shiprocket order, even when forced
    if (order.shipping && order.shipping.status === 'created') {
        return { status: 'created', skipped: true, shipping: order.shipping };
    }

    const lock = await claim(db, ref, 'shipping', { force, doneStates: ['created'] });
    if (!lock.run) return { status: lock.order.shippingStatus, skipped: true, reason: lock.reason };

    let shipping;
    try {
        shipping = await shiprocket({ ...lock.order, orderId: ref.id });
    } catch (error) {
        console.error('SHIPROCKET ERROR:', error);
        shipping = { ...EMPTY_SHIPPING, status: 'failed', error: error.message || 'Shiprocket failed.' };
    }

    await ref.set({
        shipping,
        shippingStatus: shipping.status,
        postOrderUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { status: shipping.status, shipping };
}


async function runDocuments(db, ref, force) {
    const lock = await claim(db, ref, 'documents', { force, doneStates: ['done', 'submitted'] });
    if (!lock.run) return { status: lock.order.documentsStatus, skipped: true, reason: lock.reason };

    let sync;
    try {
        sync = await appsScript({ ...lock.order, orderId: ref.id });
    } catch (error) {
        console.error('GOOGLE AUTOMATION ERROR:', error);
        sync = {
            status: 'failed', sheetStatus: 'failed', invoiceStatus: 'failed', invoiceUrl: '',
            emailStatus: 'failed', emailSentAt: '', error: error.message || 'Google automation failed.'
        };
    }

    const documentsStatus =
        sync.status === 'failed' ? 'failed'
            : sync.status === 'not_configured' ? 'not_configured'
                : sync.status === 'submitted' ? 'submitted'
                    : 'done';

    await ref.set({
        documentsStatus,
        documentsError: sync.error || '',
        sheetStatus: sync.sheetStatus || sync.status || 'pending',
        invoiceStatus: sync.invoiceStatus || 'pending',
        invoiceDriveUrl: sync.invoiceUrl || '',
        emailStatus: sync.emailStatus || 'pending',
        emailSentAt: sync.emailSentAt || '',
        postOrderUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { status: documentsStatus, emailStatus: sync.emailStatus, invoiceUrl: sync.invoiceUrl || '' };
}


exports.handler = async (event) => {

    if (event.httpMethod !== 'POST') {
        return json(405, { success: false, message: 'Method not allowed' });
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { success: false, message: 'Invalid request body.' });
    }

    const { orderRef, orderToken, step = 'shipping' } = body;

    if (!orderRef || !['shipping', 'documents'].includes(step)) {
        return json(400, { success: false, message: 'orderRef and a valid step are required.' });
    }

    try {
        const db = getDb();
        const ref = db.collection('orders').doc(String(orderRef));
        const snap = await ref.get();

        if (!snap.exists) return json(404, { success: false, message: 'Order not found.' });

        const order = snap.data() || {};

        /* ---- AUTH: customer token OR admin login ---- */
        let isAdmin = false;
        if (orderToken) {
            if (!secureEqual(hashToken(orderToken), order.orderTokenHash)) {
                return json(403, { success: false, message: 'Invalid order token.' });
            }
        } else {
            isAdmin = Boolean(await verifyAdmin(event));
            if (!isAdmin) return json(401, { success: false, message: 'Not authorised.' });
        }

        if (!PAID_STATES.includes(order.status)) {
            return json(409, { success: false, message: 'Order is not paid yet.' });
        }

        // Only admins can force a re-run (e.g. resend invoice email)
        const force = isAdmin && body.force === true;

        const result = step === 'shipping'
            ? await runShipping(db, ref, order, force)
            : await runDocuments(db, ref, force);

        return json(200, { success: true, step, ...result });

    } catch (error) {
        console.error('PROCESS ORDER ERROR:', error);
        return json(500, { success: false, message: error.message || 'Automation failed.' });
    }
};
