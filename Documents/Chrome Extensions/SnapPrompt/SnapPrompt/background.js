// Background script for Pocket Prompt Chrome Extension
console.log('Pocket Prompt background script loaded.');

// Context menu item IDs
const MENU_IDS = {
  CONFIGURE: 'configure-snippets',
  SNIPPET_PREFIX: 'snippet-'
};

// Initialize context menus when extension starts
chrome.runtime.onStartup.addListener(initializeContextMenus);
chrome.runtime.onInstalled.addListener(initializeContextMenus);

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
        // Get the active frame ID to send the message to the correct content script instance
        // This is necessary because content scripts run in each frame, and we need to target the right one.
        await insertSnippetWithRetry(tab.id, Snapprompt, 0); // Send to main frame (frameId: 0) for keyboard shortcuts
      }
    }
  } catch (error) {
    console.error('Error handling keyboard shortcut:', error);
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

// Handle context menu clicks with improved error handling and retry logic
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_IDS.CONFIGURE) {
      // Create a new tab with the extension popup
      try {
        await chrome.action.openPopup();
      } catch (error) {
        // Fallback: open extension in new tab if popup fails
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        });
      }
      return;
    }
    
    // Handle snippet insertion
    if (info.menuItemId.startsWith(MENU_IDS.SNIPPET_PREFIX)) {
      const snippetIndex = parseInt(info.menuItemId.replace(MENU_IDS.SNIPPET_PREFIX, ''));
      
      // Get Snapprompts from storage
      const result = await chrome.storage.sync.get(['Snapprompts']);
      const Snapprompts = result.Snapprompts || [];
      // Do NOT sort Snapprompts here, use original order for context menu to match keyboard shortcut order
      const validSnapprompts = Snapprompts
        .filter(Snapprompt => Snapprompt && Snapprompt.label && Snapprompt.text);
      
      const Snapprompt = validSnapprompts[snippetIndex];
      if (Snapprompt) {
        await insertSnippetWithRetry(tab.id, Snapprompt, info.frameId);
      } else {
        console.warn('No valid Snapprompt found for context menu index:', snippetIndex);
      }
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
});

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
});