// Popup script for SnapPrompt Chrome Extension

class SnapPromptConfig {
    constructor() {
        this.Snapprompts = [];
        this.maxSnippets = 5;
        this.maxTextLength = 5000;
        this.maxLabelLength = 100;
        this.toastTimeout = null;
        this.editingSnappromptId = null;

        this.initializeElements();
        this.bindEvents();
        this.loadSnippets();
        
        // Test Chrome storage availability
        this.testStorage();
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
        this.SnappromptContainer = document.getElementById('SnappromptContainer');
        this.emptyState = document.getElementById('emptyState');
        this.SnappromptCount = document.getElementById('SnappromptCount');
        this.charCounter = document.getElementById('charCounter');
        this.toast = document.getElementById('saveStatus');
        this.labelError = document.getElementById('labelError');
        this.textError = document.getElementById('textError');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.textInput.addEventListener('input', () => this.updateCharCounter());
        this.labelInput.addEventListener('input', () => this.clearValidationError('label'));
        this.textInput.addEventListener('input', () => this.clearValidationError('text'));
        this.feedbackBtn.addEventListener('click', () => this.handleFeedback());
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
                this.showToast('Maximum of 5 Snapprompts allowed', 'error');
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
        } catch (error) {
            console.error('Failed to save Snapprompt:', error);
            this.showToast('Failed to save Snapprompt', 'error');
            // If it was a new Snapprompt, remove it
            if (!this.editingSnappromptId) {
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
            const result = await chrome.storage.sync.get(['Snapprompts']);
            console.log('Loaded Snapprompts:', result); // Debug log
            this.Snapprompts = result.Snapprompts || [];
            this.renderSnippets();
        } catch (error) {
            console.error('Error loading Snapprompts:', error);
            this.showToast('Error loading Snapprompts', 'error');
            // Fallback to empty array
            this.Snapprompts = [];
            this.renderSnippets();
        }
    }

    async saveSnippets() {
        try {
            console.log('Saving Snapprompts:', this.Snapprompts); // Debug log
            await chrome.storage.sync.set({ Snapprompts: this.Snapprompts });
            console.log('Snapprompts saved successfully'); // Debug log
        } catch (error) {
            console.error('Error saving Snapprompts:', error);
            this.showToast('Error saving Snapprompts', 'error');
            throw error;
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

        return `
            <div class="Snapprompt-item">
                <button class="edit-btn" data-snapprompt-id="${Snapprompt.id}" title="Edit Snapprompt">✂️</button>
                <button class="delete-btn" data-snapprompt-id="${Snapprompt.id}" title="Delete Snapprompt">×</button>
                <div class="Snapprompt-label">${this.escapeHtml(Snapprompt.label)}</div>
                <div class="Snapprompt-text ${Snapprompt.text.length > 100 ? 'truncated' : ''}">
                    ${this.escapeHtml(truncatedText)}
                </div>
            </div>
        `;
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
        }
    }

    updateSnippetCount() {
        this.SnappromptCount.textContent = this.Snapprompts.length;
        
        // Update add button state
        if (this.Snapprompts.length >= this.maxSnippets) {
            this.addBtn.disabled = true;
            this.addBtn.textContent = 'Maximum reached (5/5)';
        } else {
            this.addBtn.disabled = false;
            this.addBtn.textContent = 'Add Snapprompt';
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