// Temporary script to manually reset "What's New" state
// Run this in the service worker console (background.js) to reset the banner

(async () => {
  // First, let's see what's currently stored
  const current = await chrome.storage.local.get(['whatsNewDismissed', 'lastSeenVersion']);
  console.log('Current storage state:', current);

  // Now set the correct values
  await chrome.storage.local.set({
    whatsNewDismissed: true,
    lastSeenVersion: '1.4.0'
  });

  // Verify it was set
  const updated = await chrome.storage.local.get(['whatsNewDismissed', 'lastSeenVersion']);
  console.log('Updated storage state:', updated);
  console.log('Banner should not show on next popup open');
})();
