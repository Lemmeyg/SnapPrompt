// SnapPrompt - Premium Chrome Extension
// Version 1.3.0 with enhanced UX and drag-to-reorder functionality

class StorageMigrationManager {
    constructor() {
        this.currentVersion = '1.3.0';
        this.storageKey = 'Snapprompts';
        this.versionKey = 'SnappromptsVersion';
    }

    async migrateIfNeeded() {
        try {
            const versionResult = await chrome.storage.sync.get([this.versionKey]);
            const storedVersion = versionResult[this.versionKey] || '1.0.0';

            console.log(`Current version: ${this.currentVersion}, Stored version: ${storedVersion}`);

            // Don't run migration on fresh install
            if (!versionResult[this.versionKey]) {
                console.log('Fresh install detected, skipping migration');
                await chrome.storage.sync.set({ [this.versionKey]: this.currentVersion });
                return;
            }

            if (storedVersion !== this.currentVersion) {
                console.log('Migration needed, starting migration process...');
                await this.performMigration(storedVersion, this.currentVersion);
                await chrome.storage.sync.set({ [this.versionKey]: this.currentVersion });
                console.log('Migration completed successfully');
            } else {
                console.log('No migration needed');
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    async performMigration(fromVersion, toVersion) {
        if (this.isVersionOlder(fromVersion, '1.1.0')) {
            await this.migrateTo110(fromVersion);
        }
    }

    async migrateTo110(fromVersion) {
        console.log(`Migrating from ${fromVersion} to 1.1.0`);

        try {
            let snippets = await this.getDataFromMultipleSources();

            if (snippets && snippets.length > 0) {
                snippets = this.validateAndCleanSnippets(snippets);
                await chrome.storage.sync.set({ [this.storageKey]: snippets });
                console.log(`Successfully migrated ${snippets.length} snippets`);
            }
        } catch (error) {
            console.error('Migration to 1.1.0 failed:', error);
        }
    }

    async getDataFromMultipleSources() {
        let allSnippets = [];

        // Try sync storage first
        try {
            const syncResult = await chrome.storage.sync.get([this.storageKey]);
            if (syncResult[this.storageKey]?.length > 0) {
                console.log(`Found ${syncResult[this.storageKey].length} snippets in sync storage`);
                allSnippets = [...allSnippets, ...syncResult[this.storageKey]];
            }
        } catch (error) {
            console.log('Sync storage failed, trying local storage...');
        }

        // Try local storage as fallback
        try {
            const localResult = await chrome.storage.local.get([this.storageKey]);
            if (localResult[this.storageKey]?.length > 0) {
                console.log(`Found ${localResult[this.storageKey].length} snippets in local storage`);
                allSnippets = [...allSnippets, ...localResult[this.storageKey]];
            }
        } catch (error) {
            console.log('Local storage also failed');
        }

        // Try alternative keys
        const alternativeKeys = ['snapprompts', 'snippets', 'prompts', 'textSnippets'];
        for (const key of alternativeKeys) {
            try {
                const result = await chrome.storage.sync.get([key]);
                if (result[key]?.length > 0) {
                    console.log(`Found ${result[key].length} snippets in alternative key: ${key}`);
                    allSnippets = [...allSnippets, ...result[key]];
                }
            } catch (error) {
                // Continue to next key
            }
        }

        return allSnippets.length > 0 ? allSnippets : null;
    }

    validateAndCleanSnippets(snippets) {
        if (!Array.isArray(snippets)) {
            snippets = [snippets];
        }

        const cleanedSnippets = snippets
            .filter(snippet => snippet && typeof snippet === 'object')
            .map(snippet => ({
                id: snippet.id || this.generateId(),
                label: snippet.label || 'Untitled Snippet',
                text: snippet.text || '',
                createdAt: snippet.createdAt || new Date().toISOString(),
                updatedAt: snippet.updatedAt || new Date().toISOString()
            }))
            .filter(snippet => snippet.text.trim().length > 0);

        // Remove duplicates
        const uniqueSnippets = [];
        const seenContent = new Set();

        for (const snippet of cleanedSnippets) {
            const contentHash = `${snippet.label.toLowerCase().trim()}:${snippet.text.toLowerCase().trim()}`;

            if (!seenContent.has(contentHash)) {
                seenContent.add(contentHash);
                uniqueSnippets.push(snippet);
            }
        }

        return uniqueSnippets;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    isVersionOlder(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);

        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1 = v1Parts[i] || 0;
            const v2 = v2Parts[i] || 0;
            if (v1 < v2) return true;
            if (v1 > v2) return false;
        }
        return false;
    }
}

class SnapPromptManager {
    constructor() {
        this.Snapprompts = [];
        this.maxSnippets = 10;
        this.maxTextLength = 5000;
        this.maxLabelLength = 100;

        // Easter egg milestones (minutes saved) - customize these messages!
        this.easterEggs = [
            { minutes: 5, message: '🌟 Nice start!' },
            { minutes: 30, message: '🚀 You\'re on a roll!' },
            { minutes: 60, message: '⭐ That\'s an hour saved!' },
            { minutes: 120, message: '🏆 Productivity champion!' },
            { minutes: 300, message: '💎 5 hours saved - incredible!' },
            { minutes: 600, message: '👑 10 hours saved - you\'re a legend!' },
            { minutes: 1440, message: '🎉 A full day saved - amazing!' }
        ];
        this.editingSnappromptId = null;
        this.migrationManager = new StorageMigrationManager();
        this.analytics = null;
        this.draggedElement = null;
        this.tooltipTimeout = null;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Initialize
        this.initializeElements();
        this.bindEvents();
        this.initializeAnalytics();
        this.initializeWithMigration();
    }

    initializeElements() {
        // Form elements
        this.form = document.getElementById('SnappromptForm');
        this.labelInput = document.getElementById('SnappromptLabel');
        this.textInput = document.getElementById('SnappromptText');
        this.addBtn = document.getElementById('addBtn');

        // Container elements
        this.SnappromptContainer = document.getElementById('SnappromptContainer');
        this.emptyState = document.getElementById('emptyState');
        this.SnappromptCount = document.getElementById('SnappromptCount');

        // UI elements
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        this.labelError = document.getElementById('labelError');
        this.textError = document.getElementById('textError');

        // Settings dropdown
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsDropdown = document.getElementById('settingsDropdown');
        this.feedbackBtn = document.getElementById('feedbackBtn');
        this.recoveryBtn = document.getElementById('recoveryBtn');
        this.readmeBtn = document.getElementById('readmeBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importFileInput = document.getElementById('importFileInput');

        // Form toggle
        this.createToggle = document.getElementById('createToggle');
        this.formSection = document.getElementById('formSection');

        // What's New banner
        this.whatsNewBanner = document.getElementById('whatsNewBanner');
        this.whatsNewVersion = document.getElementById('whatsNewVersion');
        this.whatsNewContent = document.getElementById('whatsNewContent');
        this.whatsNewClose = document.getElementById('whatsNewClose');

        // Tooltip overlay
        this.tooltipOverlay = document.getElementById('tooltipOverlay');
        this.tooltipTitle = document.getElementById('tooltipTitle');
        this.tooltipText = document.getElementById('tooltipText');
        this.tooltipClose = document.getElementById('tooltipClose');

        // Keystroke tracking
        this.keystrokeCount = document.getElementById('keystrokeCount');
        this.timeSaved = document.getElementById('timeSaved');

        // Logo icon for spin animation
        this.logoIcon = document.querySelector('.logo-icon');
    }

    bindEvents() {
        // Form events
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.labelInput.addEventListener('input', () => this.clearValidationError('label'));
        this.textInput.addEventListener('input', () => this.clearValidationError('text'));

        // Settings dropdown events
        this.settingsBtn.addEventListener('click', (e) => this.toggleSettings(e));
        this.feedbackBtn.addEventListener('click', () => this.handleFeedback());
        this.recoveryBtn.addEventListener('click', () => this.handleRecovery());
        this.readmeBtn.addEventListener('click', () => this.handleReadme());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.exportBtn.addEventListener('click', () => this.exportPrompts());
        this.importBtn.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput.addEventListener('change', (e) => this.importPrompts(e));

        // Form toggle
        this.createToggle.addEventListener('click', () => this.toggleForm());

        // What's New banner
        this.whatsNewClose.addEventListener('click', () => this.dismissWhatsNew());

        // Tooltip overlay
        this.tooltipClose.addEventListener('click', () => this.hideTooltip());
        this.tooltipOverlay.addEventListener('click', (e) => {
            if (e.target === this.tooltipOverlay) {
                this.hideTooltip();
            }
        });

        // Close settings dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.settingsBtn.contains(e.target) && !this.settingsDropdown.contains(e.target)) {
                this.settingsDropdown.classList.remove('show');
            }
        });
    }

    async initializeAnalytics() {
        try {
            if (typeof AnalyticsManager !== 'undefined') {
                this.analytics = new AnalyticsManager();
                await this.analytics.initialize();
                await this.analytics.trackPopupOpened();

                window.addEventListener('beforeunload', async () => {
                    await this.analytics.trackPopupClosed();
                });
            } else {
                // Dummy analytics
                this.analytics = {
                    trackPopupOpened: async () => {},
                    trackPopupClosed: async () => {},
                    trackSnippetCreated: async () => {},
                    trackSnippetEdited: async () => {},
                    trackSnippetDeleted: async () => {},
                    trackSnippetCopied: async () => {},
                    trackRecoveryAttempted: async () => {},
                    trackRecoverySuccessful: async () => {},
                    trackEvent: async () => {}
                };
            }
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
        }
    }

    async initializeWithMigration() {
        try {
            await this.migrationManager.migrateIfNeeded();
            await this.loadSnippets();
            await this.loadKeystrokeStats();
            await this.checkForCapturedText();
            await this.checkWhatsNew();
            await this.loadTheme();
            this.startLogoAnimation();
        } catch (error) {
            console.error('Initialization error:', error);
            await this.loadSnippets();
            await this.loadKeystrokeStats();
            await this.checkForCapturedText();
            await this.checkWhatsNew();
            this.startLogoAnimation();
        }
    }

    startLogoAnimation() {
        // Spin once immediately on load
        this.spinLogo();

        // Then spin every 8 seconds
        setInterval(() => {
            this.spinLogo();
        }, 8000);
    }

    spinLogo() {
        if (!this.logoIcon) return;

        // Add spin class
        this.logoIcon.classList.add('spin');

        // Remove spin class after animation completes (800ms)
        setTimeout(() => {
            this.logoIcon.classList.remove('spin');
        }, 800);
    }

    async checkForCapturedText() {
        try {
            const result = await chrome.storage.local.get(['capturedText', 'captureError', 'captureTimestamp']);
            const now = Date.now();
            const captureAge = result.captureTimestamp ? now - result.captureTimestamp : Infinity;

            if (captureAge > 5000) return;

            if (result.captureError) {
                this.showToast(result.captureError, 'error');
                await chrome.storage.local.remove(['captureError', 'captureTimestamp']);
                return;
            }

            if (result.capturedText) {
                this.textInput.value = result.capturedText;
                this.labelInput.focus();
                this.showToast('Text captured! Please provide a label.', 'info');
                this.openForm();
                await chrome.storage.local.remove(['capturedText', 'captureTimestamp']);
            }
        } catch (error) {
            console.error('Error checking for captured text:', error);
        }
    }

    async loadSnippets() {
        try {
            const result = await chrome.storage.sync.get([this.migrationManager.storageKey]);
            this.Snapprompts = result[this.migrationManager.storageKey] || [];
            console.log(`Loaded ${this.Snapprompts.length} snippets`);
            this.renderSnippets();
        } catch (error) {
            console.error('Error loading snippets:', error);
            this.Snapprompts = [];
            this.renderSnippets();
        }
    }

    async saveSnippets() {
        try {
            await Promise.allSettled([
                chrome.storage.sync.set({ [this.migrationManager.storageKey]: this.Snapprompts }),
                chrome.storage.local.set({ [this.migrationManager.storageKey]: this.Snapprompts })
            ]);
            console.log('Snippets saved successfully');
        } catch (error) {
            console.error('Error saving snippets:', error);
            throw error;
        }
    }

    async loadKeystrokeStats() {
        try {
            const result = await chrome.storage.sync.get(['keystrokesUsed', 'lastEasterEggMinutes']);
            const keystrokes = result.keystrokesUsed || 0;
            const minutes = Math.round(keystrokes / 200);
            const lastEasterEggMinutes = result.lastEasterEggMinutes || 0;

            // Update display
            this.keystrokeCount.textContent = keystrokes.toLocaleString();
            this.timeSaved.textContent = minutes >= 60
                ? `${Math.floor(minutes / 60)}h ${minutes % 60}min`
                : `${minutes} min`;

            // Check for easter egg milestones
            const milestone = this.easterEggs.find(egg =>
                minutes >= egg.minutes && egg.minutes > lastEasterEggMinutes
            );

            if (milestone) {
                // Show easter egg message
                this.showToast(milestone.message, 'success');
                // Save that we've shown this milestone
                await chrome.storage.sync.set({ lastEasterEggMinutes: milestone.minutes });
            }
        } catch (error) {
            console.error('Error loading keystroke stats:', error);
        }
    }

    async trackKeystrokeSavings(snippetText) {
        try {
            const keystrokesInSnippet = snippetText.length;

            // Get current keystroke count from storage
            const result = await chrome.storage.sync.get(['keystrokesUsed', 'lastEasterEggMinutes']);
            const currentKeystrokes = result.keystrokesUsed || 0;
            const lastEasterEggMinutes = result.lastEasterEggMinutes || 0;

            // Add the new keystrokes to the total
            const newTotal = currentKeystrokes + keystrokesInSnippet;
            await chrome.storage.sync.set({ keystrokesUsed: newTotal });

            // Update display
            const minutes = Math.round(newTotal / 200);
            this.keystrokeCount.textContent = newTotal.toLocaleString();
            this.timeSaved.textContent = minutes >= 60
                ? `${Math.floor(minutes / 60)}h ${minutes % 60}min`
                : `${minutes} min`;

            // Check for new easter egg milestone
            const milestone = this.easterEggs.find(egg =>
                minutes >= egg.minutes && egg.minutes > lastEasterEggMinutes
            );

            if (milestone) {
                this.showToast(milestone.message, 'success');
                await chrome.storage.sync.set({ lastEasterEggMinutes: milestone.minutes });
            }
        } catch (error) {
            console.error('Error tracking keystroke savings:', error);
        }
    }

    renderSnippets() {
        this.updateSnippetCount();

        if (this.Snapprompts.length === 0) {
            this.emptyState.style.display = 'flex';
            return;
        }

        this.emptyState.style.display = 'none';

        // Render snippets in their current order (user can reorder via drag-and-drop)
        this.SnappromptContainer.innerHTML = this.Snapprompts.map((snippet, index) =>
            this.createSnippetHTML(snippet, this.Snapprompts)
        ).join('');

        this.bindSnippetEvents();
    }

    createSnippetHTML(Snapprompt, sortedSnippets) {
        const truncatedText = Snapprompt.text.length > 100
            ? Snapprompt.text.substring(0, 100) + '...'
            : Snapprompt.text;

        const snippetIndex = sortedSnippets.findIndex(s => s.id === Snapprompt.id);

        // Only show keyboard shortcuts for first 4 snippets (Chrome limitation)
        let keyboardShortcut = '';
        if (snippetIndex >= 0 && snippetIndex < 4) {
            keyboardShortcut = `Alt+${snippetIndex + 1}`;
        }

        return `
            <div class="prompt-item"
                 data-snapprompt-id="${Snapprompt.id}"
                 draggable="true">
                <div class="prompt-header">
                    <div class="prompt-title-group">
                        <span class="prompt-title">${this.escapeHtml(Snapprompt.label)}</span>
                        ${keyboardShortcut ? `<span class="prompt-shortcut">${keyboardShortcut}</span>` : ''}
                    </div>
                    <div class="prompt-actions">
                        <button class="prompt-action copy" data-snapprompt-id="${Snapprompt.id}" title="Copy">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                        </button>
                        <button class="prompt-action edit" data-snapprompt-id="${Snapprompt.id}" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                            </svg>
                        </button>
                        <button class="prompt-action delete" data-snapprompt-id="${Snapprompt.id}" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                <line x1="10" x2="10" y1="11" y2="17"/>
                                <line x1="14" x2="14" y1="11" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="prompt-preview">${this.escapeHtml(truncatedText)}</div>
            </div>
        `;
    }

    bindSnippetEvents() {
        // Copy buttons
        this.SnappromptContainer.querySelectorAll('.prompt-action.copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.snappromptId;
                this.handleCopy(id);
            });
        });

        // Edit buttons
        this.SnappromptContainer.querySelectorAll('.prompt-action.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.snappromptId;
                this.handleEdit(id);
            });
        });

        // Delete buttons
        this.SnappromptContainer.querySelectorAll('.prompt-action.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.snappromptId;
                this.deleteSnippet(id);
            });
        });

        // Show tooltip on hover (1.5 second delay)
        this.SnappromptContainer.querySelectorAll('.prompt-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                const id = e.currentTarget.dataset.snappromptId;
                this.scheduleTooltip(id);
            });

            item.addEventListener('mousemove', (e) => {
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            });

            item.addEventListener('mouseleave', () => {
                this.cancelTooltip();
            });

            // Drag and drop events
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
        });
    }

    scheduleTooltip(snappromptId) {
        // Don't show tooltip if currently dragging
        if (this.isDragging) return;

        this.cancelTooltip();
        this.tooltipTimeout = setTimeout(() => {
            this.showTooltipForSnippet(snappromptId);
        }, 1500);
    }

    cancelTooltip() {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
    }

    showTooltipForSnippet(snappromptId) {
        const snippet = this.Snapprompts.find(s => s.id === snappromptId);
        if (!snippet) return;

        this.tooltipTitle.textContent = snippet.label;
        this.tooltipText.textContent = snippet.text;

        // Show tooltip (centered within popup via CSS flexbox)
        this.tooltipOverlay.classList.add('show');
    }

    hideTooltip() {
        this.tooltipOverlay.classList.remove('show');
        this.cancelTooltip();
    }

    // Drag and Drop handlers
    handleDragStart(e) {
        this.isDragging = true;
        this.cancelTooltip(); // Cancel any pending tooltips
        this.hideTooltip(); // Hide any visible tooltips
        this.draggedElement = e.currentTarget;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    }

    handleDragEnd(e) {
        this.isDragging = false;
        e.currentTarget.classList.remove('dragging');

        // Remove all drag-over indicators
        this.SnappromptContainer.querySelectorAll('.prompt-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    async handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (this.draggedElement !== e.currentTarget) {
            const draggedId = this.draggedElement.dataset.snappromptId;
            const droppedOnId = e.currentTarget.dataset.snappromptId;

            const draggedIndex = this.Snapprompts.findIndex(s => s.id === draggedId);
            const droppedOnIndex = this.Snapprompts.findIndex(s => s.id === droppedOnId);

            if (draggedIndex !== -1 && droppedOnIndex !== -1) {
                // Reorder array
                const [draggedItem] = this.Snapprompts.splice(draggedIndex, 1);
                this.Snapprompts.splice(droppedOnIndex, 0, draggedItem);

                await this.saveSnippets();
                this.renderSnippets();
                this.showToast('Prompts reordered', 'success');
            }
        }

        return false;
    }

    async handleCopy(snappromptId) {
        const snippet = this.Snapprompts.find(s => s.id === snappromptId);
        if (!snippet) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(snippet.text);
            } else {
                this.fallbackCopyToClipboard(snippet.text);
            }

            // Add copy flash animation
            const promptItem = this.SnappromptContainer.querySelector(`[data-snapprompt-id="${snappromptId}"]`);
            if (promptItem) {
                promptItem.classList.add('copied');
                setTimeout(() => promptItem.classList.remove('copied'), 600);
            }

            // Track keystroke savings
            await this.trackKeystrokeSavings(snippet.text);

            this.showToast('Copied to clipboard!', 'success');

            if (this.analytics) {
                await this.analytics.trackSnippetCopied(true);
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showToast('Failed to copy', 'error');

            if (this.analytics) {
                await this.analytics.trackSnippetCopied(false);
            }
        }
    }

    fallbackCopyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    handleEdit(snappromptId) {
        const snippet = this.Snapprompts.find(s => s.id === snappromptId);
        if (snippet) {
            this.editingSnappromptId = snappromptId;
            this.labelInput.value = snippet.label;
            this.textInput.value = snippet.text;
            this.addBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="M12 5v14"/>
                </svg>
                Update Prompt
            `;
            this.openForm();
        }
    }

    async deleteSnippet(snappromptId) {
        const index = this.Snapprompts.findIndex(s => s.id === snappromptId);
        if (index > -1) {
            this.Snapprompts.splice(index, 1);
            await this.saveSnippets();
            this.renderSnippets();
            this.showToast('Prompt deleted', 'success');

            if (this.analytics) {
                await this.analytics.trackSnippetDeleted(this.Snapprompts.length);
            }
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) return;

        const label = this.labelInput.value.trim();
        const text = this.textInput.value.trim();
        const isEditing = !!this.editingSnappromptId;

        if (isEditing) {
            const index = this.Snapprompts.findIndex(s => s.id === this.editingSnappromptId);
            if (index > -1) {
                this.Snapprompts[index].label = label;
                this.Snapprompts[index].text = text;
                this.Snapprompts[index].updatedAt = new Date().toISOString();
                this.showToast('Prompt updated!', 'success');
            }
        } else {
            if (this.Snapprompts.length >= this.maxSnippets) {
                this.showToast('Maximum of 10 prompts reached', 'error');
                return;
            }

            const newSnippet = {
                id: Date.now().toString(),
                label: label,
                text: text,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.Snapprompts.push(newSnippet);
            this.showToast('Prompt created!', 'success');
        }

        try {
            await this.saveSnippets();
            this.renderSnippets();
            this.clearForm();
            this.closeForm();

            if (this.analytics) {
                if (isEditing) {
                    await this.analytics.trackSnippetEdited(this.Snapprompts.length);
                } else {
                    await this.analytics.trackSnippetCreated(this.Snapprompts.length);
                }
            }
        } catch (error) {
            console.error('Failed to save prompt:', error);
            this.showToast('Failed to save prompt', 'error');
            if (!isEditing) {
                this.Snapprompts.pop();
            }
        }
    }

    validateForm() {
        let isValid = true;

        this.clearValidationError('label');
        this.clearValidationError('text');

        const label = this.labelInput.value.trim();
        if (!label) {
            this.showValidationError('label', 'Label is required');
            isValid = false;
        } else if (label.length > this.maxLabelLength) {
            this.showValidationError('label', `Label must be ${this.maxLabelLength} characters or less`);
            isValid = false;
        } else if (this.Snapprompts.some(s => s.label.toLowerCase() === label.toLowerCase() && s.id !== this.editingSnappromptId)) {
            this.showValidationError('label', 'A prompt with this label already exists');
            isValid = false;
        }

        const text = this.textInput.value.trim();
        if (!text) {
            this.showValidationError('text', 'Prompt text is required');
            isValid = false;
        } else if (text.length > this.maxTextLength) {
            this.showValidationError('text', `Text must be ${this.maxTextLength} characters or less`);
            isValid = false;
        }

        return isValid;
    }

    showValidationError(field, message) {
        if (field === 'label') {
            this.labelError.textContent = message;
        } else if (field === 'text') {
            this.textError.textContent = message;
        }
    }

    clearValidationError(field) {
        if (field === 'label') {
            this.labelError.textContent = '';
        } else if (field === 'text') {
            this.textError.textContent = '';
        }
    }

    clearForm() {
        this.labelInput.value = '';
        this.textInput.value = '';
        this.editingSnappromptId = null;
        this.addBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
            </svg>
            Save Prompt
        `;
        this.clearValidationError('label');
        this.clearValidationError('text');
    }

    toggleForm() {
        const isOpen = this.formSection.classList.contains('open');

        if (isOpen) {
            this.closeForm();
        } else {
            this.openForm();
        }
    }

    openForm() {
        this.formSection.classList.add('open');
        this.createToggle.classList.add('active');
        setTimeout(() => this.labelInput.focus(), 300);
    }

    closeForm() {
        this.formSection.classList.remove('open');
        this.createToggle.classList.remove('active');
        this.clearForm();
    }

    updateSnippetCount() {
        this.SnappromptCount.textContent = `${this.Snapprompts.length}/10`;
    }

    showToast(message, type = 'success') {
        this.toastMessage.textContent = message;

        // Remove any existing type classes
        this.toast.classList.remove('toast-success', 'toast-error', 'toast-info');

        // Add the appropriate type class
        this.toast.classList.add(`toast-${type}`);
        this.toast.classList.add('show');

        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    // Settings menu handlers
    toggleSettings(e) {
        e.stopPropagation();
        this.settingsDropdown.classList.toggle('show');
    }

    async handleFeedback() {
        try {
            await chrome.tabs.create({
                url: 'https://forms.gle/KjJwTgJt1zKTt2Xv9',
                active: true
            });
            this.settingsDropdown.classList.remove('show');
        } catch (error) {
            console.error('Error opening feedback form:', error);
            this.showToast('Error opening feedback form', 'error');
        }
    }

    async handleRecovery() {
        try {
            this.settingsDropdown.classList.remove('show');

            if (this.analytics) {
                await this.analytics.trackRecoveryAttempted();
            }

            const recoveredSnippets = await this.migrationManager.getDataFromMultipleSources();

            if (recoveredSnippets && recoveredSnippets.length > 0) {
                const cleanedSnippets = this.migrationManager.validateAndCleanSnippets(recoveredSnippets);

                const existingContent = new Set();
                this.Snapprompts.forEach(s => {
                    const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                    existingContent.add(contentHash);
                });

                const newSnippets = cleanedSnippets.filter(s => {
                    const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                    return !existingContent.has(contentHash);
                });

                if (newSnippets.length > 0) {
                    this.Snapprompts = [...this.Snapprompts, ...newSnippets];
                    await this.saveSnippets();
                    this.renderSnippets();
                    this.showToast(`Recovered ${newSnippets.length} prompts!`, 'success');

                    if (this.analytics) {
                        await this.analytics.trackRecoverySuccessful(newSnippets.length);
                    }
                } else {
                    this.showToast('No new prompts found to recover', 'info');
                }
            } else {
                this.showToast('No prompts found to recover', 'info');
            }
        } catch (error) {
            console.error('Recovery error:', error);
            this.showToast('Recovery failed', 'error');
        }
    }

    async handleReadme() {
        try {
            const readmePath = chrome.runtime.getURL('USER_GUIDE.md');
            await chrome.tabs.create({
                url: readmePath,
                active: true
            });
            this.settingsDropdown.classList.remove('show');
        } catch (error) {
            console.error('Error opening README:', error);
            this.showToast('README file not found', 'error');
        }
    }

    async toggleTheme() {
        const isActive = this.themeToggle.classList.contains('active');

        if (isActive) {
            this.themeToggle.classList.remove('active');
            document.body.classList.remove('light-theme');
            await chrome.storage.sync.set({ theme: 'dark' });
        } else {
            this.themeToggle.classList.add('active');
            document.body.classList.add('light-theme');
            await chrome.storage.sync.set({ theme: 'light' });
        }

        this.showToast(`Switched to ${isActive ? 'dark' : 'light'} mode`, 'success');
    }

    async loadTheme() {
        try {
            const result = await chrome.storage.sync.get(['theme']);
            if (result.theme === 'light') {
                this.themeToggle.classList.add('active');
                document.body.classList.add('light-theme');
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    }

    exportPrompts() {
        try {
            const dataStr = JSON.stringify(this.Snapprompts, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `snapprompt-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);

            this.settingsDropdown.classList.remove('show');
            this.showToast('Prompts exported!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Export failed', 'error');
        }
    }

    async importPrompts(e) {
        try {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedSnippets = JSON.parse(event.target.result);

                    if (!Array.isArray(importedSnippets)) {
                        throw new Error('Invalid file format');
                    }

                    const validSnippets = this.migrationManager.validateAndCleanSnippets(importedSnippets);

                    // Merge with existing, avoiding duplicates
                    const existingContent = new Set();
                    this.Snapprompts.forEach(s => {
                        const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                        existingContent.add(contentHash);
                    });

                    const newSnippets = validSnippets.filter(s => {
                        const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                        return !existingContent.has(contentHash);
                    });

                    if (newSnippets.length > 0) {
                        this.Snapprompts = [...this.Snapprompts, ...newSnippets].slice(0, this.maxSnippets);
                        await this.saveSnippets();
                        this.renderSnippets();
                        this.showToast(`Imported ${newSnippets.length} prompts!`, 'success');
                    } else {
                        this.showToast('No new prompts to import', 'info');
                    }
                } catch (error) {
                    console.error('Import parsing error:', error);
                    this.showToast('Invalid file format', 'error');
                }
            };

            reader.readAsText(file);
            this.settingsDropdown.classList.remove('show');
            e.target.value = '';
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Import failed', 'error');
        }
    }

    // What's New functionality
    async checkWhatsNew() {
        try {
            const currentVersion = chrome.runtime.getManifest().version;
            const response = await chrome.runtime.sendMessage({ action: 'getWhatsNew' });

            console.log('What\'s New check:', {
                currentVersion,
                lastSeenVersion: response.lastSeenVersion,
                whatsNewDismissed: response.whatsNewDismissed,
                isNewer: this.isNewerVersion(currentVersion, response.lastSeenVersion)
            });

            // Only show What's New on updates, not first install (0.0.0 indicates first install)
            if (!response.whatsNewDismissed &&
                response.lastSeenVersion !== '0.0.0' &&
                this.isNewerVersion(currentVersion, response.lastSeenVersion)) {
                this.showWhatsNew(currentVersion);
            }
        } catch (error) {
            console.error('Error checking What\'s New:', error);
        }
    }

    isNewerVersion(current, previous) {
        const currentParts = current.split('.').map(Number);
        const previousParts = previous.split('.').map(Number);

        for (let i = 0; i < Math.max(currentParts.length, previousParts.length); i++) {
            const c = currentParts[i] || 0;
            const p = previousParts[i] || 0;
            if (c > p) return true;
            if (c < p) return false;
        }
        return false;
    }

    showWhatsNew(currentVersion) {
        const updates = this.getUpdateContent(currentVersion);
        if (!updates || updates.length === 0) return;

        this.whatsNewVersion.textContent = `v${currentVersion}`;
        this.whatsNewContent.innerHTML = this.formatUpdateContent(updates);
        this.whatsNewBanner.classList.remove('hidden');
    }

    getUpdateContent(currentVersion) {
        const updatesByVersion = {
            '1.2.0': [
                '<strong>Update Notifications:</strong> From now on, you\'ll be notified about new features and improvements right here in the extension.'
            ],
            '1.3.0': [
                '<strong>📋 Copy Button:</strong> Quickly copy from SnapPrompt to your clipboard with one click',
                '<strong>⌨️ Keyboard Shortcuts:</strong> First 4 snippets get keyboard shortcuts Alt+1 through Alt+4 (alphabetically ordered)',
                '<strong>✂️ Text Capture:</strong> Right-click any selected text and save it directly as a new snippet',
                '<strong>🎁 Starter Snippets:</strong> New users get 3 helpful AI prompts to get started',
                '<strong>📊 Usage Analytics:</strong> Anonymous analytics help us improve (respects Do Not Track)'
            ]
        };

        return updatesByVersion[currentVersion] || null;
    }

    formatUpdateContent(updates) {
        if (!updates || updates.length === 0) {
            return '<p>Thanks for updating!</p>';
        }

        if (updates.length === 1) {
            return `<p>${updates[0]}</p>`;
        }

        return `<ul>${updates.map(update => `<li>${update}</li>`).join('')}</ul>`;
    }

    async dismissWhatsNew() {
        try {
            await chrome.runtime.sendMessage({ action: 'dismissWhatsNew' });
            this.whatsNewBanner.classList.add('hidden');
        } catch (error) {
            console.error('Error dismissing What\'s New:', error);
            this.whatsNewBanner.classList.add('hidden');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SnapPromptManager();
});
