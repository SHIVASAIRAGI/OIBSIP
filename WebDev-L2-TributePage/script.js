
// =====================================
// LOCAL PHOTO LOADER
// All photographs are beside index.html
// =====================================

const localImages = document.querySelectorAll("[data-local-image]");

localImages.forEach((img) => {
    const filename = img.dataset.localImage;
    const hasExtension = /\.(jpg|jpeg|png|webp)$/i.test(filename);

    const candidates = hasExtension
        ? [filename, filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".jpeg"),
           filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".png"),
           filename.replace(/\.(jpg|jpeg|png|webp)$/i, ".webp")]
        : [
            filename + ".jpg",
            filename + ".jpeg",
            filename + ".png",
            filename + ".webp"
        ];

    let current = 0;

    function tryNextImage() {
        if (current >= candidates.length) {
            img.style.display = "none";
            img.parentElement.classList.add("image-missing");
            console.warn("Image not found:", filename);
            return;
        }

        const nextPath = "./" + encodeURI(candidates[current]);
        current++;

        img.src = nextPath;
    }

    img.addEventListener("error", tryNextImage);
    tryNextImage();
});

// =====================================
// MOBILE NAVIGATION
// =====================================

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("active");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
            menuToggle.textContent = "☰";
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });
}

// =====================================
// SCROLL REVEAL
// =====================================

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12
    });

    revealElements.forEach((element) => observer.observe(element));
} else {
    revealElements.forEach((element) => element.classList.add("visible"));
}

// =====================================
// IMAGE GALLERY LIGHTBOX
// =====================================

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

document.querySelectorAll("[data-gallery]").forEach((card) => {
    card.addEventListener("click", () => {
        const image = card.querySelector("img");

        if (!image || image.style.display === "none" || !image.src) {
            return;
        }

        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightbox.classList.add("active");
        document.body.style.overflow = "hidden";
    });
});

function closeLightbox() {
    lightbox.classList.remove("active");
    lightboxImage.src = "";
    document.body.style.overflow = "";
}

if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
}

if (lightbox) {
    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeLightbox();
    }
});

// =====================================
// BACK TO TOP
// =====================================

const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
    if (window.scrollY > 450) {
        backToTop.classList.add("visible");
    } else {
        backToTop.classList.remove("visible");
    }
});

if (backToTop) {
    backToTop.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}
