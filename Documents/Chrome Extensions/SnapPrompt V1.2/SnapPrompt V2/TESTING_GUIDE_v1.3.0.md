# SnapPrompt v1.3.0 - Quick Testing Guide

Use this checklist to verify all features work before publishing.

## ⚙️ Setup

1. **Configure Analytics First**
   - [ ] Open `analytics.js`
   - [ ] Replace `G-XXXXXXXXXX` with your GA4 Measurement ID (line 10)
   - [ ] Replace `YOUR_API_SECRET` with your GA4 API Secret (line 11)

2. **Load Extension in Chrome**
   - [ ] Go to `chrome://extensions/`
   - [ ] Enable "Developer mode" (toggle top right)
   - [ ] Click "Load unpacked"
   - [ ] Select folder: `SnapPrompt V2`
   - [ ] Extension should load without errors

---

## 🧪 Feature Testing

### Test 1: Maximum Snippets (10 instead of 5)
- [ ] Open extension popup
- [ ] Counter shows "0/10" (not "0/5")
- [ ] Create 10 snippets successfully
- [ ] Try to create 11th - should show error "Maximum of 10 Snapprompts allowed"
- [ ] Button shows "Maximum reached (10/10)"

### Test 2: Keyboard Shortcut Labels
- [ ] Each snippet shows a keyboard shortcut badge (Alt+1, Alt+2, etc.)
- [ ] Badge appears in top-left corner
- [ ] 10th snippet shows "Alt+0" (not Alt+10)
- [ ] Badges are in alphabetical order by label

### Test 3: Keyboard Shortcuts Work (Alt+1 through Alt+0)
- [ ] Go to any editable webpage (e.g., Google Docs, Gmail compose)
- [ ] Click in text field
- [ ] Press Alt+1 - first snippet (alphabetically) inserts
- [ ] Press Alt+2 - second snippet inserts
- [ ] Press Alt+0 - tenth snippet inserts
- [ ] If you have < 10 snippets, higher shortcuts do nothing (expected)

### Test 4: Copy to Clipboard Button
- [ ] Each snippet shows a blue copy button (📋)
- [ ] Copy button is between edit (✂️) and delete (×) buttons
- [ ] Click copy button
- [ ] See toast: "Copied to clipboard!"
- [ ] Open Notepad/Word and paste (Ctrl+V) - snippet text appears
- [ ] Full text pastes even if snippet display was truncated

### Test 5: Text Capture from Webpage
**Test 5a: Successful capture**
- [ ] Go to any webpage (e.g., Wikipedia)
- [ ] Select some text (highlight it)
- [ ] Right-click selected text
- [ ] See "Save in SnapPrompt" in context menu
- [ ] Click "Save in SnapPrompt"
- [ ] Extension popup opens
- [ ] Text area is pre-filled with selected text
- [ ] Label field is focused and empty
- [ ] See toast: "Text captured! Please provide a label."
- [ ] Type a label and save - works successfully

**Test 5b: No text selected**
- [ ] Right-click without selecting any text
- [ ] Click "Save in SnapPrompt"
- [ ] Popup opens showing error toast: "No text is selected"

**Test 5c: Maximum reached**
- [ ] Create 10 snippets (maximum)
- [ ] Select text on webpage
- [ ] Right-click → "Save in SnapPrompt"
- [ ] See error: "Maximum of 10 Snapprompts reached. Delete a snippet to add new one."

### Test 6: Default Snippets (Fresh Install)
**Note:** You need to test this in a clean Chrome profile or uninstall/reinstall

- [ ] Uninstall extension completely
- [ ] Reload unpacked extension (or install fresh)
- [ ] Open popup
- [ ] See 3 default snippets already created:
  - [ ] "Act as Expert"
  - [ ] "Explain Simply"
  - [ ] "Proofread & Improve"
- [ ] Counter shows "3/10"
- [ ] Can edit default snippets
- [ ] Can delete default snippets

### Test 7: Update Notification (v1.3.0)
**Test from existing v1.2.0 installation:**
- [ ] If updating from v1.2.0, "What's New" banner appears
- [ ] Banner shows "v1.3.0"
- [ ] Lists 5 new features:
  - Copy Button
  - 10 Keyboard Shortcuts
  - Text Capture
  - Starter Snippets
  - Usage Analytics
- [ ] Click × to dismiss - banner disappears
- [ ] Close and reopen popup - banner stays dismissed

**Force notification for testing:**
- [ ] Open popup
- [ ] Open browser console (F12)
- [ ] Run: `chrome.storage.local.set({ lastSeenVersion: '1.2.0', whatsNewDismissed: false })`
- [ ] Close and reopen popup - banner should appear

### Test 8: Analytics (Optional - requires GA setup)
**If you configured GA credentials:**
- [ ] Open Google Analytics Real-Time view
- [ ] Open extension popup - should see `popup_opened` event
- [ ] Create snippet - should see `snippet_created` event
- [ ] Copy snippet - should see `snippet_copied` event
- [ ] Use keyboard shortcut - should see `snippet_inserted` event with `method: keyboard_shortcut`
- [ ] Use context menu - should see `snippet_inserted` event with `method: context_menu`
- [ ] Capture text - should see `text_captured` event

**If GA not configured:**
- [ ] Open browser console (F12)
- [ ] Should see: "Analytics disabled, skipping event: [event_name]"
- [ ] Extension should work normally (analytics failure doesn't break anything)

**Do Not Track test:**
- [ ] Enable Do Not Track in Chrome (Settings → Privacy → Send "Do Not Track")
- [ ] Reload extension
- [ ] Check console - should see: "Analytics disabled: Do Not Track is enabled"

---

## 🔍 Integration Testing

### Test existing features still work:
- [ ] Create new snippet (form validation works)
- [ ] Edit existing snippet
- [ ] Delete snippet
- [ ] Recovery button works (if you have recoverable snippets)
- [ ] Context menu shows all snippets
- [ ] Clicking context menu item inserts snippet
- [ ] Snippets sync across devices (if signed into Chrome)

---

## ✅ Pre-Publishing Checks

- [ ] No errors in browser console
- [ ] All snippets are alphabetically sorted
- [ ] Keyboard shortcuts match alphabetical order
- [ ] Privacy notice visible at bottom: "SnapPrompt collects anonymous usage data..."
- [ ] Counter shows "/10" not "/5"
- [ ] All buttons work (Store Prompt, edit, copy, delete, feedback, recovery)
- [ ] Styles look correct (no visual bugs)
- [ ] Test on multiple websites (Gmail, Google Docs, ChatGPT, Wikipedia)

---

## 🐛 Common Issues & Fixes

**Issue: "Save in SnapPrompt" not in context menu**
- Solution: Right-click must be on selected text or editable field

**Issue: Keyboard shortcuts don't work**
- Solution: Make sure text field is focused first

**Issue: Analytics not tracking**
- Solution: Check GA credentials in analytics.js, verify GA4 property is active

**Issue: Default snippets not created**
- Solution: Only happens on fresh install, not on update

**Issue: Copy button doesn't work**
- Solution: Check browser console for clipboard errors, some sites block clipboard access

---

## 📊 Expected Behavior Summary

| Feature | Expected Result |
|---------|----------------|
| Max snippets | 10 (was 5) |
| Keyboard shortcuts | Alt+1 through Alt+0 |
| Copy button | Blue 📋 between edit and delete |
| Text capture | "Save in SnapPrompt" in right-click menu |
| Default snippets | 3 snippets on fresh install only |
| Analytics | Events logged (if configured) |
| Privacy | Notice at bottom of popup |
| Update notification | Shows v1.3.0 features |

---

## ✨ All Tests Passed?

If all tests pass:
1. Update store description with new features
2. Create screenshots showing new features
3. Package extension (zip folder)
4. Upload to Chrome Web Store
5. Submit for review

**Estimated testing time:** 15-20 minutes

Good luck! 🚀
