/* =========================================================
   SAFE ESCAPE PRODUCT PAGE
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* =====================================================
     INSTALLATION FLOORS
  ===================================================== */

  const floors = [
    ['3rd–4th Floor', 15],
    ['5th–6th Floor', 20],
    ['7th–8th Floor', 25],
    ['9th–10th Floor', 30],
    ['11th–12th Floor', 35],
    ['13th–14th Floor', 40],
    ['15th–16th Floor', 45],
    ['17th–18th Floor', 50],
    ['19th–20th Floor', 55],
    ['21st–22nd Floor', 60],
    ['23rd–24th Floor', 65],
    ['25th–26th Floor', 70],
    ['27th–28th Floor', 75],
    ['29th–30th Floor', 80],
    ['31st–32nd Floor', 85],
    ['33rd–34th Floor', 90],
    ['35th–36th Floor', 95],
    ['37th–38th Floor', 100]
  ];


  /* =====================================================
     ACCESSORY CATALOG
  ===================================================== */

  const catalog = {

    'Adult Safety Belt-Orange': {
      id: 'adult-belt',
      price: 1499
    },

    'Child Safety Belt': {
      id: 'child-belt',
      price: 1299
    },

    'Gloves per pair': {
      id: 'gloves',
      price: 199
    },

    'Safety Helmet': {
      id: 'helmet',
      price: 1299
    },

    'SAFE ESCAPE Covering Box': {
      id: 'cover-box',
      price: 1999
    }

  };


  /* =====================================================
     ELEMENTS
  ===================================================== */

  const floorSelect =
    document.querySelector('#floorSelect');

  const plusButton =
    document.querySelector('#plus');

  const minusButton =
    document.querySelector('#minus');

  const addCartButton =
    document.querySelector('#addCart');

  const buyNowButton =
    document.querySelector('#buyNow');

  const summaryBuyNowButton =
    document.querySelector('#summaryBuyNow');

  const cartPopup =
    document.querySelector('#cartPopup');

  const popupBuyNowButton =
    document.querySelector('#popupBuyNow');


  /* =====================================================
     GALLERY / VIDEO ELEMENTS
  ===================================================== */

  const mainImage =
    document.querySelector('#mainImage');

  const videoModal =
    document.querySelector('#videoModal');

  const howVideo =
    document.querySelector('#howVideo');

  const closeVideo =
    document.querySelector('#closeVideo');


  /* =====================================================
     STATE
  ===================================================== */

  let quantity = 1;
  let selectedAccessories = [];


  /* =====================================================
     HELPERS
  ===================================================== */

  const money = amount => {

    return `₹${Math.round(
      Number(amount) || 0
    ).toLocaleString('en-IN')}`;

  };


  const setText = (selector, value) => {

    const element =
      document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }

  };


  /* =====================================================
     BUILD FLOOR DROPDOWN
  ===================================================== */

  if (floorSelect) {

    floorSelect.innerHTML =
      floors.map(
        ([floor, length], index) => `
          <option value="${index}">
            ${floor} — ${length} m system
          </option>
        `
      ).join('');

  }


  /* =====================================================
     PRICE CALCULATION
  ===================================================== */

  function getPricing() {

    const rawIndex =
      Number.parseInt(
        floorSelect?.value,
        10
      );

    const floorIndex =
      Number.isInteger(rawIndex) &&
      rawIndex >= 0 &&
      rawIndex < floors.length
        ? rawIndex
        : 0;


    const [floorName, length] =
      floors[floorIndex];


    /* GST-INCLUSIVE PRICE */

    const unitPrice =
      49999 + (floorIndex * 1250);


    const deviceTotal =
      unitPrice * quantity;


    const accessoriesTotal =
      selectedAccessories.reduce(
        (total, item) => {

          return total +
            (item.price * item.quantity);

        },
        0
      );


    /* 10% BULK DISCOUNT FOR 5+ */

    const bulkDiscount =
      quantity >= 5
        ? Math.round(deviceTotal * 0.10)
        : 0;


    const total =
      deviceTotal +
      accessoriesTotal -
      bulkDiscount;


    /* GST BREAKUP */

    const taxableValue =
      total / 1.18;

    const gstAmount =
      total - taxableValue;


    const deviceBase =
      deviceTotal / 1.18;

    const accessoriesBase =
      accessoriesTotal / 1.18;


    return {

      floorIndex,
      floorName,
      length,

      unitPrice,

      deviceTotal,
      accessoriesTotal,

      deviceBase,
      accessoriesBase,

      bulkDiscount,

      taxableValue,
      gstAmount,

      total

    };

  }


  /* =====================================================
     CART DATA
  ===================================================== */

  function getCartData() {

    const price =
      getPricing();


    return {

      product:
        'SAFE ESCAPE',

      floorIndex:
        price.floorIndex,

      floorName:
        price.floorName,

      length:
        price.length,

      quantity,

      unitPrice:
        price.unitPrice,


      accessories:
        selectedAccessories.map(
          ({
            id,
            name,
            price,
            quantity: accessoryQuantity
          }) => ({

            id,
            name,
            price,

            quantity:
              accessoryQuantity,

            lineTotal:
              price * accessoryQuantity

          })
        ),


      totals: {

        deviceTotal:
          price.deviceTotal,

        accessoriesTotal:
          price.accessoriesTotal,

        bulkDiscount:
          price.bulkDiscount,

        total:
          price.total

      }

    };

  }


  /* =====================================================
     SAVE CART
  ===================================================== */

  function saveCart() {

    try {

      localStorage.setItem(
        'safeEscapeCart',
        JSON.stringify(
          getCartData()
        )
      );

      return true;

    }

    catch (error) {

      console.error(
        'SAFE ESCAPE cart could not be saved:',
        error
      );

      return false;

    }

  }


  /* =====================================================
     UPDATE POPUP
  ===================================================== */

  function updatePopup() {

    const price =
      getPricing();


    setText(
      '#popupLength',
      `${price.length} Metres`
    );


    setText(
      '#popupQuantity',
      `${quantity} ${
        quantity === 1
          ? 'System'
          : 'Systems'
      }`
    );


    const accessoryText =
      selectedAccessories.length

        ? selectedAccessories
            .map(
              item =>
                `${item.name} × ${item.quantity}`
            )
            .join(', ')

        : 'None selected';


    setText(
      '#popupAccessories',
      accessoryText
    );


    setText(
      '#popupTotal',
      money(price.total)
    );

  }


  /* =====================================================
     UPDATE PAGE
  ===================================================== */

  function updatePage() {

    const price =
      getPricing();


    setText(
      '#lengthOut',
      `${price.length} Metres`
    );


    setText(
      '#devicePrice',
      money(price.unitPrice)
    );


    setText(
      '#qty',
      quantity
    );


    setText(
      '#sumProduct',
      money(price.deviceBase)
    );


    setText(
      '#sumExtra',
      money(price.accessoriesBase)
    );


    setText(
      '#gstAmount',
      money(price.gstAmount)
    );


    setText(
      '#discount',

      price.bulkDiscount
        ? `-${money(price.bulkDiscount)}`
        : '₹0'
    );


    setText(
      '#total',
      money(price.total)
    );


    updatePopup();

  }


  /* =====================================================
     MAIN PRODUCT QUANTITY
  ===================================================== */

  plusButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();

      quantity += 1;

      updatePage();

    }
  );


  minusButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();

      quantity =
        Math.max(
          1,
          quantity - 1
        );

      updatePage();

    }
  );


  /* =====================================================
     FLOOR CHANGE
  ===================================================== */

  floorSelect?.addEventListener(
    'change',
    updatePage
  );


  /* =====================================================
     OPTIONAL ACCESSORIES
  ===================================================== */

  document
    .querySelectorAll('.accessory-card')
    .forEach(card => {

      const originalButton =
        card.querySelector('button');


      const name =
        card
          .querySelector('strong')
          ?.textContent
          ?.trim();


      const item =
        catalog[name];


      if (
        !originalButton ||
        !item
      ) {
        return;
      }


      originalButton.type =
        'button';


      /* ===============================
         CREATE QUANTITY CONTROL
      =============================== */

      const quantityControl =
        document.createElement('div');


      quantityControl.className =
        'accessory-qty-control';


      quantityControl.style.display =
        'none';

      quantityControl.style.alignItems =
        'center';

      quantityControl.style.gap =
        '8px';

      quantityControl.style.marginTop =
        '8px';


      quantityControl.innerHTML = `

        <button
          type="button"
          class="accessory-minus"
          aria-label="Decrease ${name} quantity"
          style="
            width:34px;
            height:34px;
            border:1px solid #d8dde3;
            background:#fff;
            border-radius:6px;
            font-size:18px;
            font-weight:700;
            cursor:pointer;
          "
        >
          −
        </button>


        <span
          class="accessory-count"
          style="
            min-width:26px;
            text-align:center;
            font-weight:700;
          "
        >
          1
        </span>


        <button
          type="button"
          class="accessory-plus"
          aria-label="Increase ${name} quantity"
          style="
            width:34px;
            height:34px;
            border:1px solid #d8dde3;
            background:#fff;
            border-radius:6px;
            font-size:18px;
            font-weight:700;
            cursor:pointer;
          "
        >
          +
        </button>


        <strong
          class="accessory-item-total"
          style="
            margin-left:6px;
            font-size:13px;
          "
        >
          ${money(item.price)}
        </strong>

      `;


      originalButton
        .parentElement
        ?.appendChild(
          quantityControl
        );


      const accessoryMinus =
        quantityControl.querySelector(
          '.accessory-minus'
        );


      const accessoryPlus =
        quantityControl.querySelector(
          '.accessory-plus'
        );


      const accessoryCount =
        quantityControl.querySelector(
          '.accessory-count'
        );


      const accessoryItemTotal =
        quantityControl.querySelector(
          '.accessory-item-total'
        );


      /* ===============================
         UPDATE ACCESSORY CARD
      =============================== */

      function updateAccessoryCard() {

        const selectedItem =
          selectedAccessories.find(
            accessory =>
              accessory.id === item.id
          );


        if (!selectedItem) {

          card.classList.remove(
            'selected'
          );


          originalButton.textContent =
            '+ Add';


          originalButton.setAttribute(
            'aria-pressed',
            'false'
          );


          quantityControl.style.display =
            'none';


          if (accessoryCount) {
            accessoryCount.textContent =
              '1';
          }


          if (accessoryItemTotal) {
            accessoryItemTotal.textContent =
              money(item.price);
          }


          return;

        }


        card.classList.add(
          'selected'
        );


        originalButton.textContent =
          'Added ✓';


        originalButton.setAttribute(
          'aria-pressed',
          'true'
        );


        quantityControl.style.display =
          'flex';


        if (accessoryCount) {

          accessoryCount.textContent =
            selectedItem.quantity;

        }


        if (accessoryItemTotal) {

          accessoryItemTotal.textContent =
            money(
              selectedItem.price *
              selectedItem.quantity
            );

        }

      }


      /* ===============================
         ADD / REMOVE ACCESSORY
      =============================== */

      originalButton.addEventListener(
        'click',
        event => {

          event.preventDefault();


          const existing =
            selectedAccessories.find(
              accessory =>
                accessory.id === item.id
            );


          if (existing) {

            selectedAccessories =
              selectedAccessories.filter(
                accessory =>
                  accessory.id !== item.id
              );

          }

          else {

            selectedAccessories.push({

              ...item,

              name,

              quantity: 1

            });

          }


          updateAccessoryCard();

          updatePage();

        }
      );


      /* ===============================
         ACCESSORY PLUS
      =============================== */

      accessoryPlus?.addEventListener(
        'click',
        event => {

          event.preventDefault();
          event.stopPropagation();


          const selectedItem =
            selectedAccessories.find(
              accessory =>
                accessory.id === item.id
            );


          if (!selectedItem) {
            return;
          }


          selectedItem.quantity += 1;


          updateAccessoryCard();

          updatePage();

        }
      );


      /* ===============================
         ACCESSORY MINUS
      =============================== */

      accessoryMinus?.addEventListener(
        'click',
        event => {

          event.preventDefault();
          event.stopPropagation();


          const selectedItem =
            selectedAccessories.find(
              accessory =>
                accessory.id === item.id
            );


          if (!selectedItem) {
            return;
          }


          if (
            selectedItem.quantity > 1
          ) {

            selectedItem.quantity -= 1;

          }

          else {

            selectedAccessories =
              selectedAccessories.filter(
                accessory =>
                  accessory.id !== item.id
              );

          }


          updateAccessoryCard();

          updatePage();

        }
      );

    });


  /* =====================================================
     CART POPUP
  ===================================================== */

  function openPopup() {

    updatePopup();


    if (!cartPopup) {
      return;
    }


    cartPopup.classList.add(
      'show',
      'active'
    );


    cartPopup.setAttribute(
      'aria-hidden',
      'false'
    );


    document.body.classList.add(
      'popup-open'
    );

  }


  function closePopup() {

    if (!cartPopup) {
      return;
    }


    cartPopup.classList.remove(
      'show',
      'active'
    );


    cartPopup.setAttribute(
      'aria-hidden',
      'true'
    );


    document.body.classList.remove(
      'popup-open'
    );

  }


  window.closePopup =
    closePopup;


  /* =====================================================
     CHECKOUT
  ===================================================== */

  function goToCheckout() {

    saveCart();

    window.location.href =
      'checkout.html';

  }


  /* =====================================================
     ADD TO CART
  ===================================================== */

  addCartButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();


      if (saveCart()) {

        window.location.href =
          'cart.html';

      }

    }
  );


  /* =====================================================
     BUY NOW
  ===================================================== */

  buyNowButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();

      goToCheckout();

    }
  );


  summaryBuyNowButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();

      goToCheckout();

    }
  );


  popupBuyNowButton?.addEventListener(
    'click',
    event => {

      event.preventDefault();

      goToCheckout();

    }
  );


  /* =====================================================
     CART POPUP OUTSIDE CLICK
  ===================================================== */

  cartPopup?.addEventListener(
    'click',
    event => {

      if (
        event.target === cartPopup
      ) {

        closePopup();

      }

    }
  );


  /* =====================================================
     PRODUCT IMAGE GALLERY
  ===================================================== */

  window.changeImage =
    function (imagePath) {

      if (!mainImage) {
        return;
      }

      mainImage.src =
        imagePath;

      mainImage.style.display =
        'block';

    };


  /* =====================================================
     OPEN YOUTUBE PRODUCT VIDEO
  ===================================================== */

/* =====================================================
   YOUTUBE VIDEO
===================================================== */

const youtubeThumb =
  document.querySelector('.youtube-thumb');


function openProductVideo() {

  if (!videoModal || !howVideo) {
    console.error('Video modal or iframe not found');
    return;
  }

  console.log('Opening YouTube video...');

  howVideo.src =
    'https://www.youtube.com/embed/l6DJYVeE4G0?autoplay=1&controls=1&rel=0&playsinline=1';

  videoModal.classList.add('active');

  videoModal.setAttribute(
    'aria-hidden',
    'false'
  );

  document.body.style.overflow =
    'hidden';

}


/* HTML onclick support */
window.openProductVideo =
  openProductVideo;


/* Direct click listener */
youtubeThumb?.addEventListener(
  'click',
  function (event) {

    event.preventDefault();
    event.stopPropagation();

    openProductVideo();

  }
);


/* =====================================================
   CLOSE YOUTUBE VIDEO
===================================================== */

function closeProductVideo() {

  if (!videoModal || !howVideo) {
    return;
  }

  videoModal.classList.remove(
    'active'
  );

  videoModal.setAttribute(
    'aria-hidden',
    'true'
  );

  /* Stop YouTube completely */
  howVideo.src = '';

  document.body.style.overflow =
    '';

}


/* CLOSE BUTTON */

closeVideo?.addEventListener(
  'click',
  function (event) {

    event.preventDefault();
    event.stopPropagation();

    closeProductVideo();

  }
);


/* CLICK OUTSIDE */

videoModal?.addEventListener(
  'click',
  function (event) {

    if (event.target === videoModal) {
      closeProductVideo();
    }

  }
);

  /* =====================================================
     CLOSE YOUTUBE PRODUCT VIDEO
  ===================================================== */

  function closeProductVideo() {

    if (
      !videoModal ||
      !howVideo
    ) {
      return;
    }


    videoModal.classList.remove(
      'active'
    );


    videoModal.setAttribute(
      'aria-hidden',
      'true'
    );


    /* REMOVE YOUTUBE = STOP VIDEO */

    howVideo.src = '';


    document.body.style.overflow =
      '';

  }


  /* =====================================================
     VIDEO CLOSE BUTTON
  ===================================================== */

  closeVideo?.addEventListener(
    'click',
    event => {

      event.preventDefault();
      event.stopPropagation();

      closeProductVideo();

    }
  );


  /* =====================================================
     VIDEO MODAL OUTSIDE CLICK
  ===================================================== */

  videoModal?.addEventListener(
    'click',
    event => {

      if (
        event.target === videoModal
      ) {

        closeProductVideo();

      }

    }
  );


  /* =====================================================
     ESC KEY
  ===================================================== */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key !== 'Escape'
      ) {
        return;
      }


      /* CLOSE YOUTUBE */

      if (
        videoModal?.classList.contains(
          'active'
        )
      ) {

        closeProductVideo();

      }


      /* CLOSE CART POPUP */

      if (
        cartPopup?.classList.contains(
          'active'
        )
      ) {

        closePopup();

      }

    }
  );


  /* =====================================================
     INITIAL PAGE UPDATE
  ===================================================== */

  updatePage();

});