# How to Make a Fullscreen Background Image PWA (iOS)

This guide describes the technical implementation of a Progressive Web App (PWA) that allows users to set a fullscreen background image on iPhone (iOS 18+), with zoom/pan prevention and no browser UI.

## Implementation Overview

This PWA implements all the key requirements for a true fullscreen experience on iOS devices.

### 1. HTML Structure (index.html)
- Single `<input type="file">` for image upload
- Button to trigger background change (Reset)
- All required PWA meta tags

### 2. Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```
- Disables zooming with `maximum-scale=1.0` and `user-scalable=no`
- Ensures edge-to-edge display with `viewport-fit=cover`

### 3. Apple PWA Meta Tags
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```
- Enables standalone mode (no browser UI when launched from home screen)
- Sets status bar to black-translucent for immersive experience

### 4. CSS for Fullscreen (styles.css)
```css
html, body {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: none;
}

body {
    background: black;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}
```

### 5. Prevent Scrolling and Gestures
CSS properties:
- `overflow: hidden` - Prevents scrolling
- `overscroll-behavior: none` - Prevents bounce/rubber-band effect
- `touch-action: none` - Disables default touch behaviors

JavaScript multi-touch prevention:
```javascript
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
```

### 6. Image Upload and Display (app.js)
```javascript
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

function setWallpaper(imageDataUrl) {
    const body = document.body;
    body.style.background = 'black';
    body.style.backgroundImage = `url('${imageDataUrl}')`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundRepeat = 'no-repeat';
}
```

### 7. Manifest.json
```json
{
  "name": "Magic Wallpaper",
  "short_name": "Magic",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [...]
}
```

### 8. Add to Home Screen
1. Open the PWA in Safari on iOS
2. Tap the Share button
3. Select "Add to Home Screen"
4. Launch from the home screen icon for true fullscreen experience

## Key Features Implemented

✅ **Fullscreen Experience**: 100vw x 100vh viewport with no scrolling  
✅ **Zoom Prevention**: Both viewport meta tag and touch event handling  
✅ **Pan Prevention**: `touch-action: none` and multi-touch blocking  
✅ **iOS Standalone Mode**: Apple-specific meta tags for app-like behavior  
✅ **Edge-to-Edge Display**: `viewport-fit=cover` for notch support  
✅ **Black Background**: Default black background for images  
✅ **Persistent Storage**: localStorage saves wallpaper across sessions  
✅ **Service Worker**: Offline functionality via PWA caching  

## Troubleshooting

### Browser UI Still Visible
- Make sure you've added the PWA to the home screen
- Launch from the home screen icon, not from Safari
- Check that all Apple PWA meta tags are present

### Scrolling/Zooming Still Works
- Verify viewport meta tag includes `maximum-scale=1.0, user-scalable=no`
- Check CSS includes `overflow: hidden`, `overscroll-behavior: none`, `touch-action: none`
- Ensure JavaScript touch event listeners are registered with `passive: false`

### Old Version Appears After Update
- Update the cache version in `service-worker.js` (currently v2)
- Clear Safari cache or re-add the PWA to home screen
- Force reload in Safari before re-adding

## Testing
To test locally:
```bash
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000`

---

**Note**: This implementation follows iOS 18+ best practices for fullscreen PWAs. For optimal experience, test on a real iOS device with the PWA installed on the home screen.
