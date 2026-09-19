// ======================================================
// SAFE ESCAPE - FRONTEND CONFIGURATION
// ======================================================


// ------------------------------------------------------
// FIREBASE
// ------------------------------------------------------

export const firebaseConfig = {
    apiKey: "AIzaSyBOA9Gj5Slk7e9BGyEGb8DWkUJXVjKilIM",
    authDomain: "safe-escape-89006.firebaseapp.com",
    projectId: "safe-escape-89006",
    storageBucket: "safe-escape-89006.firebasestorage.app",
    messagingSenderId: "626001854773",
    appId: "1:626001854773:web:6df939ff39cdeaed69cc7c"
};


// ------------------------------------------------------
// BACKEND API
// ------------------------------------------------------

// Netlify Functions will be used instead of Firebase Functions.
// Same Netlify website = keep this relative.
export const functionsBaseUrl = "/.netlify/functions";


// ------------------------------------------------------
// RAZORPAY - PUBLIC KEY
// ------------------------------------------------------

// Safe to use on frontend.
// NEVER put Razorpay Key Secret in this file.

export const razorpayKeyId = "rzp_test_Td0D48OuB6hjeT";


// ------------------------------------------------------
// BACKEND ENDPOINTS
// ------------------------------------------------------

export const apiEndpoints = {

    // Razorpay
    createRazorpayOrder:
        `${functionsBaseUrl}/create-razorpay-order`,

    verifyRazorpayPayment:
        `${functionsBaseUrl}/verify-razorpay-payment`,

    // Invoice
    generateInvoice:
        `${functionsBaseUrl}/generate-invoice`,

    // Shiprocket
    createShipment:
        `${functionsBaseUrl}/create-shipment`,

    trackShipment:
        `${functionsBaseUrl}/track-shipment`,

    // Email
    sendOrderEmail:
        `${functionsBaseUrl}/send-order-email`
};


// ------------------------------------------------------
// GOOGLE SHEET / APPS SCRIPT
// ------------------------------------------------------

export const googleSheetWebAppUrl =
    "https://script.google.com/macros/s/AKfycbySYJgoWYSoSM8Gw-fTWBV1bo2ryMSkkJQH_mZaWcJs66_PTXPUZrHDI60GtkwgzvZI/exec";