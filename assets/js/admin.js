import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBox = document.querySelector("#adminLogin");
const adminPanel = document.querySelector("#adminPanel");
const output = document.querySelector("#dataOut");
const couponManager = document.querySelector("#couponManager");
const detailModal = document.querySelector("#detailModal");

let activeTab = "orders";

const labels = {
  orders: {
    kicker: "ORDER MANAGEMENT",
    title: "Orders Overview",
    description: "Track orders, payment status and fulfilment progress.",
    records: "Recent Orders"
  },

  enquiries: {
    kicker: "CUSTOMER LEADS",
    title: "Customer Enquiries",
    description: "Contact, Dealer, Bulk Project and Referral form submissions.",
    records: "Recent Enquiries"
  },

  warranty: {
    kicker: "PRODUCT CARE",
    title: "Warranty Registrations",
    description: "Review warranty activation requests and device details.",
    records: "Warranty Registrations"
  },

  coupons: {
    kicker: "PROMOTION MANAGEMENT",
    title: "Coupons & Offers",
    description: "Create and manage secure discount codes.",
    records: "Saved Coupons"
  }
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char];
  });
}

function formatDate(value) {
  if (value?.toDate) {
    return value.toDate().toLocaleString("en-IN");
  }

  return "—";
}

function statusTag(status) {
  const clean = String(status || "new").replace(/[^a-z_]/gi, "_");

  return `
    <span class="status-tag status-${clean}">
      ${escapeHtml(String(status || "new").replaceAll("_", " "))}
    </span>
  `;
}

function updateHeading(tab) {
  const item = labels[tab];

  document.querySelector("#dashboardKicker").textContent = item.kicker;
  document.querySelector("#dashboardTitle").textContent = item.title;
  document.querySelector("#dashboardDescription").textContent = item.description;
  document.querySelector("#recordsTitle").textContent = item.records;
}

/* Firebase config warning */

if (firebaseConfig.apiKey.startsWith("YOUR_")) {
  document.querySelector("#configWarning").hidden = false;
}

/* Login */

document.querySelector("#loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(event.target);

  try {
    await signInWithEmailAndPassword(
      auth,
      formData.get("email"),
      formData.get("password")
    );
  } catch (error) {
    showToast("Login failed: " + error.message);
  }
});

/* Password Reset */

document.querySelector("#forgotPasswordBtn")?.addEventListener("click", async () => {
  const input = document.querySelector('#loginForm input[name="email"]');
  const email = input.value.trim();

  if (!email) {
    showToast("Please enter your registered admin email first.");
    input.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showToast(
      "Password reset link has been sent to " + email +
      ". Please check Inbox and Spam folder."
    );
  } catch (error) {
    console.error(error);

    if (error.code === "auth/user-not-found") {
      showToast("This email is not registered.");
      return;
    }

    showToast("Password reset email could not be sent.");
  }
});

document.querySelector("#logoutBtn")?.addEventListener("click", () => {
  signOut(auth);
});

/* Auth */

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBox.hidden = false;
    adminPanel.hidden = true;
    return;
  }

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));

    if (!adminDoc.exists()) {
      await signOut(auth);
      showToast("This account is not authorised as admin.");
      return;
    }

    loginBox.hidden = true;
    adminPanel.hidden = false;

    document.querySelector("#adminEmail").textContent = user.email;

    await refreshCounts();
    loadData(activeTab);

  } catch (error) {
    console.error(error);
    showToast("Could not confirm admin access. Check Admin UID and Firestore Rules.");
    await signOut(auth);
  }
});

/* Dashboard cards */

async function getCollectionCount(collectionName, category = null) {
  try {
    let request;

    if (category) {
      request = query(
        collection(db, collectionName),
        where("category", "==", category),
        limit(100)
      );
    } else {
      request = query(collection(db, collectionName), limit(100));
    }

    const result = await getDocs(request);
    return result.size;
  } catch {
    return "—";
  }
}

async function refreshCounts() {
  document.querySelector("#orderCount").textContent =
    await getCollectionCount("orders");

  document.querySelector("#enquiryCount").textContent =
    await getCollectionCount("formSubmissions", "enquiry");

  document.querySelector("#warrantyCount").textContent =
    await getCollectionCount("formSubmissions", "warranty");

  document.querySelector("#couponCount").textContent =
    await getCollectionCount("coupons");
}

/* Data load */

async function loadData(tab) {
  activeTab = tab;
  updateHeading(tab);

  couponManager.hidden = tab !== "coupons";

  output.innerHTML = `
    <div class="admin-loading">
      <span></span> Loading dashboard data…
    </div>
  `;

  try {
    let snapshot;
    let records = [];

    if (tab === "orders" || tab === "coupons") {
      snapshot = await getDocs(
        query(
          collection(db, tab),
          orderBy("createdAt", "desc"),
          limit(100)
        )
      );

      records = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));
    }

    if (tab === "enquiries") {
      snapshot = await getDocs(
        query(
          collection(db, "formSubmissions"),
          where("category", "==", "enquiry"),
          limit(100)
        )
      );

      records = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));
    }

    if (tab === "warranty") {
      snapshot = await getDocs(
        query(
          collection(db, "formSubmissions"),
          where("category", "==", "warranty"),
          limit(100)
        )
      );

      records = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));
    }

    records.sort((a, b) => {
      const first = a.createdAt?.toDate?.() || new Date(0);
      const second = b.createdAt?.toDate?.() || new Date(0);
      return second - first;
    });

    document.querySelector("#recordCount").textContent =
      `${records.length} RECORD${records.length === 1 ? "" : "S"}`;

    if (!records.length) {
      output.innerHTML = `
        <div class="admin-loading">
          No records yet. New data will appear here automatically.
        </div>
      `;
      return;
    }

    if (tab === "orders") {
      renderOrders(records);
    } else if (tab === "coupons") {
      renderCoupons(records);
    } else {
      renderForms(records);
    }

  } catch (error) {
    console.error(error);

    output.innerHTML = `
      <div class="admin-loading">
        Unable to load records. Check Firebase Rules and setup.
      </div>
    `;
  }
}

/* Orders table */

function renderOrders(records) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Mobile</th>
            <th>Amount</th>
            <th>Coupon</th>
            <th>Created</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${records.map(row => `
            <tr>
            <td>${escapeHtml(row.orderNumber || row.id)}</td>
              <td>${escapeHtml(row.customer?.fullName || "—")}</td>
              <td>${escapeHtml(row.customer?.mobile || "—")}</td>
              <td>₹${Number(row.pricing?.total || 0).toLocaleString("en-IN")}</td>
              <td>${escapeHtml(row.cart?.couponCode || "—")}</td>
              <td>${formatDate(row.createdAt)}</td>

              <td>
                ${statusTag(row.status)}

                <select class="order-status" data-id="${escapeHtml(row.id)}">
                  ${[
                    "payment_pending",
                    "paid",
                    "processing",
                    "shipped",
                    "completed",
                    "cancelled"
                  ].map(status => `
                    <option value="${status}" ${row.status === status ? "selected" : ""}>
                      ${status.replace("_", " ")}
                    </option>
                  `).join("")}
                </select>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll(".order-status").forEach(select => {
    select.addEventListener("change", async () => {
      select.disabled = true;

      try {
        await updateDoc(doc(db, "orders", select.dataset.id), {
          status: select.value,
          updatedAt: serverTimestamp()
        });

        showToast("Order status updated.");
        loadData("orders");
      } catch {
        showToast("Order update failed.");
        select.disabled = false;
      }
    });
  });
}

/* Forms table */

function renderForms(records) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Form Type</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Submitted</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${records.map(row => `
            <tr>
              <td>${statusTag(row.formType)}</td>
              <td>${escapeHtml(row.details?.name || row.details?.customerName || "—")}</td>
              <td>${escapeHtml(row.details?.mobile || row.details?.phone || "—")}</td>
              <td>${escapeHtml(row.details?.email || "—")}</td>
              <td>${escapeHtml(row.subject || "—")}</td>
              <td>${formatDate(row.createdAt)}</td>
              <td>
                <button class="view-detail" data-form-id="${escapeHtml(row.id)}">
                  VIEW DETAILS
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll(".view-detail").forEach(button => {
    button.addEventListener("click", () => {
      const record = records.find(item => item.id === button.dataset.formId);
      openDetails(record);
    });
  });
}

/* Coupons table */

function renderCoupons(records) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Coupon Code</th>
            <th>Title</th>
            <th>Discount</th>
            <th>Usage</th>
            <th>Expiry</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${records.map(row => `
            <tr>
              <td>${escapeHtml(row.id)}</td>
              <td>${escapeHtml(row.title || "—")}</td>
              <td>
                ${row.discountType === "percent"
                  ? `${row.discountValue || 0}%`
                  : `₹${row.discountValue || 0}`
                }
              </td>
              <td>${row.usedCount || 0} / ${row.usageLimit || "∞"}</td>
              <td>${formatDate(row.expiryDate)}</td>
              <td>${statusTag(row.active ? "active" : "inactive")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* Form detail popup */

function openDetails(record) {
  if (!record) return;

  document.querySelector("#detailTitle").textContent =
    record.subject || "Submission Details";

  const values = {
    "Form Type": record.formType,
    "Submitted At": formatDate(record.createdAt),
    ...record.details
  };

  document.querySelector("#detailContent").innerHTML =
    Object.entries(values).map(([key, value]) => `
      <div class="detail-row">
        <b>${escapeHtml(key)}</b>
        <span>${escapeHtml(value || "—")}</span>
      </div>
    `).join("");

  detailModal.hidden = false;
}

document.querySelector("#closeDetailModal")?.addEventListener("click", () => {
  detailModal.hidden = true;
});

detailModal?.addEventListener("click", event => {
  if (event.target === detailModal) {
    detailModal.hidden = true;
  }
});

/* Sidebar */

document.querySelectorAll("[data-admin-tab]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    loadData(button.dataset.adminTab);
  });
});

/* Coupon save */

document.querySelector("#couponForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  const code = String(formData.get("code"))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    showToast("Coupon code must contain 3–30 letters, numbers, hyphen or underscore.");
    return;
  }

  const coupon = {
    title: String(formData.get("title") || code).trim(),
    discountType: formData.get("discountType"),
    discountValue: Number(formData.get("discountValue")),
    minOrder: Number(formData.get("minOrder") || 0),
    maxDiscount: Number(formData.get("maxDiscount") || 0),
    usageLimit: Number(formData.get("usageLimit") || 0),
    active: formData.get("active") === "on",
    updatedAt: serverTimestamp()
  };

  const startDate = formData.get("startDate");
  const expiryDate = formData.get("expiryDate");

  if (startDate) {
    coupon.startDate = Timestamp.fromDate(
      new Date(`${startDate}T00:00:00`)
    );
  }

  if (expiryDate) {
    coupon.expiryDate = Timestamp.fromDate(
      new Date(`${expiryDate}T23:59:59`)
    );
  }

  try {
    const reference = doc(db, "coupons", code);
    const existingCoupon = await getDoc(reference);

    if (!existingCoupon.exists()) {
      coupon.createdAt = serverTimestamp();
      coupon.usedCount = 0;
    }

    await setDoc(reference, coupon, { merge: true });

    form.reset();
    form.querySelector('[name="active"]').checked = true;

    showToast(`Coupon ${code} saved successfully.`);

    refreshCounts();
    loadData("coupons");

  } catch (error) {
    console.error(error);
    showToast("Coupon could not be saved. Check Firestore Rules.");
  }
});