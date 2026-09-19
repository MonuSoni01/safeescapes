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
                ${
                    s.bulk
                    ? '−' + formatINR(s.bulk)
                    : '₹0'
                }
            </b>

        </div>


        <div class="summary-row">

            <span>
                Coupon
                ${
                    cart.couponCode
                    ? `(${cart.couponCode})`
                    : ''
                }
            </span>

            <b>
                ${
                    s.couponDiscount
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
   CHECKOUT / RAZORPAY
========================================================= */

form?.addEventListener(
    'submit',
    async event => {


        event.preventDefault();


        if (!cart) {

            showToast(
                'Your cart is empty.'
            );

            return;

        }


        if (
            !razorpayKeyId ||
            razorpayKeyId.startsWith(
                'YOUR_'
            )
        ) {

            showToast(
                'Payment gateway is not configured yet.'
            );

            return;

        }


        const button =
            form.querySelector(
                'button[type="submit"]'
            );


        const customer =
            Object.fromEntries(
                new FormData(form)
            );


        button.disabled = true;

        button.textContent =
            'Creating secure payment…';


        try {


            /*
             IMPORTANT:
             Send coupon code to backend.

             Backend MUST validate coupon again
             before creating Razorpay order.
            */

            const paymentCart = {

                ...cart,

                couponCode:
                    cart.couponCode || ''

            };


            const response =
    await fetch(
        endpoint(
            '/create-razorpay-order'
        ), 
                    {

                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({

                                cart:
                                    paymentCart,

                                customer

                            })

                    }
                );


            const responseText = await response.text();
            let order;
            try {
                order = JSON.parse(responseText);
            } catch {
                throw new Error(`Backend returned ${response.status}: ${responseText || 'Invalid response'}`);
            }


            if (!response.ok) {

                throw new Error(
                    order.message ||
                    'Unable to start payment.'
                );

            }


            /* =====================================================
               RAZORPAY
            ====================================================== */

            new Razorpay({

                key:
                    razorpayKeyId,

                amount:
                    order.amount,

                currency:
                    order.currency,

                name:
                    'SAFE ESCAPE',

                description:
                    'Your Rescue Partner™',

                order_id:
                    order.razorpayOrderId,


                prefill: {

                    name:
                        customer.fullName,

                    email:
                        customer.email,

                    contact:
                        customer.mobile

                },


                handler:
                    async response => {


                        button.textContent =
                            'Confirming payment…';


                        try {


                            const verifyResponse =
                                await fetch(
                                    endpoint(
                                        '/verify-razorpay-payment'
                                    ),
                                    {

                                        method:
                                            'POST',

                                        headers: {

                                            'Content-Type':
                                                'application/json'

                                        },

                                        body:
                                            JSON.stringify({

                                                ...response,

                                                orderRef:
                                                    order.orderRef,

                                                orderToken:
                                                    order.orderToken

                                            })

                                    }
                                );


                            const verifyText = await verifyResponse.text();
                            let verified;
                            try {
                                verified = JSON.parse(verifyText);
                            } catch {
                                throw new Error(`Verification returned ${verifyResponse.status}: ${verifyText || 'Invalid response'}`);
                            }


                            if (
                                !verifyResponse.ok
                            ) {

                                throw new Error(
                                    verified.message ||
                                    'Payment verification failed.'
                                );

                            }


                            /* CLEAR CART */

                            localStorage.removeItem(
                                'safeEscapeCart'
                            );


                            location.href =
                                `order-success.html?order=${
                                    encodeURIComponent(
                                        verified.orderId
                                    )
                                }`;


                        }

                        catch (error) {


                            console.error(
                                error
                            );


                            showToast(
                                'Payment received but confirmation is being checked. Reference: ' +
                                order.orderRef
                            );


                            button.disabled =
                                false;


                            button.textContent =
                                'PAY SECURELY WITH RAZORPAY →';

                        }

                    },


                modal: {

                    ondismiss: () => {

                        button.disabled =
                            false;

                        button.textContent =
                            'PAY SECURELY WITH RAZORPAY →';

                    }

                },


                theme: {

                    color:
                        '#ee372f'

                }

            }).open();


        }

        catch (error) {


            console.error(
                'Checkout Error:',
                error
            );


            showToast(
                error.message
            );


            button.disabled =
                false;


            button.textContent =
                'PAY SECURELY WITH RAZORPAY →';

        }

    }
);