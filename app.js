// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Prevent multi-touch zoom/pan gestures
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Get elements
const imageUpload = document.getElementById('imageUpload');
const resetButton = document.getElementById('resetButton');

// Load saved wallpaper from localStorage
function loadWallpaper() {
    const savedImage = localStorage.getItem('wallpaperImage');
    if (savedImage) {
        setWallpaper(savedImage);
    }
}

// Set wallpaper
function setWallpaper(imageDataUrl) {
    const body = document.body;
    body.style.background = 'black';
    body.style.backgroundImage = `url('${imageDataUrl}')`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
}

// Reset wallpaper
function resetWallpaper() {
    localStorage.removeItem('wallpaperImage');
    const body = document.body;
    body.style.background = 'black';
    body.style.backgroundImage = '';
}

// Handle image upload
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageDataUrl = event.target.result;
            localStorage.setItem('wallpaperImage', imageDataUrl);
            setWallpaper(imageDataUrl);
        };
        reader.readAsDataURL(file);
    }
});

// Handle reset button
resetButton.addEventListener('click', resetWallpaper);

// Load wallpaper on page load
loadWallpaper();
