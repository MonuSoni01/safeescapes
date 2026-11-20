/* =========================================================
   SAFE ESCAPE — WARRANTY HELPERS
========================================================= */

const WARRANTY_YEARS = 5;
const REGISTRATION_DAYS = 15;

/* Serial as typed by customer -> clean display value
   "safe/escape/iizg/006 " -> "SAFE/ESCAPE/IIZG/006" */
function cleanSerial(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

/* Firestore document IDs cannot contain "/".
   "SAFE/ESCAPE/IIZG/006" -> "SAFE_ESCAPE_IIZG_006"
   (old serials like "SE-000001" stay exactly the same) */
function serialKey(value) {
    return cleanSerial(value).replace(/\//g, '_');
}

function validSerial(value) {
    return /^[A-Z0-9][A-Z0-9/_\-.]{2,49}$/.test(cleanSerial(value));
}

function validEmail(value) {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(String(value || '').trim());
}

function validMobile(value) {
    return /^[6-9][0-9]{9}$/.test(String(value || '').trim());
}

/* "YYYY-MM-DD" -> Date (UTC midnight) or null */
function parseDay(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

/* Today in India (IST) as UTC-midnight Date */
function todayIST() {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysBetween(from, to) {
    return Math.round((to - from) / 86400000);
}

function isoDay(date) {
    return date.toISOString().slice(0, 10);
}

/* Warranty: purchase date -> same date + 5 years - 1 day */
function warrantyPeriod(purchaseDate) {
    const start = parseDay(purchaseDate) || todayIST();
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + WARRANTY_YEARS);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start: isoDay(start), end: isoDay(end) };
}

async function fetchWithTimeout(url, options = {}, ms = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/* Calls the WARRANTY Google Apps Script web app */
async function warrantyScript(action, payload, ms = 8500) {
    const url = process.env.WARRANTY_APPS_SCRIPT_URL;
    const secret = process.env.WARRANTY_APPS_SCRIPT_SECRET || process.env.GOOGLE_APPS_SCRIPT_SECRET;

    if (!url || !secret) return { success: false, status: 'not_configured' };

    try {
        const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, secret, ...payload })
        }, ms);

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch {
            return { success: false, status: 'failed', message: `Apps Script invalid response: ${text.slice(0, 160)}` };
        }
        if (!res.ok || data.success === false) {
            return { success: false, status: 'failed', message: data.message || 'Apps Script failed.' };
        }
        return { ...data, success: true, status: 'done' };
    } catch (error) {
        if (error.name === 'AbortError') {
            // Google keeps running the script even when we stop waiting
            return { success: false, status: 'submitted', message: 'Apps Script is still processing.' };
        }
        return { success: false, status: 'failed', message: error.message };
    }
}

module.exports = {
    WARRANTY_YEARS,
    REGISTRATION_DAYS,
    cleanSerial,
    serialKey,
    validSerial,
    validEmail,
    validMobile,
    parseDay,
    todayIST,
    daysBetween,
    isoDay,
    warrantyPeriod,
    warrantyScript
};
