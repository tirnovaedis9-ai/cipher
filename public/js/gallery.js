document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('logo-gallery-grid');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxDownload = document.getElementById('lightbox-download');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    let currentImageIndex = 0;

    // List of images in the gallery folder
    const images = [
        'Cipher (1).png',
        'Cipher (2).png',
        'Cipher (3).png',
        'Cipher (4).png',
        'Cipher (5).png',
        'Cipher (6).png',
        'Cipher (7).png',
        'Cipher (8).png',
        'Cipher (9).png',
        'Cipher (10).png',
        'Cipher (11).png',
        'Cipher (12).png',
        'Cipher (13).png',
        'Cipher (14).png',
        'Cipher (15).png',
        'Cipher (16).png',
        'Cipher (17).png',
        'Cipher (18).png',
        'Cipher (19).png',
        'Cipher (20).png',
        'Cipher (21).png',
        'Cipher (22).png',
        'Cipher (23).png',
        'Cipher (24).png',
        'Cipher (25).png'
    ];

    // Function to show a specific image in the lightbox
    const showImage = (index) => {
        if (index < 0) {
            currentImageIndex = images.length - 1;
        } else if (index >= images.length) {
            currentImageIndex = 0;
        } else {
            currentImageIndex = index;
        }
        const imgSrc = `assets/gallery/${images[currentImageIndex]}`;
        lightboxImage.src = imgSrc;
        lightboxDownload.href = imgSrc;
        lightboxModal.style.display = 'flex';
        document.addEventListener('keydown', handleKeyDown); // Add keyboard listener when modal opens
    };

    // Function to close the lightbox
    const closeModal = () => {
        if (lightboxModal) {
            lightboxModal.style.display = 'none';
            document.removeEventListener('keydown', handleKeyDown); // Remove keyboard listener when modal closes
        }
    };

    // New: Keyboard navigation handler
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            showImage(currentImageIndex - 1);
        } else if (e.key === 'ArrowRight') {
            showImage(currentImageIndex + 1);
        } else if (e.key === 'Escape') {
            closeModal();
        }
    };

    // Dynamically create gallery items
    if (galleryGrid) {
        images.forEach((imageName, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.dataset.imageSrc = `assets/gallery/${imageName}`;

            const img = document.createElement('img');
            img.src = `assets/gallery/${imageName}`;
            img.alt = 'Cipher Logo Art';

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            overlay.innerHTML = '<i class="fas fa-expand"></i>';

            item.appendChild(img);
            item.appendChild(overlay);
            galleryGrid.appendChild(item);

            // Add click listener to open lightbox
            item.addEventListener('click', () => {
                showImage(index);
            });
        });
    }

    // Event listeners for closing the lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeModal);
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                closeModal();
            }
        });
    }

    // Event listeners for navigation buttons
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex - 1);
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex + 1);
        });
    }
});
