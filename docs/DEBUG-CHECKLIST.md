# BaitBreaker Extension - Debugging Checklist

The extension isn't showing [B] badges. Let's debug step by step.

---

## Step 1: Verify Extension is Loaded

1. Open `chrome://extensions/`
2. Find "BaitBreaker"
3. Check:
   - ✅ Extension toggle is ON (blue)
   - ✅ No error messages under the extension name
   - ✅ Version shows "1.0.0"

---

## Step 2: Enable File URL Access (CRITICAL)

This is the most common issue!

1. On `chrome://extensions/` page
2. Find "BaitBreaker"
3. Click **"Details"** button
4. Scroll down to **"Allow access to file URLs"**
5. Make sure toggle is **ON** (blue)

**If this was OFF, turn it ON and reload the news.html page**

---

## Step 3: Check Service Worker Status

### 3a. Open Service Worker DevTools
1. Go to `chrome://extensions/`
2. Find "BaitBreaker"
3. Look for "Inspect views: **service worker**" link
4. Click it - a DevTools window opens

### 3b. Check Console for Errors
In the service worker DevTools console, look for:

**GOOD (should see):**
```
BB Background Service initialized
```

**BAD (errors to look for):**
```
Failed to initialize: Error: Chrome AI APIs not available
```
or
```
Uncaught ReferenceError: LanguageModel is not defined
```

### 3c. Test AI API Availability
In the service worker DevTools console, run:
```javascript
console.log('LanguageModel' in self);
console.log('Summarizer' in self);
```

**Expected:** Both should return `true`
**If false:** AI APIs not available - check Chrome flags (Step 6)

---

## Step 4: Check Content Script is Running

### 4a. Open Page DevTools
On the news.html page:
- Press **F12** or **Cmd+Option+I**
- Go to **Console** tab

### 4b. Test Extension Connection
Run this in the page console:
```javascript
// Check if extension is injected
console.log('Extension loaded:', !!chrome.runtime);
console.log('Extension ID:', chrome.runtime?.id);
```

**Expected:** Should show extension ID
**If undefined:** Content script not injected - check Step 2 (file URL access)

### 4c. Check for Links
Run this in the page console:
```javascript
// Check if links are found
const links = document.querySelectorAll('a[href]');
console.log('Found links:', links.length);
console.log('Link texts:', Array.from(links).map(l => l.textContent));
```

**Expected:** Should show 10 links
**If 0:** Something is wrong with the HTML

### 4d. Check if Content Script Initialized
Run this in the page console:
```javascript
// Check if BBContentManager exists
console.log('BBContentManager running:',
  window.toString().includes('BBContentManager')
);
```

---

## Step 5: Manually Test Message Passing

In the page DevTools console, try to send a message to the background:

```javascript
chrome.runtime.sendMessage(
  { action: 'classifyLinks', links: [
    { text: 'You Won\'t Believe What This Celebrity Did at the Gala', href: 'test.html' }
  ]},
  (response) => {
    console.log('Response:', response);
    console.log('Error:', chrome.runtime.lastError);
  }
);
```

**Expected:** Response should be an array with classification result
**If lastError:** Check what the error says

---

## Step 6: Verify Chrome AI Flags

1. Open `chrome://flags/`
2. Search for: **"optimization guide"**
3. Enable these flags:
   - `#optimization-guide-on-device-model` → **Enabled**
   - `#prompt-api-for-gemini-nano` → **Enabled**
   - `#summarization-api-for-gemini-nano` → **Enabled**
4. Click **"Relaunch"** button at bottom
5. After restart, check service worker console for AI initialization

---

## Step 7: Check Chrome Version

The AI APIs require **Chrome 127+** (preferably Canary/Dev)

1. Go to `chrome://version/`
2. Check the version number at the top
3. If below 127, download Chrome Canary:
   - https://www.google.com/chrome/canary/

---

## Step 8: Force Content Script to Re-scan

If everything above looks good but still no badges:

### In page DevTools console:
```javascript
// Force a reload
location.reload();
```

Or manually trigger a scan:
```javascript
// Check if links are processed
const processed = document.querySelectorAll('.bb-indicator');
console.log('Badges found:', processed.length);
```

---

## Step 9: Check for CSS Issues

The [B] badges might be there but invisible due to CSS:

### In page DevTools console:
```javascript
// Look for badge elements
const badges = document.querySelectorAll('.bb-indicator');
console.log('Badge elements:', badges.length);
badges.forEach((b, i) => {
  console.log(`Badge ${i}:`, {
    text: b.textContent,
    visible: window.getComputedStyle(b).display !== 'none',
    color: window.getComputedStyle(b).color
  });
});
```

---

## Step 10: Check Storage/Cache

The extension might be using cached results:

### In service worker DevTools console:
```javascript
// Clear all cached data
chrome.storage.local.clear(() => {
  console.log('Cache cleared');
});

// Then reload the page
```

---

## Common Issues & Solutions

### Issue 1: "Service worker inactive"
**Solution:** Click the "service worker" link again to wake it up

### Issue 2: "LanguageModel is not defined"
**Solution:**
- AI APIs not available
- Check Chrome version (must be 127+)
- Check flags are enabled
- Try Chrome Canary

### Issue 3: Content script not running on file://
**Solution:** Enable "Allow access to file URLs" in extension details

### Issue 4: No errors but no badges
**Solution:**
- Check service worker is actually initialized
- Try sending test message (Step 5)
- Check if AI model is downloading (may take minutes)

### Issue 5: "Failed to fetch" errors
**Solution:**
- The article files (article1.html, etc.) don't exist
- This is OK - extension should still mark clickbait
- Check service worker console for actual errors

---

## Quick Diagnostic Script

Run this in the **page DevTools console** for a full diagnostic:

```javascript
(async function() {
  console.log('=== BaitBreaker Diagnostic ===');

  // 1. Extension loaded?
  console.log('1. Extension:', chrome.runtime?.id || 'NOT LOADED');

  // 2. Links found?
  const links = document.querySelectorAll('a[href]');
  console.log('2. Links found:', links.length);

  // 3. Badges present?
  const badges = document.querySelectorAll('.bb-indicator');
  console.log('3. Badges present:', badges.length);

  // 4. Test message passing
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'classifyLinks',
      links: [{ text: 'Test clickbait headline', href: 'test.html' }]
    });
    console.log('4. Message passing:', result ? 'WORKING' : 'FAILED');
    console.log('   Response:', result);
  } catch (e) {
    console.log('4. Message passing: ERROR', e);
  }

  console.log('=== End Diagnostic ===');
})();
```

---

## What to Share If Still Not Working

If you've gone through all steps and it's still not working, share:

1. **Chrome version** (from `chrome://version/`)
2. **Service worker console output** (copy all text)
3. **Page console output** (copy all text)
4. **Results of diagnostic script** (from above)
5. **Screenshot of `chrome://extensions/` showing the extension**

This will help identify the exact issue!
