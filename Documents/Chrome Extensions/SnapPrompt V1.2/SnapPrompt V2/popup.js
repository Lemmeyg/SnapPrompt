// Popup script for SnapPrompt Chrome Extension

class StorageMigrationManager {
    constructor() {
        this.currentVersion = '1.3.0'; // Should match manifest.json version
        this.storageKey = 'Snapprompts';
        this.versionKey = 'SnappromptsVersion';
    }

    async migrateIfNeeded() {
        try {
            // Get current stored version
            const versionResult = await chrome.storage.sync.get([this.versionKey]);
            const storedVersion = versionResult[this.versionKey] || '1.0.0'; // Default for old versions

            console.log(`Current version: ${this.currentVersion}, Stored version: ${storedVersion}`);

            // Don't run migration on fresh install (defaults handled by background.js)
            if (!versionResult[this.versionKey]) {
                console.log('Fresh install detected, skipping migration (defaults handled by background)');
                await chrome.storage.sync.set({ [this.versionKey]: this.currentVersion });
                return;
            }

            if (storedVersion !== this.currentVersion) {
                console.log('Migration needed, starting migration process...');
                await this.performMigration(storedVersion, this.currentVersion);

                // Update stored version
                await chrome.storage.sync.set({ [this.versionKey]: this.currentVersion });
                console.log('Migration completed successfully');
            } else {
                console.log('No migration needed');
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Continue with normal operation even if migration fails
        }
    }

    async performMigration(fromVersion, toVersion) {
        // Handle different migration paths based on version changes
        if (this.isVersionOlder(fromVersion, '1.1.0')) {
            await this.migrateTo110(fromVersion);
        }
        
        // Add more migration paths for future versions
        // if (this.isVersionOlder(fromVersion, '1.2.0')) {
        //     await this.migrateTo120(fromVersion);
        // }
    }

    async migrateTo110(fromVersion) {
        console.log(`Migrating from ${fromVersion} to 1.1.0`);
        
        try {
            // Try to get data from multiple storage sources
            let snippets = await this.getDataFromMultipleSources();
            
            if (snippets && snippets.length > 0) {
                // Validate and clean up old data format
                snippets = this.validateAndCleanSnippets(snippets);
                
                // Save to current storage
                await chrome.storage.sync.set({ [this.storageKey]: snippets });
                console.log(`Successfully migrated ${snippets.length} snippets`);
            }
        } catch (error) {
            console.error('Migration to 1.1.0 failed:', error);
        }
    }

    async getDataFromMultipleSources() {
        let allSnippets = [];
        let foundInSync = false;
        let foundInLocal = false;
        
        // Try sync storage first
        try {
            const syncResult = await chrome.storage.sync.get([this.storageKey]);
            const syncSnippets = syncResult[this.storageKey];
            if (syncSnippets && syncSnippets.length > 0) {
                console.log(`Found ${syncSnippets.length} snippets in sync storage`);
                allSnippets = [...allSnippets, ...syncSnippets];
                foundInSync = true;
            }
        } catch (error) {
            console.log('Sync storage failed, trying local storage...');
        }

        // Try local storage as fallback
        try {
            const localResult = await chrome.storage.local.get([this.storageKey]);
            const localSnippets = localResult[this.storageKey];
            if (localSnippets && localSnippets.length > 0) {
                console.log(`Found ${localSnippets.length} snippets in local storage`);
                allSnippets = [...allSnippets, ...localSnippets];
                foundInLocal = true;
            }
        } catch (error) {
            console.log('Local storage also failed');
        }

        // Try to recover from any other potential storage keys
        const alternativeKeys = ['snapprompts', 'snippets', 'prompts', 'textSnippets'];
        for (const key of alternativeKeys) {
            try {
                const result = await chrome.storage.sync.get([key]);
                if (result[key] && result[key].length > 0) {
                    console.log(`Found ${result[key].length} snippets in alternative key: ${key}`);
                    allSnippets = [...allSnippets, ...result[key]];
                }
            } catch (error) {
                // Continue to next alternative key
            }
        }

        // Also check local storage for alternative keys
        for (const key of alternativeKeys) {
            try {
                const result = await chrome.storage.local.get([key]);
                if (result[key] && result[key].length > 0) {
                    console.log(`Found ${result[key].length} snippets in local alternative key: ${key}`);
                    allSnippets = [...allSnippets, ...result[key]];
                }
            } catch (error) {
                // Continue to next alternative key
            }
        }

        if (allSnippets.length > 0) {
            console.log(`Total snippets found across all sources: ${allSnippets.length}`);
            console.log(`Sources: Sync=${foundInSync}, Local=${foundInLocal}`);
            return allSnippets;
        }

        return null;
    }

    validateAndCleanSnippets(snippets) {
        if (!Array.isArray(snippets)) {
            console.log('Snippets is not an array, converting...');
            snippets = [snippets];
        }

        // First, ensure all snippets have required fields
        const cleanedSnippets = snippets
            .filter(snippet => snippet && typeof snippet === 'object')
            .map(snippet => {
                // Ensure required fields exist
                if (!snippet.id) {
                    snippet.id = this.generateId();
                }
                if (!snippet.label) {
                    snippet.label = snippet.label || 'Untitled Snippet';
                }
                if (!snippet.text) {
                    snippet.text = snippet.text || '';
                }
                if (!snippet.createdAt) {
                    snippet.createdAt = snippet.createdAt || new Date().toISOString();
                }
                if (!snippet.updatedAt) {
                    snippet.updatedAt = snippet.updatedAt || new Date().toISOString();
                }
                
                return snippet;
            })
            .filter(snippet => snippet.text && snippet.text.trim().length > 0);

        // Remove duplicates based on content similarity
        const uniqueSnippets = [];
        const seenContent = new Set();
        
        for (const snippet of cleanedSnippets) {
            // Create a content hash based on label and text
            const contentHash = `${snippet.label.toLowerCase().trim()}:${snippet.text.toLowerCase().trim()}`;
            
            if (!seenContent.has(contentHash)) {
                seenContent.add(contentHash);
                uniqueSnippets.push(snippet);
            } else {
                console.log(`Removing duplicate snippet: "${snippet.label}"`);
            }
        }

        console.log(`Deduplication: ${cleanedSnippets.length} snippets -> ${uniqueSnippets.length} unique snippets`);
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

class SnapPromptConfig {
    constructor() {
        this.Snapprompts = [];
        this.maxSnippets = 10;
        this.maxTextLength = 5000;
        this.maxLabelLength = 100;
        this.toastTimeout = null;
        this.editingSnappromptId = null;
        this.migrationManager = new StorageMigrationManager();
        this.analytics = null;

        this.initializeElements();
        this.bindEvents();
        this.initializeAnalytics();
        this.initializeWithMigration();

        // Test Chrome storage availability
        this.testStorage();
    }

    async initializeAnalytics() {
        try {
            // Create analytics instance
            if (typeof AnalyticsManager !== 'undefined') {
                this.analytics = new AnalyticsManager();
                await this.analytics.initialize();
            } else {
                // Dummy analytics if not available
                this.analytics = {
                    trackPopupOpened: async () => {},
                    trackSnippetCreated: async () => {},
                    trackSnippetEdited: async () => {},
                    trackSnippetDeleted: async () => {},
                    trackRecoveryAttempted: async () => {},
                    trackRecoverySuccessful: async () => {},
                    trackSnippetCopied: async () => {},
                    trackEvent: async () => {}
                };
            }

            // Track popup opened
            await this.analytics.trackPopupOpened();

            // Track popup closed when window unloads
            window.addEventListener('beforeunload', async () => {
                await this.analytics.trackPopupClosed();
            });
        } catch (error) {
            console.error('Failed to initialize analytics in popup:', error);
        }
    }

    async initializeWithMigration() {
        try {
            // Run migration first
            await this.migrationManager.migrateIfNeeded();

            // Then load snippets normally
            await this.loadSnippets();

            // Check recovery button visibility after loading snippets
            await this.updateRecoveryButtonVisibility();

            // Check for captured text from context menu
            await this.checkForCapturedText();

            // Check and show What's New banner
            await this.checkWhatsNew();
        } catch (error) {
            console.error('Initialization error:', error);
            // Fallback to normal loading
            await this.loadSnippets();
            // Still check recovery button visibility even after fallback
            await this.updateRecoveryButtonVisibility();
            // Still check for captured text
            await this.checkForCapturedText();
            // Try to show What's New even on error
            await this.checkWhatsNew();
        }
    }

    async checkForCapturedText() {
        try {
            const result = await chrome.storage.local.get(['capturedText', 'captureError', 'captureTimestamp']);

            // Check if capture happened recently (within last 5 seconds)
            const now = Date.now();
            const captureAge = result.captureTimestamp ? now - result.captureTimestamp : Infinity;

            if (captureAge > 5000) {
                // Too old, ignore
                console.log('Captured text expired, ignoring');
                return;
            }

            // Check for errors first
            if (result.captureError) {
                console.log('Capture error detected:', result.captureError);

                // Show error toast
                if (result.captureError === 'No text is selected') {
                    this.showToast('No text is selected', 'warning');
                } else if (result.captureError.includes('Maximum')) {
                    this.showToast('Maximum of 10 Snapprompts reached. Delete a snippet to add new one.', 'error');
                } else {
                    this.showToast(result.captureError, 'error');
                }

                // Clear the error
                await chrome.storage.local.remove(['captureError', 'captureTimestamp']);
                return;
            }

            // Check for captured text
            if (result.capturedText) {
                console.log('Captured text found, pre-filling form');

                // Pre-fill the text area
                this.textInput.value = result.capturedText;
                this.updateCharCounter();

                // Focus on the label input so user can immediately start typing
                this.labelInput.focus();

                // Show info toast
                this.showToast('Text captured! Please provide a label.', 'info');

                // Clear the captured text from storage
                await chrome.storage.local.remove(['capturedText', 'captureTimestamp']);

                console.log('Form pre-filled with captured text');
            }
        } catch (error) {
            console.error('Error checking for captured text:', error);
        }
    }

    async testStorage() {
        try {
            console.log('Testing Chrome storage...');
            const testData = { test: 'hello' };
            await chrome.storage.sync.set(testData);
            const result = await chrome.storage.sync.get(['test']);
            console.log('Storage test result:', result);
            if (result.test === 'hello') {
                console.log('Chrome storage is working!');
                await chrome.storage.sync.remove(['test']);
            } else {
                console.error('Chrome storage test failed');
            }
        } catch (error) {
            console.error('Chrome storage test error:', error);
        }
    }

    initializeElements() {
        this.form = document.getElementById('SnappromptForm');
        this.labelInput = document.getElementById('SnappromptLabel');
        this.textInput = document.getElementById('SnappromptText');
        this.addBtn = document.getElementById('addBtn');
        this.feedbackBtn = document.getElementById('feedbackBtn');
        this.recoveryBtn = document.getElementById('recoveryBtn');
        this.SnappromptContainer = document.getElementById('SnappromptContainer');
        this.emptyState = document.getElementById('emptyState');
        this.SnappromptCount = document.getElementById('SnappromptCount');
        this.recoverySection = document.getElementById('recoverySection');
        this.charCounter = document.getElementById('charCounter');
        this.toast = document.getElementById('saveStatus');
        this.labelError = document.getElementById('labelError');
        this.textError = document.getElementById('textError');
        this.whatsNewBanner = document.getElementById('whatsNewBanner');
        this.whatsNewVersion = document.getElementById('whatsNewVersion');
        this.whatsNewContent = document.getElementById('whatsNewContent');
        this.whatsNewClose = document.getElementById('whatsNewClose');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.textInput.addEventListener('input', () => this.updateCharCounter());
        this.labelInput.addEventListener('input', () => this.clearValidationError('label'));
        this.textInput.addEventListener('input', () => this.clearValidationError('text'));
        this.feedbackBtn.addEventListener('click', () => this.handleFeedback());
        this.recoveryBtn.addEventListener('click', () => this.handleRecovery());
        this.whatsNewClose.addEventListener('click', () => this.dismissWhatsNew());
    }

    async handleFeedback() {
        try {
            console.log('Opening feedback form...');
            await chrome.tabs.create({
                url: 'https://forms.gle/KjJwTgJt1zKTt2Xv9',
                active: true
            });
            console.log('Feedback form opened successfully');
        } catch (error) {
            console.error('Error opening feedback form:', error);
            this.showToast('Error opening feedback form', 'error');
        }
    }

    async handleRecovery() {
        try {
            this.recoveryBtn.disabled = true;
            this.recoveryBtn.textContent = '🔍 Searching...';

            // Track recovery attempt
            if (this.analytics) {
                await this.analytics.trackRecoveryAttempted();
            }

            console.log('Starting snippet recovery process...');

            // Try to recover from multiple sources
            const recoveredSnippets = await this.migrationManager.getDataFromMultipleSources();
            
            if (recoveredSnippets && recoveredSnippets.length > 0) {
                console.log(`Found ${recoveredSnippets.length} total snippets across all storage sources`);
                console.log('Recovered snippets:', recoveredSnippets.map(s => ({ id: s.id, label: s.label, text: s.text.substring(0, 50) + '...' })));
                
                // Validate and clean the recovered snippets
                const cleanedSnippets = this.migrationManager.validateAndCleanSnippets(recoveredSnippets);
                console.log(`After validation and deduplication: ${cleanedSnippets.length} snippets`);
                console.log('Cleaned snippets:', cleanedSnippets.map(s => ({ id: s.id, label: s.label, text: s.text.substring(0, 50) + '...' })));
                
                if (cleanedSnippets.length > 0) {
                    // For recovery, we want to add ALL found snippets, not filter by ID
                    // This allows recovering deleted snippets even if they had the same ID
                    console.log(`Recovering ${cleanedSnippets.length} snippets from storage`);
                    
                    // Check if any of these snippets already exist in current list (by content, not ID)
                    console.log('Current snippets in list:', this.Snapprompts.map(s => ({ id: s.id, label: s.label, text: s.text.substring(0, 50) + '...' })));
                    
                    const existingContent = new Set();
                    this.Snapprompts.forEach(s => {
                        const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                        existingContent.add(contentHash);
                    });
                    
                    const trulyNewSnippets = cleanedSnippets.filter(s => {
                        const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                        return !existingContent.has(contentHash);
                    });
                    
                    console.log(`Found ${trulyNewSnippets.length} truly new snippets (not duplicates of existing ones)`);
                    if (trulyNewSnippets.length > 0) {
                        console.log('New snippets to add:', trulyNewSnippets.map(s => ({ id: s.id, label: s.label, text: s.text.substring(0, 50) + '...' })));
                    }
                    
                    if (trulyNewSnippets.length > 0) {
                        console.log('Snippets to add:', trulyNewSnippets.map(s => s.label));
                        this.Snapprompts = [...this.Snapprompts, ...trulyNewSnippets];
                        await this.saveSnippets();
                        this.renderSnippets();
                        this.showToast(`Recovered ${trulyNewSnippets.length} snippets!`, 'success');

                        // Track successful recovery
                        if (this.analytics) {
                            await this.analytics.trackRecoverySuccessful(trulyNewSnippets.length);
                        }

                        // Update recovery button visibility after recovery
                        await this.updateRecoveryButtonVisibility();
                    } else {
                        this.showToast('All found snippets already exist in current list', 'info');
                    }
                } else {
                    this.showToast('No valid snippets found during recovery', 'warning');
                }
            } else {
                this.showToast('No snippets found in any storage location', 'warning');
            }
        } catch (error) {
            console.error('Recovery error:', error);
            this.showToast('Recovery failed - check console for details', 'error');
        } finally {
            this.recoveryBtn.disabled = false;
            this.recoveryBtn.textContent = '🔍 Recover Lost Snippets';
            // Update recovery button visibility after recovery attempt
            this.updateRecoveryButtonVisibility();
        }
    }

    async updateRecoveryButtonVisibility() {
        try {
            // Check if there are any snippets available to recover
            const recoverableSnippets = await this.migrationManager.getDataFromMultipleSources();
            
            if (recoverableSnippets && recoverableSnippets.length > 0) {
                console.log(`Found ${recoverableSnippets.length} total recoverable snippets`);
                
                // Validate and check if any are new (not already in current snippets)
                const cleanedSnippets = this.migrationManager.validateAndCleanSnippets(recoverableSnippets);
                console.log(`After validation: ${cleanedSnippets.length} valid snippets`);
                
                // Check if any of these snippets already exist in current list (by content, not ID)
                const existingContent = new Set();
                this.Snapprompts.forEach(s => {
                    const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                    existingContent.add(contentHash);
                });
                
                const trulyNewSnippets = cleanedSnippets.filter(s => {
                    const contentHash = `${s.label.toLowerCase().trim()}:${s.text.toLowerCase().trim()}`;
                    return !existingContent.has(contentHash);
                });
                
                console.log(`Found ${trulyNewSnippets.length} truly new snippets not in current list`);
                
                if (trulyNewSnippets.length > 0) {
                    this.recoverySection.style.display = 'block';
                    console.log(`Recovery button shown - ${trulyNewSnippets.length} snippets available to recover:`, trulyNewSnippets.map(s => s.label));
                } else {
                    this.recoverySection.style.display = 'none';
                    console.log('Recovery button hidden - no new snippets to recover');
                }
            } else {
                this.recoverySection.style.display = 'none';
                console.log('Recovery button hidden - no recoverable snippets found');
            }
        } catch (error) {
            console.error('Error checking recovery button visibility:', error);
            this.recoverySection.style.display = 'none';
        }
    }

    updateCharCounter() {
        const length = this.textInput.value.length;
        this.charCounter.textContent = `${length} / ${this.maxTextLength}`;
        
        this.charCounter.className = 'char-counter';
        if (length > this.maxTextLength * 0.9) {
            this.charCounter.classList.add('warning');
        }
        if (length >= this.maxTextLength) {
            this.charCounter.classList.add('error');
        }
    }

    clearValidationError(field) {
        if (field === 'label') {
            this.labelError.textContent = '';
            this.labelInput.parentElement.classList.remove('error');
        } else if (field === 'text') {
            this.textError.textContent = '';
            this.textInput.parentElement.classList.remove('error');
        }
    }

    validateForm() {
        let isValid = true;
        
        // Clear previous errors
        this.clearValidationError('label');
        this.clearValidationError('text');

        // Validate label
        const label = this.labelInput.value.trim();
        if (!label) {
            this.showValidationError('label', 'Label is required');
            isValid = false;
        } else if (label.length > this.maxLabelLength) {
            this.showValidationError('label', `Label must be ${this.maxLabelLength} characters or less`);
            isValid = false;
        } else if (this.Snapprompts.some(Snapprompt => Snapprompt.label.toLowerCase() === label.toLowerCase() && Snapprompt.id !== this.editingSnappromptId)) {
            this.showValidationError('label', 'A Snapprompt with this label already exists');
            isValid = false;
        }

        // Validate text
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
            this.labelInput.parentElement.classList.add('error');
        } else if (field === 'text') {
            this.textError.textContent = message;
            this.textInput.parentElement.classList.add('error');
        }
    }

    handleEdit(SnappromptId) {
        const Snapprompt = this.Snapprompts.find(s => s.id === SnappromptId);
        if (Snapprompt) {
            this.editingSnappromptId = SnappromptId;
            this.labelInput.value = Snapprompt.label;
            this.textInput.value = Snapprompt.text;
            this.addBtn.textContent = 'Update Snapprompt';
            this.updateCharCounter();
            window.scrollTo(0, 0);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const label = this.labelInput.value.trim();
        const text = this.textInput.value.trim();
        const isEditing = !!this.editingSnappromptId;

        if (this.editingSnappromptId) {
            const index = this.Snapprompts.findIndex(s => s.id === this.editingSnappromptId);
            if (index > -1) {
                this.Snapprompts[index].label = label;
                this.Snapprompts[index].text = text;
                this.showToast('Snapprompt updated successfully!', 'success');
            } else {
                this.showToast('Error updating Snapprompt', 'error');
                return;
            }
        } else {
            if (this.Snapprompts.length >= this.maxSnippets) {
                this.showToast('Maximum of 10 Snapprompts allowed', 'error');
                return;
            }

            const newSnapprompt = {
                id: Date.now().toString(),
                label: label,
                text: text,
                created: new Date().toISOString()
            };

            this.Snapprompts.push(newSnapprompt);
            this.showToast('Snapprompt added successfully!', 'success');
        }

        try {
            await this.saveSnippets();
            this.renderSnippets();
            this.clearForm();

            // Track analytics
            if (this.analytics) {
                if (isEditing) {
                    await this.analytics.trackSnippetEdited(this.Snapprompts.length);
                } else {
                    await this.analytics.trackSnippetCreated(this.Snapprompts.length);
                }
            }

            // Update recovery button visibility after adding/updating snippets
            await this.updateRecoveryButtonVisibility();
        } catch (error) {
            console.error('Failed to save Snapprompt:', error);
            this.showToast('Failed to save Snapprompt', 'error');
            // If it was a new Snapprompt, remove it
            if (!isEditing) {
                this.Snapprompts.pop();
            }
        }
    }

    clearForm() {
        this.labelInput.value = '';
        this.textInput.value = '';
        this.editingSnappromptId = null;
        this.addBtn.textContent = 'Store Prompt';
        this.updateCharCounter();
        this.clearValidationError('label');
        this.clearValidationError('text');
    }

    async loadSnippets() {
        try {
            // Try multiple storage sources with fallback
            let snippets = await this.loadFromMultipleSources();
            
            if (snippets && snippets.length > 0) {
                this.Snapprompts = snippets;
                console.log(`Successfully loaded ${snippets.length} snippets`);
            } else {
                this.Snapprompts = [];
                console.log('No snippets found, starting with empty state');
            }
            
            this.renderSnippets();
        } catch (error) {
            console.error('Error loading Snapprompts:', error);
            this.showToast('Error loading Snapprompts - trying fallback storage', 'warning');
            
            // Try fallback to local storage
            try {
                const localResult = await chrome.storage.local.get(['Snapprompts']);
                this.Snapprompts = localResult.Snapprompts || [];
                console.log('Loaded snippets from fallback storage');
                this.renderSnippets();
            } catch (fallbackError) {
                console.error('Fallback storage also failed:', fallbackError);
                this.Snapprompts = [];
                this.renderSnippets();
                this.showToast('Unable to load snippets - starting fresh', 'error');
            }
            
            // Check recovery button visibility after loading (success or failure)
            await this.updateRecoveryButtonVisibility();
        }
    }

    async loadFromMultipleSources() {
        // Try sync storage first
        try {
            const syncResult = await chrome.storage.sync.get(['Snapprompts']);
            if (syncResult.Snapprompts && syncResult.Snapprompts.length > 0) {
                console.log('Found snippets in sync storage');
                return syncResult.Snapprompts;
            }
        } catch (error) {
            console.log('Sync storage failed, trying alternatives...');
        }

        // Try local storage as fallback
        try {
            const localResult = await chrome.storage.local.get(['Snapprompts']);
            if (localResult.Snapprompts && localResult.Snapprompts.length > 0) {
                console.log('Found snippets in local storage');
                return localResult.Snapprompts;
            }
        } catch (error) {
            console.log('Local storage also failed');
        }

        // Try alternative storage keys
        const alternativeKeys = ['snapprompts', 'snippets', 'prompts', 'textSnippets'];
        for (const key of alternativeKeys) {
            try {
                const result = await chrome.storage.sync.get([key]);
                if (result[key] && result[key].length > 0) {
                    console.log(`Found snippets in alternative key: ${key}`);
                    return result[key];
                }
            } catch (error) {
                // Continue to next alternative key
            }
        }

        return null;
    }

    async saveSnippets() {
        try {
            console.log('Saving Snapprompts:', this.Snapprompts);
            
            // Save to both sync and local storage for redundancy
            const savePromises = [
                chrome.storage.sync.set({ Snapprompts: this.Snapprompts }),
                chrome.storage.local.set({ Snapprompts: this.Snapprompts })
            ];
            
            await Promise.allSettled(savePromises);
            
            // Check if at least one save was successful
            const syncResult = await chrome.storage.sync.get(['Snapprompts']);
            const localResult = await chrome.storage.local.get(['Snapprompts']);
            
            if (syncResult.Snapprompts || localResult.Snapprompts) {
                console.log('Snapprompts saved successfully');
                this.showToast('Snippets saved successfully', 'success');
            } else {
                throw new Error('Failed to save to any storage');
            }
        } catch (error) {
            console.error('Error saving Snapprompts:', error);
            this.showToast('Error saving Snapprompts - trying local storage only', 'warning');
            
            // Try to save to local storage only as fallback
            try {
                await chrome.storage.local.set({ Snapprompts: this.Snapprompts });
                console.log('Saved to local storage as fallback');
                this.showToast('Snippets saved to local storage only', 'warning');
            } catch (fallbackError) {
                console.error('Local storage fallback also failed:', fallbackError);
                this.showToast('Failed to save snippets', 'error');
                throw fallbackError;
            }
        }
    }

    renderSnippets() {
        this.updateSnippetCount();

        if (this.Snapprompts.length === 0) {
            this.emptyState.style.display = 'block';
            return;
        }

        this.emptyState.style.display = 'none';

        // Sort Snapprompts alphabetically by label
        const sortedSnippets = [...this.Snapprompts].sort((a, b) => 
            a.label.localeCompare(b.label)
        );

        this.SnappromptContainer.innerHTML = sortedSnippets.map(Snapprompt => 
            this.createSnippetHTML(Snapprompt)
        ).join('');

        this.SnappromptContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const SnappromptId = e.target.dataset.snappromptId;
                this.handleEdit(SnappromptId);
            });
        });

        // Bind copy events
        this.SnappromptContainer.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const snappromptId = e.target.dataset.snappromptId;
                this.handleCopy(snappromptId);
            });
        });

        // Bind delete events
        this.SnappromptContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const SnappromptId = e.target.dataset.snappromptId;
                this.deleteSnippet(SnappromptId);
            });
        });
    }

    createSnippetHTML(Snapprompt) {
        const truncatedText = Snapprompt.text.length > 100
            ? Snapprompt.text.substring(0, 100) + '...'
            : Snapprompt.text;

        // Get the snippet's position in the sorted list to determine keyboard shortcut
        const sortedSnippets = [...this.Snapprompts].sort((a, b) =>
            a.label.localeCompare(b.label)
        );
        const snippetIndex = sortedSnippets.findIndex(s => s.id === Snapprompt.id);

        // Determine keyboard shortcut (Alt+1 through Alt+4 for positions 0-3)
        // Chrome only allows 4 keyboard shortcuts maximum
        let keyboardShortcut = '';
        if (snippetIndex >= 0 && snippetIndex < 4) {
            keyboardShortcut = `Alt+${snippetIndex + 1}`;
        }

        return `
            <div class="Snapprompt-item">
                ${keyboardShortcut ? `<div class="keyboard-shortcut-badge">${keyboardShortcut}</div>` : ''}
                <button class="edit-btn" data-snapprompt-id="${Snapprompt.id}" title="Edit Snapprompt">✂️</button>
                <button class="copy-btn" data-snapprompt-id="${Snapprompt.id}" title="Copy to clipboard">📋</button>
                <button class="delete-btn" data-snapprompt-id="${Snapprompt.id}" title="Delete Snapprompt">×</button>
                <div class="Snapprompt-label">${this.escapeHtml(Snapprompt.label)}</div>
                <div class="Snapprompt-text ${Snapprompt.text.length > 100 ? 'truncated' : ''}">
                    ${this.escapeHtml(truncatedText)}
                </div>
            </div>
        `;
    }

    async handleCopy(snappromptId) {
        const snapprompt = this.Snapprompts.find(s => s.id === snappromptId);
        if (!snapprompt) {
            this.showToast('Snapprompt not found', 'error');
            return;
        }

        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(snapprompt.text);
                this.showToast('Copied to clipboard!', 'success');

                // Track analytics
                if (this.analytics) {
                    await this.analytics.trackSnippetCopied(true);
                }
            } else {
                // Fallback to execCommand for older browsers
                const success = this.fallbackCopyToClipboard(snapprompt.text);
                if (success) {
                    this.showToast('Copied to clipboard!', 'success');

                    // Track analytics
                    if (this.analytics) {
                        await this.analytics.trackSnippetCopied(true);
                    }
                } else {
                    throw new Error('Clipboard API not available');
                }
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showToast('Failed to copy to clipboard', 'error');

            // Track analytics failure
            if (this.analytics) {
                await this.analytics.trackSnippetCopied(false);
            }
        }
    }

    fallbackCopyToClipboard(text) {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        try {
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        } catch (error) {
            document.body.removeChild(textarea);
            return false;
        }
    }

    async deleteSnippet(SnappromptId, silent = false) {
        const index = this.Snapprompts.findIndex(s => s.id === SnappromptId);
        if (index > -1) {
            this.Snapprompts.splice(index, 1);
            await this.saveSnippets();
            this.renderSnippets();
            if (!silent) {
                this.showToast('Snapprompt deleted', 'success');
            }

            // Track analytics
            if (this.analytics) {
                await this.analytics.trackSnippetDeleted(this.Snapprompts.length);
            }

            // Update recovery button visibility after deleting snippets
            await this.updateRecoveryButtonVisibility();
        }
    }

    updateSnippetCount() {
        this.SnappromptCount.textContent = this.Snapprompts.length;

        // Update add button state
        if (this.Snapprompts.length >= this.maxSnippets) {
            this.addBtn.disabled = true;
            this.addBtn.textContent = 'Maximum reached (10/10)';
        } else {
            this.addBtn.disabled = false;
            this.addBtn.textContent = 'Store Prompt';
        }
    }

    // FIXED: This method was causing the vibration!
    showToast(message, type = 'success') {
        // Clear any existing timeout
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        // Force a single reflow by setting all properties at once
        requestAnimationFrame(() => {
            // Set content and initial state
            this.toast.textContent = message;
            this.toast.className = `toast ${type}`;
            
            // Force layout calculation
            this.toast.offsetHeight;
            
            // Then show it
            requestAnimationFrame(() => {
                this.toast.classList.add('show');
            });
        });

        // Hide the toast after 3 seconds
        this.toastTimeout = setTimeout(() => {
            this.toast.classList.remove('show');
            
            // Clean up after animation completes
            setTimeout(() => {
                if (!this.toast.classList.contains('show')) {
                    this.toast.className = 'toast';
                    this.toast.textContent = '';
                }
            }, 300);
        }, 3000);
    }

    async checkWhatsNew() {
        try {
            const currentVersion = chrome.runtime.getManifest().version;

            // Get What's New status from background
            const response = await chrome.runtime.sendMessage({ action: 'getWhatsNew' });

            console.log('What\'s New check:', {
                currentVersion,
                lastSeenVersion: response.lastSeenVersion,
                dismissed: response.whatsNewDismissed
            });

            // Show banner if there's an update and it hasn't been dismissed
            if (!response.whatsNewDismissed && this.isNewerVersion(currentVersion, response.lastSeenVersion)) {
                this.showWhatsNew(currentVersion, response.lastSeenVersion);
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

    showWhatsNew(currentVersion, previousVersion) {
        const updates = this.getUpdateContent(currentVersion, previousVersion);

        if (!updates || updates.length === 0) {
            return;
        }

        this.whatsNewVersion.textContent = `v${currentVersion}`;
        this.whatsNewContent.innerHTML = this.formatUpdateContent(updates);
        this.whatsNewBanner.classList.add('show');
    }

    getUpdateContent(currentVersion, previousVersion) {
        // This is where you configure what to show for each version
        // Returns an array of update items for this version
        const updatesByVersion = {
            '1.2.0': [
                '<strong>Update Notifications:</strong> From now on, you\'ll be notified about new features and improvements right here in the extension. New Enhancements are coming soon so please leave feedback on features you would like to see',

            ],
            '1.3.0': [
                '<strong>📋 Copy Button:</strong> Quickly copy from SnapPrompt to your clipboard with one click, so you can paste outside Chrome',
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
            this.whatsNewBanner.classList.remove('show');
            console.log('What\'s New banner dismissed');
        } catch (error) {
            console.error('Error dismissing What\'s New:', error);
            // Still hide the banner even if the message fails
            this.whatsNewBanner.classList.remove('show');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the configuration interface when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new SnapPromptConfig();
});