/**
 * Base Gesture Detector
 * Handles touch events and detects swipe gestures
 */
class GestureDetector {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // Minimum distance in pixels to register as a swipe
        this.handlers = [];
        this.element = null;
        this.boundHandleTouchStart = null;
        this.boundHandleTouchEnd = null;
    }

    /**
     * Register a gesture handler
     * @param {Function} handler - Function to call when gesture is detected
     */
    onGesture(handler) {
        this.handlers.push(handler);
    }

    /**
     * Initialize touch event listeners
     * @param {HTMLElement} element - Element to attach listeners to
     */
    initialize(element = document) {
        this.element = element;
        this.boundHandleTouchStart = (e) => this.handleTouchStart(e);
        this.boundHandleTouchEnd = (e) => this.handleTouchEnd(e);
        
        element.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
        element.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        if (this.element && this.boundHandleTouchStart && this.boundHandleTouchEnd) {
            this.element.removeEventListener('touchstart', this.boundHandleTouchStart);
            this.element.removeEventListener('touchend', this.boundHandleTouchEnd);
            this.element = null;
            this.boundHandleTouchStart = null;
            this.boundHandleTouchEnd = null;
        }
    }

    /**
     * Handle touch start event
     */
    handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    /**
     * Handle touch end event
     */
    handleTouchEnd(e) {
        if (e.changedTouches.length !== 1) return;
        
        this.touchEndX = e.changedTouches[0].clientX;
        this.touchEndY = e.changedTouches[0].clientY;
        
        this.detectSwipe();
    }

    /**
     * Detect swipe direction and notify handlers
     */
    detectSwipe() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Check if swipe meets minimum distance
        if (absDeltaX < this.minSwipeDistance && absDeltaY < this.minSwipeDistance) {
            return;
        }

        // Determine primary direction
        let direction;
        if (absDeltaX > absDeltaY) {
            // Horizontal swipe
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            // Vertical swipe
            direction = deltaY > 0 ? 'down' : 'up';
        }

        // Notify all handlers
        this.handlers.forEach(handler => {
            handler({
                direction,
                deltaX,
                deltaY,
                startX: this.touchStartX,
                startY: this.touchStartY,
                endX: this.touchEndX,
                endY: this.touchEndY
            });
        });
    }
}
