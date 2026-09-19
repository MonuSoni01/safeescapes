import { googleSheetWebAppUrl, firebaseConfig } from './firebase-config.js';

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


/* =====================================================
   FORM TYPES
===================================================== */

const FORM_TYPES = {
  contact: {
    subject: 'Website Enquiry — Contact Form',
    sheet: 'Website Enquiries',
    category: 'enquiry'
  },

  dealer: {
    subject: 'Dealer / Channel Partner Enquiry',
    sheet: 'Dealer Enquiries',
    category: 'enquiry'
  },

  bulk: {
    subject: 'Bulk / Project Solutions Enquiry',
    sheet: 'Bulk Project Enquiries',
    category: 'enquiry'
  },

  referral: {
    subject: 'Refer & Earn Partner Enquiry',
    sheet: 'Referral Enquiries',
    category: 'enquiry'
  },

  warranty: {
    subject: 'Warranty Registration Request',
    sheet: 'Warranty Registrations',
    category: 'warranty'
  }
};


/* =====================================================
   FIREBASE DATABASE
===================================================== */

let db = null;

try {
  if (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith('YOUR_')
  ) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (error) {
  console.error('Firebase form setup error:', error);
}


/* =====================================================
   HELPERS
===================================================== */

const endpointReady = () =>
  googleSheetWebAppUrl &&
  !googleSheetWebAppUrl.startsWith('PASTE_');

const clean = value =>
  typeof value === 'string'
    ? value.trim()
    : value;


function getFormValues(form) {
  const values = {};

  new FormData(form).forEach((entry, key) => {
    if (entry instanceof File) return;

    values[key] = clean(entry);
  });

  return values;
}


function setButton(button, loading) {
  if (!button) return;

  button.dataset.originalText ||= button.textContent;
  button.disabled = loading;

  button.textContent = loading
    ? 'Submitting…'
    : button.dataset.originalText;
}


function validPhone(form) {
  const field = form.querySelector('[name="mobile"], [name="phone"]');

  if (!field) return true;

  const digits = field.value.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 15) {
    field.focus();
    window.showToast?.('Please enter a valid mobile number.');
    return false;
  }

  return true;
}


/* =====================================================
   GOOGLE SHEET SUBMISSION
===================================================== */

async function sendToGoogleSheet(type, values, file) {
  const meta = FORM_TYPES[type] || FORM_TYPES.contact;

  if (!endpointReady()) {
    throw new Error('Google Sheet integration is not configured.');
  }

  const payload = {
    action: 'submit',
    formType: type,
    subject: meta.subject,
    sheetName: meta.sheet,
    pageUrl: location.href,
    submittedAt: new Date().toISOString(),
    ...values
  };

  if (file?.size) {
    if (file.size > 4.5 * 1024 * 1024) {
      throw new Error('Please upload an image smaller than 4.5 MB.');
    }

    payload.fileName = file.name;
    payload.fileType = file.type;

    payload.fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result).split(',')[1]);
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  await fetch(googleSheetWebAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

  return true;
}


/* =====================================================
   FIREBASE FORM SUBMISSION
===================================================== */

async function saveToFirebase(type, values, file) {
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  const meta = FORM_TYPES[type] || FORM_TYPES.contact;

  const details = {
    ...values
  };

  if (file?.name) {
    details.uploadedFileName = file.name;
  }

  await addDoc(collection(db, 'formSubmissions'), {
    formType: type,
    category: meta.category,
    subject: meta.subject,
    details: details,
    source: 'website',
    pageUrl: location.href,
    status: 'new',
    createdAt: serverTimestamp()
  });

  return true;
}


/* =====================================================
   FORM BINDING
===================================================== */

function bindGoogleForm(form) {
  if (!form || form.dataset.googleBound) return;

  form.dataset.googleBound = 'true';

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!form.reportValidity() || !validPhone(form)) {
      return;
    }

    const button = form.querySelector('[type="submit"]');
    const formType = form.dataset.sheetForm;
    const values = getFormValues(form);
    const file = form.querySelector('input[type="file"]')?.files?.[0];

    setButton(button, true);

    let firebaseSaved = false;
    let sheetSaved = false;

    try {
      /* Firebase Admin Dashboard */
      try {
        await saveToFirebase(formType, values, file);
        firebaseSaved = true;
      } catch (firebaseError) {
        console.error('Firebase save failed:', firebaseError);
      }

      /* Google Sheet + Email */
      try {
        await sendToGoogleSheet(formType, values, file);
        sheetSaved = true;
      } catch (sheetError) {
        console.error('Google Sheet save failed:', sheetError);
      }

      if (!firebaseSaved && !sheetSaved) {
        throw new Error(
          'Form could not be submitted. Check Firebase and Google Sheet configuration.'
        );
      }

      form.reset();

      window.showToast?.(
        'Thank you. Your details have been received successfully.'
      );

      form.querySelector('[data-form-success]')?.classList.add('show');

    } catch (error) {
      console.error(error);

      window.showToast?.(
        error.message || 'Could not submit the form. Please try again.'
      );

    } finally {
      setButton(button, false);
    }
  });
}


document
  .querySelectorAll('[data-sheet-form]')
  .forEach(bindGoogleForm);