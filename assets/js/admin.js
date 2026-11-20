import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  where,
  limit,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { firebaseConfig, functionsBaseUrl } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = selector => document.querySelector(selector);

const loginBox = $("#adminLogin");
const adminPanel = $("#adminPanel");
const output = $("#dataOut");
const couponManager = $("#couponManager");
const detailModal = $("#detailModal");
const paginationBox = $("#pagination");
const searchInput = $("#tableSearch");
const statusFilter = $("#statusFilter");

const PAGE_SIZE = 10;
const PAID_STATES = ["paid", "processing", "shipped", "completed"];
const ORDER_STATUSES = ["payment_pending", "paid", "processing", "shipped", "completed", "cancelled"];

const state = {
  tab: "orders",
  records: [],
  filtered: [],
  page: 1,
  search: "",
  status: "all",
  cache: {},
  editingCoupon: null
};

const labels = {
  orders: {
    kicker: "ORDER MANAGEMENT",
    title: "Orders Overview",
    description: "Track orders, payment status and fulfilment progress.",
    records: "Recent Orders",
    search: "Search order no, name, mobile, email…"
  },
  enquiries: {
    kicker: "CUSTOMER LEADS",
    title: "Customer Enquiries",
    description: "Contact, Dealer, Bulk Project and Referral form submissions.",
    records: "Recent Enquiries",
    search: "Search name, mobile, email, subject…"
  },
  warranty: {
    kicker: "PRODUCT CARE",
    title: "Warranty Registrations",
    description: "Review warranty activation requests and device details.",
    records: "Warranty Registrations",
    search: "Search name, mobile, serial number…"
  },
  coupons: {
    kicker: "PROMOTION MANAGEMENT",
    title: "Coupons & Offers",
    description: "Create, edit, pause and delete secure discount codes.",
    records: "Saved Coupons",
    search: "Search coupon code or title…"
  }
};


/* =========================================================
   UI HELPERS
========================================================= */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && "seconds" in value) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleString("en-IN") : "—";
}

function dateCell(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `<b class="cell-main" style="font-weight:600">${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</b>
    <small class="cell-sub">${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>`;
}

function inputDate(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function statusTag(status) {
  const clean = String(status || "new").replace(/[^a-z_]/gi, "_").toLowerCase();
  return `<span class="status-tag status-${clean}">${escapeHtml(String(status || "new").replaceAll("_", " "))}</span>`;
}

function showToast(message, type = "info") {
  const stack = $("#toastStack");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i>${type === "success" ? "✓" : type === "error" ? "!" : "i"}</i><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}
window.showToast = showToast;

function confirmDialog({ title, text, okText = "Yes, continue", danger = true }) {
  return new Promise(resolve => {
    const modal = $("#confirmModal");
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    const ok = $("#confirmOk");
    ok.textContent = okText;
    ok.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
    $("#confirmIcon").className = `confirm-icon ${danger ? "" : "info"}`;
    modal.hidden = false;

    const close = result => {
      modal.hidden = true;
      ok.onclick = null;
      $("#confirmCancel").onclick = null;
      resolve(result);
    };
    ok.onclick = () => close(true);
    $("#confirmCancel").onclick = () => close(false);
  });
}

function setButtonLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="btn-spinner"></span> ${escapeHtml(text || "Please wait…")}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

function updateHeading(tab) {
  const item = labels[tab];
  $("#dashboardKicker").textContent = item.kicker;
  $("#dashboardTitle").textContent = item.title;
  $("#dashboardDescription").textContent = item.description;
  $("#recordsTitle").textContent = item.records;
  searchInput.placeholder = item.search;
}


/* =========================================================
   LOGIN
========================================================= */

if (String(firebaseConfig.apiKey || "").startsWith("YOUR_")) {
  $("#configWarning").hidden = false;
}

/* Password eye toggle */
$("#togglePassword")?.addEventListener("click", () => {
  const input = $("#loginPassword");
  const btn = $("#togglePassword");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.classList.toggle("is-visible", show);
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  btn.title = show ? "Hide password" : "Show password";
  input.focus();
});

function loginError(message) {
  const box = $("#loginError");
  box.textContent = message;
  box.hidden = !message;
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(code)) {
    return "Incorrect email or password.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/network-request-failed") return "Network error. Check your internet connection.";
  return "Login failed: " + (error?.message || "Unknown error");
}

$("#loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  loginError("");

  const formData = new FormData(event.target);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    loginError("Please enter your email and password.");
    return;
  }

  const button = $("#loginButton");
  setButtonLoading(button, true, "SIGNING IN…");

  try {
    await setPersistence(auth, $("#rememberMe").checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loginError(friendlyAuthError(error));
  } finally {
    setButtonLoading(button, false);
  }
});

$("#forgotPasswordBtn")?.addEventListener("click", async () => {
  const input = $("#loginEmail");
  const email = input.value.trim();

  if (!email) {
    loginError("Please enter your registered admin email first.");
    input.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    loginError("");
    showToast(`Password reset link sent to ${email}. Check Inbox and Spam.`, "success");
  } catch (error) {
    console.error(error);
    loginError(error.code === "auth/user-not-found" ? "This email is not registered." : "Password reset email could not be sent.");
  }
});

$("#logoutBtn")?.addEventListener("click", async () => {
  const ok = await confirmDialog({ title: "Log out?", text: "You will need to sign in again to access the dashboard.", okText: "Log out", danger: false });
  if (ok) {
    try { localStorage.removeItem("seAdminUid"); } catch {}
    state.panelLoaded = false;
    signOut(auth);
  }
});


/* =========================================================
   AUTH STATE
========================================================= */

/* Splash while Firebase restores the saved login (prevents login flash on refresh) */
function showScreen(name) {
  const splash = $("#authSplash");
  if (splash) splash.hidden = name !== "splash";
  loginBox.hidden = name !== "login";
  adminPanel.hidden = name !== "panel";
}

const ADMIN_CACHE_KEY = "seAdminUid";

onAuthStateChanged(auth, async user => {
  if (!user) {
    try { localStorage.removeItem(ADMIN_CACHE_KEY); } catch {}
    state.cache = {};
    showScreen("login");
    return;
  }

  const openPanel = () => {
    showScreen("panel");
    $("#adminEmail").textContent = user.email;
    $(".admin-initial").textContent = (user.email || "SE").slice(0, 2).toUpperCase();
    if (!state.panelLoaded) {
      state.panelLoaded = true;
      refreshCounts();
      loadData(state.tab);
    }
  };

  // Already verified on this device before -> open instantly, re-check in background
  let cachedUid = null;
  try { cachedUid = localStorage.getItem(ADMIN_CACHE_KEY); } catch {}
  if (cachedUid === user.uid) openPanel();

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));

    if (!adminDoc.exists()) {
      try { localStorage.removeItem(ADMIN_CACHE_KEY); } catch {}
      state.panelLoaded = false;
      await signOut(auth);
      loginError("This account is not authorised as admin.");
      return;
    }

    try { localStorage.setItem(ADMIN_CACHE_KEY, user.uid); } catch {}
    openPanel();

  } catch (error) {
    // Network / temporary error: DON'T log the admin out
    console.error("Admin check failed:", error);
    if (cachedUid === user.uid) {
      showToast("Connection is slow — showing dashboard, some data may not load.", "error");
      return;
    }
    showScreen("login");
    loginError("Could not confirm admin access (network issue?). Please refresh the page.");
  }
});


/* =========================================================
   STAT CARDS
========================================================= */

async function countOf(collectionName, category = null) {
  try {
    const ref = category
      ? query(collection(db, collectionName), where("category", "==", category))
      : collection(db, collectionName);
    const snap = await getCountFromServer(ref);
    return snap.data().count;
  } catch {
    try {
      const ref = category
        ? query(collection(db, collectionName), where("category", "==", category), limit(500))
        : query(collection(db, collectionName), limit(500));
      return (await getDocs(ref)).size;
    } catch {
      return "—";
    }
  }
}

async function refreshCounts() {
  const [orders, enquiries, coupons] = await Promise.all([
    countOf("orders"),
    countOf("formSubmissions", "enquiry"),
    countOf("coupons")
  ]);

  // Warranty counts come from the secure warranty API
  fetchRecords("warranty").then(updateWarrantyCounts).catch(() => { $("#navWarranty").textContent = ""; });

  $("#orderCount").textContent = orders;
  $("#enquiryCount").textContent = enquiries;
  $("#couponCount").textContent = coupons;

  $("#navOrders").textContent = orders || "";
  $("#navEnquiries").textContent = enquiries || "";
  $("#navCoupons").textContent = coupons || "";

  // Revenue needs order data
  try {
    const orderRows = await fetchRecords("orders");
    const paid = orderRows.filter(o => PAID_STATES.includes(o.status));
    const revenue = paid.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0);
    $("#revenueCount").textContent = money(revenue);
    $("#revenueSub").textContent = `${paid.length} paid order${paid.length === 1 ? "" : "s"}`;
    const pending = orderRows.filter(o => o.status === "payment_pending").length;
    $("#orderSub").textContent = `${paid.length} paid · ${pending} pending`;
  } catch { /* ignore */ }

  try {
    const couponRows = await fetchRecords("coupons");
    const active = couponRows.filter(c => c.active === true).length;
    $("#couponSub").textContent = `${active} active · ${couponRows.length - active} paused`;
  } catch { /* ignore */ }
}


/* =========================================================
   DATA
========================================================= */

async function fetchRecords(tab, force = false) {
  if (!force && state.cache[tab]) return state.cache[tab];

  if (tab === "warranty") {
    const data = await warrantyApi("list");
    state.warrantyMeta = { counts: data.counts, serials: data.serials };
    const rows = data.rows || [];
    state.cache.warranty = rows;
    return rows;
  }

  let snapshot;

  if (tab === "orders") {
    snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500)));
  } else if (tab === "coupons") {
    snapshot = await getDocs(collection(db, "coupons"));
  } else {
    snapshot = await getDocs(query(
      collection(db, "formSubmissions"),
      where("category", "==", "enquiry"),
      limit(500)
    ));
  }

  const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));

  records.sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));

  state.cache[tab] = records;
  return records;
}

function searchText(tab, row) {
  if (tab === "orders") {
    const c = row.customer || {};
    return [row.orderNumber, row.id, c.fullName, c.mobile, c.email, c.city, row.cart?.couponCode, row.razorpayPaymentId].join(" ");
  }
  if (tab === "coupons") return [row.id, row.title].join(" ");
  if (tab === "warranty") {
    return [row.serialNumber, row.customerName, row.mobile, row.email, row.purchasedFrom, row.installedBy,
      row.installationAddress, row.wireLength ? row.wireLength + "m" : "", row.status, row.registrationId].join(" ");
  }
  const d = row.details || {};
  return [row.formType, row.subject, ...Object.values(d)].join(" ");
}

function setupStatusFilter(tab) {
  let options = [];
  if (tab === "orders") {
    options = [["all", "All statuses"], ...ORDER_STATUSES.map(s => [s, s.replaceAll("_", " ")])];
  } else if (tab === "coupons") {
    options = [["all", "All coupons"], ["active", "Active"], ["paused", "Paused"]];
  } else if (tab === "warranty") {
    options = [["all", "All statuses"], ["pending", "Pending approval"], ["approved", "Approved"],
      ["rejected", "Rejected"], ["late", "Late (> 15 days)"]];
  } else {
    const types = [...new Set(state.records.map(r => r.formType).filter(Boolean))];
    options = types.length > 1 ? [["all", "All form types"], ...types.map(t => [t, t])] : [];
  }

  statusFilter.hidden = !options.length;
  statusFilter.innerHTML = options.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join("");
  statusFilter.value = "all";
  state.status = "all";

  // extra warranty filters
  const extra = $("#warrantyFilters");
  if (extra) {
    extra.hidden = tab !== "warranty";
    if (tab === "warranty") {
      const lengths = [...new Set(state.records.map(r => String(r.wireLength || "")).filter(Boolean))]
        .sort((a, b) => Number(a) - Number(b));
      $("#wfLength").innerHTML = `<option value="">All wire lengths</option>` +
        lengths.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)} m</option>`).join("");
      $("#wfFrom").value = ""; $("#wfTo").value = ""; $("#wfLength").value = "";
    }
  }
  $("#warrantyTools") && ($("#warrantyTools").hidden = tab !== "warranty");
  $("#warrantySummary") && ($("#warrantySummary").hidden = tab !== "warranty");
}

function applyFilters() {
  const term = state.search.trim().toLowerCase();
  const tab = state.tab;

  state.filtered = state.records.filter(row => {
    if (term && !searchText(tab, row).toLowerCase().includes(term)) return false;
    if (tab === "warranty" && !warrantyExtraMatch(row)) return false;
    if (state.status === "all") return true;
    if (tab === "warranty") return state.status === "late" ? row.lateRegistration === true : row.status === state.status;
    if (tab === "orders") return row.status === state.status;
    if (tab === "coupons") return state.status === "active" ? row.active === true : row.active !== true;
    return row.formType === state.status;
  });

  if (tab === "warranty") {
    // Pending approvals always on top, newest first
    const rank = { pending: 0, approved: 1, rejected: 2 };
    state.filtered.sort((a, b) =>
      (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  if (state.page > pages) state.page = pages;

  render();
}

async function loadData(tab, force = false) {
  state.tab = tab;
  state.page = 1;
  state.search = "";
  searchInput.value = "";
  updateHeading(tab);

  couponManager.hidden = tab !== "coupons";
  if (tab !== "coupons") resetCouponForm();

  output.innerHTML = `<div class="admin-loading"><span></span> Loading dashboard data…</div>`;
  paginationBox.hidden = true;

  try {
    state.records = await fetchRecords(tab, force);
    setupStatusFilter(tab);
    applyFilters();
  } catch (error) {
    console.error(error);
    output.innerHTML = `<div class="admin-empty error">Unable to load records. Check Firebase Rules and setup.</div>`;
    $("#recordCount").textContent = "ERROR";
  }
}

function render() {
  const total = state.filtered.length;
  $("#recordCount").textContent = `${state.records.length} RECORD${state.records.length === 1 ? "" : "S"}`;
  if (state.tab === "warranty") updateWarrantyCounts(state.records);

  if (!total) {
    output.innerHTML = `
      <div class="admin-empty">
        <div class="empty-icon">⌕</div>
        <b>${state.records.length ? "No matching records" : (state.tab === "warranty" ? "No warranty registrations yet" : "No records yet")}</b>
        <p>${state.records.length ? "Try a different search or filter." : "New data will appear here automatically."}</p>
      </div>`;
    paginationBox.hidden = true;
    return;
  }

  const start = (state.page - 1) * PAGE_SIZE;
  const rows = state.filtered.slice(start, start + PAGE_SIZE);

  if (state.tab === "orders") renderOrders(rows);
  else if (state.tab === "coupons") renderCoupons(rows);
  else if (state.tab === "warranty") renderWarranty(rows);
  else renderForms(rows);

  renderPagination(total, start, rows.length);
}

function renderPagination(total, start, count) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const current = state.page;

  const numbers = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== "…") numbers.push("…");
  }

  paginationBox.hidden = false;
  paginationBox.innerHTML = `
    <span class="page-info">Showing <b>${start + 1}–${start + count}</b> of <b>${total}</b></span>
    <div class="page-buttons">
      <button type="button" data-page="${current - 1}" ${current === 1 ? "disabled" : ""}>‹ Prev</button>
      ${numbers.map(n => n === "…"
        ? `<span class="page-dots">…</span>`
        : `<button type="button" data-page="${n}" class="${n === current ? "active" : ""}">${n}</button>`
      ).join("")}
      <button type="button" data-page="${current + 1}" ${current === pages ? "disabled" : ""}>Next ›</button>
    </div>`;
}

paginationBox.addEventListener("click", event => {
  const btn = event.target.closest("button[data-page]");
  if (!btn || btn.disabled) return;
  state.page = Number(btn.dataset.page);
  render();
  $(".records-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value;
    state.page = 1;
    applyFilters();
  }, 200);
});

statusFilter.addEventListener("change", () => {
  state.status = statusFilter.value;
  state.page = 1;
  applyFilters();
});

$("#refreshBtn")?.addEventListener("click", async () => {
  state.cache = {};
  await loadData(state.tab, true);
  refreshCounts();
  showToast("Data refreshed.", "success");
});


/* =========================================================
   ORDERS
========================================================= */

function renderOrders(rows) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Mobile</th>
            <th>Amount</th>
            <th>Coupon</th>
            <th>Created</th>
            <th>Status</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>
                <b class="cell-main">${escapeHtml(row.orderNumber || "—")}</b>
                <small class="cell-sub mono">${escapeHtml(row.id)}</small>
              </td>
              <td class="cust">
                <b class="cell-main">${escapeHtml(row.customer?.fullName || "—")}</b>
                <small class="cell-sub">${escapeHtml(row.customer?.email || "")}</small>
              </td>
              <td>${escapeHtml(row.customer?.mobile || "—")}</td>
              <td><b>${money(row.pricing?.total)}</b></td>
              <td>${row.cart?.couponCode ? `<span class="coupon-chip">${escapeHtml(row.cart.couponCode)}</span>` : "—"}</td>
              <td class="nowrap">${dateCell(row.createdAt)}</td>
              <td>
                <div class="status-cell">
                  <select class="order-status st-${escapeHtml(row.status || "")}" data-id="${escapeHtml(row.id)}" aria-label="Change status">
                    ${ORDER_STATUSES.map(s => `<option value="${s}" ${row.status === s ? "selected" : ""}>${s.replaceAll("_", " ")}</option>`).join("")}
                  </select>
                </div>
              </td>
              <td class="td-actions">
                <button type="button" class="row-btn view" data-view-order="${escapeHtml(row.id)}" title="View details">👁 View</button>
                <button type="button" class="row-btn edit" data-edit-order="${escapeHtml(row.id)}" title="Edit details">✎ Edit</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

  output.querySelectorAll(".order-status").forEach(select => {
    select.addEventListener("change", () => changeOrderStatus(select));
  });

  output.querySelectorAll("[data-view-order]").forEach(btn => {
    btn.addEventListener("click", () => openOrder(btn.dataset.viewOrder, false));
  });

  output.querySelectorAll("[data-edit-order]").forEach(btn => {
    btn.addEventListener("click", () => openOrder(btn.dataset.editOrder, true));
  });
}

async function changeOrderStatus(select) {
  const id = select.dataset.id;
  const record = state.records.find(r => r.id === id);
  const previous = record?.status;
  const next = select.value;

  if (next === "cancelled" || (PAID_STATES.includes(previous) && next === "payment_pending")) {
    const ok = await confirmDialog({
      title: "Change order status?",
      text: `Change ${record?.orderNumber || id} from "${String(previous).replaceAll("_", " ")}" to "${next.replaceAll("_", " ")}"?`,
      okText: "Yes, change"
    });
    if (!ok) { select.value = previous; return; }
  }

  select.disabled = true;
  try {
    await updateDoc(doc(db, "orders", id), { status: next, updatedAt: serverTimestamp() });
    if (record) record.status = next;
    showToast("Order status updated.", "success");
    render();
    refreshCounts();
  } catch (error) {
    console.error(error);
    showToast("Order update failed.", "error");
    select.value = previous;
    select.disabled = false;
  }
}

function infoRow(label, value, mono = false) {
  return `<div class="info-row"><span>${escapeHtml(label)}</span><b class="${mono ? "mono" : ""}">${escapeHtml(value || "—")}</b></div>`;
}

function automationBadge(value) {
  const v = String(value || "pending");
  const cls = ["created", "done", "sent", "success", "completed"].includes(v) ? "ok"
    : ["failed", "error"].includes(v) ? "bad"
      : ["not_configured"].includes(v) ? "muted" : "wait";
  return `<span class="auto-badge ${cls}">${escapeHtml(v.replaceAll("_", " "))}</span>`;
}

function openModal(kicker, title, html) {
  $("#detailKicker").textContent = kicker;
  $("#detailTitle").textContent = title;
  $("#detailContent").innerHTML = html;
  detailModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  detailModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openOrder(id, editMode) {
  const order = state.records.find(r => r.id === id) || state.cache.orders?.find(r => r.id === id);
  if (!order) return;
  if (editMode) renderOrderEdit(order);
  else renderOrderView(order);
}

function renderOrderView(order) {
  const c = order.customer || {};
  const p = order.pricing || {};
  const cart = order.cart || {};
  const s = order.shipping || {};
  const items = Array.isArray(cart.accessories) ? cart.accessories : [];

  const html = `
    <div class="order-detail-top">
      <div><span>Status</span>${statusTag(order.status)}</div>
      <div><span>Amount</span><b>${money(p.total)}</b></div>
      <div><span>Created</span><b>${formatDate(order.createdAt)}</b></div>
      <div><span>Paid at</span><b>${formatDate(order.paidAt)}</b></div>
    </div>

    <div class="detail-grid">
      <section class="detail-card">
        <h4>Customer</h4>
        ${infoRow("Name", c.fullName)}
        ${infoRow("Mobile", c.mobile)}
        ${infoRow("Email", c.email)}
        ${c.companyName ? infoRow("Company", c.companyName) : ""}
        ${c.companyGST ? infoRow("GSTIN", c.companyGST) : ""}
        ${infoRow("Billing address", [c.address, c.city, c.state, c.pincode].filter(Boolean).join(", "))}
        ${infoRow("Installation address", c.installationAddress || c.address)}
      </section>

      <section class="detail-card">
        <h4>Items &amp; Pricing</h4>
        ${infoRow(`SAFE ESCAPE ${cart.length || ""}m × ${cart.quantity || 1}`, money(p.product))}
        ${items.map(a => infoRow(`${a.name} × ${a.quantity || 1}`, money(Number(a.price || 0) * Number(a.quantity || 1)))).join("")}
        ${infoRow("Subtotal", money(p.subtotal))}
        ${infoRow("Bulk discount", "−" + money(p.bulk))}
        ${infoRow(`Coupon${cart.couponCode ? ` (${cart.couponCode})` : ""}`, "−" + money(p.couponDiscount))}
        <div class="info-row total"><span>Total paid</span><b>${money(p.total)}</b></div>
      </section>

      <section class="detail-card">
        <h4>Payment</h4>
        ${infoRow("Order number", order.orderNumber)}
        ${infoRow("Invoice number", order.invoiceNumber)}
        ${infoRow("Razorpay order", order.razorpayOrderId, true)}
        ${infoRow("Razorpay payment", order.razorpayPaymentId, true)}
        ${infoRow("Firestore ID", order.id, true)}
      </section>

      <section class="detail-card">
        <h4>Shipping &amp; Automation</h4>
        <div class="info-row"><span>Shiprocket</span>${automationBadge(order.shippingStatus || s.status)}</div>
        ${s.courier ? infoRow("Courier", s.courier) : ""}
        ${s.awb ? infoRow("AWB", s.awb, true) : ""}
        ${s.trackingUrl ? `<div class="info-row"><span>Tracking</span><a href="${escapeHtml(s.trackingUrl)}" target="_blank" rel="noopener">Open tracking ↗</a></div>` : ""}
        ${s.error ? `<p class="auto-error">${escapeHtml(s.error)}</p>` : ""}
        <div class="info-row"><span>Google Sheet</span>${automationBadge(order.sheetStatus)}</div>
        <div class="info-row"><span>PDF Invoice</span>${automationBadge(order.invoiceStatus)}</div>
        <div class="info-row"><span>Customer Email</span>${automationBadge(order.emailStatus)}</div>
        ${order.invoiceDriveUrl ? `<div class="info-row"><span>Invoice PDF</span><a href="${escapeHtml(order.invoiceDriveUrl)}" target="_blank" rel="noopener">Open in Drive ↗</a></div>` : ""}
        ${order.documentsError ? `<p class="auto-error">${escapeHtml(order.documentsError)}</p>` : ""}
      </section>
    </div>

    ${order.adminNote ? `<div class="admin-note"><b>Admin note</b><p>${escapeHtml(order.adminNote)}</p></div>` : ""}

    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="orderEditBtn">✎ EDIT DETAILS</button>
      ${PAID_STATES.includes(order.status) ? `
        <button type="button" class="btn btn-light" id="retryShipping" ${s.status === "created" ? "disabled title='Shiprocket order already created'" : ""}>⟳ Retry Shiprocket</button>
        <button type="button" class="btn btn-light" id="retryDocs">✉ Resend Invoice &amp; Email</button>` : ""}
      ${c.mobile ? `<a class="btn btn-light" href="tel:${escapeHtml(c.mobile)}">📞 Call</a>
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://wa.me/91${escapeHtml(String(c.mobile).replace(/\D/g, "").slice(-10))}">💬 WhatsApp</a>` : ""}
    </div>`;

  openModal("ORDER DETAILS", order.orderNumber || "Order", html);

  $("#orderEditBtn")?.addEventListener("click", () => renderOrderEdit(order));
  $("#retryShipping")?.addEventListener("click", e => runAutomation(order, "shipping", e.currentTarget));
  $("#retryDocs")?.addEventListener("click", e => runAutomation(order, "documents", e.currentTarget));
}

function field(label, name, value, type = "text", full = false) {
  return `
    <div class="field ${full ? "full" : ""}">
      <label>${escapeHtml(label)}</label>
      ${type === "textarea"
        ? `<textarea name="${name}" rows="3">${escapeHtml(value || "")}</textarea>`
        : `<input type="${type}" name="${name}" value="${escapeHtml(value || "")}">`}
    </div>`;
}

function renderOrderEdit(order) {
  const c = order.customer || {};
  const s = order.shipping || {};

  const html = `
    <form id="orderEditForm" class="edit-form">
      <h4 class="form-group-title">Order</h4>
      <div class="edit-grid">
        <div class="field">
          <label>Status</label>
          <select name="status">
            ${ORDER_STATUSES.map(st => `<option value="${st}" ${order.status === st ? "selected" : ""}>${st.replaceAll("_", " ")}</option>`).join("")}
          </select>
        </div>
        ${field("Admin note (internal)", "adminNote", order.adminNote, "textarea", true)}
      </div>

      <h4 class="form-group-title">Customer details</h4>
      <div class="edit-grid">
        ${field("Full name", "customer.fullName", c.fullName)}
        ${field("Mobile", "customer.mobile", c.mobile, "tel")}
        ${field("Email", "customer.email", c.email, "email")}
        ${field("Company name", "customer.companyName", c.companyName)}
        ${field("GSTIN", "customer.companyGST", c.companyGST)}
        ${field("Pincode", "customer.pincode", c.pincode)}
        ${field("City", "customer.city", c.city)}
        ${field("State", "customer.state", c.state)}
        ${field("Billing address", "customer.address", c.address, "textarea", true)}
        ${field("Installation address", "customer.installationAddress", c.installationAddress, "textarea", true)}
      </div>

      <h4 class="form-group-title">Shipping / tracking</h4>
      <div class="edit-grid">
        ${field("Courier", "shipping.courier", s.courier)}
        ${field("AWB / Tracking no.", "shipping.awb", s.awb)}
        ${field("Tracking URL", "shipping.trackingUrl", s.trackingUrl, "url", true)}
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn btn-primary" id="orderSaveBtn">SAVE CHANGES →</button>
        <button type="button" class="btn btn-light" id="orderBackBtn">Cancel</button>
      </div>
    </form>`;

  openModal("EDIT ORDER", order.orderNumber || order.id, html);

  $("#orderBackBtn").addEventListener("click", () => renderOrderView(order));

  $("#orderEditForm").addEventListener("submit", async event => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const updates = { updatedAt: serverTimestamp() };

    for (const [key, raw] of fd.entries()) {
      updates[key] = String(raw).trim();
    }

    if (updates["shipping.awb"] && !updates["shipping.trackingUrl"]) {
      updates["shipping.trackingUrl"] = `https://shiprocket.co/tracking/${encodeURIComponent(updates["shipping.awb"])}`;
    }

    const btn = $("#orderSaveBtn");
    setButtonLoading(btn, true, "SAVING…");

    try {
      await updateDoc(doc(db, "orders", order.id), updates);

      // Update local copy without reloading
      order.status = updates.status;
      order.adminNote = updates.adminNote;
      order.customer = { ...(order.customer || {}) };
      order.shipping = { ...(order.shipping || {}) };
      for (const [key, value] of Object.entries(updates)) {
        if (key.startsWith("customer.")) order.customer[key.slice(9)] = value;
        if (key.startsWith("shipping.")) order.shipping[key.slice(9)] = value;
      }

      showToast("Order details saved.", "success");
      render();
      renderOrderView(order);
      refreshCounts();
    } catch (error) {
      console.error(error);
      showToast("Could not save order. Check Firestore Rules.", "error");
      setButtonLoading(btn, false);
    }
  });
}

async function runAutomation(order, step, button) {
  const isDocs = step === "documents";
  if (isDocs) {
    const ok = await confirmDialog({
      title: "Resend invoice & email?",
      text: "This will re-run Google Sheet + PDF invoice and send the order email to the customer again.",
      okText: "Yes, resend",
      danger: false
    });
    if (!ok) return;
  }

  setButtonLoading(button, true, "Working…");

  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${functionsBaseUrl || ""}/process-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderRef: order.id, step, force: true })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) throw new Error(data.message || `Request failed (${res.status})`);

    showToast(`${isDocs ? "Invoice/email" : "Shiprocket"}: ${String(data.status || "done").replaceAll("_", " ")}`,
      ["failed"].includes(data.status) ? "error" : "success");

    // reload this order
    const fresh = await getDoc(doc(db, "orders", order.id));
    if (fresh.exists()) {
      Object.assign(order, { id: fresh.id, ...fresh.data() });
      render();
      renderOrderView(order);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "Automation failed.", "error");
    setButtonLoading(button, false);
  }
}


/* =========================================================
   ENQUIRIES / WARRANTY
========================================================= */

function renderForms(rows) {
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
            <th class="th-actions">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${statusTag(row.formType)}</td>
              <td><b class="cell-main">${escapeHtml(row.details?.name || row.details?.customerName || row.details?.fullName || "—")}</b></td>
              <td>${escapeHtml(row.details?.mobile || row.details?.phone || "—")}</td>
              <td>${escapeHtml(row.details?.email || "—")}</td>
              <td>${escapeHtml(row.subject || "—")}</td>
              <td class="nowrap">${dateCell(row.createdAt)}</td>
              <td class="td-actions">
                <button type="button" class="row-btn view" data-form-id="${escapeHtml(row.id)}">👁 View</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

  output.querySelectorAll("[data-form-id]").forEach(button => {
    button.addEventListener("click", () => {
      openFormDetails(state.records.find(item => item.id === button.dataset.formId));
    });
  });
}

function openFormDetails(record) {
  if (!record) return;

  const values = {
    "Form Type": record.formType,
    "Submitted At": formatDate(record.createdAt),
    ...record.details
  };

  const mobile = record.details?.mobile || record.details?.phone;

  const html = `
    <div class="detail-card">
      ${Object.entries(values).map(([key, value]) => `
        <div class="info-row">
          <span>${escapeHtml(key)}</span>
          <b>${escapeHtml(typeof value === "object" && value !== null ? (toDate(value)?.toLocaleString("en-IN") || JSON.stringify(value)) : (value || "—"))}</b>
        </div>`).join("")}
    </div>
    ${mobile ? `
      <div class="modal-actions">
        <a class="btn btn-primary" href="tel:${escapeHtml(mobile)}">📞 Call</a>
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://wa.me/91${escapeHtml(String(mobile).replace(/\D/g, "").slice(-10))}">💬 WhatsApp</a>
        ${record.details?.email ? `<a class="btn btn-light" href="mailto:${escapeHtml(record.details.email)}">✉ Email</a>` : ""}
      </div>` : ""}`;

  openModal("FORM DETAILS", record.subject || "Submission Details", html);
}

$("#closeDetailModal")?.addEventListener("click", closeModal);
detailModal?.addEventListener("click", event => {
  if (event.target === detailModal) closeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !detailModal.hidden) closeModal();
});


/* =========================================================
   COUPONS
========================================================= */

function couponExpired(row) {
  const end = toDate(row.expiryDate);
  return end && end < new Date();
}

function renderCoupons(rows) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Coupon Code</th>
            <th>Title</th>
            <th>Discount</th>
            <th>Min Order</th>
            <th>Usage</th>
            <th>Validity</th>
            <th>Status</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            const expired = couponExpired(row);
            const statusLabel = expired ? "expired" : row.active ? "active" : "paused";
            return `
            <tr class="${row.active ? "" : "row-muted"}">
              <td><span class="coupon-chip big">${escapeHtml(row.id)}</span></td>
              <td>${escapeHtml(row.title || "—")}</td>
              <td><b>${row.discountType === "percent" ? `${row.discountValue || 0}%` : money(row.discountValue)}</b>
                ${Number(row.maxDiscount) > 0 ? `<small class="cell-sub">max ${money(row.maxDiscount)}</small>` : ""}</td>
              <td>${Number(row.minOrder) > 0 ? money(row.minOrder) : "—"}</td>
              <td>${row.usedCount || 0} / ${Number(row.usageLimit) > 0 ? row.usageLimit : "∞"}</td>
              <td class="nowrap">
                <small class="cell-sub">From: ${toDate(row.startDate) ? toDate(row.startDate).toLocaleDateString("en-IN") : "—"}</small>
                <small class="cell-sub">To: ${toDate(row.expiryDate) ? toDate(row.expiryDate).toLocaleDateString("en-IN") : "No expiry"}</small>
              </td>
              <td>${statusTag(statusLabel)}</td>
              <td class="td-actions">
                <button type="button" class="row-btn ${row.active ? "pause" : "play"}" data-toggle-coupon="${escapeHtml(row.id)}"
                  title="${row.active ? "Pause coupon" : "Activate coupon"}">
                  ${row.active ? "❚❚ Pause" : "▶ Play"}
                </button>
                <button type="button" class="row-btn edit" data-edit-coupon="${escapeHtml(row.id)}" title="Edit coupon">✎ Edit</button>
                <button type="button" class="row-btn delete" data-delete-coupon="${escapeHtml(row.id)}" title="Delete coupon">🗑 Delete</button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  output.querySelectorAll("[data-toggle-coupon]").forEach(btn => {
    btn.addEventListener("click", () => toggleCoupon(btn.dataset.toggleCoupon, btn));
  });
  output.querySelectorAll("[data-edit-coupon]").forEach(btn => {
    btn.addEventListener("click", () => editCoupon(btn.dataset.editCoupon));
  });
  output.querySelectorAll("[data-delete-coupon]").forEach(btn => {
    btn.addEventListener("click", () => removeCoupon(btn.dataset.deleteCoupon));
  });
}

async function toggleCoupon(code, button) {
  const coupon = state.records.find(r => r.id === code);
  if (!coupon) return;
  const next = !coupon.active;

  setButtonLoading(button, true, next ? "Activating…" : "Pausing…");
  try {
    await updateDoc(doc(db, "coupons", code), { active: next, updatedAt: serverTimestamp() });
    coupon.active = next;
    showToast(`Coupon ${code} ${next ? "activated" : "paused"}.`, "success");
    applyFilters();
    refreshCounts();
  } catch (error) {
    console.error(error);
    showToast("Could not update coupon.", "error");
    setButtonLoading(button, false);
  }
}

async function removeCoupon(code) {
  const ok = await confirmDialog({
    title: `Delete coupon ${code}?`,
    text: "This coupon will be permanently removed and customers will no longer be able to use it. This cannot be undone.",
    okText: "Yes, delete"
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "coupons", code));
    state.records = state.records.filter(r => r.id !== code);
    state.cache.coupons = state.records;
    if (state.editingCoupon === code) resetCouponForm();
    showToast(`Coupon ${code} deleted.`, "success");
    applyFilters();
    refreshCounts();
  } catch (error) {
    console.error(error);
    showToast("Could not delete coupon. Check Firestore Rules.", "error");
  }
}

const couponForm = $("#couponForm");
const cf = name => couponForm.elements.namedItem(name);

function editCoupon(code) {
  const c = state.records.find(r => r.id === code);
  if (!c) return;

  state.editingCoupon = code;
  cf("code").value = code;
  cf("code").readOnly = true;
  cf("title").value = c.title || "";
  cf("discountType").value = c.discountType || "percent";
  cf("discountValue").value = c.discountValue ?? "";
  cf("minOrder").value = c.minOrder ?? 0;
  cf("maxDiscount").value = c.maxDiscount ?? 0;
  cf("usageLimit").value = c.usageLimit ?? 0;
  cf("startDate").value = inputDate(c.startDate);
  cf("expiryDate").value = inputDate(c.expiryDate);
  cf("active").checked = c.active === true;

  $("#couponFormTitle").textContent = `Edit Coupon · ${code}`;
  $("#couponFormKicker").textContent = "EDITING COUPON";
  $("#couponSaveLabel").textContent = "UPDATE COUPON";
  $("#couponCancelEdit").hidden = false;
  couponManager.classList.add("is-editing");
  couponManager.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetCouponForm() {
  state.editingCoupon = null;
  couponForm.reset();
  cf("code").readOnly = false;
  cf("active").checked = true;
  $("#couponFormTitle").textContent = "Create New Coupon";
  $("#couponFormKicker").textContent = "DISCOUNT MANAGEMENT";
  $("#couponSaveLabel").textContent = "SAVE COUPON";
  $("#couponCancelEdit").hidden = true;
  couponManager.classList.remove("is-editing");
}

$("#couponCancelEdit")?.addEventListener("click", resetCouponForm);

couponForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(couponForm);
  const code = String(formData.get("code")).trim().toUpperCase().replace(/\s+/g, "");

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    showToast("Coupon code must contain 3–30 letters, numbers, hyphen or underscore.", "error");
    return;
  }

  const discountType = formData.get("discountType");
  const discountValue = Number(formData.get("discountValue"));

  if (!(discountValue > 0)) {
    showToast("Discount value must be greater than 0.", "error");
    return;
  }
  if (discountType === "percent" && discountValue > 100) {
    showToast("Percentage discount cannot be more than 100%.", "error");
    return;
  }

  const startDate = formData.get("startDate");
  const expiryDate = formData.get("expiryDate");

  if (startDate && expiryDate && expiryDate < startDate) {
    showToast("Expiry date cannot be before start date.", "error");
    return;
  }

  const isEdit = state.editingCoupon === code;

  const coupon = {
    title: String(formData.get("title") || code).trim(),
    discountType,
    discountValue,
    minOrder: Number(formData.get("minOrder") || 0),
    maxDiscount: Number(formData.get("maxDiscount") || 0),
    usageLimit: Number(formData.get("usageLimit") || 0),
    active: formData.get("active") === "on",
    updatedAt: serverTimestamp(),
    startDate: startDate ? Timestamp.fromDate(new Date(`${startDate}T00:00:00`)) : deleteField(),
    expiryDate: expiryDate ? Timestamp.fromDate(new Date(`${expiryDate}T23:59:59`)) : deleteField()
  };

  const button = $("#couponSaveBtn");
  setButtonLoading(button, true, isEdit ? "UPDATING…" : "SAVING…");

  try {
    const reference = doc(db, "coupons", code);
    const existing = await getDoc(reference);

    if (existing.exists() && !isEdit) {
      const ok = await confirmDialog({
        title: `Coupon ${code} already exists`,
        text: "Do you want to overwrite its settings? Usage count will be kept.",
        okText: "Overwrite",
        danger: false
      });
      if (!ok) { setButtonLoading(button, false); return; }
    }

    if (!existing.exists()) {
      coupon.createdAt = serverTimestamp();
      coupon.usedCount = 0;
    }

    await setDoc(reference, coupon, { merge: true });

    showToast(`Coupon ${code} ${isEdit ? "updated" : "saved"} successfully.`, "success");
    resetCouponForm();
    state.cache.coupons = null;
    await loadData("coupons", true);
    refreshCounts();
  } catch (error) {
    console.error(error);
    showToast("Coupon could not be saved. Check Firestore Rules.", "error");
  } finally {
    setButtonLoading(button, false);
  }
});


/* =========================================================
   SIDEBAR
========================================================= */

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

document.querySelectorAll("[data-admin-tab]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    closeSidebar();
    loadData(button.dataset.adminTab);
  });
});

$("#menuToggle")?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
$("#sidebarBackdrop")?.addEventListener("click", closeSidebar);



/* =========================================================
   WARRANTY REGISTRATIONS
========================================================= */

const REJECT_REASONS = [
  "Warranty registration was submitted after 15 days of purchase.",
  "The details filled in the form are incorrect or do not match our records.",
  "The uploaded photo is not clear / does not show the installed SAFE ESCAPE device.",
  "The serial number details do not match the product supplied.",
  "Product was not purchased from an authorised SAFE ESCAPE seller."
];

async function warrantyApi(action, body = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${functionsBaseUrl || "/.netlify/functions"}/warranty-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...body })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

function prettyDay(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value ? formatDate(value) : "—";
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function updateWarrantyCounts(rows = []) {
  const c = { pending: 0, approved: 0, rejected: 0 };
  rows.forEach(r => { if (c[r.status] !== undefined) c[r.status] += 1; });

  const nav = $("#navWarranty");
  if (nav) {
    nav.textContent = c.pending ? c.pending : (rows.length || "");
    nav.classList.toggle("nav-count-alert", c.pending > 0);
    nav.title = c.pending ? `${c.pending} pending approval` : "";
  }

  const box = $("#warrantySummary");
  if (box) {
    box.innerHTML = `
      <span class="sum-chip pending" data-sum="pending">⏳ <b>${c.pending}</b> Pending approval</span>
      <span class="sum-chip approved" data-sum="approved">✓ <b>${c.approved}</b> Approved</span>
      <span class="sum-chip rejected" data-sum="rejected">✕ <b>${c.rejected}</b> Rejected</span>`;
  }

  const serials = state.warrantyMeta?.serials;
  const sInfo = $("#serialInfo");
  if (sInfo && serials) {
    sInfo.textContent = `${serials.total} serials uploaded · ${serials.registered} registered`;
  }
}

function warrantyExtraMatch(row) {
  const from = $("#wfFrom")?.value;
  const to = $("#wfTo")?.value;
  const len = $("#wfLength")?.value;
  const day = String(row.purchaseDate || "").slice(0, 10);
  if (from && (!day || day < from)) return false;
  if (to && (!day || day > to)) return false;
  if (len && String(row.wireLength || "") !== len) return false;
  return true;
}

["#wfFrom", "#wfTo", "#wfLength"].forEach(sel => {
  $(sel)?.addEventListener("change", () => { state.page = 1; applyFilters(); });
});
$("#wfClear")?.addEventListener("click", () => {
  $("#wfFrom").value = ""; $("#wfTo").value = ""; $("#wfLength").value = "";
  statusFilter.value = "all"; state.status = "all";
  searchInput.value = ""; state.search = "";
  state.page = 1; applyFilters();
});

$("#warrantySummary")?.addEventListener("click", e => {
  const chip = e.target.closest("[data-sum]");
  if (!chip) return;
  statusFilter.value = chip.dataset.sum;
  state.status = chip.dataset.sum;
  state.page = 1;
  applyFilters();
});

function photoButton(row, cls = "row-btn image") {
  const label = cls.startsWith("row-btn") ? "🖼 Image" : "🖼 View Image";
  if (row.photoUrl) {
    return `<a class="${cls}" href="${escapeHtml(row.photoUrl)}" target="_blank" rel="noopener" title="Open photo in new tab">${label}</a>`;
  }
  if (row.photoPath && !row.photoUrl) {
    return `<span class="${cls} disabled" title="Old record — photo is in Firebase Storage: ${escapeHtml(row.photoPath)}">🖼 In Storage</span>`;
  }
  return `<button type="button" class="${cls}" data-find-photo="${escapeHtml(row.id)}" title="Find photo in Google Drive">${label}</button>`;
}

function renderWarranty(rows) {
  output.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Serial No.</th>
            <th>Customer</th>
            <th>Wire</th>
            <th>Purchase Date</th>
            <th>Purchased From</th>
            <th>Status</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr class="${row.status === "pending" ? "row-pending" : ""}">
              <td>
                <b class="cell-main mono serial">${escapeHtml(row.serialNumber || "—")}</b>
                <small class="cell-sub">Submitted ${toDate(row.createdAt)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) || "—"}</small>
              </td>
              <td class="cust">
                <b class="cell-main">${escapeHtml(row.customerName || "—")}</b>
                <small class="cell-sub">${escapeHtml(row.mobile || "")}${row.email ? " · " + escapeHtml(row.email) : ""}</small>
              </td>
              <td>${row.wireLength ? escapeHtml(row.wireLength) + " m" : "—"}</td>
              <td class="nowrap">
                <b class="cell-main" style="font-weight:600">${prettyDay(row.purchaseDate)}</b>
                ${row.lateRegistration ? `<small class="late-badge" title="Registered ${row.daysSincePurchase} days after purchase">LATE · ${escapeHtml(row.daysSincePurchase)}d</small>`
                  : (row.daysSincePurchase != null ? `<small class="cell-sub">submitted after ${escapeHtml(row.daysSincePurchase)} day${row.daysSincePurchase == 1 ? "" : "s"}</small>` : "")}
              </td>
              <td class="from">${escapeHtml(row.purchasedFrom || "—")}</td>
              <td>
                ${statusTag(row.status)}
                ${row.status === "approved" && row.warrantyEnd ? `<small class="cell-sub">till ${prettyDay(row.warrantyEnd)}</small>` : ""}
              </td>
              <td class="td-actions">
                ${photoButton(row)}
                <button type="button" class="row-btn view" data-view-warranty="${escapeHtml(row.id)}">👁 View</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  output.querySelectorAll("[data-view-warranty]").forEach(btn =>
    btn.addEventListener("click", () => openWarranty(btn.dataset.viewWarranty)));
}

/* "View Image" when the Drive link is not saved yet */
document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-find-photo]");
  if (!btn) return;
  e.preventDefault();
  const win = window.open("", "_blank"); // open now so pop-up blockers allow it
  setButtonLoading(btn, true, "Finding…");
  try {
    const data = await warrantyApi("photo", { id: btn.dataset.findPhoto });
    const rec = state.records.find(r => r.id === btn.dataset.findPhoto);
    if (rec) Object.assign(rec, { photoUrl: data.photoUrl, photoFileId: data.photoFileId });
    if (win) win.location.href = data.photoUrl; else window.open(data.photoUrl, "_blank");
    render();
  } catch (error) {
    win?.close();
    showToast(error.message || "Photo not found.", "error");
    setButtonLoading(btn, false);
  }
});

function warrantyPeriodPreview(purchaseDate) {
  const m = String(purchaseDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const start = new Date(+m[1], +m[2] - 1, +m[3]);
  const end = new Date(+m[1] + 5, +m[2] - 1, +m[3] - 1);
  const f = d => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return { start: f(start), end: f(end) };
}

function openWarranty(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;

  const period = warrantyPeriodPreview(r.purchaseDate);
  const thumb = r.photoFileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(r.photoFileId)}&sz=w900` : "";
  const mobileDigits = String(r.mobile || "").replace(/\D/g, "").slice(-10);

  const decision = r.status === "approved"
    ? `<div class="decision-banner approved">✓ Warranty approved: <b>${prettyDay(r.warrantyStart)}</b> to <b>${prettyDay(r.warrantyEnd)}</b>
         ${r.reviewedBy ? `<small>by ${escapeHtml(r.reviewedBy)} · ${formatDate(r.reviewedAt)}</small>` : ""}</div>`
    : r.status === "rejected"
      ? `<div class="decision-banner rejected">✕ Rejected: ${escapeHtml(r.rejectReason || "—")}
           ${r.reviewedBy ? `<small>by ${escapeHtml(r.reviewedBy)} · ${formatDate(r.reviewedAt)}</small>` : ""}</div>`
      : `<div class="decision-banner pending">⏳ Waiting for approval${r.lateRegistration ? ` — <b>submitted ${escapeHtml(r.daysSincePurchase)} days after purchase (more than 15 days)</b>` : ""}</div>`;

  const html = `
    ${decision}

    <div class="warranty-detail">
      <div class="detail-grid">
        <section class="detail-card">
          <h4>Customer</h4>
          ${infoRow("Name / Company", r.customerName)}
          ${infoRow("Mobile", r.mobile)}
          ${infoRow("Email", r.email)}
        </section>

        <section class="detail-card">
          <h4>Product</h4>
          ${infoRow("Serial number", r.serialNumber, true)}
          ${infoRow("Wire length", r.wireLength ? r.wireLength + " metres" : "")}
          ${infoRow("Purchased from", r.purchasedFrom)}
          ${infoRow("Purchase date", prettyDay(r.purchaseDate))}
          ${infoRow("Days (purchase → submit)", r.daysSincePurchase != null ? String(r.daysSincePurchase) : "")}
        </section>

        <section class="detail-card">
          <h4>Installation</h4>
          ${infoRow("Installed by", r.installedBy)}
          ${infoRow("Installation address", r.installationAddress)}
        </section>

        <section class="detail-card">
          <h4>Record</h4>
          ${infoRow("Submitted", formatDate(r.createdAt))}
          ${infoRow("Registration ID", r.id, true)}
          <div class="info-row"><span>Photo</span>${automationBadge(r.photoStatus === "saved" ? "done" : r.photoStatus)}</div>
          <div class="info-row"><span>Received email</span>${automationBadge(r.emailStatus)}</div>
          ${r.decisionEmailStatus ? `<div class="info-row"><span>Decision email</span>${automationBadge(r.decisionEmailStatus)}</div>` : ""}
          ${r.decisionEmailError ? `<p class="auto-error">${escapeHtml(r.decisionEmailError)}</p>` : ""}
        </section>
      </div>

      <section class="detail-card photo-card">
        <h4>Installed Device Photo</h4>
        ${thumb ? `<a href="${escapeHtml(r.photoUrl)}" target="_blank" rel="noopener"><img src="${thumb}" alt="Installed device photo" loading="lazy"
             onerror="this.parentElement.outerHTML='<p class=&quot;muted&quot;>Preview not available — use View Image.</p>'"></a>` : `<p class="muted">Preview not available.</p>`}
        <div>${photoButton(r, "btn btn-light")}</div>
      </section>
    </div>

    <div class="decision-box">
      ${r.status !== "approved" ? `
        <div class="decision-col">
          <h4>Approve warranty</h4>
          <p>${period ? `5-year warranty will be valid from <b>${period.start}</b> to <b>${period.end}</b>.` : "Purchase date missing."}
             Customer will receive an approval email.</p>
          <button type="button" class="btn btn-success" id="approveWarranty">✓ APPROVE WARRANTY</button>
        </div>` : ""}
      ${r.status !== "rejected" ? `
        <div class="decision-col">
          <h4>${r.status === "approved" ? "Revoke / reject warranty" : "Reject warranty"}</h4>
          <div class="field">
            <label>Reason (sent to customer)</label>
            <select id="rejectReason">
              ${REJECT_REASONS.map(x => `<option>${escapeHtml(x)}</option>`).join("")}
              <option value="__other">Other reason (write below)…</option>
            </select>
          </div>
          <div class="field" id="rejectOtherWrap" hidden>
            <textarea id="rejectOther" rows="2" maxlength="400" placeholder="Write the reason customer will see"></textarea>
          </div>
          <button type="button" class="btn btn-danger" id="rejectWarranty">✕ REJECT</button>
        </div>` : ""}
    </div>

    <div class="modal-actions">
      ${mobileDigits ? `<a class="btn btn-light" href="tel:${escapeHtml(mobileDigits)}">📞 Call</a>
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://wa.me/91${escapeHtml(mobileDigits)}">💬 WhatsApp</a>` : ""}
      ${r.email ? `<a class="btn btn-light" href="mailto:${escapeHtml(r.email)}">✉ Email</a>` : ""}
    </div>`;

  openModal("WARRANTY REGISTRATION", r.serialNumber || "Warranty", html);

  $("#rejectReason")?.addEventListener("change", e => {
    $("#rejectOtherWrap").hidden = e.target.value !== "__other";
  });

  $("#approveWarranty")?.addEventListener("click", async e => {
    const ok = await confirmDialog({
      title: "Approve this warranty?",
      text: `${r.customerName} · ${r.serialNumber}. An approval email${period ? ` (valid ${period.start} – ${period.end})` : ""} will be sent to ${r.email}.`,
      okText: "Yes, approve",
      danger: false
    });
    if (ok) decideWarranty(r.id, "approve", "", e.currentTarget);
  });

  $("#rejectWarranty")?.addEventListener("click", async e => {
    const sel = $("#rejectReason").value;
    const reason = sel === "__other" ? $("#rejectOther").value.trim() : sel;
    if (!reason) { showToast("Please write the rejection reason.", "error"); $("#rejectOther").focus(); return; }
    const ok = await confirmDialog({
      title: "Reject this warranty?",
      text: `A rejection email will be sent to ${r.email} with the reason: "${reason}". The serial number will be free for the customer to register again.`,
      okText: "Yes, reject"
    });
    if (ok) decideWarranty(r.id, "reject", reason, e.currentTarget);
  });
}

async function decideWarranty(id, action, reason, button) {
  setButtonLoading(button, true, action === "approve" ? "APPROVING…" : "REJECTING…");
  try {
    const data = await warrantyApi(action, { id, reason });
    const idx = state.records.findIndex(x => x.id === id);
    if (idx >= 0) state.records[idx] = { ...state.records[idx], ...data.record };
    state.cache.warranty = state.records;
    const mail = data.record.decisionEmailStatus;
    showToast(
      `Warranty ${action === "approve" ? "approved" : "rejected"}. ` +
      (mail === "sent" || mail === "done" ? "Email sent to customer." : mail === "not_configured" ? "Email not configured yet." : "Email status: " + (mail || "pending")),
      "success");
    applyFilters();
    openWarranty(id);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not update warranty.", "error");
    setButtonLoading(button, false);
  }
}


/* =========================================================
   BULK SERIAL UPLOAD
========================================================= */

const SAMPLE_CSV =
  "serialNumber,wireLength,batch\n" +
  "SAFE/ESCAPE/IIZG/006,15,IIZG\n" +
  "SAFE/ESCAPE/IIZG/007,15,IIZG\n" +
  "SAFE/ESCAPE/IIZG/008,20,IIZG\n";

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "safe-escape-serial-numbers-sample.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function splitCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (!q && (ch === "," || ch === ";" || ch === "\t")) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

function rowsFromTable(table) {
  const rows = table.filter(r => r.some(c => String(c ?? "").trim()));
  if (!rows.length) return [];
  let start = 0;
  let cols = { serial: 0, length: 1, batch: 2 };
  const head = rows[0].map(c => String(c ?? "").toLowerCase().replace(/[^a-z]/g, ""));
  if (head.some(h => h.includes("serial"))) {
    start = 1;
    cols = {
      serial: head.findIndex(h => h.includes("serial")),
      length: head.findIndex(h => h.includes("length") || h.includes("wire") || h.includes("metre") || h.includes("meter")),
      batch: head.findIndex(h => h.includes("batch") || h.includes("lot"))
    };
  }
  return rows.slice(start).map(r => ({
    serialNumber: String(r[cols.serial] ?? "").trim().toUpperCase().replace(/\s+/g, ""),
    wireLength: cols.length >= 0 ? String(r[cols.length] ?? "").replace(/[^0-9.]/g, "") : "",
    batch: cols.batch >= 0 ? String(r[cols.batch] ?? "").trim() : ""
  })).filter(r => r.serialNumber);
}

async function parseSerialFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return rowsFromTable(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }));
  }
  const text = await file.text();
  return rowsFromTable(text.replace(/^﻿/, "").split(/\r?\n/).map(splitCsvLine));
}

function openBulkUpload() {
  let parsed = [];

  openModal("SERIAL NUMBERS", "Bulk Upload Serial Numbers", `
    <div class="bulk-steps">
      <div class="bulk-step">
        <span>1</span>
        <div>
          <b>Download the sample file</b>
          <p>Column A: <code>serialNumber</code> (required) · B: <code>wireLength</code> · C: <code>batch</code> (optional)</p>
          <button type="button" class="btn btn-light" id="bulkSample">⬇ DOWNLOAD SAMPLE CSV</button>
        </div>
      </div>
      <div class="bulk-step">
        <span>2</span>
        <div>
          <b>Upload your file (CSV or Excel)</b>
          <label class="drop-zone" id="bulkDrop">
            <input type="file" id="bulkFile" accept=".csv,.txt,.xlsx,.xls" hidden>
            <strong>Click to choose file</strong> or drag &amp; drop here
            <small>.csv · .xlsx · .xls — up to 3000 serial numbers per upload</small>
          </label>
          <p class="bulk-or">— or paste serial numbers (one per line) —</p>
          <textarea id="bulkPaste" rows="4" placeholder="SAFE/ESCAPE/IIZG/006&#10;SAFE/ESCAPE/IIZG/007"></textarea>
        </div>
      </div>
      <div class="bulk-step">
        <span>3</span>
        <div>
          <b>Check &amp; upload</b>
          <div id="bulkPreview" class="bulk-preview muted">No serial numbers selected yet.</div>
          <button type="button" class="btn btn-primary" id="bulkSubmitBtn" disabled>⬆ UPLOAD SERIAL NUMBERS</button>
        </div>
      </div>
    </div>`);

  const preview = $("#bulkPreview");
  const uploadBtn = $("#bulkSubmitBtn");

  const showParsed = (rows, source) => {
    const seen = new Set();
    parsed = rows.filter(r => !seen.has(r.serialNumber) && seen.add(r.serialNumber));
    uploadBtn.disabled = !parsed.length;
    preview.classList.toggle("muted", !parsed.length);
    preview.innerHTML = parsed.length
      ? `<b>${parsed.length}</b> unique serial number${parsed.length === 1 ? "" : "s"} ready from ${escapeHtml(source)}
         <div class="bulk-sample">${parsed.slice(0, 6).map(r =>
           `<code>${escapeHtml(r.serialNumber)}${r.wireLength ? ` · ${escapeHtml(r.wireLength)}m` : ""}</code>`).join("")}${parsed.length > 6 ? `<em>+${parsed.length - 6} more</em>` : ""}</div>`
      : "No serial numbers found. Check that column A has serial numbers.";
  };

  const handleFile = async file => {
    if (!file) return;
    preview.textContent = "Reading file…";
    try {
      showParsed(await parseSerialFile(file), file.name);
    } catch (error) {
      console.error(error);
      preview.textContent = "Could not read this file. Please use the sample CSV format.";
    }
  };

  $("#bulkSample").addEventListener("click", downloadSample);
  $("#bulkFile").addEventListener("change", e => handleFile(e.target.files[0]));

  const drop = $("#bulkDrop");
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));

  $("#bulkPaste").addEventListener("input", e => {
    const lines = e.target.value.split(/\r?\n/).map(splitCsvLine);
    showParsed(rowsFromTable(lines), "pasted text");
  });

  uploadBtn.addEventListener("click", async () => {
    if (!parsed.length) return;
    setButtonLoading(uploadBtn, true, "UPLOADING…");
    const total = { added: 0, existing: 0, invalid: 0, invalidSamples: [] };
    try {
      for (let i = 0; i < parsed.length; i += 3000) {
        const r = await warrantyApi("uploadSerials", { rows: parsed.slice(i, i + 3000) });
        total.added += r.added; total.existing += r.existing; total.invalid += r.invalid;
        total.invalidSamples.push(...(r.invalidSamples || []));
      }

      $("#detailContent").innerHTML = `
        <div class="bulk-done">
          <div class="bulk-done-icon">✓</div>
          <h3>Thank you for the bulk upload!</h3>
          <p>Your serial numbers have been saved. Customers can now register warranty with these serial numbers.</p>
          <div class="bulk-result">
            <div class="ok"><b>${total.added}</b><span>New serials added</span></div>
            <div><b>${total.existing}</b><span>Already existed (skipped)</span></div>
            <div class="${total.invalid ? "bad" : ""}"><b>${total.invalid}</b><span>Invalid (skipped)</span></div>
          </div>
          ${total.invalidSamples.length ? `<p class="auto-error">Invalid examples: ${total.invalidSamples.slice(0, 8).map(escapeHtml).join(", ")}</p>` : ""}
          <div class="modal-actions" style="justify-content:center">
            <button type="button" class="btn btn-light" id="bulkAgain">UPLOAD MORE</button>
            <button type="button" class="btn btn-primary" id="bulkViewList">VIEW SERIAL NUMBERS</button>
          </div>
        </div>`;
      $("#bulkAgain").addEventListener("click", openBulkUpload);
      $("#bulkViewList").addEventListener("click", openSerialList);

      if (state.warrantyMeta?.serials) {
        state.warrantyMeta.serials.total += total.added;
        updateWarrantyCounts(state.records);
      }
      showToast(`${total.added} serial numbers added.`, "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Bulk upload failed.", "error");
      setButtonLoading(uploadBtn, false);
    }
  });
}


/* =========================================================
   SERIAL NUMBER LIST
========================================================= */

async function openSerialList() {
  openModal("SERIAL NUMBERS", "Uploaded Serial Numbers", `<div class="admin-loading"><span></span> Loading serial numbers…</div>`);

  let rows = [];
  try {
    rows = (await warrantyApi("serials")).rows || [];
  } catch (error) {
    $("#detailContent").innerHTML = `<div class="admin-empty error">${escapeHtml(error.message)}</div>`;
    return;
  }

  const st = { q: "", f: "all", page: 1 };
  const SIZE = 10;

  const statusOf = r => !r.active ? "inactive" : r.warrantyStatus === "approved" ? "approved"
    : r.registered ? "registered" : "available";

  $("#detailContent").innerHTML = `
    <div class="table-toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="search" id="serialSearch" placeholder="Search serial number or batch…">
      </div>
      <select id="serialFilter" class="toolbar-select">
        <option value="all">All (${rows.length})</option>
        <option value="available">Available</option>
        <option value="registered">Registered (pending)</option>
        <option value="approved">Warranty approved</option>
      </select>
      <button type="button" class="btn btn-light" id="serialBulk">⬆ BULK UPLOAD</button>
    </div>
    <div id="serialTable"></div>
    <div class="pagination" id="serialPager"></div>`;

  const draw = () => {
    const q = st.q.toLowerCase();
    const list = rows.filter(r =>
      (!q || `${r.serialNumber} ${r.batch}`.toLowerCase().includes(q)) &&
      (st.f === "all" || statusOf(r) === st.f));
    const pages = Math.max(1, Math.ceil(list.length / SIZE));
    st.page = Math.min(st.page, pages);
    const start = (st.page - 1) * SIZE;
    const slice = list.slice(start, start + SIZE);

    $("#serialTable").innerHTML = slice.length ? `
      <div class="data-table-wrap">
        <table class="data-table" style="min-width:640px">
          <thead><tr><th>Serial No.</th><th>Wire</th><th>Batch</th><th>Uploaded</th><th>Status</th><th class="th-actions">Action</th></tr></thead>
          <tbody>
            ${slice.map(r => `
              <tr>
                <td><b class="cell-main mono serial">${escapeHtml(r.serialNumber)}</b></td>
                <td>${r.wireLength ? escapeHtml(r.wireLength) + " m" : "—"}</td>
                <td>${escapeHtml(r.batch || "—")}</td>
                <td class="nowrap">${r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                <td>${statusTag(statusOf(r))}${r.warrantyEnd ? `<small class="cell-sub">till ${prettyDay(r.warrantyEnd)}</small>` : ""}</td>
                <td class="td-actions">${!r.registered
                  ? `<button type="button" class="row-btn delete" data-del-serial="${escapeHtml(r.serialNumber)}">🗑 Delete</button>` : "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<div class="admin-empty"><b>No serial numbers found</b><p>Upload serial numbers using Bulk Upload.</p></div>`;

    $("#serialPager").innerHTML = list.length ? `
      <span class="page-info">Showing <b>${start + 1}–${start + slice.length}</b> of <b>${list.length}</b></span>
      <div class="page-buttons">
        <button type="button" data-sp="${st.page - 1}" ${st.page === 1 ? "disabled" : ""}>‹ Prev</button>
        <button type="button" class="active">${st.page} / ${pages}</button>
        <button type="button" data-sp="${st.page + 1}" ${st.page === pages ? "disabled" : ""}>Next ›</button>
      </div>` : "";
  };

  $("#serialSearch").addEventListener("input", e => { st.q = e.target.value.trim(); st.page = 1; draw(); });
  $("#serialFilter").addEventListener("change", e => { st.f = e.target.value; st.page = 1; draw(); });
  $("#serialBulk").addEventListener("click", openBulkUpload);
  $("#serialPager").addEventListener("click", e => {
    const b = e.target.closest("[data-sp]");
    if (b && !b.disabled) { st.page = Number(b.dataset.sp); draw(); }
  });
  $("#serialTable").addEventListener("click", async e => {
    const b = e.target.closest("[data-del-serial]");
    if (!b) return;
    const serial = b.dataset.delSerial;
    const sure = await confirmDialog({
      title: `Delete ${serial}?`,
      text: "Customers will not be able to register warranty with this serial number.",
      okText: "Yes, delete"
    });
    if (!sure) return;
    setButtonLoading(b, true, "…");
    try {
      await warrantyApi("deleteSerial", { serialNumber: serial });
      rows = rows.filter(r => r.serialNumber !== serial);
      if (state.warrantyMeta?.serials) { state.warrantyMeta.serials.total -= 1; updateWarrantyCounts(state.records); }
      showToast(`Serial ${serial} deleted.`, "success");
      draw();
    } catch (error) {
      showToast(error.message, "error");
      setButtonLoading(b, false);
    }
  });

  draw();
}

$("#bulkUploadBtn")?.addEventListener("click", openBulkUpload);
$("#sampleCsvBtn")?.addEventListener("click", downloadSample);
$("#serialListBtn")?.addEventListener("click", openSerialList);


/* =========================================================
   TEST CONNECTION (Netlify <-> Apps Script <-> Drive/Sheet/Mail)
========================================================= */

async function testWarrantyConnection(button) {
  setButtonLoading(button, true, "Testing…");
  try {
    const d = await warrantyApi("testConnection");
    const c = d.checks || {};
    const sc = d.script || {};
    const row = (label, ok, extra = "") =>
      `<div class="info-row"><span>${escapeHtml(label)}</span>${automationBadge(ok === null ? "pending" : ok ? "done" : "failed")}${extra ? `<b style="margin-left:8px">${escapeHtml(extra)}</b>` : ""}</div>`;

    openModal("WARRANTY SETUP", d.ok ? "Connection OK ✓" : "Connection problem", `
      <div class="decision-banner ${d.ok ? "approved" : "rejected"}">${escapeHtml(d.advice || "")}</div>
      <div class="detail-card">
        ${row("Netlify: WARRANTY_APPS_SCRIPT_URL", c.urlSet && c.urlLooksRight)}
        ${row("Netlify: WARRANTY_APPS_SCRIPT_SECRET", c.secretSet)}
        ${row("Apps Script reachable + SECRET match", d.script ? Boolean(sc.success) : null, sc.success ? "" : (sc.message || ""))}
        ${row("Google Drive permission", d.script && sc.success ? sc.drive !== false : null, sc.driveFolder || sc.driveError || "")}
        ${row("Google Sheet permission", d.script && sc.success ? sc.sheet !== false : null, sc.sheetName || sc.sheetError || "")}
        ${row("ADMIN_EMAIL property", d.script && sc.success ? sc.adminEmail !== "missing" : null)}
        ${sc.mailQuota != null ? `<div class="info-row"><span>Emails left today</span><b>${escapeHtml(sc.mailQuota)}</b></div>` : ""}
      </div>`);
  } catch (error) {
    showToast(error.message || "Test failed.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

$("#testConnBtn")?.addEventListener("click", e => testWarrantyConnection(e.currentTarget));
