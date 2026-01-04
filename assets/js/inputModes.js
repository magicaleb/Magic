/**
 * Input Modes Module
 * Defines different input modes for gesture-based selection
 */

/**
 * Clock Face Input Mode
 * Direct swipe to one of 12 positions (like a clock face)
 */
class ClockFaceMode {
    constructor() {
        this.name = 'clockface';
        this.displayName = 'Clock Face (12 positions)';
        this.onComplete = null;
    }

    /**
     * Process a gesture and return the selected position (1-12)
     * @param {Object} gesture - Gesture data from GestureDetector
     */
    processGesture(gesture) {
        const { deltaX, deltaY } = gesture;
        
        // Calculate angle in degrees (0° = right, 90° = down, etc.)
        const angleRad = Math.atan2(deltaY, deltaX);
        let angleDeg = (angleRad * 180 / Math.PI);
        
        // Convert to clock face (12 o'clock = 0°, clockwise)
        // Rotate by 90° and adjust so 12 o'clock is at top
        angleDeg = (90 - angleDeg + 360) % 360;
        
        // Map to 12 positions (each position covers 30°)
        // 12 o'clock = 0°, 1 o'clock = 30°, etc.
        const position = Math.round(angleDeg / 30) % 12;
        const clockPosition = position === 0 ? 12 : position;
        
        if (this.onComplete) {
            this.onComplete(clockPosition);
        }
        
        return {
            position: clockPosition,
            complete: true
        };
    }

    /**
     * Get current state for UI feedback
     */
    getState() {
        return {
            stage: 'ready',
            message: 'Swipe in any direction'
        };
    }

    /**
     * Reset the mode
     */
    reset() {
        // Clock face has no internal state to reset
    }

    /**
     * Register completion callback
     */
    onCompletion(callback) {
        this.onComplete = callback;
    }
}

/**
 * Two-Swipe Input Mode
 * First swipe selects base position (12, 3, 6, 9), second swipe refines (+1, -1, or exact)
 */
class TwoSwipeMode {
    constructor() {
        this.name = 'twoswipe';
        this.displayName = 'Two-Swipe (12 positions)';
        this.onComplete = null;
        this.stage = 'first'; // 'first' or 'second'
        this.basePosition = null;
        this.firstSwipeDirection = null;
        this.timeout = null;
        this.timeoutDuration = 3000; // 3 seconds to complete second swipe
    }

    /**
     * Process a gesture based on current stage
     * @param {Object} gesture - Gesture data from GestureDetector
     */
    processGesture(gesture) {
        if (this.stage === 'first') {
            return this.processFirstSwipe(gesture);
        } else {
            return this.processSecondSwipe(gesture);
        }
    }

    /**
     * Process first swipe - select base position from cardinal directions
     */
    processFirstSwipe(gesture) {
        const { direction } = gesture;
        
        // Map direction to base position (clock face)
        const directionMap = {
            'up': 12,      // 12 o'clock
            'right': 3,    // 3 o'clock
            'down': 6,     // 6 o'clock
            'left': 9      // 9 o'clock
        };
        
        this.basePosition = directionMap[direction];
        this.firstSwipeDirection = direction;
        this.stage = 'second';
        
        // Set timeout to reset if second swipe not completed
        this.setTimeout();
        
        return {
            position: null,
            complete: false,
            basePosition: this.basePosition,
            stage: 'second'
        };
    }

    /**
     * Process second swipe - refine selection
     */
    processSecondSwipe(gesture) {
        const { direction } = gesture;
        
        this.clearTimeout();
        
        let finalPosition = this.basePosition;
        
        // Determine refinement based on second swipe direction
        if (direction === this.firstSwipeDirection) {
            // Same direction = exact base position
            finalPosition = this.basePosition;
        } else if (this.isForwardOrUp(direction, this.firstSwipeDirection)) {
            // Forward/Up = +1
            finalPosition = this.basePosition + 1;
            if (finalPosition > 12) finalPosition = 1;
        } else {
            // Backward/Down = -1
            finalPosition = this.basePosition - 1;
            if (finalPosition < 1) finalPosition = 12;
        }
        
        // Reset for next input
        const result = {
            position: finalPosition,
            complete: true,
            basePosition: this.basePosition
        };
        
        this.reset();
        
        if (this.onComplete) {
            this.onComplete(finalPosition);
        }
        
        return result;
    }

    /**
     * Determine if second swipe is "forward" or "up" relative to first
     */
    isForwardOrUp(secondDir, firstDir) {
        // For horizontal first swipe: up is +1, down is -1
        if (firstDir === 'left' || firstDir === 'right') {
            return secondDir === 'up';
        }
        // For vertical first swipe: right is +1, left is -1
        if (firstDir === 'up' || firstDir === 'down') {
            return secondDir === 'right';
        }
        return false;
    }

    /**
     * Set timeout for incomplete sequence
     */
    setTimeout() {
        this.clearTimeout();
        this.timeout = setTimeout(() => {
            this.reset();
        }, this.timeoutDuration);
    }

    /**
     * Clear timeout
     */
    clearTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    /**
     * Get current state for UI feedback
     */
    getState() {
        if (this.stage === 'first') {
            return {
                stage: 'first',
                message: 'Swipe in cardinal direction (↑ → ↓ ←)'
            };
        } else {
            return {
                stage: 'second',
                message: `Base: ${this.basePosition} o'clock - Refine your selection`,
                basePosition: this.basePosition
            };
        }
    }

    /**
     * Reset the mode
     */
    reset() {
        this.stage = 'first';
        this.basePosition = null;
        this.firstSwipeDirection = null;
        this.clearTimeout();
    }

    /**
     * Register completion callback
     */
    onCompletion(callback) {
        this.onComplete = callback;
    }
}

/**
 * Input Mode Manager
 * Manages different input modes and switching between them
 */
class InputModeManager {
    constructor() {
        this.modes = {
            clockface: new ClockFaceMode(),
            twoswipe: new TwoSwipeMode()
        };
        this.currentMode = null;
        this.gestureDetector = new GestureDetector();
        
        // Initialize with clock face mode (but don't save to localStorage yet)
        this.setMode('clockface', false);
        
        // Setup gesture listener
        this.gestureDetector.onGesture((gesture) => {
            if (this.currentMode) {
                this.currentMode.processGesture(gesture);
            }
        });
    }

    /**
     * Initialize the input mode manager
     */
    initialize(element = document) {
        this.gestureDetector.initialize(element);
    }

    /**
     * Set the active input mode
     * @param {string} modeName - Name of the mode to activate
     * @param {boolean} saveToStorage - Whether to save to localStorage (default: true)
     */
    setMode(modeName, saveToStorage = true) {
        if (this.modes[modeName]) {
            // Reset previous mode
            if (this.currentMode) {
                this.currentMode.reset();
            }
            
            this.currentMode = this.modes[modeName];
            
            // Save preference
            if (saveToStorage) {
                localStorage.setItem('inputMode', modeName);
            }
        }
    }

    /**
     * Get the current mode
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Get all available modes
     */
    getAvailableModes() {
        return Object.keys(this.modes).map(key => ({
            name: key,
            displayName: this.modes[key].displayName
        }));
    }

    /**
     * Get current state for UI feedback
     */
    getState() {
        return this.currentMode ? this.currentMode.getState() : null;
    }

    /**
     * Register completion callback for current mode
     */
    onCompletion(callback) {
        if (this.currentMode) {
            this.currentMode.onCompletion(callback);
        }
    }

    /**
     * Load saved mode preference
     */
    loadSavedMode() {
        const savedMode = localStorage.getItem('inputMode');
        if (savedMode && this.modes[savedMode]) {
            this.setMode(savedMode, false); // Don't save again, we're loading
        } else {
            // First time - save the default
            localStorage.setItem('inputMode', 'clockface');
        }
    }
}
