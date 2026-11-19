/* =========================================================
   SAFE ESCAPE — POST-PAYMENT AUTOMATION
   Shiprocket + Google Apps Script (Sheet, PDF invoice, Email)

   These run AFTER the customer already sees the Thank You page,
   so they never slow down the payment confirmation.
========================================================= */

async function fetchWithTimeout(url, options = {}, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const EMPTY_SHIPPING = {
  status: 'pending', shiprocketOrderId: '', shipmentId: '', awb: '', courier: '', trackingUrl: ''
};

/* ---------------- SHIPROCKET ---------------- */

async function shiprocket(order) {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  const pickup = process.env.SHIPROCKET_PICKUP_LOCATION;

  if (!email || !password || !pickup) {
    return { ...EMPTY_SHIPPING, status: 'not_configured' };
  }

  const authResponse = await fetchWithTimeout(
    'https://apiv2.shiprocket.in/v1/external/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    },
    6000
  );

  if (!authResponse.ok) {
    const authText = await authResponse.text();
    throw new Error(`Shiprocket login failed (${authResponse.status}): ${authText.slice(0, 200)}`);
  }

  const { token } = await authResponse.json();
  if (!token) throw new Error('Shiprocket authentication token missing.');

  const customer = order.customer || {};
  const pricing = order.pricing || {};
  const cart = order.cart || {};
  const orderLength = cart.length || '';
  const quantity = Math.max(1, Number(cart.quantity || 1));
  const total = Number(pricing.total || 0);

  const payload = {
    order_id: order.orderNumber,
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickup,

    billing_customer_name: customer.fullName || 'Customer',
    billing_last_name: '',
    billing_address: customer.address || customer.installationAddress || '',
    billing_city: customer.city || '',
    billing_pincode: String(customer.pincode || ''),
    billing_state: customer.state || '',
    billing_country: 'India',
    billing_email: customer.email || '',
    billing_phone: String(customer.mobile || ''),
    shipping_is_billing: true,

    order_items: [{
      name: orderLength ? `SAFE ESCAPE ${orderLength}m` : 'SAFE ESCAPE',
      sku: orderLength ? `SAFE-ESCAPE-${orderLength}M` : 'SAFE-ESCAPE',
      units: quantity,
      // per-unit price so Shiprocket's total = amount paid
      selling_price: Math.round(total / quantity),
      discount: 0,
      tax: 0,
      hsn: ''
    }],

    payment_method: 'Prepaid',
    sub_total: total,

    length: Number(process.env.SHIPROCKET_PACKAGE_LENGTH_CM || 50),
    breadth: Number(process.env.SHIPROCKET_PACKAGE_BREADTH_CM || 30),
    height: Number(process.env.SHIPROCKET_PACKAGE_HEIGHT_CM || 20),
    weight: Number(process.env.SHIPROCKET_PACKAGE_WEIGHT_KG || 5)
  };

  const response = await fetchWithTimeout(
    'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    },
    7000
  );

  const responseText = await response.text();
  let data = {};
  try { data = JSON.parse(responseText); } catch { data = {}; }

  if (!response.ok) {
    throw new Error(data.message || `Shiprocket order failed (${response.status}): ${responseText.slice(0, 200)}`);
  }

  return {
    status: 'created',
    shiprocketOrderId: data.order_id || '',
    shipmentId: data.shipment_id || '',
    awb: data.awb_code || '',
    courier: data.courier_name || '',
    trackingUrl: data.awb_code
      ? `https://shiprocket.co/tracking/${encodeURIComponent(data.awb_code)}`
      : ''
  };
}

/* ---------------- GOOGLE APPS SCRIPT ----------------
   Apps Script will: save Google Sheet, create PDF invoice,
   save PDF to Drive, email the customer.
------------------------------------------------------ */

async function appsScript(order) {
  const url = process.env.GOOGLE_APPS_SCRIPT_ORDER_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (!url || !secret) {
    return {
      status: 'not_configured', sheetStatus: 'not_configured', invoiceStatus: 'not_configured',
      invoiceUrl: '', emailStatus: 'not_configured', emailSentAt: ''
    };
  }

  // Never send internal secrets to Apps Script
  const { orderTokenHash, ...safeOrder } = order;

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        // text/plain avoids Apps Script CORS/preflight issues
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'finalizeOrder', secret, order: safeOrder })
      },
      8500 // stay inside Netlify's 10s function limit
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      // Apps Script keeps running on Google's side even if we stop waiting.
      return {
        status: 'submitted', sheetStatus: 'submitted', invoiceStatus: 'submitted',
        invoiceUrl: '', emailStatus: 'submitted', emailSentAt: ''
      };
    }
    throw error;
  }

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Apps Script invalid response: ${text.slice(0, 200)}`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Google Apps Script automation failed.');
  }

  return data;
}

module.exports = { shiprocket, appsScript, EMPTY_SHIPPING };
