const CART_KEY = 'safeEscapeCart';
const box = document.querySelector('#cartContent');

const formatINR = amount =>
    `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;

function escapeHTML(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY));
    } catch (error) {
        console.error('Unable to load cart:', error);
        return null;
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        return true;
    } catch (error) {
        console.error('Unable to save cart:', error);
        return false;
    }
}

function getTotals(cart) {
    const quantity = Math.max(1, Number(cart.quantity) || 1);
    const unitPrice = Number(cart.unitPrice) || 0;

    const deviceTotal = unitPrice * quantity;

    const accessoriesTotal = (cart.accessories || []).reduce((total, item) => {
        const itemPrice = Number(item.price) || 0;
        const itemQuantity = Math.max(1, Number(item.quantity) || 1);

        return total + (itemPrice * itemQuantity);
    }, 0);

    const subtotal = deviceTotal + accessoriesTotal;

    /* 10% discount for 5 or more systems */
    const bulkDiscount = quantity >= 5
        ? Math.round(subtotal * 0.10)
        : 0;

    /* This is the final amount. GST is already included here. */
    const totalPayable = subtotal - bulkDiscount;

    /* Extract GST from GST-inclusive amount: 18 / 118 */
    const gstIncluded = Math.round(totalPayable * 18 / 118);

    return {
        quantity,
        unitPrice,
        deviceTotal,
        accessoriesTotal,
        subtotal,
        bulkDiscount,
        gst: gstIncluded,
        total: totalPayable
    };
}

function renderCart() {
    if (!box) return;

    const cart = loadCart();

    if (!cart || !cart.floorName || !cart.length) {
        box.innerHTML = `
            <div class="notice">
                Your cart is empty.
                <a href="product.html">Explore SAFE ESCAPE systems →</a>
            </div>
        `;
        return;
    }

    cart.quantity = Math.max(1, Number(cart.quantity) || 1);
    cart.accessories = Array.isArray(cart.accessories)
        ? cart.accessories
        : [];

    const totals = getTotals(cart);

    const accessoriesRows = cart.accessories.length
        ? cart.accessories.map(item => {
            const itemName = escapeHTML(item.name);
            const itemId = escapeHTML(item.id);
            const itemQuantity = Math.max(1, Number(item.quantity) || 1);
            const itemPrice = Number(item.price) || 0;

            return `
                <tr>
                    <td>
                        <strong>${itemName}</strong>
                        <span class="cart-item-type">Optional Accessory</span>
                    </td>

                    <td>Accessory</td>

                    <td>
                        <div class="cart-stepper">
                            <button type="button"
                                data-action="accessory-minus"
                                data-id="${itemId}"
                                aria-label="Decrease quantity">−</button>

                            <span>${itemQuantity}</span>

                            <button type="button"
                                data-action="accessory-plus"
                                data-id="${itemId}"
                                aria-label="Increase quantity">+</button>
                        </div>
                    </td>

                    <td>
                        <strong>${formatINR(itemPrice * itemQuantity)}</strong>

                        <button class="cart-remove"
                            type="button"
                            data-action="remove-accessory"
                            data-id="${itemId}">
                            Remove
                        </button>
                    </td>
                </tr>
            `;
        }).join('')
        : `
            <tr>
                <td colspan="4" class="cart-empty-accessory">
                    No optional accessories selected.
                </td>
            </tr>
        `;

    box.innerHTML = `
        <div class="cart-layout">

            <div class="cart-main">
                <div class="cart-table-wrap">
                    <table class="cart-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Configuration</th>
                                <th>Quantity</th>
                                <th>Amount</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td>
                                    <strong>SAFE ESCAPE — Your Rescue Partner™</strong>
                                    <span class="cart-item-type">
                                        Emergency Escape System
                                    </span>
                                </td>

                                <td>
                                    ${escapeHTML(cart.floorName)} ·
                                    ${escapeHTML(cart.length)} m
                                </td>

                                <td>
                                    <div class="cart-stepper">
                                        <button type="button"
                                            data-action="product-minus"
                                            aria-label="Decrease system quantity">−</button>

                                        <span>${totals.quantity}</span>

                                        <button type="button"
                                            data-action="product-plus"
                                            aria-label="Increase system quantity">+</button>
                                    </div>
                                </td>

                                <td>
                                    <strong>${formatINR(totals.deviceTotal)}</strong>
                                </td>
                            </tr>

                            ${accessoriesRows}
                        </tbody>
                    </table>
                </div>

                <div class="cart-notes">
                    <h3>Installation & Delivery Information</h3>

                    <ul>
                        <li>
                            Professional installation, anchoring and training are included
                            for Delhi/NCR orders.
                        </li>

                        <li>
                         For locations outside our direct service zones, we assist you in hiring a local technician and provide live video supervision to ensure a correct installation. 

                        </li>

                        <li>
                            International shipping, import duty and local installation
                            charges will be confirmed after address verification.
                        </li>

                        <li>
                             Please verify your final wire length before placing your order.
  Incorrect orders are subject to our standard
  <a style="color:blue" target='_blank' href="shipping-return-policy.html">
    Shipping & Return Policy
  </a>.
                        </li>
                    </ul>
                </div>
            </div>

           <aside class="cart-summary">
    <h2>Order Summary</h2>

    <div class="summary-row">
        <span>Subtotal</span>
        <strong>${formatINR(totals.subtotal)}</strong>
    </div>

    <div class="summary-row ${totals.bulkDiscount ? 'discount-row' : ''}">
        <span>5+ Units Discount</span>
        <strong>
            ${totals.bulkDiscount
                ? `−${formatINR(totals.bulkDiscount)}`
                : '₹0'}
        </strong>
    </div>

    <div class="summary-row">
        <span>GST @ 18%</span>
        <strong>Included (${formatINR(totals.gst)})</strong>
    </div>

    <div class="summary-total">
        <span>Total Payable</span>
        <strong>${formatINR(totals.total)}</strong>
    </div>

    <a class="btn cart-checkout-btn" href="checkout.html">
        Proceed to Checkout →
    </a>

    <p class="cart-secure-note">
        GST is included in the total payable amount. Your address, installation
        requirement and delivery charges will be confirmed during checkout.
    </p>
</aside>

        </div>
    `;
}

box?.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');

    if (!button) return;

    const cart = loadCart();

    if (!cart) return;

    const action = button.dataset.action;
    const accessoryId = button.dataset.id;

    cart.quantity = Math.max(1, Number(cart.quantity) || 1);
    cart.accessories = Array.isArray(cart.accessories)
        ? cart.accessories
        : [];

    if (action === 'product-plus') {
        cart.quantity += 1;
    }

    if (action === 'product-minus') {
        cart.quantity = Math.max(1, cart.quantity - 1);
    }

    if (accessoryId) {
        const accessory = cart.accessories.find(
            item => String(item.id) === String(accessoryId)
        );

        if (action === 'accessory-plus' && accessory) {
            accessory.quantity = Math.max(
                1,
                Number(accessory.quantity) || 1
            ) + 1;
        }

        if (action === 'accessory-minus' && accessory) {
            accessory.quantity = Math.max(
                1,
                (Number(accessory.quantity) || 1) - 1
            );
        }

        if (action === 'remove-accessory') {
            cart.accessories = cart.accessories.filter(
                item => String(item.id) !== String(accessoryId)
            );
        }
    }

    const totals = getTotals(cart);

    cart.totals = {
        deviceTotal: totals.deviceTotal,
        accessoriesTotal: totals.accessoriesTotal,
        bulkDiscount: totals.bulkDiscount,
        taxableTotal: totals.taxableTotal,
        gst: totals.gst,
        total: totals.total
    };

    if (saveCart(cart)) {
        renderCart();
    }
});

renderCart();