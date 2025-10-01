# Magic Wallpaper

A minimal GitHub Pages PWA that lets you upload a screenshot and display it full-bleed as a fake lock/home screen on iPhone.

## Features

- 📤 Upload custom images with full-screen display
- 🔄 Hard reset function (clears cache, storage, and unregisters service worker)
- 💾 Persistent storage using canvas and localStorage
- 📱 iOS PWA support with no safe-area gaps
- 🎨 Full-bleed display with object-fit: cover
- 📐 Viewport height fix for mobile devices
- 🚫 No stale cache issues (minimal service worker)

## Usage

### GitHub Pages
1. Visit https://magicaleb.github.io/Magic/
2. Add to Home Screen on iOS
3. Launch from icon (no top or bottom bars visible)
4. Click **Upload Image** to select a screenshot
5. The image fills the entire screen with no gaps
6. Close and relaunch - the image persists

### Local Development
Serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then navigate to `http://localhost:8000`

### Hard Reset
If you need to clear everything:
- Click the **Reset** button
- Or visit `index.html?nosw=1` to disable service worker
- Or use the console: `window.hardReset()`

## Technical Details

- All URLs are relative (`./file`) for GitHub Pages subpath deployment
- Viewport height fix using CSS custom property `--vh`
- Canvas-based image persistence with cover-fit scaling
- Safe-area insets for iOS notch support
- Minimal service worker (skipWaiting + claim only, no fetch handler)
- Version query strings for cache busting (`?v=1`)

## Requirements Met

✅ Works at GitHub Pages repo path (not site root)  
✅ Full-bleed display with no gaps on iOS  
✅ Respects safe areas (notch)  
✅ Image persists across relaunches  
✅ Hard reset clears all state  
✅ No stale cache issues during development
