// analytics.js - Centralized Google Analytics helper for SnapPrompt
class AnalyticsManager {
  constructor() {
    this.GA_MEASUREMENT_ID = 'G-MG0SCXR3KP'; // TODO: Replace with actual Measurement ID
    this.API_SECRET = 'YOUR_API_SECRET'; // TODO: Replace with actual API secret
    this.enabled = false;
    this.clientId = null;
  }

  async initialize() {
    try {
      // Check Do Not Track setting (only check navigator, as window doesn't exist in service workers)
      if (navigator.doNotTrack === '1') {
        console.log('Analytics disabled: Do Not Track is enabled');
        this.enabled = false;
        return;
      }

      // Generate or retrieve persistent client ID
      const result = await chrome.storage.local.get(['analyticsClientId']);
      if (result.analyticsClientId) {
        this.clientId = result.analyticsClientId;
      } else {
        this.clientId = this.generateClientId();
        await chrome.storage.local.set({ analyticsClientId: this.clientId });
      }

      this.enabled = true;
      console.log('Analytics initialized successfully');

      // Track initialization
      await this.trackEvent('extension_initialized', {
        version: chrome.runtime.getManifest().version
      });
    } catch (error) {
      console.error('Analytics initialization failed:', error);
      this.enabled = false;
    }
  }

  generateClientId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async trackEvent(eventName, eventParams = {}) {
    if (!this.enabled) {
      console.log('Analytics disabled, skipping event:', eventName);
      return;
    }

    try {
      const payload = {
        client_id: this.clientId,
        events: [{
          name: eventName,
          params: {
            ...eventParams,
            timestamp: Date.now(),
            version: chrome.runtime.getManifest().version,
            engagement_time_msec: '100'
          }
        }]
      };

      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.GA_MEASUREMENT_ID}&api_secret=${this.API_SECRET}`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        console.warn('Analytics event failed:', eventName, response.status);
      } else {
        console.log('Analytics event tracked:', eventName, eventParams);
      }
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      // Don't break extension functionality if analytics fails
    }
  }

  // Convenience methods for common events
  async trackSnippetInserted(method, snippetPosition, success) {
    await this.trackEvent('snippet_inserted', {
      method: method, // 'keyboard_shortcut' or 'context_menu'
      snippet_position: snippetPosition,
      success: success
    });
  }

  async trackSnippetCreated(snippetCount) {
    await this.trackEvent('snippet_created', {
      snippet_count: snippetCount
    });
  }

  async trackSnippetEdited(snippetCount) {
    await this.trackEvent('snippet_edited', {
      snippet_count: snippetCount
    });
  }

  async trackSnippetDeleted(snippetCount) {
    await this.trackEvent('snippet_deleted', {
      snippet_count: snippetCount
    });
  }

  async trackInsertionFailed(errorType, errorMessage) {
    await this.trackEvent('insertion_failed', {
      error_type: errorType,
      error_message: errorMessage.substring(0, 100) // Limit message length
    });
  }

  async trackPopupOpened() {
    await this.trackEvent('popup_opened', {});
  }

  async trackPopupClosed() {
    await this.trackEvent('popup_closed', {});
  }

  async trackRecoveryAttempted() {
    await this.trackEvent('recovery_attempted', {});
  }

  async trackRecoverySuccessful(snippetsRecovered) {
    await this.trackEvent('recovery_successful', {
      snippets_recovered: snippetsRecovered
    });
  }

  async trackSnippetCopied(success) {
    await this.trackEvent('snippet_copied', {
      success: success
    });
  }

  async trackTextCaptured(success, textLength) {
    // Round text length to nearest 100 for privacy
    const roundedLength = Math.round(textLength / 100) * 100;
    await this.trackEvent('text_captured', {
      success: success,
      text_length: roundedLength
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsManager;
}
