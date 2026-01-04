// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Prevent multi-touch zoom/pan gestures (but allow single touch for swipes)
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

// Initialize gesture input system
let inputModeManager;
let settingsManager;

// Initialize after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create input mode manager
    inputModeManager = new InputModeManager();
    inputModeManager.initialize();
    inputModeManager.loadSavedMode();
    
    // Create settings manager
    settingsManager = new SettingsManager(inputModeManager);
    settingsManager.createUI();
    
    // Handle gesture completion
    inputModeManager.onCompletion((position) => {
        handleGestureInput(position);
    });
    
    // Show initial feedback
    settingsManager.updateFeedback();
});

/**
 * Handle gesture input completion
 * @param {number} position - Selected position (1-12)
 */
function handleGestureInput(position) {
    console.log(`Gesture input: Position ${position}`);
    
    // Show feedback message
    settingsManager.showMessage(`Selected: ${position} o'clock`);
    
    // Copy to clipboard if enabled
    const clipboardEnabled = settingsManager.getSetting('clipboardCopy');
    if (clipboardEnabled && navigator.clipboard) {
        navigator.clipboard.writeText(position.toString())
            .then(() => {
                console.log('Copied to clipboard:', position);
            })
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
            });
    }
    
    // Auto-submit after delay (placeholder for future functionality)
    const autoSubmitDelay = settingsManager.getSetting('autoSubmitDelay');
    setTimeout(() => {
        // This is where you would submit the position to a trick/action
        console.log('Auto-submit:', position);
    }, autoSubmitDelay);
    
    // Update feedback for next gesture
    setTimeout(() => {
        settingsManager.updateFeedback();
    }, autoSubmitDelay + 100);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Press 's' to open settings
    if (e.key === 's' || e.key === 'S') {
        if (settingsManager) {
            settingsManager.toggle();
        }
    }
    
    // Press 'Escape' to close settings
    if (e.key === 'Escape') {
        if (settingsManager) {
            settingsManager.close();
        }
    }
});
