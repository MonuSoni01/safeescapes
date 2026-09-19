export const basePrice = 49999;
export const floorOptions = [
  ['3rd–4th Floor',15],['5th–6th Floor',20],['7th–8th Floor',25],['9th–10th Floor',30],['11th–12th Floor',35],['13th–14th Floor',40],['15th–16th Floor',45],['17th–18th Floor',50],['19th–20th Floor',55],['21st–22nd Floor',60],['23rd–24th Floor',65],['25th–26th Floor',70],['27th–28th Floor',75],['29th–30th Floor',80],['31st–32nd Floor',85],['32nd–33rd Floor',90],['34th Floor',95],['34th–35th Floor',100]
];
export const accessories = [
  {id:'adult-belt',name:'Adult Safety Belt',price:1499},{id:'child-belt',name:'Child Safety Belt',price:1299},{id:'gloves',name:'Safety Gloves — Pair',price:199},{id:'helmet',name:'Safety Helmet',price:1299},{id:'cover-box',name:'SAFE ESCAPE Metal Covering Box',price:1999},{id:'anchor-kit',name:'Structural Anchor Kit',price:2499}
];
export const formatINR=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Math.round(Number(n)||0));
export const unitPriceFor=index=>basePrice+(Math.min(Math.max(Number(index)||0,0),floorOptions.length-1)*1250);
const positive=(v,fallback=1)=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>0?n:fallback};
export function normaliseCart(value){if(!value||typeof value!=='object')return null;const parsedIndex=Math.floor(Number(value.floorIndex)),floorIndex=Number.isFinite(parsedIndex)?Math.min(Math.max(parsedIndex,0),floorOptions.length-1):0;const selected=new Map();for(const row of Array.isArray(value.accessories)?value.accessories:[]){const item=accessories.find(x=>x.id===row?.id);if(item)selected.set(item.id,{...item,quantity:positive(row.quantity)})}return{product:'SAFE ESCAPE',floorIndex,floorName:floorOptions[floorIndex][0],length:floorOptions[floorIndex][1],quantity:positive(value.quantity),accessories:[...selected.values()],couponCode:typeof value.couponCode==='string'?value.couponCode.toUpperCase().trim():''}}
export function loadCart(){try{return normaliseCart(JSON.parse(localStorage.getItem('safeEscapeCart')))}catch{return null}}
export function saveCart(cart){const clean=normaliseCart(cart);if(clean)localStorage.setItem('safeEscapeCart',JSON.stringify(clean))}
export function calculateCart(cart,couponDiscount=0){const clean=normaliseCart(cart);if(!clean)return null;const unit=unitPriceFor(clean.floorIndex),product=unit*clean.quantity,extras=clean.accessories.reduce((sum,item)=>sum+item.price*item.quantity,0),subtotal=product+extras,bulk=clean.quantity>=5?Math.round(product*.10):0,coupon=Math.max(0,Math.min(Number(couponDiscount)||0,subtotal-bulk));return{...clean,unit,product,extras,subtotal,bulk,couponDiscount:coupon,total:Math.max(0,subtotal-bulk-coupon)}}
