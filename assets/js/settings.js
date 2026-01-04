/**
 * Settings Manager
 * Handles settings UI and configuration
 */
class SettingsManager {
    constructor(inputModeManager) {
        this.inputModeManager = inputModeManager;
        this.isOpen = false;
        this.settingsPanel = null;
        this.feedbackElement = null;
    }

    /**
     * Create and inject settings UI into the page
     */
    createUI() {
        // Create settings button
        const settingsButton = document.createElement('button');
        settingsButton.id = 'settingsButton';
        settingsButton.className = 'button settings-button';
        settingsButton.textContent = '⚙️ Settings';
        settingsButton.addEventListener('click', () => this.toggle());

        // Create settings panel
        this.settingsPanel = document.createElement('div');
        this.settingsPanel.id = 'settingsPanel';
        this.settingsPanel.className = 'settings-panel';
        this.settingsPanel.style.display = 'none';
        
        const modes = this.inputModeManager.getAvailableModes();
        const currentModeName = this.inputModeManager.getCurrentMode()?.name || 'clockface';
        
        this.settingsPanel.innerHTML = `
            <h2>Settings</h2>
            
            <div class="setting-group">
                <label for="inputModeSelect">Input Mode:</label>
                <select id="inputModeSelect" class="setting-select">
                    ${modes.map(mode => `
                        <option value="${mode.name}" ${mode.name === currentModeName ? 'selected' : ''}>
                            ${mode.displayName}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="setting-group">
                <label for="autoSubmitDelay">Auto-submit Delay:</label>
                <input type="number" id="autoSubmitDelay" class="setting-input" 
                       min="0" max="5000" step="100" value="500" />
                <span class="setting-unit">ms</span>
            </div>
            
            <div class="setting-group">
                <label for="clipboardCopy">
                    <input type="checkbox" id="clipboardCopy" />
                    Copy result to clipboard
                </label>
            </div>
            
            <div class="setting-group">
                <label for="showFeedback">
                    <input type="checkbox" id="showFeedback" checked />
                    Show gesture feedback
                </label>
            </div>
            
            <button id="closeSettings" class="button">Close</button>
        `;

        // Create gesture feedback element
        this.feedbackElement = document.createElement('div');
        this.feedbackElement.id = 'gestureFeedback';
        this.feedbackElement.className = 'gesture-feedback';
        this.feedbackElement.style.display = 'none';

        // Add to page
        const buttonContainer = document.querySelector('.button-container');
        if (buttonContainer) {
            buttonContainer.appendChild(settingsButton);
        }
        document.body.appendChild(this.settingsPanel);
        document.body.appendChild(this.feedbackElement);

        // Setup event listeners
        this.setupEventListeners();
        
        // Load saved settings
        this.loadSettings();
    }

    /**
     * Setup event listeners for settings controls
     */
    setupEventListeners() {
        // Input mode selector
        const modeSelect = document.getElementById('inputModeSelect');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.inputModeManager.setMode(e.target.value);
                this.updateFeedback();
            });
        }

        // Close button
        const closeButton = document.getElementById('closeSettings');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }

        // Auto-submit delay
        const autoSubmitDelay = document.getElementById('autoSubmitDelay');
        if (autoSubmitDelay) {
            autoSubmitDelay.addEventListener('change', (e) => {
                localStorage.setItem('autoSubmitDelay', e.target.value);
            });
        }

        // Clipboard copy
        const clipboardCopy = document.getElementById('clipboardCopy');
        if (clipboardCopy) {
            clipboardCopy.addEventListener('change', (e) => {
                localStorage.setItem('clipboardCopy', e.target.checked);
            });
        }

        // Show feedback
        const showFeedback = document.getElementById('showFeedback');
        if (showFeedback) {
            showFeedback.addEventListener('change', (e) => {
                localStorage.setItem('showFeedback', e.target.checked);
                if (!e.target.checked) {
                    this.feedbackElement.style.display = 'none';
                }
            });
        }
    }

    /**
     * Load saved settings from localStorage
     */
    loadSettings() {
        // Auto-submit delay
        const savedDelay = localStorage.getItem('autoSubmitDelay');
        const delayInput = document.getElementById('autoSubmitDelay');
        if (savedDelay && delayInput) {
            delayInput.value = savedDelay;
        }

        // Clipboard copy
        const savedClipboard = localStorage.getItem('clipboardCopy');
        const clipboardCheckbox = document.getElementById('clipboardCopy');
        if (savedClipboard && clipboardCheckbox) {
            clipboardCheckbox.checked = savedClipboard === 'true';
        }

        // Show feedback
        const savedFeedback = localStorage.getItem('showFeedback');
        const feedbackCheckbox = document.getElementById('showFeedback');
        if (savedFeedback !== null && feedbackCheckbox) {
            feedbackCheckbox.checked = savedFeedback === 'true';
        }
    }

    /**
     * Toggle settings panel
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open settings panel
     */
    open() {
        this.settingsPanel.style.display = 'block';
        this.isOpen = true;
    }

    /**
     * Close settings panel
     */
    close() {
        this.settingsPanel.style.display = 'none';
        this.isOpen = false;
    }

    /**
     * Update gesture feedback display
     */
    updateFeedback() {
        const showFeedback = document.getElementById('showFeedback');
        if (!showFeedback || !showFeedback.checked) {
            return;
        }

        const state = this.inputModeManager.getState();
        if (state) {
            this.feedbackElement.textContent = state.message;
            this.feedbackElement.style.display = 'block';
            
            // Auto-hide after 3 seconds if on first stage or ready
            if (state.stage === 'first' || state.stage === 'ready') {
                setTimeout(() => {
                    this.feedbackElement.style.display = 'none';
                }, 3000);
            }
        }
    }

    /**
     * Show a temporary message
     */
    showMessage(message, duration = 2000) {
        this.feedbackElement.textContent = message;
        this.feedbackElement.style.display = 'block';
        
        setTimeout(() => {
            this.feedbackElement.style.display = 'none';
        }, duration);
    }

    /**
     * Get setting value
     */
    getSetting(name) {
        switch (name) {
            case 'autoSubmitDelay':
                return parseInt(localStorage.getItem('autoSubmitDelay') || '500');
            case 'clipboardCopy':
                return localStorage.getItem('clipboardCopy') === 'true';
            case 'showFeedback':
                const saved = localStorage.getItem('showFeedback');
                return saved === null ? true : saved === 'true';
            default:
                return null;
        }
    }
}
