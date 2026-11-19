const crypto = require('crypto');

const {
    getDb,
    json,
    admin,
    secureEqual,
    hashToken,
    orderSummary,
    SUPPORT
} = require('./_shared');


/* =========================================================
   SAFE ESCAPE — FAST RAZORPAY PAYMENT VERIFICATION

   This function now does ONLY the critical work so the
   customer sees the Thank You page in ~1–2 seconds:

     1. Verify Razorpay signature
     2. Verify order token
     3. ONE Firestore transaction:
          status = paid, order number SE000X,
          invoice number, coupon usage +1
     4. Return order summary

   Shiprocket + Google Sheet + PDF Invoice + Email run
   separately in  process-order.js  (triggered by the
   Thank You page, retry-able from the Admin panel).
========================================================= */

const PAID_STATES = ['paid', 'processing', 'shipped', 'completed'];

function createInvoiceNumber(orderNumber) {
    return `INV-${new Date().getFullYear()}-${orderNumber}`;
}


exports.handler = async (event) => {

    if (event.httpMethod !== 'POST') {
        return json(405, { success: false, message: 'Method not allowed' });
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { success: false, message: 'Invalid request body.' });
    }

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderRef,
        orderToken
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderRef || !orderToken) {
        return json(400, { success: false, message: 'Missing payment verification data.', support: SUPPORT });
    }

    try {

        /* ---------- 1. SIGNATURE (no network, instant) ---------- */

        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!razorpaySecret) throw new Error('RAZORPAY_KEY_SECRET is missing.');

        const expectedSignature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (!secureEqual(expectedSignature, razorpay_signature)) {
            return json(400, { success: false, message: 'Invalid Razorpay payment signature.', support: SUPPORT });
        }


        /* ---------- 2 + 3. ONE TRANSACTION ---------- */

        const db = getDb();
        const ref = db.collection('orders').doc(String(orderRef));
        const counterRef = db.collection('system').doc('orderCounter');

        const result = await db.runTransaction(async (tx) => {

            const snap = await tx.get(ref);
            if (!snap.exists) {
                const err = new Error('Order not found.');
                err.statusCode = 404;
                throw err;
            }

            const order = snap.data() || {};

            if (!secureEqual(hashToken(orderToken), order.orderTokenHash)) {
                const err = new Error('Invalid order token.');
                err.statusCode = 403;
                throw err;
            }

            if (order.razorpayOrderId !== razorpay_order_id) {
                const err = new Error('Razorpay order mismatch.');
                err.statusCode = 400;
                throw err;
            }

            /* Already verified earlier (retry / refresh) -> idempotent */
            if (PAID_STATES.includes(order.status) && order.orderNumber) {
                return { ...order, orderId: ref.id };
            }

            /* Counter read must happen before any write in the transaction */
            let orderNumber = order.orderNumber;
            let nextNumber = null;

            if (!orderNumber) {
                const counterSnap = await tx.get(counterRef);
                const current = counterSnap.exists ? Number(counterSnap.data().lastNumber || 0) : 0;
                nextNumber = current + 1;
                orderNumber = `SE${String(nextNumber).padStart(4, '0')}`;
            }

            const invoiceNumber = order.invoiceNumber || createInvoiceNumber(orderNumber);
            const now = admin.firestore.FieldValue.serverTimestamp();

            if (nextNumber !== null) {
                tx.set(counterRef, { lastNumber: nextNumber, updatedAt: now }, { merge: true });
            }

            const update = {
                status: 'paid',
                paymentStatus: 'paid',
                razorpayPaymentId: razorpay_payment_id,
                orderNumber,
                invoiceNumber,
                paidAt: now,
                shippingStatus: order.shippingStatus || 'pending',
                documentsStatus: 'pending'
            };

            tx.set(ref, update, { merge: true });

            /* Coupon usage — only once, because we only reach here when not yet paid */
            if (order.cart && order.cart.couponCode) {
                tx.set(
                    db.collection('coupons').doc(order.cart.couponCode),
                    { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: now },
                    { merge: true }
                );
            }

            return {
                ...order,
                ...update,
                orderId: ref.id,
                paidAt: new Date()
            };
        });


        /* ---------- 4. RESPOND IMMEDIATELY ---------- */

        return json(200, {
            success: true,
            paymentStatus: 'paid',
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            invoiceNumber: result.invoiceNumber,
            order: orderSummary(result),
            support: SUPPORT
        });

    } catch (error) {

        console.error('PAYMENT VERIFICATION ERROR:', error);

        return json(error.statusCode || 500, {
            success: false,
            message: error.message || 'Payment verification failed.',
            support: SUPPORT
        });
    }
};
