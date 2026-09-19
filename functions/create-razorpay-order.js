const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getDb, json, validCustomer, cleanCustomer, serverPrice, admin } = require('./_shared');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, message: 'Method not allowed' });
  try {
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay credentials are missing.');
    const { cart, customer } = JSON.parse(event.body || '{}');
    if (!cart || !validCustomer(customer)) return json(400, { success: false, message: 'Complete customer and shipping details are required.' });
    const db = getDb(); const pricing = await serverPrice(db, cart);
    if (pricing.total < 1) return json(400, { success: false, message: 'Invalid order total.' });
    const ref = db.collection('orders').doc();
    const orderToken = crypto.randomBytes(24).toString('hex');
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const ro = await razorpay.orders.create({ amount: pricing.total * 100, currency: 'INR', receipt: ref.id, notes: { orderRef: ref.id, source: 'SAFE ESCAPE Website' } });
    await ref.set({ orderId: ref.id, orderTokenHash: crypto.createHash('sha256').update(orderToken).digest('hex'), customer: cleanCustomer(customer), cart: { product: 'SAFE ESCAPE', floorIndex: pricing.floorIndex, length: pricing.length, quantity: pricing.quantity, accessories: pricing.items, couponCode: pricing.couponCode }, pricing, razorpayOrderId: ro.id, amountPaise: ro.amount, currency: ro.currency, status: 'payment_pending', sheetStatus: 'pending', invoiceStatus: 'pending', emailStatus: 'pending', shippingStatus: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return json(200, { success: true, orderRef: ref.id, orderToken, razorpayOrderId: ro.id, amount: ro.amount, currency: ro.currency, pricing });
  } catch (e) { console.error(e); return json(500, { success: false, message: e.message || 'Unable to create Razorpay order.' }); }
};
