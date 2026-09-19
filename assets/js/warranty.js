/* =========================================================
   SAFE ESCAPE
   WARRANTY REGISTRATION - FINAL
   ---------------------------------------------------------
   FEATURES:
   1. Firebase Firestore integration
   2. Serial Number verification
   3. Invalid Serial Number protection
   4. Inactive Serial Number protection
   5. Duplicate warranty registration protection
   6. 15-day installation validation
   7. Mobile validation
   8. Photo validation
   9. Firebase Storage upload
   10. Warranty registration save
   11. Serial marked as registered
========================================================= */


/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
    initializeApp,
    getApps,
    getApp
}
from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";


import {
    getFirestore,
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


import {
    getStorage,
    ref,
    uploadBytes
}
from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";


import {
    firebaseConfig
}
from "./firebase-config.js";



/* =========================================================
   ELEMENTS
========================================================= */

const form =
    document.querySelector("#warrantyForm");


const installationDateInput =
    document.querySelector("#installationDate");


const warrantyError =
    document.querySelector("#warrantyError");


const warrantyErrorText =
    document.querySelector("#warrantyErrorText");


const serialInput =
    form?.querySelector(
        'input[name="serialNumber"]'
    );


const mobileInput =
    form?.querySelector(
        'input[name="mobile"]'
    );


const submitButton =
    form?.querySelector(
        'button[type="submit"]'
    );



/* =========================================================
   STOP IF FORM DOES NOT EXIST
========================================================= */

if (!form) {

    console.error(
        "SAFE ESCAPE: Warranty form not found."
    );

}



/* =========================================================
   FIREBASE
========================================================= */

let app = null;
let db = null;
let storage = null;


function initializeFirebase() {

    if (
        !firebaseConfig ||
        !firebaseConfig.apiKey ||
        firebaseConfig.apiKey.startsWith("YOUR_")
    ) {

        throw new Error(
            "Firebase configuration is missing."
        );

    }


    if (getApps().length) {

        app = getApp();

    } else {

        app = initializeApp(
            firebaseConfig
        );

    }


    db =
        getFirestore(app);


    storage =
        getStorage(app);

}



/* =========================================================
   DATE HELPERS
========================================================= */

function getTodayLocalMidnight() {

    const now =
        new Date();


    return new Date(

        now.getFullYear(),

        now.getMonth(),

        now.getDate()

    );

}



function parseLocalDate(value) {

    if (!value) {

        return null;

    }


    const parts =
        value.split("-");


    if (parts.length !== 3) {

        return null;

    }


    const year =
        Number(parts[0]);


    const month =
        Number(parts[1]) - 1;


    const day =
        Number(parts[2]);


    const date =
        new Date(
            year,
            month,
            day
        );


    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {

        return null;

    }


    return date;

}



/* =========================================================
   DAYS SINCE INSTALLATION
========================================================= */

function getDaysSinceInstallation(
    installationDateValue
) {

    const installationDate =
        parseLocalDate(
            installationDateValue
        );


    if (!installationDate) {

        return null;

    }


    const today =
        getTodayLocalMidnight();


    const difference =
        today.getTime() -
        installationDate.getTime();


    return Math.floor(

        difference /
        (
            1000 *
            60 *
            60 *
            24
        )

    );

}



/* =========================================================
   ERROR BOX
========================================================= */

function showWarrantyError(message) {

    console.error(
        "Warranty Error:",
        message
    );


    if (warrantyErrorText) {

        warrantyErrorText.textContent =
            message;

    }


    if (warrantyError) {

        warrantyError.classList.add(
            "show"
        );


        warrantyError.scrollIntoView({

            behavior: "smooth",

            block: "center"

        });

    }

}



function hideWarrantyError() {

    warrantyError?.classList.remove(
        "show"
    );

}



/* =========================================================
   TOAST / MESSAGE
========================================================= */

function showMessage(
    message,
    type = "success"
) {

    /*
       If your website already has showToast(),
       use that.
    */

    if (
        typeof window.showToast ===
        "function"
    ) {

        window.showToast(
            message
        );

        return;

    }


    /*
       Otherwise create our own toast.
    */

    let toast =
        document.querySelector(
            "#warrantyToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );


        toast.id =
            "warrantyToast";


        Object.assign(
            toast.style,
            {

                position:
                    "fixed",

                left:
                    "50%",

                bottom:
                    "30px",

                transform:
                    "translateX(-50%)",

                zIndex:
                    "99999",

                maxWidth:
                    "calc(100% - 40px)",

                padding:
                    "14px 20px",

                borderRadius:
                    "6px",

                color:
                    "#ffffff",

                fontSize:
                    "14px",

                fontWeight:
                    "700",

                lineHeight:
                    "1.5",

                textAlign:
                    "center",

                boxShadow:
                    "0 10px 30px rgba(0,0,0,.25)",

                opacity:
                    "0",

                pointerEvents:
                    "none",

                transition:
                    "opacity .25s ease"

            }

        );


        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.style.background =
        type === "error"
            ? "#c62828"
            : "#08121b";


    toast.style.opacity =
        "1";


    clearTimeout(
        window.__warrantyToastTimer
    );


    window.__warrantyToastTimer =
        setTimeout(
            () => {

                toast.style.opacity =
                    "0";

            },
            4500
        );

}



/* =========================================================
   WARRANTY PERIOD VALIDATION
========================================================= */

function validateWarrantyPeriod() {

    const dateValue =
        installationDateInput?.value;


    if (!dateValue) {

        return false;

    }


    const days =
        getDaysSinceInstallation(
            dateValue
        );


    if (days === null) {

        showWarrantyError(
            "Please enter a valid installation date."
        );

        return false;

    }



    /* =====================================================
       FUTURE DATE
    ===================================================== */

    if (days < 0) {

        showWarrantyError(
            "The installation date cannot be in the future. Please enter the correct installation date."
        );

        return false;

    }



    /* =====================================================
       0 - 15 DAYS = ALLOWED
       16+ DAYS = EXPIRED
    ===================================================== */

    if (days >= 16) {

        showWarrantyError(
            "Warranty registration period has expired. Registration must be completed within 15 calendar days of installation."
        );

        return false;

    }


    hideWarrantyError();


    return true;

}



/* =========================================================
   INSTALLATION DATE CHANGE
========================================================= */

installationDateInput
    ?.addEventListener(
        "change",
        () => {

            validateWarrantyPeriod();

        }
    );



/* =========================================================
   PREVENT FUTURE INSTALLATION DATE
========================================================= */

if (installationDateInput) {

    const today =
        new Date();


    const yyyy =
        today.getFullYear();


    const mm =
        String(
            today.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const dd =
        String(
            today.getDate()
        ).padStart(
            2,
            "0"
        );


    installationDateInput.max =
        `${yyyy}-${mm}-${dd}`;

}



/* =========================================================
   MOBILE NUMBER CLEANING
========================================================= */

mobileInput
    ?.addEventListener(
        "input",
        event => {

            event.target.value =
                event.target.value
                    .replace(
                        /\D/g,
                        ""
                    )
                    .slice(
                        0,
                        10
                    );

        }
    );



/* =========================================================
   SERIAL NUMBER CLEANING

   Example:
   se-000001 -> SE-000001
========================================================= */

serialInput
    ?.addEventListener(
        "input",
        event => {

            event.target.value =
                event.target.value
                    .trimStart()
                    .toUpperCase();

            /*
               Remove old error as user
               starts correcting serial.
            */

            hideWarrantyError();

        }
    );



/* =========================================================
   NORMALIZE SERIAL NUMBER
========================================================= */

function normalizeSerialNumber(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toUpperCase();

}



/* =========================================================
   SERIAL NUMBER FIREBASE CHECK

   Firestore Structure:

   serialNumbers
       SE-000001
           serialNumber: "SE-000001"
           active: true
           registered: false
========================================================= */

async function verifySerialNumber(
    serialNumber
) {

    if (!db) {

        throw new Error(
            "Database connection is not available."
        );

    }


    const normalizedSerial =
        normalizeSerialNumber(
            serialNumber
        );


    if (!normalizedSerial) {

        return {

            valid: false,

            reason:
                "empty"

        };

    }



    /*
       Serial number is being used
       as Firestore Document ID.
    */

    const serialRef =
        doc(
            db,
            "serialNumbers",
            normalizedSerial
        );


    const serialSnapshot =
        await getDoc(
            serialRef
        );



    /* =====================================================
       SERIAL DOES NOT EXIST
    ===================================================== */

    if (
        !serialSnapshot.exists()
    ) {

        return {

            valid: false,

            reason:
                "not-found",

            ref:
                serialRef

        };

    }



    const serialData =
        serialSnapshot.data();



    /* =====================================================
       SERIAL INACTIVE
    ===================================================== */

    if (
        serialData.active === false
    ) {

        return {

            valid: false,

            reason:
                "inactive",

            data:
                serialData,

            ref:
                serialRef

        };

    }



    /* =====================================================
       ALREADY REGISTERED
    ===================================================== */

    if (
        serialData.registered === true
    ) {

        return {

            valid: false,

            reason:
                "already-registered",

            data:
                serialData,

            ref:
                serialRef

        };

    }



    /* =====================================================
       VALID SERIAL
    ===================================================== */

    return {

        valid: true,

        data:
            serialData,

        ref:
            serialRef,

        normalizedSerial

    };

}



/* =========================================================
   PHOTO VALIDATION
========================================================= */

function validatePhoto(
    file
) {

    if (
        !file ||
        !file.size
    ) {

        throw new Error(
            "Please upload the installed device / serial number photograph."
        );

    }


    const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp"

    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        throw new Error(
            "Please upload a JPG, PNG or WEBP image."
        );

    }



    /*
       Maximum 8 MB
    */

    const maxSize =
        8 *
        1024 *
        1024;


    if (
        file.size >
        maxSize
    ) {

        throw new Error(
            "Installed device photo must be below 8 MB."
        );

    }


    return true;

}



/* =========================================================
   UPLOAD WARRANTY PHOTO
========================================================= */

async function uploadWarrantyPhoto(
    file,
    serialNumber
) {

    const safeFileName =
        file.name.replace(

            /[^a-zA-Z0-9._-]/g,

            "_"

        );


    const safeSerial =
        serialNumber.replace(

            /[^a-zA-Z0-9_-]/g,

            "_"

        );


    const uniqueID =

        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"

            ? crypto.randomUUID()

            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;



    const photoPath =

        `warranty/${safeSerial}/${uniqueID}-${safeFileName}`;



    const storageReference =
        ref(
            storage,
            photoPath
        );


    await uploadBytes(

        storageReference,

        file,

        {

            contentType:
                file.type

        }

    );


    return photoPath;

}



/* =========================================================
   FORM SUBMIT

   IMPORTANT:
   We intentionally DO NOT use:

   !document.querySelector('[data-sheet-form]')

   because this warranty form must be handled here.
========================================================= */

form?.addEventListener(

    "submit",

    async event => {


        event.preventDefault();


        event.stopImmediatePropagation();


        hideWarrantyError();



        /* =================================================
           HTML REQUIRED FIELD VALIDATION
        ================================================= */

        if (
            !form.checkValidity()
        ) {

            form.reportValidity();

            return;

        }



        /* =================================================
           MOBILE NUMBER VALIDATION
        ================================================= */

        const mobile =
            String(
                mobileInput?.value ||
                ""
            ).trim();


        if (
            !/^[0-9]{10}$/.test(
                mobile
            )
        ) {

            showWarrantyError(
                "Please enter a valid 10-digit mobile number."
            );

            mobileInput?.focus();

            return;

        }



        /* =================================================
           WARRANTY DATE CHECK
        ================================================= */

        if (
            !validateWarrantyPeriod()
        ) {

            return;

        }



        /* =================================================
           SERIAL NUMBER
        ================================================= */

        const serialNumber =
            normalizeSerialNumber(
                serialInput?.value
            );


        if (!serialNumber) {

            showWarrantyError(
                "Please enter the Device Serial Number."
            );

            serialInput?.focus();

            return;

        }



        /* =================================================
           DISABLE SUBMIT BUTTON
        ================================================= */

        if (submitButton) {

            submitButton.disabled =
                true;


            submitButton.textContent =
                "Verifying Serial Number…";

        }



        try {


            /* =================================================
               INITIALIZE FIREBASE
            ================================================= */

            initializeFirebase();



            /* =================================================
               SERIAL NUMBER VERIFICATION
            ================================================= */

            const serialResult =
                await verifySerialNumber(
                    serialNumber
                );



            /* =================================================
               INVALID SERIAL
            ================================================= */

            if (
                serialResult.reason ===
                "not-found"
            ) {

                showWarrantyError(

                    "Invalid Serial Number. The serial number entered does not match our database. Please check the serial number printed on your SAFE ESCAPE device and try again."

                );


                serialInput?.focus();


                return;

            }



            /* =================================================
               INACTIVE SERIAL
            ================================================= */

            if (
                serialResult.reason ===
                "inactive"
            ) {

                showWarrantyError(

                    "This Serial Number is currently inactive and cannot be registered. Please contact SAFE ESCAPE support."

                );


                serialInput?.focus();


                return;

            }



            /* =================================================
               ALREADY REGISTERED
            ================================================= */

            if (
                serialResult.reason ===
                "already-registered"
            ) {

                showWarrantyError(

                    "This Serial Number has already been registered for warranty. Duplicate warranty registration is not permitted."

                );


                serialInput?.focus();


                return;

            }



            if (
                !serialResult.valid
            ) {

                showWarrantyError(

                    "Unable to verify this Serial Number. Please check the number and try again."

                );


                return;

            }



            /* =================================================
               SERIAL VERIFIED
            ================================================= */

            if (submitButton) {

                submitButton.textContent =
                    "Uploading Photo…";

            }



            /* =================================================
               FORM DATA
            ================================================= */

            const fd =
                new FormData(
                    form
                );


            const file =
                fd.get(
                    "photo"
                );



            /* =================================================
               PHOTO VALIDATION
            ================================================= */

            validatePhoto(
                file
            );



            /* =================================================
               RECHECK INSTALLATION DATE
            ================================================= */

            const installationDateValue =
                String(
                    fd.get(
                        "installationDate"
                    ) || ""
                );


            const daysSinceInstallation =
                getDaysSinceInstallation(
                    installationDateValue
                );


            if (
                daysSinceInstallation === null
            ) {

                throw new Error(
                    "Please enter a valid installation date."
                );

            }


            if (
                daysSinceInstallation < 0
            ) {

                showWarrantyError(

                    "The installation date cannot be in the future."

                );


                return;

            }


            if (
                daysSinceInstallation >= 16
            ) {

                showWarrantyError(

                    "Warranty registration period has expired. Registration must be completed within 15 calendar days of installation."

                );


                return;

            }



            /* =================================================
               UPLOAD PHOTO
            ================================================= */

            const photoPath =
                await uploadWarrantyPhoto(

                    file,

                    serialNumber

                );



            /* =================================================
               PREPARE DATABASE OBJECT
            ================================================= */

            const data = {};


            for (
                const [key, value]
                of fd.entries()
            ) {

                /*
                   Do not save File object
                   directly to Firestore.
                */

                if (
                    key === "photo"
                ) {

                    continue;

                }


                data[key] =
                    typeof value === "string"

                        ? value.trim()

                        : value;

            }



            /*
               Always save normalized serial.
            */

            data.serialNumber =
                serialNumber;


            data.mobile =
                mobile;



            /* =================================================
               CHANGE BUTTON
            ================================================= */

            if (submitButton) {

                submitButton.textContent =
                    "Saving Registration…";

            }



            /* =================================================
               SAVE WARRANTY REGISTRATION
            ================================================= */

            const registrationReference =
                await addDoc(

                    collection(
                        db,
                        "warrantyRegistrations"
                    ),

                    {

                        ...data,


                        /* PHOTO */

                        photoPath,


                        /* SERIAL VERIFICATION */

                        serialVerified:
                            true,


                        serialDatabaseDocument:
                            serialResult.ref.id,


                        /* WARRANTY */

                        registrationEligibility:
                            "within-15-days",


                        daysSinceInstallation,


                        warrantyYears:
                            5,


                        /* STATUS */

                        status:
                            "pending-review",


                        /* TIMESTAMP */

                        createdAt:
                            serverTimestamp()

                    }

                );



            /* =================================================
               MARK SERIAL NUMBER AS REGISTERED
            ================================================= */

            await updateDoc(

                serialResult.ref,

                {

                    registered:
                        true,


                    registeredAt:
                        serverTimestamp(),


                    warrantyRegistrationId:
                        registrationReference.id,


                    warrantyStatus:
                        "pending-review"

                }

            );



            /* =================================================
               SUCCESS
            ================================================= */

            form.reset();


            hideWarrantyError();


            showMessage(

                "Warranty registration submitted successfully. Your Serial Number has been verified and the registration is now pending review.",

                "success"

            );



            /*
               Scroll to form top
            */

            form.scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "start"

            });


        }


        catch (error) {


            console.error(
                "SAFE ESCAPE Warranty Error:",
                error
            );



            /* =================================================
               FIRESTORE PERMISSION ERROR
            ================================================= */

            if (
                error?.code ===
                "permission-denied"
            ) {

                showWarrantyError(

                    "Database permission denied. Please check your Firebase Firestore and Storage security rules."

                );

            }



            /* =================================================
               NETWORK ERROR
            ================================================= */

            else if (
                error?.code ===
                "unavailable"
            ) {

                showWarrantyError(

                    "Unable to connect to the server. Please check your internet connection and try again."

                );

            }



            /* =================================================
               STORAGE ERROR
            ================================================= */

            else if (
                String(
                    error?.code || ""
                ).startsWith(
                    "storage/"
                )
            ) {

                showWarrantyError(

                    "The installation photo could not be uploaded. Please try again."

                );

            }



            /* =================================================
               OTHER ERROR
            ================================================= */

            else {

                showWarrantyError(

                    error?.message ||

                    "Could not submit the warranty registration. Please try again."

                );

            }


            showMessage(

                "Warranty registration could not be submitted.",

                "error"

            );


        }


        finally {


            /* =================================================
               RESTORE BUTTON
            ================================================= */

            if (submitButton) {

                submitButton.disabled =
                    false;


                submitButton.textContent =
                    "Submit Registration →";

            }


        }


    },

    /*
       Capture mode helps this warranty handler
       take control before generic form handlers.
    */

    true

);



/* =========================================================
   RESET BUTTON
========================================================= */

form?.addEventListener(

    "reset",

    () => {


        hideWarrantyError();


        setTimeout(
            () => {

                if (submitButton) {

                    submitButton.disabled =
                        false;


                    submitButton.textContent =
                        "Submit Registration →";

                }

            },
            0
        );


    }

);



/* =========================================================
   INITIAL LOG
========================================================= */

console.log(
    "SAFE ESCAPE Warranty Registration JS Loaded."
);