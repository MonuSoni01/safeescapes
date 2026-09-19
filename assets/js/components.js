/* =========================================================
   SAFE ESCAPE
   COMMON HEADER + FOOTER + NAVIGATION
   File: js/components.js
========================================================= */


/* =========================================================
   NAVIGATION ITEMS
========================================================= */

const navItems = [
  {
    name: 'Home',
    href: 'index.html',
    page: 'home'
  },

  {
    name: 'About',
    href: 'about.html',
    page: 'about'
  },

  {
    name: 'Product',
    dropdown: [
      ['How It Works', 'index.html#how', 'how-it-works'],
      ['Products', 'products.html', 'products'],
      ['Gallery', 'gallery.html', 'gallery']
    ]
  },

  {
    name: 'Safety',
    dropdown: [
      ['Safety & Testing', 'safety-testing.html', 'safety-testing'],
      ['Applications', 'applications.html', 'applications'],
      ['Resources', 'resources.html', 'resources']
    ]
  },

  {
    name: 'Business',
    dropdown: [
      ['Become a Dealer', 'dealer.html', 'dealer'],
      ['Bulk / Projects', 'bulk-projects.html', 'bulk-projects'],
       ['Refer & earn', 'refer&earn.html', 'refer&earn']
    ]
  },

  {
    name: 'Contact',
    href: 'contact.html',
    page: 'contact'
  }
];


/* =========================================================
   HEADER
========================================================= */

function header() {

  const page = document.body.dataset.page || '';

  const navHTML = navItems.map(item => {

    /* -----------------------------------------
       NORMAL NAVIGATION LINK
    ----------------------------------------- */

    if (!item.dropdown) {

      const isActive = page === item.page;

      return `
        <a
          class="nav-link ${isActive ? 'active' : ''}"
          href="${item.href}"
        >
          ${item.name}
        </a>
      `;
    }


    /* -----------------------------------------
       DROPDOWN ACTIVE CHECK
    ----------------------------------------- */

    const dropdownActive = item.dropdown.some(
      ([name, href, pageName]) => page === pageName
    );


    /* -----------------------------------------
       DROPDOWN
    ----------------------------------------- */

    return `
      <div class="nav-dropdown ${dropdownActive ? 'active' : ''}">

        <button
          class="nav-dropdown-btn"
          type="button"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <span>${item.name}</span>
          <span class="dropdown-arrow">▾</span>
        </button>


        <div class="dropdown-menu">

          ${item.dropdown.map(([name, href, pageName]) => {

            const isActive = page === pageName;

            return `
              <a
                class="${isActive ? 'active' : ''}"
                href="${href}"
              >
                <span>${name}</span>
                <span class="dropdown-link-arrow">→</span>
              </a>
            `;

          }).join('')}

        </div>

      </div>
    `;

  }).join('');


  /* -----------------------------------------
     HEADER HTML
  ----------------------------------------- */

  return `
    <header class="site-header">

      <div class="shell header-inner">


        <!-- LOGO -->
        <a
          class="brand"
          href="index.html"
          aria-label="SAFE ESCAPE Home"
        >
          <img
            src="assets/images/logo.png"
            alt="SAFE ESCAPE logo"
          >
        </a>


        <!-- MAIN NAVIGATION -->
        <nav
          class="nav"
          id="mainNav"
          aria-label="Main Navigation"
        >
          ${navHTML}
        </nav>


        <!-- RIGHT SIDE ACTIONS -->
        <div class="header-actions">


          <!-- WARRANTY -->
         <a
    class="warranty-link"
    href="warranty.html"
>
    REGISTER WARRANTY
</a>


          <!-- BUY NOW -->
          <a
            class="btn header-buy-btn"
            href="products.html"
          >
            BUY NOW
            <span>→</span>
          </a>


          <!-- MOBILE MENU -->
          <button
            class="menu-btn"
            id="menuBtn"
            type="button"
            aria-label="Open menu"
            aria-expanded="false"
          >
            ☰
          </button>

        </div>

      </div>

    </header>
  `;
}


/* =========================================================
   FOOTER
========================================================= */

function footer(){

return `

<footer class="footer">

<div class="shell">


<div class="footer-grid">


<!-- BRAND -->

<div class="footer-brand-col">


<p class="footer-import">
Imported and Marketed by :
</p>


<img
class="footer-logo"
src="assets/images/innovative.png"
alt="Innovative Ideaz Global"
>


<p class="footer-company-name">

Innovative Ideaz Global Private Limited

</p>


<p class="footer-gstin">

GSTIN : 07AACCI2349M1ZD

</p>
<p class="footer-gstin" style="color:#fff;">
SAFE ESCAPE is an additional emergency evacuation system and does not replace statutory fire exits, staircases, alarms, sprinklers, fire extinguishers or professional emergency services.
</p>
<p class="footer-gstin" style="color:#fff; margin-top:12px;">
Disclaimer : Some visual and video content on this website is generated using artificial intelligence.
</p>
</div>




<!-- EXPLORE -->

<div class="footer-col">

<strong>Explore</strong>

<a href="about.html">About</a>

<a href="products.html">Products</a>

<a href="applications.html">Applications</a>

<a href="safety-testing.html">
Safety & Testing
</a>

<a href="refer&earn.html">
Business with Us
</a>

<a href="faq.html">
FAQ
</a>


</div>





<!-- CUSTOMERS -->

<div class="footer-col">


<strong>
For Customers
</strong>


<a href="products.html">
Buy Now
</a>


<a href="bulk-projects.html">
Bulk Projects
</a>


<a href="dealer.html">
Become a Dealer
</a>


<a href="warranty.html">
Register Warranty
</a>


<a href="resources.html">
Resources
</a>


</div>





<!-- CONTACT -->

<div class="footer-col">


<strong>
Contact
</strong>



<p>
D-36, First Floor, Ajay Enclave<br>
New Delhi – 110018
</p>



<a href="tel:+919311605588">

+91 93116 05588

</a>



<a href="mailto:safeescapesolutions@gmail.com">

safeescapesolutions@gmail.com

</a>



<p class="instagram">

Instagram :

<a href="https://www.instagram.com/safe.escape.solutions/"
target="_blank">

@safe.escape.solutions

</a>

</p>



<a href="privacy.html">
Privacy Policy
</a>


<a href="terms.html">
Terms and Conditions
</a>


<a href="shipping-return-policy.html">
Shipping and Returns
</a>


</div>



</div>





 



<!-- COPYRIGHT -->


<div class="footer-bottom">


<span>

© 2026 <span style="color:gold">Innovative Ideaz Global Private Limited. </span>
All Rights Reserved.

</span>



<span>

Design & Developed by

<a href="https://www.rankchahiye.com/"
target="_blank">

Rank Chahiye

</a>


</span>


</div>



</div>


</footer>


`;

}


/* =========================================================
   INSERT HEADER
========================================================= */

const headerPlaceholder =
  document.querySelector('#siteHeader');

if (headerPlaceholder) {

  const wrapper =
    document.createElement('div');

  wrapper.innerHTML =
    header();

  headerPlaceholder.replaceWith(
    wrapper.firstElementChild
  );
}


/* =========================================================
   INSERT FOOTER
========================================================= */

const footerPlaceholder =
  document.querySelector('#siteFooter');

if (footerPlaceholder) {

  const wrapper =
    document.createElement('div');

  wrapper.innerHTML =
    footer();

  footerPlaceholder.replaceWith(
    wrapper.firstElementChild
  );
}


/* =========================================================
   FLOATING BUTTONS + TOAST
========================================================= */

document.body.insertAdjacentHTML(
  'beforeend',
  `

<a
    class="floating-wa"
    href="https://wa.me/919311605588"
    target="_blank"
    rel="noopener"
    aria-label="WhatsApp SAFE ESCAPE"
    title="Chat on WhatsApp"
>
    <img 
        src="https://mobiledoctorjaipur.netlify.app/images/whatsapp_logo.png"
        alt="WhatsApp"
    >
</a>


 


    <div
      class="toast"
      id="toast"
      role="status"
      aria-live="polite"
    ></div>

  `
);


/* =========================================================
   RESPONSIVE MAIN NAVIGATION
========================================================= */

const NAV_BREAKPOINT = 1240;
const menuBtn = document.querySelector('#menuBtn');
const nav = document.querySelector('#mainNav');
const headerElement = document.querySelector('.site-header');
const dropdowns = Array.from(document.querySelectorAll('.nav-dropdown'));

function isMobileNav() {
  return window.innerWidth < NAV_BREAKPOINT;
}

function closeDropdowns() {
  dropdowns.forEach(dropdown => {
    dropdown.classList.remove('open');
    dropdown.querySelector('.nav-dropdown-btn')?.setAttribute('aria-expanded', 'false');
  });
}

function setMenuState(open) {
  if (!nav || !menuBtn) return;

  nav.classList.toggle('open', open);
  document.body.classList.toggle('nav-is-open', open && isMobileNav());
  menuBtn.textContent = open ? '✕' : '☰';
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

  if (!open) closeDropdowns();
}

menuBtn?.setAttribute('aria-controls', 'mainNav');

menuBtn?.addEventListener('click', () => {
  if (!isMobileNav()) return;
  setMenuState(!nav?.classList.contains('open'));
});

dropdowns.forEach(dropdown => {
  const button = dropdown.querySelector('.nav-dropdown-btn');

  button?.addEventListener('click', event => {
    if (!isMobileNav()) return;

    event.preventDefault();
    const shouldOpen = !dropdown.classList.contains('open');

    closeDropdowns();
    dropdown.classList.toggle('open', shouldOpen);
    button.setAttribute('aria-expanded', String(shouldOpen));
  });
});

nav?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    if (isMobileNav()) setMenuState(false);
  });
});

document.addEventListener('click', event => {
  if (!isMobileNav() || !nav?.classList.contains('open')) return;
  if (headerElement?.contains(event.target)) return;
  setMenuState(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav?.classList.contains('open')) {
    setMenuState(false);
    menuBtn?.focus();
  }
});

let previousMobileState = isMobileNav();

window.addEventListener('resize', () => {
  const mobileNow = isMobileNav();

  if (mobileNow !== previousMobileState || !mobileNow) {
    setMenuState(false);
  }

  previousMobileState = mobileNow;
});


/* =========================================================
   TOAST FUNCTION
========================================================= */

window.showToast =
  function (message) {

    const toast =
      document.querySelector('#toast');


    if (!toast) {
      return;
    }


    toast.textContent =
      message;


    toast.classList.add(
      'show'
    );


    clearTimeout(
      window.safeEscapeToastTimer
    );


    window.safeEscapeToastTimer =
      setTimeout(
        () => {

          toast.classList.remove(
            'show'
          );

        },
        2600
      );

  };

  
  /* =========================================================
   SAFE ESCAPE
   WEBSITE CONTENT PROTECTION
   Add this at the END of components.js
========================================================= */

// (function () {

//   "use strict";


//   /* =========================================================
//      1. DISABLE RIGHT CLICK
//   ========================================================= */

//   document.addEventListener("contextmenu", function (event) {

//     /*
//       IMPORTANT:
//       Form fields par right click allow rakha hai
//       taaki users form normally use kar saken.
//     */

//     const target = event.target;

//     if (
//       target.closest("input") ||
//       target.closest("textarea") ||
//       target.closest("select")
//     ) {
//       return;
//     }

//     event.preventDefault();

//     if (typeof window.showToast === "function") {
//       window.showToast(
//         "Content on this website is protected."
//       );
//     }

//   });


//   /* =========================================================
//      2. PREVENT IMAGE DRAGGING
//   ========================================================= */

//   document.addEventListener("dragstart", function (event) {

//     if (
//       event.target &&
//       event.target.tagName === "IMG"
//     ) {

//       event.preventDefault();

//     }

//   });


//   /* =========================================================
//      3. DISABLE IMAGE CONTEXT MENU
//   ========================================================= */

//   document.addEventListener("contextmenu", function (event) {

//     if (
//       event.target &&
//       event.target.tagName === "IMG"
//     ) {

//       event.preventDefault();

//     }

//   });


//   /* =========================================================
//      4. PREVENT NORMAL TEXT COPY

//      Forms are excluded so users can still copy/paste
//      their name, email, address, serial number etc.
//   ========================================================= */

//   document.addEventListener("copy", function (event) {

//     const target = event.target;

//     if (
//       target.closest("input") ||
//       target.closest("textarea")
//     ) {
//       return;
//     }

//     event.preventDefault();

//     if (typeof window.showToast === "function") {

//       window.showToast(
//         "Copying website content is not permitted."
//       );

//     }

//   });


//   /* =========================================================
//      5. PREVENT CUT

//      Again: allow inside forms.
//   ========================================================= */

//   document.addEventListener("cut", function (event) {

//     const target = event.target;

//     if (
//       target.closest("input") ||
//       target.closest("textarea")
//     ) {
//       return;
//     }

//     event.preventDefault();

//   });


//   /* =========================================================
//      6. BLOCK COMMON COPY / SAVE SHORTCUTS
//   ========================================================= */

//   document.addEventListener("keydown", function (event) {

//     const key =
//       event.key.toLowerCase();


//     const target =
//       event.target;


//     const isFormField =
//       target instanceof HTMLElement &&
//       (
//         target.matches("input") ||
//         target.matches("textarea") ||
//         target.matches("select") ||
//         target.isContentEditable
//       );


//     /*
//       Forms must work normally.

//       Ctrl+C
//       Ctrl+V
//       Ctrl+X
//       Ctrl+A

//       remain available inside form fields.
//     */

//     if (isFormField) {
//       return;
//     }


//     /* -----------------------------------------
//        CTRL / CMD + C
//        Copy
//     ----------------------------------------- */

//     if (
//       (event.ctrlKey || event.metaKey) &&
//       key === "c"
//     ) {

//       event.preventDefault();

//       window.showToast?.(
//         "Copying website content is not permitted."
//       );

//       return;

//     }


//     /* -----------------------------------------
//        CTRL / CMD + X
//     ----------------------------------------- */

//     if (
//       (event.ctrlKey || event.metaKey) &&
//       key === "x"
//     ) {

//       event.preventDefault();

//       return;

//     }


//     /* -----------------------------------------
//        CTRL / CMD + S
//        Save Page
//     ----------------------------------------- */

//     if (
//       (event.ctrlKey || event.metaKey) &&
//       key === "s"
//     ) {

//       event.preventDefault();

//       window.showToast?.(
//         "Saving this page is disabled."
//       );

//       return;

//     }


//     /* -----------------------------------------
//        CTRL / CMD + U
//        View Source shortcut
//     ----------------------------------------- */

//     if (
//       (event.ctrlKey || event.metaKey) &&
//       key === "u"
//     ) {

//       event.preventDefault();

//       return;

//     }

//   });


//   /* =========================================================
//      7. MAKE ALL IMAGES NON-DRAGGABLE
//   ========================================================= */

//   function protectImages() {

//     document
//       .querySelectorAll("img")
//       .forEach(function (img) {

//         img.setAttribute(
//           "draggable",
//           "false"
//         );

//         img.style.webkitUserDrag =
//           "none";

//       });

//   }


//   protectImages();


//   /* =========================================================
//      8. PROTECT IMAGES ADDED LATER

//      Important because your site dynamically injects
//      header/footer/components.
//   ========================================================= */

//   const imageObserver =
//     new MutationObserver(function (mutations) {

//       mutations.forEach(function (mutation) {

//         mutation.addedNodes.forEach(function (node) {

//           if (!(node instanceof HTMLElement)) {
//             return;
//           }


//           if (node.tagName === "IMG") {

//             node.setAttribute(
//               "draggable",
//               "false"
//             );

//             node.style.webkitUserDrag =
//               "none";

//           }


//           node
//             .querySelectorAll?.("img")
//             .forEach(function (img) {

//               img.setAttribute(
//                 "draggable",
//                 "false"
//               );

//               img.style.webkitUserDrag =
//                 "none";

//             });

//         });

//       });

//     });


//   imageObserver.observe(
//     document.body,
//     {
//       childList: true,
//       subtree: true
//     }
//   );


//   /* =========================================================
//      9. DISABLE TEXT SELECTION
//      EXCEPT FORM ELEMENTS
//   ========================================================= */

//   const protectionStyle =
//     document.createElement("style");


//   protectionStyle.textContent = `

//     body {
//       -webkit-user-select: none;
//       -moz-user-select: none;
//       user-select: none;
//     }


//     img {
//       -webkit-user-drag: none;
//       user-drag: none;
//       -webkit-user-select: none;
//       user-select: none;
//     }


//     /*
//        IMPORTANT:
//        Forms must remain fully usable.
//     */

//     input,
//     textarea,
//     select,
//     option,
//     [contenteditable="true"] {

//       -webkit-user-select: text !important;
//       -moz-user-select: text !important;
//       user-select: text !important;

//     }

//   `;


//   document.head.appendChild(
//     protectionStyle
//   );


//   /* =========================================================
//      INITIALIZED
//   ========================================================= */

//   console.log(
//     "SAFE ESCAPE content protection enabled."
//   );


// })();