// Background script for SnapPrompt Chrome Extension
console.log('SnapPrompt background script loaded.');

// Default snippets for new installations
const DEFAULT_SNIPPETS = [
  {
    id: 'default-1-' + Date.now(),
    label: 'Ask me Questions',
    text: 'Before you start the task, review all inputs and ask me any questions you need to improve the chances of successfully producing the output I am looking for. number all the questions and if possible, make them yes or no answers so I can quickly easily and clearly answer the questions.',
    created: new Date().toISOString()
  },
  {
    id: 'default-2-' + (Date.now() + 1),
    label: 'Improve Output',
    text: 'This output is good but I know you can do better. Review the last prompt and compare it to your output then 10X the output based onth erequirements from the prompt',
    created: new Date().toISOString()
  },
  {
    id: 'default-3-' + (Date.now() + 2),
    label: 'Dictation Organizer',
    text: 'Below is a dictated note I made. Please review the dictation and work to orgnaize it into a form you feel matches the intended outcome of the author. Feel free to ask up to 5 questions before creating the first draft output',
    created: new Date().toISOString()
  }
];

// Context menu item IDs
const MENU_IDS = {
  CONFIGURE: 'configure-snippets',
  SNIPPET_PREFIX: 'snippet-',
  SAVE_SELECTED: 'save-selected-text'
};

// Analytics instance
let analytics;

// Initialize analytics
(async function initAnalytics() {
  try {
    // Dynamically import and initialize analytics
    importScripts('analytics.js');
    analytics = new AnalyticsManager();
    await analytics.initialize();
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
    // Create dummy analytics object that does nothing
    analytics = {
      trackSnippetInserted: async () => {},
      trackInsertionFailed: async () => {},
      trackSnippetCreated: async () => {},
      trackTextCaptured: async () => {},
      trackEvent: async () => {}
    };
  }
})();

// Initialize context menus when extension starts
chrome.runtime.onStartup.addListener(initializeContextMenus);
chrome.runtime.onInstalled.addListener(initializeContextMenus);

// Handle migrations when extension is installed/updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    console.log(`Extension ${details.reason}ed, checking for migrations...`);
    await handleMigration(details.reason, details.previousVersion);

    // Handle update notifications
    if (details.reason === 'update') {
      await handleUpdateNotification(details.previousVersion);
    } else if (details.reason === 'install') {
      await handleInstallNotification();
    }
  }
});

// Update context menus when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.Snapprompts) {
    initializeContextMenus();
  }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  let snippetIndex;
  switch(command) {
    case "snippet-1": snippetIndex = 0; break;
    case "snippet-2": snippetIndex = 1; break;
    case "snippet-3": snippetIndex = 2; break;
    case "snippet-4": snippetIndex = 3; break;
    default: return;
  }

  try {
    const result = await chrome.storage.sync.get(['Snapprompts']);
    const Snapprompts = result.Snapprompts || [];
    // Do NOT sort Snapprompts here, use original order for keyboard shortcuts
    const validSnapprompts = Snapprompts
      .filter(Snapprompt => Snapprompt && Snapprompt.label && Snapprompt.text);

    const Snapprompt = validSnapprompts[snippetIndex];
    if (Snapprompt) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const success = await insertSnippetWithRetry(tab.id, Snapprompt, 0);

        // Track analytics
        if (analytics) {
          await analytics.trackSnippetInserted('keyboard_shortcut', snippetIndex + 1, success);
        }
      }
    }
  } catch (error) {
    console.error('Error handling keyboard shortcut:', error);
    if (analytics) {
      await analytics.trackInsertionFailed('keyboard_shortcut', error.message);
    }
  }
});

async function initializeContextMenus() {
  try {
    // Remove all existing context menus
    await chrome.contextMenus.removeAll();

    // Get stored Snapprompts
    const result = await chrome.storage.sync.get(['Snapprompts']);
    const Snapprompts = result.Snapprompts || [];

    // Filter Snapprompts (do NOT sort for context menus to match keyboard shortcut order)
    const validSnapprompts = Snapprompts
      .filter(Snapprompt => Snapprompt && Snapprompt.label && Snapprompt.text);

    if (validSnapprompts.length > 0) {
      // Add Snapprompt menu items
      validSnapprompts.forEach((Snapprompt, index) => {
        chrome.contextMenus.create({
          id: MENU_IDS.SNIPPET_PREFIX + index,
          title: Snapprompt.label,
          contexts: ['editable'],
          documentUrlPatterns: ['<all_urls>']
        });
      });

      // Add separator before configure option
      chrome.contextMenus.create({
        id: 'separator',
        type: 'separator',
        contexts: ['editable']
      });
    }

    // Add "Save in SnapPrompt" menu item for text capture
    chrome.contextMenus.create({
      id: MENU_IDS.SAVE_SELECTED,
      title: 'Save in SnapPrompt',
      contexts: ['selection', 'editable'],
      documentUrlPatterns: ['<all_urls>']
    });

    // Add separator before configure
    if (validSnapprompts.length === 0) {
      chrome.contextMenus.create({
        id: 'separator2',
        type: 'separator',
        contexts: ['editable']
      });
    }

    // Always add configure option
    chrome.contextMenus.create({
      id: MENU_IDS.CONFIGURE,
      title: validSnapprompts.length > 0 ? 'Configure Snapprompts' : 'Configure Snapprompts (No Snapprompts configured)',
      contexts: ['editable'],
      documentUrlPatterns: ['<all_urls>']
    });
  } catch (error) {
    console.error('Error initializing context menus:', error);
  }
}

// Handle migrations when extension is installed/updated
async function handleMigration(reason, previousVersion) {
  try {
    const currentVersion = '1.3.0'; // Should match manifest.json version
    const versionKey = 'SnappromptsVersion';

    console.log(`Migration: ${reason} from ${previousVersion || 'unknown'} to ${currentVersion}`);

    // Check if this is a fresh install
    if (reason === 'install') {
      console.log('Fresh install detected - adding default snippets');
      await addDefaultSnippets();
      await chrome.storage.sync.set({ [versionKey]: currentVersion });
      console.log('Default snippets added successfully');
      return;
    }

    // Get current stored version
    const versionResult = await chrome.storage.sync.get([versionKey]);
    const storedVersion = versionResult[versionKey] || '1.0.0';

    if (storedVersion !== currentVersion) {
      console.log('Migration needed, starting migration process...');

      // Try to recover data from multiple sources
      const snippets = await getDataFromMultipleSources();

      if (snippets && snippets.length > 0) {
        // Validate and clean up old data format
        const cleanedSnippets = validateAndCleanSnippets(snippets);

        // Save to current storage
        await chrome.storage.sync.set({
          Snapprompts: cleanedSnippets,
          [versionKey]: currentVersion
        });

        console.log(`Successfully migrated ${cleanedSnippets.length} snippets`);
      } else {
        // Just update version if no data to migrate
        await chrome.storage.sync.set({ [versionKey]: currentVersion });
        console.log('No data to migrate, version updated');
      }
    } else {
      console.log('No migration needed');
    }
  } catch (error) {
    console.error('Migration error:', error);
    // Continue with normal operation even if migration fails
  }
}

// Add default snippets for fresh installations
async function addDefaultSnippets() {
  try {
    // Check if any snippets already exist (shouldn't on fresh install, but safety check)
    const result = await chrome.storage.sync.get(['Snapprompts']);
    const existingSnippets = result.Snapprompts || [];

    if (existingSnippets.length > 0) {
      console.log('Snippets already exist, skipping default snippet creation');
      return;
    }

    // Create default snippets with unique IDs
    const defaultSnippets = DEFAULT_SNIPPETS.map((snippet, index) => ({
      ...snippet,
      id: `default-${index + 1}-${Date.now() + index}`,
      created: new Date().toISOString()
    }));

    // Save to storage
    await chrome.storage.sync.set({ Snapprompts: defaultSnippets });

    // Also save to local storage as backup
    await chrome.storage.local.set({ Snapprompts: defaultSnippets });

    console.log(`Added ${defaultSnippets.length} default snippets`);

    // Track analytics if available
    if (analytics) {
      for (let i = 0; i < defaultSnippets.length; i++) {
        await analytics.trackSnippetCreated(i + 1);
      }
    }

  } catch (error) {
    console.error('Error adding default snippets:', error);
    // Don't throw error - extension should work even if defaults fail
  }
}

// Helper function to get data from multiple storage sources
async function getDataFromMultipleSources() {
  let allSnippets = [];
  let foundInSync = false;
  let foundInLocal = false;
  
  // Try sync storage first
  try {
    const syncResult = await chrome.storage.sync.get(['Snapprompts']);
    const syncSnippets = syncResult.Snapprompts;
    if (syncSnippets && syncSnippets.length > 0) {
      console.log(`Found ${syncSnippets.length} snippets in sync storage`);
      allSnippets = [...allSnippets, ...syncSnippets];
      foundInSync = true;
    }
  } catch (error) {
    console.log('Sync storage failed, trying alternatives...');
  }

  // Try local storage as fallback
  try {
    const localResult = await chrome.storage.local.get(['Snapprompts']);
    const localSnippets = localResult.Snapprompts;
    if (localSnippets && localSnippets.length > 0) {
      console.log(`Found ${localSnippets.length} snippets in local storage`);
      allSnippets = [...allSnippets, ...localSnippets];
      foundInLocal = true;
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

// Helper function to validate and clean snippets
function validateAndCleanSnippets(snippets) {
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
        snippet.id = generateId();
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
      console.log(`Keeping unique snippet: "${snippet.label}"`);
    } else {
      console.log(`Removing duplicate snippet: "${snippet.label}"`);
    }
  }

  console.log(`Deduplication: ${cleanedSnippets.length} snippets -> ${uniqueSnippets.length} unique snippets`);
  return uniqueSnippets;
}

// Helper function to generate IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Handle context menu clicks with improved error handling and retry logic
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_IDS.CONFIGURE) {
      try {
        await chrome.action.openPopup();
      } catch (error) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        });
      }
      return;
    }

    // Handle "Save in SnapPrompt" text capture
    if (info.menuItemId === MENU_IDS.SAVE_SELECTED) {
      await handleTextCapture(info, tab);
      return;
    }

    // Handle snippet insertion
    if (info.menuItemId.startsWith(MENU_IDS.SNIPPET_PREFIX)) {
      const snippetIndex = parseInt(info.menuItemId.replace(MENU_IDS.SNIPPET_PREFIX, ''));

      // Get Snapprompts from storage
      const result = await chrome.storage.sync.get(['Snapprompts']);
      const Snapprompts = result.Snapprompts || [];
      const validSnapprompts = Snapprompts
        .filter(Snapprompt => Snapprompt && Snapprompt.label && Snapprompt.text);

      const Snapprompt = validSnapprompts[snippetIndex];
      if (Snapprompt) {
        const success = await insertSnippetWithRetry(tab.id, Snapprompt, info.frameId);

        // Track analytics
        if (analytics) {
          await analytics.trackSnippetInserted('context_menu', snippetIndex + 1, success);
        }
      } else {
        console.warn('No valid Snapprompt found for context menu index:', snippetIndex);
        if (analytics) {
          await analytics.trackInsertionFailed('context_menu', 'No valid snippet found');
        }
      }
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
    if (analytics) {
      await analytics.trackInsertionFailed('context_menu', error.message);
    }
  }
});

// Handle text capture from context menu
async function handleTextCapture(info, tab) {
  try {
    console.log('Text capture initiated');

    // Get selected text
    let selectedText = info.selectionText || '';

    // If no text selected, show error
    if (!selectedText || selectedText.trim().length === 0) {
      console.log('No text selected');

      await chrome.storage.local.set({
        captureError: 'No text is selected',
        captureTimestamp: Date.now()
      });

      // Open popup to show the error
      try {
        await chrome.action.openPopup();
      } catch (error) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        });
      }

      // Track analytics
      if (analytics) {
        await analytics.trackTextCaptured(false, 0);
      }

      return;
    }

    // Check if user already has maximum snippets
    const result = await chrome.storage.sync.get(['Snapprompts']);
    const Snapprompts = result.Snapprompts || [];

    if (Snapprompts.length >= 10) {
      console.log('Maximum snippets reached');

      await chrome.storage.local.set({
        captureError: 'Maximum of 10 Snapprompts reached. Delete a snippet to add new one.',
        captureTimestamp: Date.now()
      });

      // Open popup to show the error
      try {
        await chrome.action.openPopup();
      } catch (error) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        });
      }

      // Track analytics
      if (analytics) {
        await analytics.trackTextCaptured(false, selectedText.length);
      }

      return;
    }

    // Clean up selected text (trim, normalize whitespace)
    selectedText = selectedText.trim().replace(/\s+/g, ' ');

    console.log(`Captured text (${selectedText.length} chars):`, selectedText.substring(0, 100) + '...');

    // Store captured text temporarily
    await chrome.storage.local.set({
      capturedText: selectedText,
      captureTimestamp: Date.now(),
      captureError: null // Clear any previous errors
    });

    // Open popup with captured text
    try {
      await chrome.action.openPopup();
    } catch (error) {
      // Fallback: open in new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup.html')
      });
    }

    console.log('Popup opened with captured text');

    // Track analytics
    if (analytics) {
      await analytics.trackTextCaptured(true, selectedText.length);
    }

  } catch (error) {
    console.error('Error capturing text:', error);

    // Store error message
    await chrome.storage.local.set({
      captureError: 'Failed to capture text: ' + error.message,
      captureTimestamp: Date.now()
    });

    // Track analytics
    if (analytics) {
      await analytics.trackTextCaptured(false, 0);
    }
  }
}

// Simplified snippet insertion - rely on manifest-injected content script
async function insertSnippetWithRetry(tabId, Snapprompt, frameId = 0, maxRetries = 2) {
  console.log(`[insertSnippetWithRetry] Attempting to send message to tabId: ${tabId}, frameId: ${frameId}`);
  if (!tabId) {
    console.error('[insertSnippetWithRetry] Invalid tabId received.');
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const messagePayload = {
        action: 'insertText',
        text: Snapprompt.text,
        elementInfo: {
          frameId: frameId || 0
        }
      };
      console.log(`[insertSnippetWithRetry] Sending message (attempt ${attempt}):`, messagePayload, `to tabId: ${tabId}, frameId: ${frameId}`);
      
      const response = await chrome.tabs.sendMessage(tabId, messagePayload, { frameId: frameId });
      
      console.log('[insertSnippetWithRetry] Message sent, response received:', response);
      
      if (response && response.success) {
        console.log('[insertSnippetWithRetry] Successfully inserted Snapprompt.');
        return true;
      } else {
        console.warn(`[insertSnippetWithRetry] Attempt ${attempt} failed, response:`, response);
        if (attempt === maxRetries) {
          console.error('[insertSnippetWithRetry] All attempts failed to insert Snapprompt.');
          return false;
        }
      }
      
    } catch (error) {
      console.error(`[insertSnippetWithRetry] Error during message sending (attempt ${attempt}):`, error);
      
      if (error.message.includes('Could not establish connection') && attempt < maxRetries) {
        console.log('[insertSnippetWithRetry] Content script might not be ready, waiting and retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      if (attempt === maxRetries) {
        console.error('[insertSnippetWithRetry] All attempts failed with errors.');
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSnapprompts') {
    chrome.storage.sync.get(['Snapprompts']).then(result => {
      sendResponse(result.Snapprompts || []);
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'getWhatsNew') {
    chrome.storage.local.get(['lastSeenVersion', 'whatsNewDismissed']).then(result => {
      sendResponse({
        lastSeenVersion: result.lastSeenVersion || '0.0.0',
        whatsNewDismissed: result.whatsNewDismissed || false
      });
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'dismissWhatsNew') {
    chrome.storage.local.set({
      whatsNewDismissed: true,
      lastSeenVersion: chrome.runtime.getManifest().version
    }).then(() => {
      sendResponse({ success: true });
    });
    return true; // Will respond asynchronously
  }
});

// Handle installation notification
async function handleInstallNotification() {
  try {
    await chrome.storage.local.set({
      lastSeenVersion: '0.0.0',
      whatsNewDismissed: false
    });
    console.log('First install - notification system initialized');
  } catch (error) {
    console.error('Error setting up install notification:', error);
  }
}

// Handle update notifications
async function handleUpdateNotification(previousVersion) {
  try {
    const currentVersion = chrome.runtime.getManifest().version;

    console.log(`Extension updated from ${previousVersion || 'unknown'} to ${currentVersion}`);

    // Store the last seen version and reset the dismissed flag
    await chrome.storage.local.set({
      lastSeenVersion: previousVersion || '0.0.0',
      whatsNewDismissed: false
    });

    console.log('Update notification flag set - user will see What\'s New on next popup open');
  } catch (error) {
    console.error('Error setting up update notification:', error);
  }
}