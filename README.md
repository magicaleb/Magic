# Magic Wallpaper

A Progressive Web App (PWA) for setting fullscreen background images on iOS and other devices, with an advanced modular gesture input system.

## Features

- 🖼️ **True Fullscreen Experience**: Edge-to-edge display with no browser UI (iOS standalone mode)
- 📤 **Upload Custom Images**: Select any image as your fullscreen wallpaper
- 🔄 **Reset Functionality**: Return to clean black background
- 💾 **Persistent Storage**: Wallpaper saved across sessions using localStorage
- 📱 **iOS Optimized**: Designed for iOS 18+ with zoom/pan prevention
- 🚫 **No Scrolling/Gestures**: Locked viewport prevents unwanted interactions
- 🔌 **Offline Support**: Service worker enables offline functionality
- 📐 **Responsive Design**: Works on all screen sizes and orientations
- 👆 **Gesture Input System**: Modular swipe-based input with multiple modes
- ⚙️ **Configurable Settings**: Switch between input modes and customize behavior

## iOS Installation (Recommended)

For the best fullscreen experience on iPhone:

1. Open the app in **Safari**
2. Tap the **Share** button (square with arrow)
3. Select **"Add to Home Screen"**
4. Launch the app from your home screen icon

When launched from the home screen, the app runs in standalone mode with no browser UI!

## Usage

### Basic Usage

1. Open the app (from home screen on iOS or in browser on other devices)
2. Click **Upload Image** to select an image from your device
3. The image will fill the entire screen as a background
4. Click **Reset** to return to the default black background

### Gesture Input System

The app includes a modular gesture input system that can be used for future interactive tricks:

#### Clock Face Mode (Default)
- Swipe in any direction to select one of 12 positions (like a clock face)
- Each position is determined by the angle of your swipe
- Provides immediate feedback on selection

#### Two-Swipe Mode
1. **First Swipe**: Select a base position from 4 cardinal directions
   - Swipe Up → 12 o'clock
   - Swipe Right → 3 o'clock
   - Swipe Down → 6 o'clock
   - Swipe Left → 9 o'clock

2. **Second Swipe**: Fine-tune your selection
   - Same direction as first swipe → Exact base position
   - Forward/Up relative to first → +1 position
   - Backward/Down relative to first → -1 position

Example: Swipe Right (3 o'clock) then Swipe Up (+1) = 4 o'clock

### Settings

Click the **⚙️ Settings** button or press **'s'** to access:
- **Input Mode**: Switch between Clock Face and Two-Swipe modes
- **Auto-submit Delay**: Configure delay before processing input (in milliseconds)
- **Copy to Clipboard**: Automatically copy selected position to clipboard
- **Show Feedback**: Toggle visual feedback for gestures

### Keyboard Shortcuts

- **s** - Open settings panel
- **Escape** - Close settings panel

## Running Locally

Serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Technical Details

### Gesture System Architecture

The gesture input system is built with modularity in mind:

- **`assets/js/gestureDetector.js`**: Base gesture detection handling touch events
- **`assets/js/inputModes.js`**: Input mode implementations (Clock Face, Two-Swipe)
- **`assets/js/settings.js`**: Settings management and UI

### Adding New Input Modes

To add a new input mode:

1. Create a new class in `inputModes.js` implementing:
   - `processGesture(gesture)` - Handle gesture input
   - `getState()` - Return current state for UI feedback
   - `reset()` - Reset internal state
   - `onCompletion(callback)` - Register completion callback

2. Add the mode to `InputModeManager.modes` object

3. The mode will automatically appear in settings

See [FULLSCREEN_PWA_GUIDE.md](FULLSCREEN_PWA_GUIDE.md) for complete technical implementation details including:
- Viewport configuration for zoom/pan prevention
- Apple PWA meta tags
- Touch event handling
- CSS for fullscreen layout
- Service worker setup
