import { saveCart } from './store.js';

document.addEventListener('DOMContentLoaded', () => {
  let quantity = 1;
  const quantityOut = document.querySelector('#homeQtyOut');
  const notify = message => window.showToast ? window.showToast(message) : alert(message);
  const buildCart = () => ({
    product: 'SAFE ESCAPE',
    floorIndex: 0,
    floorName: '3rd–4th Floor',
    length: 15,
    quantity,
    accessories: []
  });
  const updateQuantity = () => { if (quantityOut) quantityOut.textContent = quantity; };
  document.querySelector('#homeQtyMinus')?.addEventListener('click', () => { quantity = Math.max(1, quantity - 1); updateQuantity(); });
  document.querySelector('#homeQtyPlus')?.addEventListener('click', () => { quantity += 1; updateQuantity(); });
  document.querySelector('#homeAddCart')?.addEventListener('click', () => {
    saveCart(buildCart());
    notify('SAFE ESCAPE has been added to your cart.');
    window.location.href = 'cart.html';
  });
  document.querySelector('#homeBuyNow')?.addEventListener('click', () => {
    saveCart(buildCart());
    window.location.href = 'checkout.html';
  });
});

const videoModal = document.getElementById("videoModal");
const howVideo = document.getElementById("howVideo");
const closeVideo = document.getElementById("closeVideo");

// Aapka existing video open button
const watchVideoBtn = document.getElementById("watchVideoBtn");

watchVideoBtn.addEventListener("click", function () {

    // Modal Open
    videoModal.classList.add("active");

    // Video Load + Autoplay
    howVideo.src = howVideo.dataset.src;

});


// Close Button
closeVideo.addEventListener("click", function () {

    videoModal.classList.remove("active");

    // Video completely stop
    howVideo.src = "";

});


// Background par click karke close
videoModal.addEventListener("click", function (e) {

    if (e.target === videoModal) {

        videoModal.classList.remove("active");

        // Video stop
        howVideo.src = "";

    }

});