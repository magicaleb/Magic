// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

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
    document.body.classList.add('has-wallpaper');
    const style = document.createElement('style');
    style.id = 'wallpaper-style';
    style.textContent = `body::before { background-image: url(${imageDataUrl}); }`;
    document.head.appendChild(style);
}

// Reset wallpaper
function resetWallpaper() {
    localStorage.removeItem('wallpaperImage');
    document.body.classList.remove('has-wallpaper');
    // Remove the wallpaper style
    const wallpaperStyle = document.getElementById('wallpaper-style');
    if (wallpaperStyle) {
        wallpaperStyle.remove();
    }
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
