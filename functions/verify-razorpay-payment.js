const crypto = require('crypto');

const {
    getDb,
    json,
    admin
} = require('./_shared');


/* =========================================================
   SAFE ESCAPE
   RAZORPAY PAYMENT VERIFICATION

   FINAL FLOW:

   Razorpay Payment
        ↓
   Signature Verification
        ↓
   Firestore = PAID
        ↓
   Order Number = SE0001
        ↓
   Shiprocket
        ↓
   Google Apps Script
        ↓
   Google Sheet
        ↓
   PDF Invoice
        ↓
   Google Drive
        ↓
   Customer Email
        ↓
   Firestore Final Status
        ↓
   Success Response
========================================================= */


/* =========================================================
   SECURE STRING COMPARISON
========================================================= */

function secureEqual(a, b) {

    const A =
        Buffer.from(
            String(a || '')
        );

    const B =
        Buffer.from(
            String(b || '')
        );


    return (
        A.length === B.length &&
        crypto.timingSafeEqual(A, B)
    );
}


/* =========================================================
   ORDER NUMBER GENERATOR

   SE0001
   SE0002
   SE0003
   ...
========================================================= */

async function getOrCreateOrderNumber(
    db,
    orderRef
) {

    return await db.runTransaction(
        async transaction => {


            /* ---------------------------------------------
               GET ORDER
            --------------------------------------------- */

            const orderSnap =
                await transaction.get(
                    orderRef
                );


            if (!orderSnap.exists) {

                throw new Error(
                    'Order not found.'
                );

            }


            const orderData =
                orderSnap.data() || {};


            /* ---------------------------------------------
               ALREADY GENERATED?

               Important:
               Repeated Razorpay verification should NOT
               generate another order number.
            --------------------------------------------- */

            if (orderData.orderNumber) {

                return orderData.orderNumber;

            }


            /* ---------------------------------------------
               GLOBAL COUNTER
            --------------------------------------------- */

            const counterRef =
                db
                    .collection('system')
                    .doc('orderCounter');


            const counterSnap =
                await transaction.get(
                    counterRef
                );


            const currentNumber =
                counterSnap.exists
                    ? Number(
                        counterSnap.data()
                            .lastNumber || 0
                    )
                    : 0;


            const nextNumber =
                currentNumber + 1;


            const orderNumber =
                `SE${String(
                    nextNumber
                ).padStart(
                    4,
                    '0'
                )}`;


            /* ---------------------------------------------
               SAVE NEW COUNTER
            --------------------------------------------- */

            transaction.set(
                counterRef,
                {

                    lastNumber:
                        nextNumber,

                    updatedAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                },
                {

                    merge:
                        true

                }
            );


            /* ---------------------------------------------
               SAVE ORDER NUMBER
            --------------------------------------------- */

            transaction.set(
                orderRef,
                {

                    orderNumber

                },
                {

                    merge:
                        true

                }
            );


            return orderNumber;

        }
    );
}


/* =========================================================
   INVOICE NUMBER

   Example:

   INV-2026-SE0001
========================================================= */

function createInvoiceNumber(
    orderNumber
) {

    const year =
        new Date().getFullYear();


    return (
        `INV-${year}-${orderNumber}`
    );
}


/* =========================================================
   SHIPROCKET
========================================================= */

async function shiprocket(order) {


    /* =====================================================
       ENVIRONMENT
    ====================================================== */

    const email =
        process.env
            .SHIPROCKET_EMAIL;


    const password =
        process.env
            .SHIPROCKET_PASSWORD;


    const pickup =
        process.env
            .SHIPROCKET_PICKUP_LOCATION;


    /* =====================================================
       NOT CONFIGURED

       Don't fail customer payment.
    ====================================================== */

    if (
        !email ||
        !password ||
        !pickup
    ) {

        return {

            status:
                'not_configured',

            shiprocketOrderId:
                '',

            shipmentId:
                '',

            awb:
                '',

            courier:
                '',

            trackingUrl:
                ''

        };

    }


    /* =====================================================
       SHIPROCKET LOGIN
    ====================================================== */

    const authResponse =
        await fetch(
            'https://apiv2.shiprocket.in/v1/external/auth/login',
            {

                method:
                    'POST',

                headers: {

                    'Content-Type':
                        'application/json'

                },

                body:
                    JSON.stringify({

                        email,
                        password

                    })

            }
        );


    if (!authResponse.ok) {

        const authText =
            await authResponse.text();


        throw new Error(
            `Shiprocket login failed (${authResponse.status}): ${authText.slice(0, 200)}`
        );

    }


    const authData =
        await authResponse.json();


    const token =
        authData.token;


    if (!token) {

        throw new Error(
            'Shiprocket authentication token missing.'
        );

    }


    /* =====================================================
       ORDER DATA
    ====================================================== */

    const customer =
        order.customer || {};


    const pricing =
        order.pricing || {};


    const cart =
        order.cart || {};


    const orderLength =
        cart.length || '';


    const quantity =
        Number(
            cart.quantity || 1
        );


    /* =====================================================
       SHIPROCKET PAYLOAD
    ====================================================== */

    const payload = {


        /* ---------------------------------------------
           USE CUSTOMER-FRIENDLY ORDER NUMBER
        --------------------------------------------- */

        order_id:
            order.orderNumber,


        order_date:
            new Date()
                .toISOString()
                .slice(0, 19)
                .replace(
                    'T',
                    ' '
                ),


        pickup_location:
            pickup,


        /* ---------------------------------------------
           BILLING DETAILS
        --------------------------------------------- */

        billing_customer_name:
            customer.fullName ||
            'Customer',


        billing_last_name:
            '',


        billing_address:
            customer.address ||
            customer.installationAddress ||
            '',


        billing_city:
            customer.city ||
            '',


        billing_pincode:
            String(
                customer.pincode ||
                ''
            ),


        billing_state:
            customer.state ||
            '',


        billing_country:
            'India',


        billing_email:
            customer.email ||
            '',


        billing_phone:
            String(
                customer.mobile ||
                ''
            ),


        /* ---------------------------------------------
           SHIPPING = BILLING
        --------------------------------------------- */

        shipping_is_billing:
            true,


        /* ---------------------------------------------
           PRODUCT
        --------------------------------------------- */

        order_items: [

            {

                name:
                    orderLength
                        ? `SAFE ESCAPE ${orderLength}m`
                        : 'SAFE ESCAPE',


                sku:
                    orderLength
                        ? `SAFE-ESCAPE-${orderLength}M`
                        : 'SAFE-ESCAPE',


                units:
                    quantity,


                selling_price:
                    Number(
                        pricing.total ||
                        0
                    ),


                discount:
                    0,


                tax:
                    0,


                hsn:
                    ''

            }

        ],


        /* ---------------------------------------------
           PREPAID
        --------------------------------------------- */

        payment_method:
            'Prepaid',


        sub_total:
            Number(
                pricing.total ||
                0
            ),


        /* ---------------------------------------------
           PACKAGE
        --------------------------------------------- */

        length:
            Number(
                process.env
                    .SHIPROCKET_PACKAGE_LENGTH_CM ||
                50
            ),


        breadth:
            Number(
                process.env
                    .SHIPROCKET_PACKAGE_BREADTH_CM ||
                30
            ),


        height:
            Number(
                process.env
                    .SHIPROCKET_PACKAGE_HEIGHT_CM ||
                20
            ),


        weight:
            Number(
                process.env
                    .SHIPROCKET_PACKAGE_WEIGHT_KG ||
                5
            )

    };


    /* =====================================================
       CREATE SHIPROCKET ORDER
    ====================================================== */

    const response =
        await fetch(
            'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
            {

                method:
                    'POST',

                headers: {

                    'Content-Type':
                        'application/json',

                    Authorization:
                        `Bearer ${token}`

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    const responseText =
        await response.text();


    let data = {};


    try {

        data =
            JSON.parse(
                responseText
            );

    }

    catch {

        data = {};

    }


    if (!response.ok) {

        throw new Error(
            data.message ||
            `Shiprocket order failed (${response.status}): ${responseText.slice(0, 200)}`
        );

    }


    /* =====================================================
       RETURN SHIPPING DATA
    ====================================================== */

    return {

        status:
            'created',


        shiprocketOrderId:
            data.order_id ||
            '',


        shipmentId:
            data.shipment_id ||
            '',


        awb:
            data.awb_code ||
            '',


        courier:
            data.courier_name ||
            '',


        trackingUrl:
            data.awb_code
                ? `https://shiprocket.co/tracking/${encodeURIComponent(
                    data.awb_code
                )}`
                : ''

    };

}


/* =========================================================
   GOOGLE APPS SCRIPT

   IMPORTANT:

   Netlify DOES NOT create PDF anymore.

   Google Apps Script will:

   1. Save Google Sheet
   2. Create PDF
   3. Save PDF to Drive
   4. Email PDF to customer
========================================================= */

async function appsScript(order) {


    const url =
        process.env
            .GOOGLE_APPS_SCRIPT_ORDER_URL;


    const secret =
        process.env
            .GOOGLE_APPS_SCRIPT_SECRET;


    /* =====================================================
       NOT CONFIGURED
    ====================================================== */

    if (
        !url ||
        !secret
    ) {

        return {

            status:
                'not_configured',

            sheetStatus:
                'not_configured',

            invoiceStatus:
                'not_configured',

            invoiceUrl:
                '',

            emailStatus:
                'not_configured',

            emailSentAt:
                ''

        };

    }


    /* =====================================================
       PAYLOAD
    ====================================================== */

    const payload = {

        action:
            'finalizeOrder',

        secret,

        order

    };


    /* =====================================================
       CALL APPS SCRIPT
    ====================================================== */

    const response =
        await fetch(
            url,
            {

                method:
                    'POST',

                headers: {

                    /*
                     text/plain avoids unnecessary
                     Apps Script CORS/preflight issues.
                    */

                    'Content-Type':
                        'text/plain;charset=utf-8'

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    const text =
        await response.text();


    /* =====================================================
       PARSE RESPONSE
    ====================================================== */

    let data;


    try {

        data =
            JSON.parse(
                text
            );

    }

    catch {

        throw new Error(
            `Apps Script invalid response: ${text.slice(0, 200)}`
        );

    }


    /* =====================================================
       APPS SCRIPT ERROR
    ====================================================== */

    if (
        !response.ok ||
        data.success === false
    ) {

        throw new Error(
            data.message ||
            'Google Apps Script automation failed.'
        );

    }


    return data;

}


/* =========================================================
   NETLIFY FUNCTION
========================================================= */

exports.handler =
async (event) => {


    /* =====================================================
       ONLY POST REQUEST
    ====================================================== */

    if (
        event.httpMethod !==
        'POST'
    ) {

        return json(
            405,
            {

                success:
                    false,

                message:
                    'Method not allowed'

            }
        );

    }


    try {


        /* =================================================
           PARSE REQUEST
        ================================================== */

        let body;


        try {

            body =
                JSON.parse(
                    event.body ||
                    '{}'
                );

        }

        catch {

            return json(
                400,
                {

                    success:
                        false,

                    message:
                        'Invalid request body.'

                }
            );

        }


        const {

            razorpay_order_id,

            razorpay_payment_id,

            razorpay_signature,

            orderRef,

            orderToken

        } = body;


        /* =================================================
           REQUIRED DATA
        ================================================== */

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !orderRef ||
            !orderToken
        ) {

            return json(
                400,
                {

                    success:
                        false,

                    message:
                        'Missing payment verification data.'

                }
            );

        }


        /* =================================================
           RAZORPAY SECRET
        ================================================== */

        const razorpaySecret =
            process.env
                .RAZORPAY_KEY_SECRET;


        if (!razorpaySecret) {

            throw new Error(
                'RAZORPAY_KEY_SECRET is missing.'
            );

        }


        /* =================================================
           VERIFY RAZORPAY SIGNATURE
        ================================================== */

        const expectedSignature =
            crypto
                .createHmac(
                    'sha256',
                    razorpaySecret
                )
                .update(
                    `${razorpay_order_id}|${razorpay_payment_id}`
                )
                .digest(
                    'hex'
                );


        if (
            !secureEqual(
                expectedSignature,
                razorpay_signature
            )
        ) {

            return json(
                400,
                {

                    success:
                        false,

                    message:
                        'Invalid Razorpay payment signature.'

                }
            );

        }


        /* =================================================
           FIRESTORE
        ================================================== */

        const db =
            getDb();


        const ref =
            db
                .collection('orders')
                .doc(orderRef);


        const snapshot =
            await ref.get();


        if (!snapshot.exists) {

            return json(
                404,
                {

                    success:
                        false,

                    message:
                        'Order not found.'

                }
            );

        }


        let order =
            snapshot.data() || {};


        /* =================================================
           VERIFY ORDER TOKEN
        ================================================== */

        const tokenHash =
            crypto
                .createHash(
                    'sha256'
                )
                .update(
                    String(orderToken)
                )
                .digest(
                    'hex'
                );


        if (
            !secureEqual(
                tokenHash,
                order.orderTokenHash
            )
        ) {

            return json(
                403,
                {

                    success:
                        false,

                    message:
                        'Invalid order token.'

                }
            );

        }


        /* =================================================
           VERIFY RAZORPAY ORDER ID
        ================================================== */

        if (
            order.razorpayOrderId !==
            razorpay_order_id
        ) {

            return json(
                400,
                {

                    success:
                        false,

                    message:
                        'Razorpay order mismatch.'

                }
            );

        }


        /* =================================================
           PAYMENT VERIFIED

           CRITICAL SECTION

           Once this successfully saves "paid",
           secondary services cannot turn this
           payment into a failed checkout.
        ================================================== */

        const wasAlreadyPaid =
            order.status ===
            'paid';


        if (!wasAlreadyPaid) {

            await ref.update({

                status:
                    'paid',

                razorpayPaymentId:
                    razorpay_payment_id,

                paidAt:
                    admin.firestore
                        .FieldValue
                        .serverTimestamp()

            });


            /* =============================================
               COUPON USAGE

               Only increment once.
            ============================================== */

            if (
                order.cart &&
                order.cart.couponCode
            ) {

                try {

                    await db
                        .collection(
                            'coupons'
                        )
                        .doc(
                            order.cart
                                .couponCode
                        )
                        .set(
                            {

                                usedCount:
                                    admin.firestore
                                        .FieldValue
                                        .increment(1),

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            },
                            {

                                merge:
                                    true

                            }
                        );

                }

                catch (couponError) {

                    console.error(
                        'COUPON UPDATE ERROR:',
                        couponError
                    );

                }

            }

        }


        /* =================================================
           ORDER NUMBER

           SE0001
           SE0002
           ...
        ================================================== */

        let orderNumber;


        try {

            orderNumber =
                await getOrCreateOrderNumber(
                    db,
                    ref
                );

        }

        catch (orderNumberError) {

            console.error(
                'ORDER NUMBER ERROR:',
                orderNumberError
            );


            /*
             Fallback only.

             Payment must not fail because
             numbering service failed.
            */

            orderNumber =
                order.orderNumber ||
                `SE-${String(
                    orderRef
                )
                    .slice(
                        0,
                        8
                    )
                    .toUpperCase()
                }`;

        }


        /* =================================================
           INVOICE NUMBER
        ================================================== */

        const invoiceNumber =
            order.invoiceNumber ||
            createInvoiceNumber(
                orderNumber
            );


        /* =================================================
           BUILD FINAL ORDER OBJECT
        ================================================== */

        order = {

            ...order,

            orderId:
                orderRef,

            orderNumber,

            invoiceNumber,

            status:
                'paid',

            razorpayPaymentId:
                razorpay_payment_id

        };


        /* =================================================
           SAVE NUMBER BEFORE EXTERNAL SERVICES
        ================================================== */

        try {

            await ref.set(
                {

                    orderNumber,

                    invoiceNumber,

                    status:
                        'paid',

                    razorpayPaymentId:
                        razorpay_payment_id

                },
                {

                    merge:
                        true

                }
            );

        }

        catch (saveNumberError) {

            console.error(
                'ORDER NUMBER SAVE ERROR:',
                saveNumberError
            );

        }


        /* =================================================
           SHIPROCKET

           NON-FATAL
        ================================================== */

        let shipping = {

            status:
                'pending',

            shiprocketOrderId:
                '',

            shipmentId:
                '',

            awb:
                '',

            courier:
                '',

            trackingUrl:
                ''

        };


        try {

            /*
             If Shiprocket already created,
             don't create duplicate order.
            */

            if (
                order.shipping &&
                order.shipping.status ===
                    'created'
            ) {

                shipping =
                    order.shipping;

            }

            else {

                shipping =
                    await shiprocket(
                        order
                    );

            }

        }

        catch (shippingError) {

            console.error(
                'SHIPROCKET ERROR:',
                shippingError
            );


            shipping = {

                status:
                    'failed',

                shiprocketOrderId:
                    '',

                shipmentId:
                    '',

                awb:
                    '',

                courier:
                    '',

                trackingUrl:
                    '',

                error:
                    shippingError.message ||
                    'Shiprocket failed.'

            };

        }


        /* =================================================
           ADD SHIPPING TO ORDER
        ================================================== */

        order = {

            ...order,

            shipping

        };


        /* =================================================
           SAVE SHIPPING BEFORE GOOGLE AUTOMATION
        ================================================== */

        try {

            await ref.set(
                {

                    shipping,

                    shippingStatus:
                        shipping.status,

                    postOrderUpdatedAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                },
                {

                    merge:
                        true

                }
            );

        }

        catch (shippingSaveError) {

            console.error(
                'SHIPPING FIRESTORE UPDATE ERROR:',
                shippingSaveError
            );

        }


        /* =================================================
           GOOGLE AUTOMATION

           GOOGLE APPS SCRIPT WILL:

           1. SAVE GOOGLE SHEET
           2. CREATE PDF
           3. SAVE PDF TO DRIVE
           4. SEND PDF EMAIL

           NON-FATAL
        ================================================== */

        let sync = {

            status:
                'pending',

            sheetStatus:
                'pending',

            invoiceStatus:
                'pending',

            invoiceUrl:
                '',

            emailStatus:
                'pending',

            emailSentAt:
                ''

        };


        try {

            sync =
                await appsScript(
                    order
                );

        }

        catch (googleError) {

            console.error(
                'GOOGLE AUTOMATION ERROR:',
                googleError
            );


            sync = {

                status:
                    'failed',

                sheetStatus:
                    'failed',

                invoiceStatus:
                    'failed',

                invoiceUrl:
                    '',

                emailStatus:
                    'failed',

                emailSentAt:
                    '',

                error:
                    googleError.message ||
                    'Google automation failed.'

            };

        }


        /* =================================================
           FINAL FIRESTORE UPDATE

           NON-FATAL
        ================================================== */

        try {

            await ref.set(
                {

                    orderNumber,

                    invoiceNumber,

                    status:
                        'paid',

                    paymentStatus:
                        'paid',

                    razorpayPaymentId:
                        razorpay_payment_id,

                    shipping,

                    shippingStatus:
                        shipping.status,

                    sheetStatus:
                        sync.sheetStatus ||
                        sync.status ||
                        'pending',

                    invoiceStatus:
                        sync.invoiceStatus ||
                        'pending',

                    invoiceDriveUrl:
                        sync.invoiceUrl ||
                        '',

                    emailStatus:
                        sync.emailStatus ||
                        'pending',

                    emailSentAt:
                        sync.emailSentAt ||
                        '',

                    postOrderUpdatedAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                },
                {

                    merge:
                        true

                }
            );

        }

        catch (finalUpdateError) {

            /*
             PAYMENT IS ALREADY PAID.

             Never return 500 because this
             secondary update failed.
            */

            console.error(
                'FINAL FIRESTORE UPDATE ERROR:',
                finalUpdateError
            );

        }


        /* =================================================
           FINAL SUCCESS RESPONSE

           Customer can now go to:
           order-success.html

           even if:
           - Shiprocket failed
           - Google Sheet failed
           - PDF failed
           - Email failed
        ================================================== */

        return json(
            200,
            {

                success:
                    true,

                paymentStatus:
                    'paid',

                orderId:
                    orderRef,

                orderNumber,

                invoiceNumber,

                shipping,

                sheetStatus:
                    sync.sheetStatus ||
                    sync.status ||
                    'pending',

                invoiceStatus:
                    sync.invoiceStatus ||
                    'pending',

                invoiceUrl:
                    sync.invoiceUrl ||
                    '',

                emailStatus:
                    sync.emailStatus ||
                    'pending',

                emailSentAt:
                    sync.emailSentAt ||
                    '',

                sync

            }
        );


    }

    catch (error) {


        /* =================================================
           CRITICAL FAILURE

           Only errors BEFORE payment is safely handled
           should normally reach here.
        ================================================== */

        console.error(
            'PAYMENT VERIFICATION ERROR:',
            error
        );


        return json(
            500,
            {

                success:
                    false,

                message:
                    error.message ||
                    'Payment verification failed.'

            }
        );

    }

};