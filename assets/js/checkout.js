import {
    loadCart,
    saveCart,
    calculateCart,
    formatINR,
    floorOptions
} from './store.js';

import {
    razorpayKeyId,
    functionsBaseUrl,
    firebaseConfig
} from './firebase-config.js';

import {
    initializeApp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';

import {
    getFirestore,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


/* =========================================================
   FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


/* =========================================================
   CHECKOUT
========================================================= */

let cart = loadCart();
let couponDiscount = 0;

const summary = document.querySelector('#checkoutSummary');
const form = document.querySelector('#checkoutForm');

const endpoint = path =>
    (functionsBaseUrl || '') + path;


/* =========================================================
   ORDER SUMMARY
========================================================= */

function render() {

    if (!summary) return;

    if (!cart) {

        summary.innerHTML = `
            <div class="notice">
                Your cart is empty.
            </div>
        `;

        return;
    }


    const s = calculateCart(
        cart,
        couponDiscount
    );


    summary.innerHTML = `

        <h3>Order Summary</h3>

        <div class="summary-row">

            <span>
                SAFE ESCAPE ·
                ${floorOptions[cart.floorIndex][1]} m
                × ${cart.quantity}
            </span>

            <b>
                ${formatINR(s.product)}
            </b>

        </div>


        ${cart.accessories.map(a => `

            <div class="summary-row">

                <span>
                    ${a.name} × ${a.quantity}
                </span>

                <b>
                    ${formatINR(
        a.price * a.quantity
    )}
                </b>

            </div>

        `).join('')}


        <div class="summary-row">

            <span>
                Bulk discount
            </span>

            <b>
                ${s.bulk
            ? '−' + formatINR(s.bulk)
            : '₹0'
        }
            </b>

        </div>


        <div class="summary-row">

            <span>
                Coupon
                ${cart.couponCode
            ? `(${cart.couponCode})`
            : ''
        }
            </span>

            <b>
                ${s.couponDiscount
            ? '−' + formatINR(
                s.couponDiscount
            )
            : '₹0'
        }
            </b>

        </div>


        <div class="summary-total">

            <span>
                Payable
            </span>

            <strong>
                ${formatINR(s.total)}
            </strong>

        </div>

    `;
}


render();


/* =========================================================
   FIRESTORE DATE HELPER
========================================================= */

function getDate(value) {

    if (!value) return null;

    if (
        typeof value.toDate === 'function'
    ) {
        return value.toDate();
    }

    return new Date(value);
}


/* =========================================================
   COUPON VALIDATION
========================================================= */

async function validateCoupon(
    code,
    orderAmount
) {

    const couponRef = doc(
        db,
        'coupons',
        code
    );


    const snapshot =
        await getDoc(couponRef);


    /* COUPON NOT FOUND */

    if (!snapshot.exists()) {

        throw new Error(
            'Invalid coupon code.'
        );

    }


    const coupon =
        snapshot.data();


    /* ACTIVE */

    if (coupon.active !== true) {

        throw new Error(
            'This coupon is currently inactive.'
        );

    }


    const now = new Date();

    const startDate =
        getDate(coupon.startDate);

    const expiryDate =
        getDate(coupon.expiryDate);


    /* START DATE */

    if (
        startDate &&
        now < startDate
    ) {

        throw new Error(
            'This coupon is not active yet.'
        );

    }


    /* EXPIRY */

    if (
        expiryDate &&
        now > expiryDate
    ) {

        throw new Error(
            'This coupon has expired.'
        );

    }


    /* MINIMUM ORDER */

    const minOrder =
        Number(coupon.minOrder || 0);


    if (
        orderAmount < minOrder
    ) {

        throw new Error(
            `Minimum order of ${formatINR(minOrder)} required for this coupon.`
        );

    }


    /* USAGE LIMIT */

    const usageLimit =
        Number(coupon.usageLimit || 0);

    const usedCount =
        Number(coupon.usedCount || 0);


    if (
        usageLimit > 0 &&
        usedCount >= usageLimit
    ) {

        throw new Error(
            'This coupon has reached its usage limit.'
        );

    }


    /* =====================================================
       CALCULATE DISCOUNT
    ====================================================== */

    const discountValue =
        Number(
            coupon.discountValue || 0
        );


    let discount = 0;


    /* FLAT */

    if (
        coupon.discountType === 'flat'
    ) {

        discount =
            discountValue;

    }


    /* PERCENT */

    else if (
        coupon.discountType === 'percent'
    ) {

        discount =
            orderAmount *
            (discountValue / 100);

    }


    else {

        throw new Error(
            'Invalid coupon configuration.'
        );

    }


    /* MAX DISCOUNT */

    const maxDiscount =
        Number(
            coupon.maxDiscount || 0
        );


    if (
        maxDiscount > 0 &&
        discount > maxDiscount
    ) {

        discount =
            maxDiscount;

    }


    /* NEVER EXCEED ORDER */

    discount =
        Math.min(
            discount,
            orderAmount
        );


    discount =
        Math.max(
            0,
            Math.round(discount)
        );


    if (
        discount <= 0
    ) {

        throw new Error(
            'This coupon does not provide a valid discount.'
        );

    }


    return {

        valid: true,

        code: code,

        title:
            coupon.title ||
            'Coupon Applied',

        discount,

        coupon

    };

}


/* =========================================================
   APPLY COUPON
========================================================= */

document
    .querySelector('#applyCoupon')
    ?.addEventListener(
        'click',
        async () => {


            if (!cart) {

                showToast(
                    'Your cart is empty.'
                );

                return;

            }


            const input =
                document.querySelector(
                    '#couponCode'
                );


            const button =
                document.querySelector(
                    '#applyCoupon'
                );


            const code =
                input.value
                    .trim()
                    .toUpperCase();


            /* REMOVE COUPON */

            if (!code) {

                couponDiscount = 0;

                cart.couponCode = '';

                saveCart(cart);

                render();


                showToast(
                    'Coupon removed.'
                );

                return;

            }


            button.disabled = true;

            button.textContent =
                'VERIFYING…';


            try {


                /*
                 Amount after bulk discount.
                */

                const current =
                    calculateCart(cart);


                const eligibleAmount =
                    Math.max(
                        0,
                        current.subtotal -
                        current.bulk
                    );


                const result =
                    await validateCoupon(
                        code,
                        eligibleAmount
                    );


                couponDiscount =
                    result.discount;


                cart.couponCode =
                    result.code;


                saveCart(cart);


                render();


                showToast(
                    `${result.title} applied. You saved ${formatINR(result.discount)}.`
                );


                input.value =
                    result.code;


            }

            catch (error) {


                console.error(
                    'Coupon Error:',
                    error
                );


                couponDiscount = 0;

                cart.couponCode = '';


                saveCart(cart);

                render();


                showToast(
                    error.message ||
                    'Coupon could not be applied.'
                );

            }

            finally {


                button.disabled = false;

                button.textContent =
                    'APPLY COUPON';

            }

        }
    );


/* =========================================================
   SUPPORT + PAYMENT OVERLAY
========================================================= */

const SUPPORT = {
    phone: '+91 93116 05588',
    tel: '+919311605588',
    whatsapp: '919311605588',
    email: 'safeescapesolutions@gmail.com'
};

const PENDING_KEY = 'safeEscapePendingPayment';
const LAST_ORDER_KEY = 'safeEscapeLastOrder';

function escapeText(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
}

function injectOverlayStyles() {
    if (document.querySelector('#payOverlayStyles')) return;
    const style = document.createElement('style');
    style.id = 'payOverlayStyles';
    style.textContent = `
      .pay-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
        padding:20px;background:rgba(8,18,27,.72);backdrop-filter:blur(6px);font-family:inherit}
      .pay-overlay-box{width:min(440px,100%);background:#fff;border-radius:20px;padding:34px 28px;text-align:center;
        box-shadow:0 30px 80px rgba(0,0,0,.35)}
      .pay-overlay-icon{width:72px;height:72px;margin:0 auto 18px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;font-size:34px;font-weight:900;color:#fff;background:#11845f}
      .pay-overlay-icon.warn{background:#e08a12}
      .pay-overlay-icon.fail{background:#ee372f}
      .pay-spinner{width:46px;height:46px;margin:0 auto 18px;border-radius:50%;border:4px solid #e6eef1;
        border-top-color:#11845f;animation:paySpin .8s linear infinite}
      @keyframes paySpin{to{transform:rotate(360deg)}}
      .pay-overlay h3{margin:0 0 8px;font-size:22px;color:#08121b}
      .pay-overlay p{margin:0 0 6px;color:#5d6b75;font-size:14px;line-height:1.6}
      .pay-ref{display:inline-block;margin:10px 0 4px;padding:6px 12px;border-radius:8px;background:#f2f5f7;
        font-family:monospace;font-size:12px;color:#17232c;word-break:break-all}
      .pay-support{display:grid;gap:10px;margin-top:20px}
      .pay-support a,.pay-support button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;
        border-radius:10px;font-weight:800;font-size:13px;text-decoration:none;border:0;cursor:pointer}
      .pay-support .call{background:#ee372f;color:#fff}
      .pay-support .wa{background:#11845f;color:#fff}
      .pay-support .mail{background:#f2f5f7;color:#08121b}
      .pay-support .close{background:transparent;color:#5d6b75;min-height:36px}
    `;
    document.head.appendChild(style);
}

function overlay(html) {
    injectOverlayStyles();
    let el = document.querySelector('#payOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'payOverlay';
        el.className = 'pay-overlay';
        document.body.appendChild(el);
    }
    el.innerHTML = `<div class="pay-overlay-box">${html}</div>`;
    return el;
}

function closeOverlay() {
    document.querySelector('#payOverlay')?.remove();
}

function supportButtons({ orderRef = '', paymentId = '', reason = '' } = {}) {
    const msg = encodeURIComponent(
        `Hello SAFE ESCAPE, I need help with my payment.\n` +
        (orderRef ? `Order Ref: ${orderRef}\n` : '') +
        (paymentId ? `Payment ID: ${paymentId}\n` : '') +
        (reason ? `Issue: ${reason}` : '')
    );
    const subject = encodeURIComponent(`Payment help - ${orderRef || paymentId || 'SAFE ESCAPE order'}`);
    return `
      <div class="pay-support">
        <a class="call" href="tel:${SUPPORT.tel}">📞 Call Support ${SUPPORT.phone}</a>
        <a class="wa" href="https://wa.me/${SUPPORT.whatsapp}?text=${msg}" target="_blank" rel="noopener">💬 WhatsApp Us</a>
        <a class="mail" href="mailto:${SUPPORT.email}?subject=${subject}&body=${msg}">✉ ${SUPPORT.email}</a>
      </div>`;
}

function showPaymentFailed(reason, orderRef, paymentId) {
    const el = overlay(`
      <div class="pay-overlay-icon fail">!</div>
      <h3>Payment was not completed</h3>
      <p>${escapeText(reason || 'Your payment could not be processed.')}</p>
      <p>If money was deducted from your account, don't worry — it will be
         auto-refunded by your bank, or call us and we will help you immediately.</p>
      ${orderRef ? `<span class="pay-ref">Ref: ${escapeText(orderRef)}</span>` : ''}
      ${supportButtons({ orderRef, paymentId, reason })}
      <div class="pay-support"><button class="close" type="button" id="payOverlayClose">Close & try again</button></div>
    `);
    el.querySelector('#payOverlayClose')?.addEventListener('click', closeOverlay);
}


/* =========================================================
   VERIFY WITH TIMEOUT + RETRY
========================================================= */

async function verifyPayment(payload, attempts = 3) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch(endpoint('/verify-razorpay-payment'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch { /* non-JSON */ }

            if (res.ok && data.success) return data;

            lastError = new Error(data.message || `Verification returned ${res.status}`);

            // Wrong signature / token will never succeed on retry
            if ([400, 403, 404].includes(res.status)) break;

        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timer);
        }

        await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }

    throw lastError || new Error('Payment verification failed.');
}


/* =========================================================
   CHECKOUT / RAZORPAY
========================================================= */

const PAY_LABEL = 'PAY SECURELY WITH RAZORPAY →';

form?.addEventListener('submit', async event => {

    event.preventDefault();

    if (!cart) {
        showToast('Your cart is empty.');
        return;
    }

    if (!razorpayKeyId || razorpayKeyId.startsWith('YOUR_')) {
        showToast('Payment gateway is not configured yet.');
        return;
    }

    const button = form.querySelector('button[type="submit"]');
    const customer = Object.fromEntries(new FormData(form));

    const resetButton = () => {
        button.disabled = false;
        button.textContent = PAY_LABEL;
    };

    button.disabled = true;
    button.textContent = 'Creating secure payment…';

    try {

        /* Backend validates the coupon again before creating the order */
        const paymentCart = { ...cart, couponCode: cart.couponCode || '' };

        const response = await fetch(endpoint('/create-razorpay-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: paymentCart, customer })
        });

        const responseText = await response.text();
        let order;
        try {
            order = JSON.parse(responseText);
        } catch {
            throw new Error(`Backend returned ${response.status}: ${responseText || 'Invalid response'}`);
        }

        if (!response.ok) {
            throw new Error(order.message || 'Unable to start payment.');
        }

        let paymentHandled = false;
        let lastFailure = null;

        const rzp = new Razorpay({
            key: razorpayKeyId,
            amount: order.amount,
            currency: order.currency,
            name: 'SAFE ESCAPE',
            description: 'Your Rescue Partner™',
            order_id: order.razorpayOrderId,

            prefill: {
                name: customer.fullName,
                email: customer.email,
                contact: customer.mobile
            },

            notes: { orderRef: order.orderRef },

            /* ---------- PAYMENT SUCCESS ---------- */
            handler: async rzpResponse => {

                paymentHandled = true;

                const payload = {
                    ...rzpResponse,
                    orderRef: order.orderRef,
                    orderToken: order.orderToken
                };

                /* Save first — if the tab closes, Thank You page can finish the job */
                try {
                    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
                } catch { /* storage blocked */ }

                /* Cart is paid — clear it right away */
                localStorage.removeItem('safeEscapeCart');

                overlay(`
                  <div class="pay-spinner"></div>
                  <h3>Payment successful!</h3>
                  <p>Confirming your order… please don't close or refresh this page.</p>
                `);

                const successUrl = (ref, no, pending) =>
                    `./order-success.html?order=${encodeURIComponent(ref)}` +
                    (no ? `&orderNo=${encodeURIComponent(no)}` : '') +
                    (pending ? '&pending=1' : '');

                try {
                    const verified = await verifyPayment(payload);

                    try {
                        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({
                            ...verified.order,
                            orderRef: order.orderRef,
                            orderToken: order.orderToken
                        }));
                        localStorage.removeItem(PENDING_KEY);
                    } catch { /* storage blocked */ }

                    window.location.replace(
                        successUrl(order.orderRef, verified.orderNumber, false)
                    );

                } catch (error) {
                    console.error('Verification error:', error);

                    /* Money is captured by Razorpay. Never leave the customer stuck:
                       go to Thank You page in "confirming" mode with support details. */
                    window.location.replace(successUrl(order.orderRef, '', true));
                }
            },

            modal: {
                ondismiss: () => {
                    if (paymentHandled) return;
                    resetButton();
                    /* Customer closed Razorpay after a failed attempt -> show help */
                    if (lastFailure) {
                        showPaymentFailed(lastFailure.reason, order.orderRef, lastFailure.paymentId);
                    }
                }
            },

            theme: { color: '#ee372f' }
        });

        /* ---------- PAYMENT FAILED ---------- */
        rzp.on('payment.failed', resp => {
            const err = resp?.error || {};
            console.error('Razorpay payment failed:', err);
            /* Razorpay lets the customer retry inside its popup.
               We show our help screen when they close the popup. */
            lastFailure = {
                reason: err.description || err.reason || 'Payment failed.',
                paymentId: err.metadata?.payment_id || ''
            };
        });

        rzp.open();

    } catch (error) {
        console.error('Checkout Error:', error);
        showToast(error.message);
        resetButton();
    }
});
