// Set viewport height fix
function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', setVH);

// Get elements
const input = document.getElementById('file');
const bg = document.getElementById('bg');
const uploadBtn = document.getElementById('upload-btn');
const resetBtn = document.getElementById('reset-btn');

// Handle file input
input.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    const url = URL.createObjectURL(f);
    bg.src = url;
    
    // Persist to localStorage as data URL via canvas scaled to screen size
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = screen.width * devicePixelRatio;
        c.height = screen.height * devicePixelRatio;
        const ctx = c.getContext('2d');
        
        // Cover-fit draw
        const iw = img.width, ih = img.height;
        const cw = c.width, ch = c.height;
        const ir = iw / ih, cr = cw / ch;
        let dw, dh, dx, dy;
        if (ir > cr) {
            dh = ch;
            dw = dh * ir;
            dx = (cw - dw) / 2;
            dy = 0;
        } else {
            dw = cw;
            dh = dw / ir;
            dx = 0;
            dy = (ch - dh) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        localStorage.setItem('bgData', c.toDataURL('image/jpeg', 0.92));
        URL.revokeObjectURL(url);
    };
    img.src = url;
});

// Restore persisted background
const saved = localStorage.getItem('bgData');
if (saved) bg.src = saved;

// Upload button
uploadBtn.addEventListener('click', () => {
    input.click();
});

// Hard reset function
async function hardReset() {
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        if (self.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        localStorage.clear();
        sessionStorage.clear();
    } finally {
        location.replace('./index.html?refreshed=1&v=1&nosw=1');
    }
}

window.hardReset = hardReset;

// Reset button
resetBtn.addEventListener('click', hardReset);

// Debug: log display-mode
if (matchMedia('(display-mode: standalone)').matches) {
    console.log('standalone');
}
