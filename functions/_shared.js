const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing in .env / Netlify environment variables.');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.firestore();
}

const floorLengths = [15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100];
const accessoryCatalog = {
  'adult-belt': {name:'Adult Safety Belt', price:1499},
  'child-belt': {name:'Child Safety Belt', price:1299},
  'gloves': {name:'Safety Gloves — Pair', price:199},
  'helmet': {name:'Safety Helmet', price:1299},
  'cover-box': {name:'SAFE ESCAPE Metal Covering Box', price:1999},
  'anchor-kit': {name:'Structural Anchor Kit', price:2499}
};

function json(statusCode, body) {
  return { statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(body) };
}
function validCustomer(c={}) {
  return ['fullName','mobile','email','address','city','state','pincode'].every(k => String(c[k]||'').trim());
}
function cleanCustomer(c={}) {
  const out={};
  for (const [k,v] of Object.entries(c)) out[k]=typeof v==='string'?v.trim():v;
  return out;
}
async function validateCoupon(db, code, amount) {
  const normalized=String(code||'').trim().toUpperCase();
  if(!normalized) return {valid:false,code:'',discount:0};
  const snap=await db.collection('coupons').doc(normalized).get();
  if(!snap.exists) return {valid:false,code:'',discount:0};
  const c=snap.data(), now=new Date();
  const date=v=>!v?null:(v.toDate?v.toDate():new Date(v));
  const start=date(c.startDate), end=date(c.expiryDate);
  if(c.active!==true || (start&&now<start) || (end&&now>end)) return {valid:false,code:'',discount:0};
  if(Number(c.minOrder||0)>amount) return {valid:false,code:'',discount:0};
  if(Number(c.usageLimit||0)>0 && Number(c.usedCount||0)>=Number(c.usageLimit)) return {valid:false,code:'',discount:0};
  let discount=c.discountType==='percent'?Math.round(amount*Number(c.discountValue||0)/100):Number(c.discountValue||0);
  if(Number(c.maxDiscount||0)>0) discount=Math.min(discount,Number(c.maxDiscount));
  discount=Math.max(0,Math.min(discount,amount));
  return {valid:discount>0,code:discount>0?normalized:'',discount};
}
async function serverPrice(db, cart={}) {
  const idx=Math.min(Math.max(Math.floor(Number(cart.floorIndex)||0),0),floorLengths.length-1);
  const qty=Math.max(1,Math.floor(Number(cart.quantity)||1));
  const unit=49999+idx*1250;
  const items=[]; let extras=0;
  for(const row of Array.isArray(cart.accessories)?cart.accessories:[]) {
    const item=accessoryCatalog[row?.id]; if(!item) continue;
    const quantity=Math.max(1,Math.floor(Number(row.quantity)||1));
    items.push({id:row.id,name:item.name,quantity,price:item.price}); extras+=item.price*quantity;
  }
  const product=unit*qty, subtotal=product+extras, bulk=qty>=5?Math.round(product*.10):0;
  const coupon=await validateCoupon(db,cart.couponCode,subtotal-bulk);
  return {floorIndex:idx,length:floorLengths[idx],quantity:qty,unit,items,product,extras,subtotal,bulk,couponCode:coupon.code,couponDiscount:coupon.discount,total:Math.max(0,subtotal-bulk-coupon.discount)};
}
module.exports={getDb,json,validCustomer,cleanCustomer,serverPrice,admin};
