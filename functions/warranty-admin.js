const { getDb, json, admin, verifyAdmin, toIso } = require('./_shared');
const W = require('./_warranty');

/* =========================================================
   SAFE ESCAPE — WARRANTY ADMIN API  (admin login required)

   POST /.netlify/functions/warranty-admin
   Header: Authorization: Bearer <Firebase ID token>
   Body:   { action, ... }

   actions:
     list            -> all registrations + counts
     approve   {id}
     reject    {id, reason}
     photo     {id}            -> find Drive photo link (repair)
     uploadSerials {rows:[{serialNumber, wireLength?, batch?}]}
     serials   {}              -> serial number list
     deleteSerial {serialNumber}  (only if not registered)
========================================================= */

const MAX_UPLOAD = 3000;

function plain(doc) {
    const d = doc.data() || {};
    const out = { id: doc.id };
    for (const [k, v] of Object.entries(d)) {
        out[k] = v && typeof v.toDate === 'function' ? toIso(v) : v;
    }
    /* Old records (before this update) */
    if (!out.purchaseDate && out.installationDate) out.purchaseDate = out.installationDate;
    if (out.status === 'pending-review' || !out.status) out.status = 'pending';
    if (out.customerName == null && out.fullName) out.customerName = out.fullName;
    return out;
}

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}


async function list(db) {
    const snap = await db.collection('warrantyRegistrations').limit(2000).get();
    const rows = snap.docs.map(plain).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const counts = { total: rows.length, pending: 0, approved: 0, rejected: 0 };
    rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status] += 1; });

    let serials = { total: 0, registered: 0 };
    try {
        const col = db.collection('serialNumbers');
        const [all, reg] = await Promise.all([
            col.count().get(),
            col.where('registered', '==', true).count().get()
        ]);
        serials = { total: all.data().count, registered: reg.data().count };
    } catch (e) {
        console.warn('Serial count failed:', e.message);
    }

    return { rows, counts, serials };
}


async function decide(db, id, decision, reason, adminUser) {
    const regRef = db.collection('warrantyRegistrations').doc(String(id));
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(regRef);
        if (!snap.exists) { const e = new Error('Registration not found.'); e.statusCode = 404; throw e; }

        const reg = snap.data() || {};
        const key = reg.serialKey || W.serialKey(reg.serialNumber);
        const serialRef = db.collection('serialNumbers').doc(key);
        const serialSnap = await tx.get(serialRef);
        const serial = serialSnap.exists ? serialSnap.data() : {};

        // Serial already taken by a DIFFERENT registration?
        if (decision === 'approved' && serial.registered === true &&
            serial.warrantyRegistrationId && serial.warrantyRegistrationId !== regRef.id) {
            const e = new Error('This serial number is already registered under another warranty registration.');
            e.statusCode = 409;
            throw e;
        }

        const update = {
            status: decision,
            reviewedAt: now,
            reviewedBy: adminUser.email || adminUser.uid,
            updatedAt: now
        };

        if (decision === 'approved') {
            const period = W.warrantyPeriod(reg.purchaseDate || reg.installationDate);
            update.warrantyStart = period.start;
            update.warrantyEnd = period.end;
            update.rejectReason = admin.firestore.FieldValue.delete();

            tx.set(serialRef, {
                registered: true,
                warrantyStatus: 'approved',
                warrantyRegistrationId: regRef.id,
                warrantyStart: period.start,
                warrantyEnd: period.end
            }, { merge: true });
        } else {
            update.rejectReason = reason;
            update.warrantyStart = admin.firestore.FieldValue.delete();
            update.warrantyEnd = admin.firestore.FieldValue.delete();

            // Free the serial so the customer can submit correct details again
            if (serialSnap.exists && (!serial.warrantyRegistrationId || serial.warrantyRegistrationId === regRef.id)) {
                tx.set(serialRef, {
                    registered: false,
                    warrantyStatus: 'rejected',
                    lastRejectedRegistrationId: regRef.id,
                    warrantyRegistrationId: admin.firestore.FieldValue.delete(),
                    warrantyStart: admin.firestore.FieldValue.delete(),
                    warrantyEnd: admin.firestore.FieldValue.delete()
                }, { merge: true });
            }
        }

        tx.set(regRef, update, { merge: true });
        return { ...reg, ...update, warrantyStart: update.warrantyStart, warrantyEnd: update.warrantyEnd };
    });

    /* ---- Email via Apps Script ---- */
    const script = await W.warrantyScript('warrantyDecision', {
        registration: {
            registrationId: regRef.id,
            customerName: result.customerName || result.fullName || '',
            email: result.email,
            mobile: result.mobile,
            serialNumber: result.serialNumber,
            wireLength: result.wireLength,
            purchaseDate: result.purchaseDate || result.installationDate,
            warrantyStart: decision === 'approved' ? result.warrantyStart : '',
            warrantyEnd: decision === 'approved' ? result.warrantyEnd : '',
            reason: decision === 'rejected' ? reason : ''
        },
        decision
    });

    await regRef.set({
        decisionEmailStatus: script.status === 'done' ? (script.emailStatus || 'sent') : script.status,
        decisionEmailError: script.success ? '' : (script.message || '')
    }, { merge: true });

    return plain(await regRef.get());
}


async function findPhoto(db, id) {
    const regRef = db.collection('warrantyRegistrations').doc(String(id));
    const snap = await regRef.get();
    if (!snap.exists) { const e = new Error('Registration not found.'); e.statusCode = 404; throw e; }
    const reg = snap.data();
    if (reg.photoUrl) return { photoUrl: reg.photoUrl, photoFileId: reg.photoFileId || '' };

    const script = await W.warrantyScript('findPhoto', { registrationId: regRef.id });
    if (script.success && script.fileUrl) {
        await regRef.set({ photoUrl: script.fileUrl, photoFileId: script.fileId || '', photoStatus: 'saved' }, { merge: true });
        return { photoUrl: script.fileUrl, photoFileId: script.fileId || '' };
    }
    const e = new Error(script.message || 'Photo not found in Google Drive yet.');
    e.statusCode = 404;
    throw e;
}


async function uploadSerials(db, rows, adminUser) {
    if (!Array.isArray(rows) || !rows.length) { const e = new Error('No serial numbers found in the file.'); e.statusCode = 400; throw e; }
    if (rows.length > MAX_UPLOAD) { const e = new Error(`Maximum ${MAX_UPLOAD} serial numbers per upload.`); e.statusCode = 400; throw e; }

    const invalid = [];
    const map = new Map();

    for (const row of rows) {
        const serialNumber = W.cleanSerial(row && row.serialNumber);
        if (!serialNumber) continue;
        if (!W.validSerial(serialNumber)) { invalid.push(serialNumber); continue; }
        const key = W.serialKey(serialNumber);
        if (!map.has(key)) {
            map.set(key, {
                serialNumber,
                wireLength: String(row.wireLength || '').trim().slice(0, 10),
                batch: String(row.batch || '').trim().slice(0, 60)
            });
        }
    }

    const keys = [...map.keys()];
    const existing = new Set();

    for (const part of chunk(keys, 300)) {
        const refs = part.map(k => db.collection('serialNumbers').doc(k));
        const snaps = await db.getAll(...refs);
        snaps.forEach(s => { if (s.exists) existing.add(s.id); });
    }

    const toAdd = keys.filter(k => !existing.has(k));
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const part of chunk(toAdd, 450)) {
        const batch = db.batch();
        part.forEach(k => {
            const row = map.get(k);
            batch.set(db.collection('serialNumbers').doc(k), {
                serialNumber: row.serialNumber,
                serialKey: k,
                wireLength: row.wireLength,
                batch: row.batch,
                active: true,
                registered: false,
                uploadedBy: adminUser.email || adminUser.uid,
                createdAt: now
            });
        });
        await batch.commit();
    }

    return {
        total: rows.length,
        unique: keys.length,
        added: toAdd.length,
        existing: existing.size,
        invalid: invalid.length,
        invalidSamples: invalid.slice(0, 10)
    };
}


async function serials(db) {
    const snap = await db.collection('serialNumbers').limit(5000).get();
    const rows = snap.docs.map(d => {
        const s = d.data() || {};
        return {
            id: d.id,
            serialNumber: s.serialNumber || d.id,
            wireLength: s.wireLength || '',
            batch: s.batch || '',
            active: s.active !== false,
            registered: s.registered === true,
            warrantyStatus: s.warrantyStatus || '',
            warrantyEnd: s.warrantyEnd || '',
            createdAt: toIso(s.createdAt)
        };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { rows };
}


async function testConnection() {
    const url = process.env.WARRANTY_APPS_SCRIPT_URL || '';
    const secret = process.env.WARRANTY_APPS_SCRIPT_SECRET || process.env.GOOGLE_APPS_SCRIPT_SECRET || '';
    const checks = {
        urlSet: Boolean(url),
        urlLooksRight: /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url.trim()),
        secretSet: Boolean(secret),
        urlHasSpaces: url !== url.trim(),
        secretHasSpaces: secret !== secret.trim()
    };

    let advice = '';
    let script = null;

    if (!checks.urlSet || !checks.secretSet) {
        advice = 'Netlify me WARRANTY_APPS_SCRIPT_URL / WARRANTY_APPS_SCRIPT_SECRET nahi mila. Variable SAVE karo, phir Deploys -> Trigger deploy -> Deploy site.';
    } else if (!checks.urlLooksRight) {
        advice = 'WARRANTY_APPS_SCRIPT_URL galat lag raha hai. Wo https://script.google.com/macros/s/..../exec jaisa hona chahiye (Deploy -> Manage deployments -> Web app URL).';
    } else {
        script = await W.warrantyScript('ping', {}, 9000);
        const msg = String(script.message || '');
        if (script.success) {
            advice = script.drive === false || script.sheet === false
                ? 'Script connected, par Drive/Sheet permission nahi hai. Apps Script editor me "setup" function Run karke Allow karo, phir New version deploy karo.'
                : 'Sab theek hai ✓ Warranty form ab kaam karega.';
        } else if (/unauthori/i.test(msg)) {
            advice = 'SECRET match nahi kar raha. Apps Script -> Project Settings -> Script Properties me SECRET aur Netlify ka WARRANTY_APPS_SCRIPT_SECRET bilkul same hone chahiye (koi space nahi). Change ke baad Netlify redeploy karo.';
        } else if (/invalid response/i.test(msg)) {
            advice = 'Apps Script HTML page bhej raha hai (JSON nahi). Deploy -> Manage deployments -> Edit: "Execute as: Me" aur "Who has access: Anyone" rakho, Version: New version -> Deploy. Aur "setup" function ek baar Run karke permission Allow karo.';
        } else if (script.status === 'submitted') {
            advice = 'Apps Script bahut slow reply kar raha hai (9 sec se zyada). Thodi der baad dobara test karo.';
        } else {
            advice = 'Apps Script error: ' + msg;
        }
    }

    return { checks, script, advice, ok: Boolean(script && script.success && script.drive !== false && script.sheet !== false) };
}


async function deleteSerial(db, serialNumber) {
    const ref = db.collection('serialNumbers').doc(W.serialKey(serialNumber));
    const snap = await ref.get();
    if (!snap.exists) { const e = new Error('Serial number not found.'); e.statusCode = 404; throw e; }
    if (snap.data().registered === true) {
        const e = new Error('This serial is already registered for warranty and cannot be deleted.');
        e.statusCode = 409;
        throw e;
    }
    await ref.delete();
    return { deleted: true };
}


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { success: false, message: 'Method not allowed' });

    const adminUser = await verifyAdmin(event);
    if (!adminUser) return json(401, { success: false, message: 'Admin login required.' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { success: false, message: 'Invalid request.' });
    }

    try {
        const db = getDb();
        let data;

        switch (body.action) {
            case 'list': data = await list(db); break;
            case 'approve': data = { record: await decide(db, body.id, 'approved', '', adminUser) }; break;
            case 'reject': {
                const reason = String(body.reason || '').trim().slice(0, 500);
                if (!reason) return json(400, { success: false, message: 'Please select a rejection reason.' });
                data = { record: await decide(db, body.id, 'rejected', reason, adminUser) };
                break;
            }
            case 'photo': data = await findPhoto(db, body.id); break;
            case 'uploadSerials': data = await uploadSerials(db, body.rows, adminUser); break;
            case 'serials': data = await serials(db); break;
            case 'deleteSerial': data = await deleteSerial(db, body.serialNumber); break;
            case 'testConnection': data = await testConnection(); break;
            default: return json(400, { success: false, message: 'Unknown action.' });
        }

        return json(200, { success: true, ...data });

    } catch (error) {
        console.error('WARRANTY ADMIN ERROR:', error);
        return json(error.statusCode || 500, { success: false, message: error.message || 'Request failed.' });
    }
};
