/**
 * =========================================================
 *  SAFE ESCAPE — WARRANTY AUTOMATION (Google Apps Script)
 * =========================================================
 *
 *  Called ONLY by the website server (Netlify functions):
 *    warranty-submit.js  -> action "warrantySubmit"
 *    warranty-admin.js   -> action "warrantyDecision", "findPhoto"
 *
 *  What it does:
 *    1. Saves the installed-device photo in Google Drive
 *       (link = "anyone with the link can view", so admin can open it)
 *    2. Adds / updates a row in the Google Sheet "Warranty Registrations"
 *    3. Sends emails (customer + copy to SAFE ESCAPE):
 *         • Received  (after customer submits)
 *         • Approved  (5-year warranty from date → to date)
 *         • Rejected  (with reason)
 *
 *  SETUP  (see SETUP-WARRANTY.md for screenshots-level steps)
 *  ---------------------------------------------------------
 *  Project Settings → Script Properties:
 *    SECRET          (required)  same value as Netlify WARRANTY_APPS_SCRIPT_SECRET
 *    ADMIN_EMAIL     (required)  e.g. safeescapesolutions@gmail.com  (gets a copy of every mail)
 *    SHEET_ID        (optional)  Google Sheet ID. Empty = sheet this script is attached to,
 *                                or a new sheet is created automatically.
 *    DRIVE_FOLDER_ID (optional)  Drive folder ID for photos. Empty = folder
 *                                "SAFE ESCAPE Warranty Photos" is created automatically.
 *    SUPPORT_PHONE   (optional)  default +91 93116 05588
 *    WEBSITE_URL     (optional)  default https://safeescape.in
 *    LOGO_URL        (optional)  default https://safeescape.in/assets/images/logo.png
 *
 *  Deploy → New deployment → Web app
 *    Execute as: Me      Who has access: Anyone
 *  Copy the /exec URL into Netlify env  WARRANTY_APPS_SCRIPT_URL
 * =========================================================
 */

const SHEET_NAME = 'Warranty Registrations';

const HEADERS = [
  'Registration ID', 'Submitted At', 'Status', 'Serial Number', 'Customer / Company', 'Mobile', 'Email',
  'Wire Length (m)', 'Purchased From', 'Purchase Date', 'Days (Purchase → Submit)', 'Late (>15 days)',
  'Installed By', 'Installation Address', 'Photo Link', 'Photo File ID',
  'Warranty Start', 'Warranty End', 'Reject Reason', 'Reviewed At', 'Last Email'
];

/* ---------------- helpers ---------------- */

function props_() {
  return PropertiesService.getScriptProperties();
}

function cfg_(key, fallback) {
  const v = props_().getProperty(key);
  return v ? String(v).trim() : (fallback || '');
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function prettyDate_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso || '');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Utilities.formatDate(d, 'Asia/Kolkata', 'dd MMMM yyyy');
}

function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm:ss');
}

/* ---------------- sheet ---------------- */

function sheet_() {
  let ss;
  const id = cfg_('SHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id);
  else {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
    if (!ss) {
      ss = SpreadsheetApp.create('SAFE ESCAPE — Warranty Registrations');
      props_().setProperty('SHEET_ID', ss.getId());
    }
  }

  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0b1922').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, registrationId) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(registrationId)) return i + 2;
  }
  return -1;
}

function setCells_(sh, row, values) {
  // values: { 'Header Name': value }
  Object.keys(values).forEach(function (h) {
    const col = HEADERS.indexOf(h) + 1;
    if (col > 0) sh.getRange(row, col).setValue(values[h]);
  });
}

/* ---------------- drive ---------------- */

function folder_() {
  const id = cfg_('DRIVE_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const it = DriveApp.getFoldersByName('SAFE ESCAPE Warranty Photos');
  const f = it.hasNext() ? it.next() : DriveApp.createFolder('SAFE ESCAPE Warranty Photos');
  props_().setProperty('DRIVE_FOLDER_ID', f.getId());
  return f;
}

function savePhoto_(reg, photo) {
  const bytes = Utilities.base64Decode(photo.data);
  const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const safeSerial = String(reg.serialNumber || 'SERIAL').replace(/[^A-Za-z0-9_-]/g, '_');
  const name = safeSerial + '__' + reg.registrationId + '.' + ext;

  const blob = Utilities.newBlob(bytes, photo.type || 'image/jpeg', name);
  const file = folder_().createFile(blob);
  file.setDescription('SAFE ESCAPE warranty | ' + reg.serialNumber + ' | ' + reg.customerName + ' | ' + reg.registrationId);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Some Google Workspace domains block public links; admin can still open it while signed in
    console.warn('Sharing not allowed: ' + e);
  }

  return { fileId: file.getId(), fileUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
}

/* ---------------- email ---------------- */

function layout_(title, color, bodyHtml) {
  const logo = cfg_('LOGO_URL', 'https://safeescape.in/assets/images/logo.png');
  const site = cfg_('WEBSITE_URL', 'https://safeescape.in');
  const phone = cfg_('SUPPORT_PHONE', '+91 93116 05588');
  const tel = phone.replace(/[^0-9+]/g, '');
  const wa = tel.replace(/\D/g, '');
  const admin = cfg_('ADMIN_EMAIL');

  return '' +
    '<div style="margin:0;padding:24px 12px;background:#f2f5f8;font-family:Arial,Helvetica,sans-serif;color:#142229">' +
    ' <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4eaee">' +
    '  <div style="background:#0b1922;padding:22px;text-align:center"><img src="' + esc_(logo) + '" alt="SAFE ESCAPE" style="height:46px"></div>' +
    '  <div style="height:4px;background:' + color + '"></div>' +
    '  <div style="padding:30px 28px 10px">' +
    '   <h2 style="margin:0 0 14px;font-size:22px;color:#0b1922">' + title + '</h2>' +
        bodyHtml +
    '  </div>' +
    '  <div style="padding:6px 28px 28px">' +
    '   <div style="padding:16px;border-radius:10px;background:#f7f9fb;font-size:13px;line-height:1.7;color:#5f707a">' +
    '    Need help? Call <a href="tel:' + tel + '" style="color:#ee372f;font-weight:bold;text-decoration:none">' + esc_(phone) + '</a>' +
    '    · <a href="https://wa.me/' + wa + '" style="color:#0f8a63;font-weight:bold;text-decoration:none">WhatsApp</a>' +
        (admin ? ' · <a href="mailto:' + esc_(admin) + '" style="color:#2367ab;text-decoration:none">' + esc_(admin) + '</a>' : '') +
    '   </div>' +
    '  </div>' +
    '  <div style="padding:16px;text-align:center;background:#0b1922;color:#8a99a2;font-size:12px">' +
    '   SAFE ESCAPE — Your Rescue Partner™ · <a href="' + esc_(site) + '" style="color:#ffffff;text-decoration:none">' + esc_(site.replace(/^https?:\/\//, '')) + '</a>' +
    '  </div>' +
    ' </div>' +
    '</div>';
}

function detailsTable_(reg, extraRows) {
  const rows = [
    ['Serial Number', reg.serialNumber],
    ['Customer / Company', reg.customerName],
    ['Mobile', reg.mobile],
    ['Wire Length', reg.wireLength ? reg.wireLength + ' metres' : ''],
    ['Purchase Date', prettyDate_(reg.purchaseDate)]
  ].concat(extraRows || []);

  return '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13.5px">' +
    rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<tr><td style="padding:9px 12px;border-bottom:1px solid #eef2f5;color:#5f707a;width:42%">' + esc_(r[0]) +
        '</td><td style="padding:9px 12px;border-bottom:1px solid #eef2f5;font-weight:bold">' + esc_(r[1]) + '</td></tr>';
    }).join('') + '</table>';
}

function send_(to, subject, html, copyToAdmin) {
  const admin = cfg_('ADMIN_EMAIL');
  const opts = { to: to, subject: subject, htmlBody: html, name: 'SAFE ESCAPE' };
  if (admin) opts.replyTo = admin;
  if (admin && copyToAdmin) opts.bcc = admin;
  MailApp.sendEmail(opts);
  return 'sent';
}

function mailReceived_(reg) {
  const body =
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0 0 6px">Dear ' + esc_(reg.customerName) + ',</p>' +
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0">Thank you for submitting your SAFE ESCAPE warranty registration. ' +
    'We have received your details and our team is now verifying them. We will update you on this email as soon as possible.</p>' +
    detailsTable_(reg, [['Reference ID', reg.registrationId]]) +
    '<p style="font-size:13px;color:#8a99a2;margin:0">You will receive another email once your warranty is approved.</p>';

  return send_(reg.email, 'We received your SAFE ESCAPE warranty registration — ' + reg.serialNumber,
    layout_('Warranty details received ✓', '#e9a23b', body), false); // admin gets its own "new registration" mail
}

function mailAdminNew_(reg, fileUrl) {
  const admin = cfg_('ADMIN_EMAIL');
  if (!admin) return;
  const body =
    '<p style="font-size:14px;color:#3b4b55">A new warranty registration is waiting for approval.' +
    (reg.lateRegistration ? ' <b style="color:#c0352f">Submitted ' + esc_(reg.daysSincePurchase) + ' days after purchase (more than 15 days).</b>' : '') + '</p>' +
    detailsTable_(reg, [['Email', reg.email], ['Purchased From', reg.purchasedFrom], ['Installed By', reg.installedBy],
      ['Installation Address', reg.installationAddress], ['Reference ID', reg.registrationId]]) +
    (fileUrl ? '<p><a href="' + esc_(fileUrl) + '" style="display:inline-block;padding:12px 18px;background:#0b1922;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">View installed device photo</a></p>' : '') +
    '<p><a href="' + esc_(cfg_('WEBSITE_URL', 'https://safeescape.in')) + '/admin/" style="color:#ee372f;font-weight:bold">Open Admin Panel → Warranty</a></p>';

  MailApp.sendEmail({ to: admin, subject: '🛡 New warranty registration — ' + reg.serialNumber + ' (' + reg.customerName + ')',
    htmlBody: layout_('New warranty registration', '#2367ab', body), name: 'SAFE ESCAPE Website', replyTo: reg.email });
}

function mailApproved_(reg) {
  const body =
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0 0 6px">Dear ' + esc_(reg.customerName) + ',</p>' +
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0">Thank you for uploading your warranty details. ' +
    '<b>Your warranty has been approved!</b></p>' +
    '<div style="margin:18px 0;padding:18px;border-radius:12px;background:#e4f6ef;border:1px solid #bfe6d7;text-align:center">' +
    ' <div style="font-size:12px;letter-spacing:1px;color:#0f8a63;font-weight:bold">5-YEAR WARRANTY ACTIVE</div>' +
    ' <div style="margin-top:6px;font-size:18px;color:#0b1922;font-weight:bold">' + esc_(prettyDate_(reg.warrantyStart)) +
    '  &nbsp;→&nbsp; ' + esc_(prettyDate_(reg.warrantyEnd)) + '</div>' +
    '</div>' +
    detailsTable_(reg, [['Warranty Valid From', prettyDate_(reg.warrantyStart)], ['Warranty Valid Till', prettyDate_(reg.warrantyEnd)]]) +
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0">Please keep this email for your records. ' +
    'Enjoy your warranty and stay safe with SAFE ESCAPE!</p>';

  return send_(reg.email, '✅ Your SAFE ESCAPE warranty is approved — ' + reg.serialNumber,
    layout_('Your warranty is approved 🎉', '#0f8a63', body), true);
}

function mailRejected_(reg) {
  const body =
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0 0 6px">Dear ' + esc_(reg.customerName) + ',</p>' +
    '<p style="font-size:14.5px;line-height:1.7;color:#3b4b55;margin:0">We are very sorry to inform you that your warranty registration ' +
    'for the serial number below <b>has not been approved</b>.</p>' +
    '<div style="margin:18px 0;padding:16px;border-radius:12px;background:#fdeceb;border:1px solid #f3c6c3;color:#c0352f;font-size:14px;line-height:1.6">' +
    ' <b>Reason:</b> ' + esc_(reg.reason || 'The details provided could not be verified.') +
    '</div>' +
    detailsTable_(reg) +
    '<p style="font-size:14px;line-height:1.7;color:#3b4b55;margin:0">Please note: warranty registration must be submitted within ' +
    '<b>15 days of purchase</b>, with correct details and a clear photo of the installed device. ' +
    'If you believe this is a mistake or you entered wrong details, you can submit the form again with the correct details ' +
    'or contact our support team.</p>' +
    '<p style="margin:16px 0 0"><a href="' + esc_(cfg_('WEBSITE_URL', 'https://safeescape.in')) + '/warranty.html" ' +
    'style="display:inline-block;padding:12px 18px;background:#ee372f;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Submit warranty details again</a></p>';

  return send_(reg.email, 'Update on your SAFE ESCAPE warranty registration — ' + reg.serialNumber,
    layout_('Warranty registration not approved', '#c0352f', body), true);
}

/* ---------------- actions ---------------- */

function warrantySubmit_(data) {
  const reg = data.registration || {};
  const photo = data.photo || {};
  if (!reg.registrationId || !photo.data) throw new Error('Missing registration or photo.');

  const saved = savePhoto_(reg, photo);

  let emailStatus = 'sent';
  try {
    mailReceived_(reg);
    mailAdminNew_(reg, saved.fileUrl);
  } catch (e) {
    console.error('Email error: ' + e);
    emailStatus = 'failed';
  }

  let sheetStatus = 'done';
  try {
    sheet_().appendRow([
      reg.registrationId, now_(), 'Pending', reg.serialNumber, reg.customerName, "'" + reg.mobile, reg.email,
      reg.wireLength, reg.purchasedFrom, reg.purchaseDate, reg.daysSincePurchase, reg.lateRegistration ? 'YES' : 'No',
      reg.installedBy, reg.installationAddress, saved.fileUrl, saved.fileId, '', '', '', '',
      'Received — ' + emailStatus + ' — ' + now_()
    ]);
  } catch (e) {
    console.error('Sheet error: ' + e);
    sheetStatus = 'failed';
  }

  return { success: true, fileId: saved.fileId, fileUrl: saved.fileUrl, sheetStatus: sheetStatus, emailStatus: emailStatus };
}

function warrantyDecision_(data) {
  const reg = data.registration || {};
  const decision = data.decision;
  if (!reg.email) throw new Error('Customer email missing.');

  let emailStatus = 'sent';
  try {
    if (decision === 'approved') mailApproved_(reg);
    else mailRejected_(reg);
  } catch (e) {
    console.error('Decision email error: ' + e);
    emailStatus = 'failed';
  }

  try {
    const sh = sheet_();
    const r = findRow_(sh, reg.registrationId);
    if (r > 0) {
      setCells_(sh, r, {
        'Status': decision === 'approved' ? 'Approved' : 'Rejected',
        'Warranty Start': decision === 'approved' ? reg.warrantyStart : '',
        'Warranty End': decision === 'approved' ? reg.warrantyEnd : '',
        'Reject Reason': decision === 'approved' ? '' : reg.reason,
        'Reviewed At': now_(),
        'Last Email': (decision === 'approved' ? 'Approved' : 'Rejected') + ' — ' + emailStatus + ' — ' + now_()
      });
    }
  } catch (e) {
    console.error('Sheet update error: ' + e);
  }

  if (emailStatus === 'failed') return { success: false, message: 'Email could not be sent (check MailApp quota / email address).', emailStatus: emailStatus };
  return { success: true, emailStatus: emailStatus };
}

function findPhoto_(data) {
  const id = String(data.registrationId || '');
  if (!id) throw new Error('registrationId missing.');
  const files = folder_().searchFiles('title contains "' + id.replace(/"/g, '') + '"');
  if (!files.hasNext()) return { success: false, message: 'Photo not found in Drive.' };
  const f = files.next();
  return { success: true, fileId: f.getId(), fileUrl: 'https://drive.google.com/file/d/' + f.getId() + '/view' };
}

/* ---------------- web app ---------------- */

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = cfg_('SECRET');
    if (!secret || data.secret !== secret) return out_({ success: false, message: 'Unauthorised.' });

    switch (data.action) {
      case 'warrantySubmit': return out_(warrantySubmit_(data));
      case 'warrantyDecision': return out_(warrantyDecision_(data));
      case 'findPhoto': return out_(findPhoto_(data));
      case 'ping': return out_({ success: true, message: 'SAFE ESCAPE warranty script is working.' });
      default: return out_({ success: false, message: 'Unknown action.' });
    }
  } catch (err) {
    console.error(err);
    return out_({ success: false, message: String(err && err.message || err) });
  }
}

function doGet() {
  return out_({ success: true, message: 'SAFE ESCAPE warranty script is live. Use POST.' });
}

/**
 * Run this ONCE from the editor (select "setup" → Run) to grant
 * Drive / Sheets / Mail permissions and create the sheet + folder.
 */
function setup() {
  sheet_();
  folder_();
  Logger.log('Sheet ID: ' + cfg_('SHEET_ID'));
  Logger.log('Drive folder ID: ' + cfg_('DRIVE_FOLDER_ID'));
  Logger.log('Admin email: ' + cfg_('ADMIN_EMAIL', '(not set!)'));
}
