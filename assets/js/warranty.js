/* =========================================================
   SAFE ESCAPE — WARRANTY REGISTRATION (Frontend)

   • Live checks: mobile (10 digits), email (format + typo
     suggestion + "are you sure" line), serial number,
     purchase date ("are you sure" line + 15-day notice)
   • Photo preview + compression in the browser (fast upload)
   • Submits to Netlify function  /warranty-submit
     (server re-checks everything, verifies serial, saves to
     Firebase, photo -> Google Drive, row -> Google Sheet,
     email -> customer + SAFE ESCAPE)
   • "Thank you" popup with Contact buttons
========================================================= */

import { functionsBaseUrl } from "./firebase-config.js";

const SUPPORT = {
    phone: "+91 93116 05588",
    tel: "+919311605588",
    whatsapp: "919311605588"
};

const REGISTRATION_DAYS = 15;

const form = document.querySelector("#warrantyForm");
const errorBox = document.querySelector("#warrantyError");
const errorTitle = document.querySelector("#warrantyErrorTitle");
const errorText = document.querySelector("#warrantyErrorText");
const successModal = document.querySelector("#warrantySuccess");

if (!form) console.error("SAFE ESCAPE: Warranty form not found.");

const field = name => form?.elements.namedItem(name);
const hint = name => form?.querySelector(`[data-hint="${name}"]`);
const submitButton = form?.querySelector('button[type="submit"]');
const SUBMIT_LABEL = "Submit Registration →";


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>'"]/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
}

function setHint(name, html, type = "error") {
    const el = hint(name);
    if (!el) return;
    el.innerHTML = html || "";
    el.classList.toggle("show", Boolean(html));
    el.classList.toggle("ok", type === "ok");
}

function markField(name, bad) {
    field(name)?.closest(".field")?.classList.toggle("has-error", Boolean(bad));
}

function showError(message, title = "Please check your details") {
    if (errorTitle) errorTitle.textContent = title;
    if (errorText) errorText.textContent = message;
    errorBox?.classList.add("show");
    errorBox?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
    errorBox?.classList.remove("show");
}

function todayISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
}

function daysSince(value) {
    const d = parseDay(value);
    if (!d) return null;
    const t = new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((today - d) / 86400000);
}

function prettyDate(value) {
    const d = parseDay(value);
    return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : value;
}


/* =========================================================
   MOBILE — exactly 10 digits, starts 6–9
========================================================= */

function checkMobile(final = false) {
    const input = field("mobile");
    const value = input.value;

    if (!value) {
        setHint("mobile", final ? "Please enter your 10-digit mobile number." : "");
        markField("mobile", final);
        return false;
    }
    if (!/^[6-9]/.test(value)) {
        setHint("mobile", "Indian mobile numbers start with 6, 7, 8 or 9.");
        markField("mobile", true);
        return false;
    }
    if (value.length < 10) {
        setHint("mobile", final ? `Mobile number must be 10 digits (you entered ${value.length}).` : "");
        markField("mobile", final);
        return false;
    }
    setHint("mobile", "");
    markField("mobile", false);
    return true;
}

field("mobile")?.addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    checkMobile(false);
});
field("mobile")?.addEventListener("blur", () => checkMobile(true));


/* =========================================================
   EMAIL — format, common typos, "are you sure" line
========================================================= */

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const DOMAIN_FIX = {
    "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
    "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com",
    "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.om": "gmail.com",
    "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com", "yaoo.com": "yahoo.com",
    "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmal.com": "hotmail.com",
    "outlok.com": "outlook.com", "outlook.con": "outlook.com",
    "rediffmail.con": "rediffmail.com", "redifmail.com": "rediffmail.com",
    "icloud.con": "icloud.com"
};

function checkEmail(final = false) {
    const input = field("email");
    const value = input.value.trim().toLowerCase();

    if (!value) {
        setHint("email", final ? "Please enter your email address." : "");
        markField("email", final);
        return false;
    }

    if (/\s/.test(input.value.trim()) || !EMAIL_RE.test(value) || value.includes("..")) {
        setHint("email", final || value.includes("@")
            ? "Please enter a valid email address, e.g. name@gmail.com" : "");
        markField("email", final);
        return false;
    }

    const [user, domain] = value.split("@");
    const fix = DOMAIN_FIX[domain];

    if (fix) {
        setHint("email",
            `Did you mean <b>${escapeHtml(user)}@${escapeHtml(fix)}</b>?` +
            `<button type="button" data-fix-email="${escapeHtml(user)}@${escapeHtml(fix)}">Yes, correct it</button>`);
        markField("email", true);
        return false;
    }

    markField("email", false);
    setHint("email", `Are you sure that <b>${escapeHtml(value)}</b> is your correct email ID? Warranty updates will be sent to this email.`);
    return true;
}

field("email")?.addEventListener("input", () => {
    // live: only clear once it becomes valid
    const v = field("email").value.trim();
    if (EMAIL_RE.test(v)) checkEmail(false);
    else { setHint("email", ""); markField("email", false); }
});
field("email")?.addEventListener("blur", () => checkEmail(true));

form?.addEventListener("click", e => {
    const btn = e.target.closest("[data-fix-email]");
    if (!btn) return;
    field("email").value = btn.dataset.fixEmail;
    checkEmail(true);
});


/* =========================================================
   SERIAL NUMBER
========================================================= */

const SERIAL_RE = /^[A-Z0-9][A-Z0-9/_\-.]{2,49}$/;

function checkSerial(final = false) {
    const value = field("serialNumber").value.trim();
    if (!value) {
        setHint("serialNumber", final ? "Please enter the device serial number." : "");
        markField("serialNumber", final);
        return false;
    }
    if (!SERIAL_RE.test(value)) {
        setHint("serialNumber", "Serial number can contain only letters, numbers and / - _ . characters.");
        markField("serialNumber", true);
        return false;
    }
    setHint("serialNumber", "");
    markField("serialNumber", false);
    return true;
}

field("serialNumber")?.addEventListener("input", e => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase().replace(/\s+/g, "");
    try { e.target.setSelectionRange(pos, pos); } catch { /* ignore */ }
    hideError();
    checkSerial(false);
});
field("serialNumber")?.addEventListener("blur", () => checkSerial(true));


/* =========================================================
   PURCHASE DATE — "are you sure" + 15 days notice
========================================================= */

if (field("purchaseDate")) field("purchaseDate").max = todayISO();

function checkPurchaseDate(final = false) {
    const value = field("purchaseDate").value;
    if (!value) {
        setHint("purchaseDate", final ? "Please select the purchase date." : "");
        markField("purchaseDate", final);
        return false;
    }

    const days = daysSince(value);
    if (days === null) {
        setHint("purchaseDate", "Please enter a valid purchase date.");
        markField("purchaseDate", true);
        return false;
    }
    if (days < 0) {
        setHint("purchaseDate", "Purchase date cannot be in the future.");
        markField("purchaseDate", true);
        return false;
    }

    markField("purchaseDate", false);

    let html = `Are you sure that your purchase date <b>${escapeHtml(prettyDate(value))}</b> is correct?`;
    if (days > REGISTRATION_DAYS) {
        html += `<br>⚠ This is ${days} days ago. Warranty registration must be done within ${REGISTRATION_DAYS} days of purchase, so it may not be approved.`;
    }
    setHint("purchaseDate", html);
    return true;
}

field("purchaseDate")?.addEventListener("change", () => checkPurchaseDate(false));
field("purchaseDate")?.addEventListener("input", () => checkPurchaseDate(false));


/* =========================================================
   PHOTO — preview + compression
========================================================= */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL = 15 * 1024 * 1024;
const preview = document.querySelector("#photoPreview");

field("photo")?.addEventListener("change", () => {
    const file = field("photo").files?.[0];
    if (!file) { if (preview) preview.hidden = true; return; }

    if (!ALLOWED_TYPES.includes(file.type)) {
        showError("Please upload a JPG, PNG or WEBP photo of the installed device.");
        field("photo").value = "";
        if (preview) preview.hidden = true;
        return;
    }
    hideError();
    if (preview) {
        preview.querySelector("img").src = URL.createObjectURL(file);
        preview.querySelector("span").textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        preview.hidden = false;
    }
});

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("This photo could not be read. Please choose another image."));
        img.src = URL.createObjectURL(file);
    });
}

/* Resize to max 1600px & JPEG ~82% -> usually 200–600 KB */
async function compressPhoto(file) {
    const img = await loadImage(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 3.8 * 1024 * 1024 && quality > 0.45) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    return {
        name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
        type: "image/jpeg",
        data: dataUrl.split(",")[1]
    };
}


/* =========================================================
   SUCCESS POPUP
========================================================= */

function openSuccess({ email, serialNumber }) {
    if (!successModal) return;
    successModal.querySelector("#wrEmail").textContent = email || "";
    successModal.querySelector("#wrSerial").textContent = `Serial No: ${serialNumber}`;
    const msg = encodeURIComponent(
        `Hello SAFE ESCAPE, I have submitted my warranty registration.\nSerial No: ${serialNumber}\nEmail: ${email}`
    );
    successModal.querySelector("#wrWhatsapp").href = `https://wa.me/${SUPPORT.whatsapp}?text=${msg}`;
    successModal.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeSuccess() {
    if (!successModal) return;
    successModal.hidden = true;
    document.body.style.overflow = "";
}

successModal?.addEventListener("click", e => {
    if (e.target === successModal || e.target.closest("[data-close-success]")) closeSuccess();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && successModal && !successModal.hidden) closeSuccess();
});


/* =========================================================
   SUBMIT
========================================================= */

function setBusy(text) {
    if (!submitButton) return;
    submitButton.disabled = Boolean(text);
    submitButton.textContent = text || SUBMIT_LABEL;
}

function firstMissingRequired() {
    const required = [
        ["customerName", "Please enter the customer / company name."],
        ["wireLength", "Please select the length of wire."],
        ["purchasedFrom", "Please enter where you purchased the device from."],
        ["installationAddress", "Please enter the installation address including floor."],
        ["installedBy", "Please enter who installed the device."]
    ];
    for (const [name, message] of required) {
        if (!String(field(name)?.value || "").trim()) return { name, message };
    }
    return null;
}

form?.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    hideError();

    /* ---- client checks (server checks again) ---- */
    const missing = firstMissingRequired();
    if (missing) { markField(missing.name, true); field(missing.name).focus(); showError(missing.message); return; }

    if (!checkMobile(true)) { field("mobile").focus(); showError("Please enter a valid 10-digit mobile number."); return; }
    if (!checkEmail(true)) { field("email").focus(); showError("Please enter a valid email address."); return; }
    if (!checkSerial(true)) { field("serialNumber").focus(); showError("Please enter a valid device serial number."); return; }
    if (!checkPurchaseDate(true)) { field("purchaseDate").focus(); showError("Please enter a valid purchase date."); return; }

    const file = field("photo")?.files?.[0];
    if (!file) { showError("Please upload a clear photo of the installed SAFE ESCAPE device."); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { showError("Please upload a JPG, PNG or WEBP image."); return; }
    if (file.size > MAX_ORIGINAL) { showError("Photo is too large (max 15 MB). Please choose a smaller photo."); return; }

    if (!field("termsAccepted")?.checked) {
        showError("Please tick the box to accept the Warranty Activation Terms and Conditions.");
        return;
    }

    try {
        setBusy("Preparing photo…");
        const photo = await compressPhoto(file);

        setBusy("Verifying & submitting…");

        const payload = {
            customerName: field("customerName").value.trim(),
            mobile: field("mobile").value.trim(),
            email: field("email").value.trim().toLowerCase(),
            serialNumber: field("serialNumber").value.trim().toUpperCase(),
            wireLength: field("wireLength").value,
            purchasedFrom: field("purchasedFrom").value.trim(),
            installationAddress: field("installationAddress").value.trim(),
            purchaseDate: field("purchaseDate").value,
            installedBy: field("installedBy").value.trim(),
            termsAccepted: true,
            photo
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);

        let res, data = {};
        try {
            res = await fetch(`${functionsBaseUrl || "/.netlify/functions"}/warranty-submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            data = await res.json().catch(() => ({}));
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok || !data.success) {
            if (data.field) {
                markField(data.field, true);
                field(data.field)?.focus?.();
            }
            const title = data.field === "serialNumber" ? "Serial number problem" : "Could not submit registration";
            showError(data.message || "Could not submit the warranty registration. Please try again.", title);
            return;
        }

        /* ---- success ---- */
        form.reset();
        ["mobile", "email", "serialNumber", "purchaseDate"].forEach(n => { setHint(n, ""); markField(n, false); });
        if (preview) preview.hidden = true;
        openSuccess({ email: data.email || payload.email, serialNumber: data.serialNumber || payload.serialNumber });

    } catch (error) {
        console.error("SAFE ESCAPE Warranty Error:", error);
        showError(
            error.name === "AbortError"
                ? "The server is taking too long. Please check your internet connection and try again."
                : (error.message || "Could not submit the warranty registration. Please try again."),
            "Could not submit registration"
        );
    } finally {
        setBusy("");
    }
}, true);


/* =========================================================
   RESET
========================================================= */

form?.addEventListener("reset", () => {
    hideError();
    setTimeout(() => {
        ["mobile", "email", "serialNumber", "purchaseDate"].forEach(n => { setHint(n, ""); markField(n, false); });
        form.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
        if (preview) preview.hidden = true;
        setBusy("");
    }, 0);
});

/* clear red border as user types */
form?.addEventListener("input", e => {
    const name = e.target?.name;
    if (name && !["mobile", "email", "serialNumber", "purchaseDate"].includes(name)) markField(name, false);
});
