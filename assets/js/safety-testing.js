document.addEventListener("DOMContentLoaded", () => {

    const buttons = [...document.querySelectorAll(".view-document")];

    const modal = document.getElementById("documentModal");
    const preview = document.getElementById("documentPreview");
    const closeBtn = document.querySelector(".document-close");

    if (!modal || !preview || !closeBtn) {
        console.log("Document modal elements missing");
        return;
    }


    /* =========================================
       DOCUMENT LIST
    ========================================= */

    const documents = buttons.map(button => button.dataset.document);

    let currentIndex = 0;
    let zoomLevel = 1;


    /* =========================================
       CREATE MODAL CONTROLS
    ========================================= */

    const controls = document.createElement("div");

    controls.className = "document-controls";

    controls.innerHTML = `
        <button type="button" class="document-prev" aria-label="Previous document">
            ‹
        </button>

        <button type="button" class="document-zoom-out" aria-label="Zoom out">
            −
        </button>

        <span class="document-zoom-value">
            100%
        </span>

        <button type="button" class="document-zoom-in" aria-label="Zoom in">
            +
        </button>

        <button type="button" class="document-reset" aria-label="Reset zoom">
            Reset
        </button>

        <button type="button" class="document-next" aria-label="Next document">
            ›
        </button>
    `;

    document
        .querySelector(".document-modal-box")
        ?.appendChild(controls);


    const prevBtn = controls.querySelector(".document-prev");
    const nextBtn = controls.querySelector(".document-next");
    const zoomInBtn = controls.querySelector(".document-zoom-in");
    const zoomOutBtn = controls.querySelector(".document-zoom-out");
    const resetBtn = controls.querySelector(".document-reset");
    const zoomValue = controls.querySelector(".document-zoom-value");


    /* =========================================
       UPDATE IMAGE
    ========================================= */

   function showDocument(index) {

    if (!documents.length) return;

    if (index < 0) {
        index = documents.length - 1;
    }

    if (index >= documents.length) {
        index = 0;
    }

    currentIndex = index;
    zoomLevel = 1;

    preview.onload = () => {

        updateZoom();

        // New slide always starts from top-left
        const viewer = document.querySelector(".document-modal-box");

        if (viewer) {
            viewer.scrollTop = 0;
            viewer.scrollLeft = 0;
        }
    };

    preview.src = documents[currentIndex];
}


    /* =========================================
       ZOOM
    ========================================= */

  function updateZoom() {

    // Actual image size change — no transform/scale
    preview.style.transform = "none";

    preview.style.width = `${zoomLevel * 100}%`;
    preview.style.maxWidth = "none";
    preview.style.maxHeight = "none";
    preview.style.height = "auto";

    if (zoomValue) {
        zoomValue.textContent =
            `${Math.round(zoomLevel * 100)}%`;
    }

}


    function zoomIn() {

        if (zoomLevel < 3) {

            zoomLevel += 0.25;

            updateZoom();

        }

    }


    function zoomOut() {

        if (zoomLevel > 0.5) {

            zoomLevel -= 0.25;

            updateZoom();

        }

    }


    function resetZoom() {

        zoomLevel = 1;

        updateZoom();

    }


    /* =========================================
       OPEN DOCUMENT
    ========================================= */

    buttons.forEach((button, index) => {

        button.addEventListener("click", e => {

            e.preventDefault();

            currentIndex = index;

            showDocument(currentIndex);

            modal.classList.add("active");

            document.body.classList.add("document-open");

        });

    });


    /* =========================================
       PREVIOUS / NEXT
    ========================================= */

    prevBtn?.addEventListener("click", e => {

        e.stopPropagation();

        showDocument(currentIndex - 1);

    });


    nextBtn?.addEventListener("click", e => {

        e.stopPropagation();

        showDocument(currentIndex + 1);

    });


    /* =========================================
       ZOOM BUTTONS
    ========================================= */

    zoomInBtn?.addEventListener("click", e => {

        e.stopPropagation();

        zoomIn();

    });


    zoomOutBtn?.addEventListener("click", e => {

        e.stopPropagation();

        zoomOut();

    });


    resetBtn?.addEventListener("click", e => {

        e.stopPropagation();

        resetZoom();

    });


    /* =========================================
       DOUBLE CLICK IMAGE = ZOOM
    ========================================= */

    preview.addEventListener("dblclick", e => {

        e.preventDefault();

        if (zoomLevel === 1) {

            zoomLevel = 2;

        } else {

            zoomLevel = 1;

        }

        updateZoom();

    });


    /* =========================================
       MOUSE WHEEL ZOOM
    ========================================= */

    preview.addEventListener(
        "wheel",
        e => {

            e.preventDefault();

            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }

        },
        { passive: false }
    );


    /* =========================================
       CLOSE MODAL
    ========================================= */

    function closeModal() {

        modal.classList.remove("active");

        document.body.classList.remove("document-open");

        preview.src = "";

        zoomLevel = 1;

        updateZoom();

    }


    closeBtn.addEventListener("click", closeModal);


    modal.addEventListener("click", e => {

        if (e.target === modal) {
            closeModal();
        }

    });


    /* =========================================
       KEYBOARD
    ========================================= */

    document.addEventListener("keydown", e => {

        if (!modal.classList.contains("active")) {
            return;
        }

        if (e.key === "Escape") {
            closeModal();
        }

        if (e.key === "ArrowRight") {
            showDocument(currentIndex + 1);
        }

        if (e.key === "ArrowLeft") {
            showDocument(currentIndex - 1);
        }

        if (e.key === "+" || e.key === "=") {
            zoomIn();
        }

        if (e.key === "-") {
            zoomOut();
        }

    });


    /* =========================================
       IMAGE PROTECTION
       Disable right click
    ========================================= */

    document.addEventListener("contextmenu", e => {

        e.preventDefault();

    });


    /* =========================================
       DISABLE IMAGE DRAGGING
    ========================================= */

    document.querySelectorAll("img").forEach(img => {

        img.setAttribute("draggable", "false");

        img.addEventListener("dragstart", e => {
            e.preventDefault();
        });

    });


    /* =========================================
       DISABLE COPY
    ========================================= */

    document.addEventListener("copy", e => {

        e.preventDefault();

    });


    document.addEventListener("cut", e => {

        e.preventDefault();

    });


    /* =========================================
       DISABLE COMMON COPY SHORTCUTS
    ========================================= */

    document.addEventListener("keydown", e => {

        if (
            (e.ctrlKey || e.metaKey) &&
            ["c", "x", "s", "u"].includes(
                e.key.toLowerCase()
            )
        ) {

            e.preventDefault();

        }

    });

});