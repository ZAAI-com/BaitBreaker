# Testing BaitBreaker Extension on news.html

## Expected Results

The extension should detect **3 clickbait headlines** in `Clickbait-Examples/news.html`:

1. ✓ "This Simple Habit Will Change Your Life Forever!" (line 22)
2. ✓ "You Won't Believe What This Celebrity Did at the Gala" (line 26)
3. ✓ "Doctors Are Stunned by This One Food That Burns Fat" (line 29)

Each detected headline should display a **[B]** badge next to it.

---

## Prerequisites

### 1. Chrome Version & AI APIs
- **Chrome 127+** (Chrome Canary or Dev channel recommended)
- Enable flags at `chrome://flags/`:
  - `#optimization-guide-on-device-model` → **Enabled**
  - `#prompt-api-for-gemini-nano` → **Enabled**
  - `#summarization-api-for-gemini-nano` → **Enabled**
- **Restart Chrome** after enabling flags

### 2. Load Extension
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select: `/Users/m/Manuel-Sun/Development/Github/ZAAI-com/BaitBreaker/dist/`
5. Verify "BaitBreaker" appears with no errors

### 3. Enable Local File Access
**CRITICAL**: By default, Chrome extensions don't run on `file://` URLs.

1. Go to `chrome://extensions/`
2. Find "BaitBreaker" extension
3. Click **Details**
4. Scroll down and toggle **"Allow access to file URLs"** to ON

---

## Test Procedure

### Step 1: Open the Test File
```bash
# Open news.html in Chrome
open -a "Google Chrome" /Users/m/Manuel-Sun/Development/Github/ZAAI-com/BaitBreaker/Clickbait-Examples/news.html
```

Or manually:
- File → Open File → Navigate to `Clickbait-Examples/news.html`

### Step 2: Wait for AI Initialization
- Open Chrome DevTools (F12 or Cmd+Option+I)
- Go to the **Console** tab
- Look for: `"BB Background Service initialized"`
- This may take 30-60 seconds on first run (AI model downloads)

### Step 3: Check for [B] Badges
The extension should add **[B]** badges next to these headlines:
- "This Simple Habit Will Change Your Life Forever!" [B]
- "You Won't Believe What This Celebrity Did at the Gala" [B]
- "Doctors Are Stunned by This One Food That Burns Fat" [B]

### Step 4: Test Hover Functionality
1. Hover over a **[B]** badge
2. A tooltip should appear with:
   - "Analyzing article..." (loading state)
   - Then show a summary of the article content
   - Display confidence percentage

---

## Troubleshooting

### Issue: No [B] badges appear

**Check 1: Console Errors**
```javascript
// Open DevTools → Console
// Look for errors like:
// - "Chrome AI APIs not available"
// - "Prompt API unavailable on this device"
```

**Check 2: Service Worker**
1. Go to `chrome://extensions/`
2. Find "BaitBreaker"
3. Click **"Inspect views: service worker"**
4. Check console for initialization errors

**Check 3: Content Script Running**
```javascript
// In the page's DevTools console, check:
console.log(document.querySelector('.bb-indicator'));
// Should show elements or null if not processed yet
```

### Issue: AI model not downloading

**Solution**: The Gemini Nano model may need to download first
- Check service worker console for download progress
- May require 100MB+ download on first run
- Requires stable internet connection

### Issue: Extension doesn't run on local file

**Solution**: Enable file URL access (see Prerequisites #3)

### Issue: Only 1 or 2 headlines detected

**Possible reasons**:
1. AI model variance (confidence threshold)
2. Check service worker console for classification results
3. Cache may have incorrect results - clear cache:
   ```javascript
   // In service worker console:
   chrome.storage.local.clear()
   ```

---

## Debugging Commands

### Check if extension is active:
```javascript
// In page console:
console.log(chrome.runtime.getURL('/'));
// Should show: chrome-extension://<id>/
```

### Force rescan:
```javascript
// Reload the page:
location.reload();
```

### Check cached classifications:
```javascript
// In service worker console:
chrome.storage.local.get(null, (data) => console.log(data));
```

---

## Expected Behavior by Headline

| Headline | Clickbait? | Reason |
|----------|------------|--------|
| This Simple Habit Will Change Your Life Forever! | ✅ YES | Curiosity gap, emotional trigger |
| Scientists Announce Breakthrough in Renewable Energy | ❌ NO | Clear, factual |
| Local Team Wins Championship After Dramatic Finale | ❌ NO | Clear, factual |
| Global Markets Rally After Economic Report | ❌ NO | Clear, factual |
| You Won't Believe What This Celebrity Did at the Gala | ✅ YES | Classic curiosity gap |
| New Wildlife Sanctuary Opens to the Public | ❌ NO | Clear, factual |
| Art Exhibit Features Rising Young Talents | ❌ NO | Clear, factual |
| Doctors Are Stunned by This One Food That Burns Fat | ✅ YES | Sensational medical claim |
| Tech Conference Highlights: The Future of AI | ❌ NO | Clear, informative |
| City Expands Bike Lane Network for Cyclists | ❌ NO | Clear, factual |

---

## Notes

- **AI Accuracy**: The Chrome built-in AI model determines clickbait based on patterns. Results may vary slightly from the expected 3 headlines depending on model updates.
- **Confidence Threshold**: The extension marks headlines as clickbait if the AI determines they use curiosity gaps, emotional triggers, or withhold key information.
- **First Run**: Expect longer initialization time on first run due to AI model downloads.
- **Local Files**: Remember that production deployments wouldn't need file:// access - this is only for testing with the local HTML file.

---

## Success Criteria

✅ Extension loads without errors
✅ Service worker initializes AI APIs
✅ Content script scans page for links
✅ 3 headlines are marked with [B] badges
✅ Hovering over [B] shows article summaries
✅ No console errors during operation
