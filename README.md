# Magic Wallpaper

A Progressive Web App (PWA) for setting fullscreen background images on iOS and other devices.

## Features

- 🖼️ **True Fullscreen Experience**: Edge-to-edge display with no browser UI (iOS standalone mode)
- 📤 **Upload Custom Images**: Select any image as your fullscreen wallpaper
- 🔄 **Reset Functionality**: Return to clean black background
- 💾 **Persistent Storage**: Wallpaper saved across sessions using localStorage
- 📱 **iOS Optimized**: Designed for iOS 18+ with zoom/pan prevention
- 🚫 **No Scrolling/Gestures**: Locked viewport prevents unwanted interactions
- 🔌 **Offline Support**: Service worker enables offline functionality
- 📐 **Responsive Design**: Works on all screen sizes and orientations

## iOS Installation (Recommended)

For the best fullscreen experience on iPhone:

1. Open the app in **Safari**
2. Tap the **Share** button (square with arrow)
3. Select **"Add to Home Screen"**
4. Launch the app from your home screen icon

When launched from the home screen, the app runs in standalone mode with no browser UI!

## Usage

1. Open the app (from home screen on iOS or in browser on other devices)
2. Click **Upload Image** to select an image from your device
3. The image will fill the entire screen as a background
4. Click **Reset** to return to the default black background

## Running Locally

Serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Technical Details

See [FULLSCREEN_PWA_GUIDE.md](FULLSCREEN_PWA_GUIDE.md) for complete technical implementation details including:
- Viewport configuration for zoom/pan prevention
- Apple PWA meta tags
- Touch event handling
- CSS for fullscreen layout
- Service worker setup
