// analytics.js - Centralized Google Analytics helper for SnapPrompt
class AnalyticsManager {
  constructor() {
    // Detect if running in development mode (unpacked extension)
    const isDevelopment = !('update_url' in chrome.runtime.getManifest());

    // Use separate GA4 properties for dev and production
    this.GA_MEASUREMENT_ID = isDevelopment
      ? 'G-DEV-MEASUREMENT-ID' // TODO: Create separate dev GA4 property
      : 'G-MG0SCXR3KP'; // Production Measurement ID

    this.API_SECRET = isDevelopment
      ? 'DEV_API_SECRET' // TODO: API secret for dev property
      : 'YOUR_API_SECRET'; // TODO: API secret for production property

    this.enabled = false;
    this.clientId = null;

    // Event batching properties
    this.eventQueue = [];
    this.maxBatchSize = 10;
    this.flushInterval = 30000; // 30 seconds
    this.flushTimer = null;

    // Keystroke milestone tracking
    this.milestones = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    this.achievedMilestones = new Set();
  }

  async initialize() {
    try {
      // Check Do Not Track setting (only check navigator, as window doesn't exist in service workers)
      if (navigator.doNotTrack === '1') {
        this.enabled = false;
        return;
      }

      // Generate or retrieve persistent client ID and achieved milestones
      const result = await chrome.storage.local.get(['analyticsClientId', 'achievedMilestones']);
      if (result.analyticsClientId) {
        this.clientId = result.analyticsClientId;
      } else {
        this.clientId = this.generateClientId();
        await chrome.storage.local.set({ analyticsClientId: this.clientId });
      }

      // Load achieved milestones
      if (result.achievedMilestones && Array.isArray(result.achievedMilestones)) {
        this.achievedMilestones = new Set(result.achievedMilestones);
      }

      this.enabled = true;

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
      return;
    }

    try {
      // Queue the event instead of sending immediately
      const event = {
        name: eventName,
        params: {
          ...eventParams,
          timestamp: Date.now(),
          version: chrome.runtime.getManifest().version,
          engagement_time_msec: '100'
        }
      };

      this.eventQueue.push(event);

      // Flush when queue reaches max size
      if (this.eventQueue.length >= this.maxBatchSize) {
        await this.flushEvents();
      } else if (!this.flushTimer) {
        // Start flush timer if not already running
        this.flushTimer = setTimeout(() => this.flushEvents(), this.flushInterval);
      }
    } catch (error) {
      console.error('Error queueing analytics event:', error);
      // Don't break extension functionality if analytics fails
    }
  }

  async flushEvents() {
    if (!this.enabled || this.eventQueue.length === 0) {
      return;
    }

    // Clear the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Get events to send and clear queue
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const payload = {
        client_id: this.clientId,
        events: eventsToSend
      };

      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.GA_MEASUREMENT_ID}&api_secret=${this.API_SECRET}`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        console.warn('Analytics batch failed:', response.status);
      }
    } catch (error) {
      console.error('Error flushing analytics events:', error);
      // Don't break extension functionality if analytics fails
    }
  }

  flushEventsSync() {
    // Synchronous flush using sendBeacon for popup close / service worker suspend
    if (!this.enabled || this.eventQueue.length === 0) {
      return;
    }

    // Clear the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const payload = {
        client_id: this.clientId,
        events: [...this.eventQueue]
      };

      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.GA_MEASUREMENT_ID}&api_secret=${this.API_SECRET}`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, blob);
      }

      this.eventQueue = [];
    } catch (error) {
      console.error('Error in synchronous flush:', error);
    }
  }

  async checkKeystrokeMilestone(totalKeystrokes) {
    // Check if we've reached any new milestones
    for (const milestone of this.milestones) {
      if (totalKeystrokes >= milestone && !this.achievedMilestones.has(milestone)) {
        this.achievedMilestones.add(milestone);
        await chrome.storage.local.set({ achievedMilestones: Array.from(this.achievedMilestones) });
        await this.trackEvent('keystrokes_milestone', {
          total_keystrokes_saved: totalKeystrokes,
          milestone: milestone.toString()
        });
        return milestone; // For UI notification
      }
    }
    return null;
  }

  // Convenience methods for common events
  async trackSnippetInserted(method, snippetPosition, success) {
    await this.trackEvent('snippet_inserted', {
      method: method, // 'keyboard_shortcut' or 'context_menu'
      snippet_position: snippetPosition,
      success: success
    });
  }

  async trackSnippetCreated(snippetCount, creationMethod = 'manual') {
    await this.trackEvent('snippet_created', {
      snippet_count: snippetCount,
      method: creationMethod // 'manual' or 'default'
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

  async trackPopupClosed(snippetCount = 0, sessionDuration = 0) {
    await this.trackEvent('popup_closed', {
      snippet_count: snippetCount,
      session_duration_ms: sessionDuration
    });
  }

  async trackRecoveryAttempted() {
    await this.trackEvent('recovery_attempted', {});
  }

  async trackRecoverySuccessful(snippetsRecovered) {
    await this.trackEvent('recovery_successful', {
      snippets_recovered: snippetsRecovered
    });
  }

  async trackSnippetCopied(success, snippetPosition = 0) {
    await this.trackEvent('snippet_copied', {
      success: success,
      snippet_position: snippetPosition
    });
  }

  async trackSnippetsExported(exportCount, totalSnippets) {
    await this.trackEvent('snippets_exported', {
      export_count: exportCount,
      total_after: totalSnippets
    });
  }

  async trackSnippetsImported(importCount, totalSnippets) {
    await this.trackEvent('snippets_imported', {
      import_count: importCount,
      total_after: totalSnippets
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
