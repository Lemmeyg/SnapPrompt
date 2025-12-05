// Content script for Pocket Prompt Chrome Extension

// Prevent multiple initialization
if (window.pocketPromptInitialized) {
  // console.log('Pocket Prompt already initialized, skipping...'); // Removed for brevity
} else {
  window.pocketPromptInitialized = true;

  // Store the last focused element for text insertion
  let lastFocusedElement = null;
  let lastCursorPosition = null;
  let contextMenuTarget = null;

  // Enhanced event listeners for better element tracking
  document.addEventListener('focusin', (event) => {
    if (isTextEnabledElement(event.target)) {
      // console.log('Element focused:', event.target.tagName, event.target.type, event.target); // Removed for brevity
      lastFocusedElement = event.target;
      updateCursorPosition(event.target);
    }
  });

  document.addEventListener('click', (event) => {
    if (isTextEnabledElement(event.target)) {
      // console.log('Text element clicked:', event.target.tagName, event.target.type); // Removed for brevity
      lastFocusedElement = event.target;
      setTimeout(() => updateCursorPosition(event.target), 10);
    }
  });

  // IMPORTANT: Track right-click context menu target
  document.addEventListener('contextmenu', (event) => {
    if (isTextEnabledElement(event.target)) {
      // console.log('Context menu opened on text element:', event.target.tagName, event.target.type); // Removed for brevity
      contextMenuTarget = event.target;
      lastFocusedElement = event.target;
      // Focus the element when context menu is opened
      setTimeout(() => {
        event.target.focus();
        updateCursorPosition(event.target);
      }, 10);
    }
  });

  document.addEventListener('keyup', (event) => {
    if (isTextEnabledElement(event.target)) {
      lastFocusedElement = event.target;
      updateCursorPosition(event.target);
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (isTextEnabledElement(event.target)) {
      lastFocusedElement = event.target;
      setTimeout(() => updateCursorPosition(event.target), 10);
    }
  });

  // Store cursor position for the current element
  function updateCursorPosition(element) {
    try {
      if (element.selectionStart !== undefined) {
        lastCursorPosition = element.selectionStart;
        // console.log('Updated cursor position:', lastCursorPosition); // Removed for brevity
      } else if (element.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          lastCursorPosition = range.startOffset;
          // console.log('Updated contenteditable cursor position:', lastCursorPosition); // Removed for brevity
        }
      }
    } catch (error) {
      console.warn('Could not get cursor position:', error);
      lastCursorPosition = null;
    }
  }

  // Enhanced function to check if element can accept text input
  function isTextEnabledElement(element) {
    if (!element) return false;
    
    // Check if element is disabled or readonly
    if (element.disabled || element.readOnly) return false;
    
    // Check for input elements
    if (element.tagName === 'INPUT') {
      const type = (element.type || 'text').toLowerCase();
      const textInputTypes = [
        'text', 'email', 'password', 'search', 'tel', 'url', 'number'
      ];
      return textInputTypes.includes(type);
    }
    
    // Check for textarea
    if (element.tagName === 'TEXTAREA') return true;
    
    // Check for contenteditable elements
    if (element.contentEditable === 'true' || element.isContentEditable) return true;
    
    // Check for elements with textbox role
    if (element.getAttribute('role') === 'textbox') return true;
    
    return false;
  }

  // Improved text insertion function with multiple fallback methods
  function insertTextAtCursor(element, text) {
    try {
      if (!element || !text) {
        console.error('Invalid element or text for insertion');
        return false;
      }
      
      // console.log('Attempting to insert text into:', element.tagName, element.type || 'N/A'); // Removed for brevity
      
      // Ensure element is focused
      element.focus();
      
      // Method 1: Try execCommand first (works well with many frameworks)
      if (document.execCommand) {
        try {
          // Clear any selection first
          if (element.selectionStart !== undefined) {
            element.setSelectionRange(element.selectionStart, element.selectionEnd);
          }
          
          const success = document.execCommand('insertText', false, text);
          if (success) {
            // console.log('Successfully inserted text using execCommand'); // Removed for brevity
            triggerInputEvents(element);
            return true;
          }
        } catch (error) {
          // console.log('execCommand failed, trying manual insertion:', error.message); // Removed for brevity
        }
      }
      
      // Method 2: Manual insertion for input/textarea
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return insertIntoInputElement(element, text);
      }
      
      // Method 3: ContentEditable elements
      if (element.isContentEditable || element.contentEditable === 'true') {
        return insertIntoContentEditable(element, text);
      }
      
      return false;
      
    } catch (error) {
      console.error('Error inserting text:', error);
      return false;
    }
  }

  function insertIntoInputElement(element, text) {
    try {
      const currentValue = element.value || '';
      let startPos = element.selectionStart || 0;
      let endPos = element.selectionEnd || 0;
      
      // Use stored cursor position if available and valid
      if (lastCursorPosition !== null && lastCursorPosition >= 0 && lastCursorPosition <= currentValue.length) {
        startPos = endPos = lastCursorPosition;
      }
      
      const beforeText = currentValue.substring(0, startPos);
      const afterText = currentValue.substring(endPos);
      
      element.value = beforeText + text + afterText;
      
      // Set cursor position after inserted text
      const newPos = startPos + text.length;
      element.setSelectionRange(newPos, newPos);
      
      triggerInputEvents(element);
      // console.log('Successfully inserted text into input/textarea'); // Removed for brevity
      return true;
      
    } catch (error) {
      console.error('Error inserting into input element:', error);
      return false;
    }
  }

  function insertIntoContentEditable(element, text) {
    try {
      element.focus();
      
      const selection = window.getSelection();
      let range;
      
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
      }
      
      // Delete any selected content
      range.deleteContents();
      
      // Insert text as text node
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      triggerInputEvents(element);
      // console.log('Successfully inserted text into contenteditable'); // Removed for brevity
      return true;
      
    } catch (error) {
      console.error('Error inserting into contenteditable:', error);
      return false;
    }
  }

  function triggerInputEvents(element) {
    // Trigger multiple events that frameworks might be listening for
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
    ];
    
    events.forEach(event => {
      try {
        element.dispatchEvent(event);
      } catch (error) {
        console.warn('Failed to dispatch event:', event.type, error);
      }
    });
  }

  // Improved function to find the best target element
  function findBestTargetElement() {
    // console.log('Finding best target element...'); // Removed for brevity
    
    // Priority 1: Context menu target (most recent right-click)
    if (contextMenuTarget && isTextEnabledElement(contextMenuTarget) && isElementVisible(contextMenuTarget)) {
      // console.log('Using context menu target:', contextMenuTarget.tagName); // Removed for brevity
      return contextMenuTarget;
    }
    
    // Priority 2: Last focused element
    if (lastFocusedElement && isTextEnabledElement(lastFocusedElement) && isElementVisible(lastFocusedElement)) {
      // console.log('Using last focused element:', lastFocusedElement.tagName); // Removed for brevity
      return lastFocusedElement;
    }
    
    // Priority 3: Currently active element
    if (document.activeElement && isTextEnabledElement(document.activeElement)) {
      // console.log('Using active element:', document.activeElement.tagName); // Removed for brevity
      return document.activeElement;
    }
    
    // Priority 4: Look for any focused element
    const focusedElement = document.querySelector('input:focus, textarea:focus, [contenteditable="true"]:focus');
    if (focusedElement && isTextEnabledElement(focusedElement)) {
      // console.log('Found focused element:', focusedElement.tagName); // Removed for brevity
      return focusedElement;
    }
    
    // Priority 5: Find the most likely candidate (visible text inputs)
    const candidates = document.querySelectorAll(`
      input[type="text"]:not([disabled]):not([readonly]), 
      input[type="email"]:not([disabled]):not([readonly]), 
      input[type="search"]:not([disabled]):not([readonly]), 
      input[type="password"]:not([disabled]):not([readonly]), 
      input[type="tel"]:not([disabled]):not([readonly]), 
      input[type="url"]:not([disabled]):not([readonly]), 
      input[type="number"]:not([disabled]):not([readonly]), 
      textarea:not([disabled]):not([readonly]), 
      [contenteditable="true"]
    `);
    
    for (const candidate of candidates) {
      if (isElementVisible(candidate)) {
        // console.log('Found visible candidate:', candidate.tagName); // Removed for brevity
        return candidate;
      }
    }
    
    console.warn('No suitable target element found');
    return null;
  }

  function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetParent !== null &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  // Enhanced message listener with better error handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log('Content script received message:', request.action, 'from sender:', sender); // Removed for brevity

    // Respond to ping to confirm content script is loaded
    if (request.action === 'ping') {
      sendResponse({ success: true, ready: true });
      return true;
    }

    if (request.action === 'insertText') {
      // console.log('Attempting to insert text:', request.text); // Removed for brevity
      try {
        const targetElement = findBestTargetElement();
        // console.log('Target element found:', targetElement); // Removed for brevity
        
        if (targetElement && isTextEnabledElement(targetElement)) {
          // console.log('Inserting text into:', targetElement.tagName, targetElement.type || 'N/A'); // Removed for brevity
          const success = insertTextAtCursor(targetElement, request.text);
          // console.log('Text insertion success:', success); // Removed for brevity
          
          // Clear context menu target after use
          if (success) {
            contextMenuTarget = null;
          }
          
          sendResponse({ 
            success, 
            target: targetElement.tagName,
            elementType: targetElement.type || 'N/A'
          });
        } else {
          console.warn('No suitable text element found for insertion. Debug info:', {
            contextMenuTarget: contextMenuTarget ? contextMenuTarget.tagName : 'none',
            lastFocused: lastFocusedElement ? lastFocusedElement.tagName : 'none',
            activeElement: document.activeElement ? document.activeElement.tagName : 'none',
            isTextEnabled: targetElement ? isTextEnabledElement(targetElement) : 'N/A',
            isVisible: targetElement ? isElementVisible(targetElement) : 'N/A'
          });
          sendResponse({ 
            success: false, 
            error: 'No suitable text element found',
            debug: {
              contextMenuTarget: contextMenuTarget ? contextMenuTarget.tagName : 'none',
              lastFocused: lastFocusedElement ? lastFocusedElement.tagName : 'none',
              activeElement: document.activeElement ? document.activeElement.tagName : 'none',
              isTextEnabled: targetElement ? isTextEnabledElement(targetElement) : 'N/A',
              isVisible: targetElement ? isElementVisible(targetElement) : 'N/A'
            }
          });
        }
      } catch (error) {
        console.error('Error handling insert text message:', error);
        sendResponse({ success: false, error: error.message });
      }
      
      return true; // Will respond asynchronously
    }
    
    return true;
  });
}