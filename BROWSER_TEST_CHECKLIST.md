# Browser Testing Checklist

## ✅ Build Status
- **Build Completed**: ✓ Successfully built extension
- **Build Location**: `./dist/` folder
- **Bundle Files**: 
  - `background.bundle.js` (31.9 KiB)
  - `content.bundle.js` (17.3 KiB)
  - `popup.bundle.js` (13.5 KiB)
- **All Assets**: Icons, CSS, HTML, manifest - all present

## 🚀 Quick Start for Testing

### 1. Load Extension in Chrome
```
1. Open Chrome
2. Navigate to: chrome://extensions/
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select: /Users/m/Manuel-Sun/Development/Github/ZAAI-com/BaitBreaker/dist/
6. Verify extension appears with no errors
```

### 2. Enable Required Flags (for Chrome AI APIs)
```
Navigate to: chrome://flags/

Enable these flags:
✓ #optimization-guide-on-device-model → Enabled
✓ #prompt-api-for-gemini-nano → Enabled  
✓ #summarization-api-for-gemini-nano → Enabled

Then RESTART Chrome completely
```

### 3. Enable File URL Access (for local testing)
```
1. chrome://extensions/ → Find "BaitBreaker"
2. Click "Details"
3. Toggle "Allow access to file URLs" → ON
```

### 4. Test on Local File
```bash
# Option 1: Command line
open -a "Google Chrome" Clickbait-Examples/news.html

# Option 2: File menu
File → Open File → Clickbait-Examples/news.html
```

## 🔍 What to Test

### Core Functionality
- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Content script initializes (check page console)
- [ ] Service worker initializes (check service worker console)
- [ ] Links are scanned on page load
- [ ] Clickbait links show `[B]` badges
- [ ] Hover over `[B]` shows tooltip with summary
- [ ] Summary prefetch works (badge changes color when ready)

### Expected Results on news.html
The extension should detect **3 clickbait headlines**:
1. "This Simple Habit Will Change Your Life Forever!" [B]
2. "You Won't Believe What This Celebrity Did at the Gala" [B]
3. "Doctors Are Stunned by This One Food That Burns Fat" [B]

### Error Handling
- [ ] Context invalidation handled gracefully (if extension reloaded)
- [ ] Timeout errors show helpful messages
- [ ] Service worker failures handled with retry logic
- [ ] Badges gray out appropriately when extension context is invalid

## 🐛 Debugging Tips

### Check Service Worker
```
1. chrome://extensions/ → BaitBreaker → "Inspect views: service worker"
2. Look for:
   - "BaitBreaker: Service worker initialized"
   - "BaitBreaker: Keepalive ping #X"
   - Any error messages
```

### Check Content Script
```
1. Open page DevTools (F12)
2. Console tab
3. Look for:
   - "BaitBreaker: Content script initializing..."
   - "BaitBreaker: Found X links to process"
   - Any error messages
```

### Check Extension State
```javascript
// In page console:
chrome.runtime.sendMessage({action: 'getMetrics'}, (r) => console.log(r));

// Should return:
// {
//   linksProcessed: <number>,
//   clickbaitDetected: <number>,
//   linksDetected: <number>,
//   clickbaitSummarized: <number>
// }
```

## 📝 Common Issues

| Issue | Solution |
|-------|----------|
| No `[B]` badges appear | Check Chrome AI flags enabled, restart Chrome |
| "Extension context invalidated" | Reload page after extension reload |
| "Message channel closed" | Check service worker console, may need to retry |
| AI model not downloading | Check internet, wait for download progress |
| Extension not working on file:// | Enable "Allow access to file URLs" |
| No summaries on hover | Check service worker console for errors |

## 🎯 Success Criteria

✅ Extension loads without errors  
✅ Service worker initializes AI APIs  
✅ Content script scans page successfully  
✅ Clickbait detection works (3 badges on news.html)  
✅ Hover tooltips show summaries  
✅ Error handling works gracefully  
✅ No console errors during normal operation  

## 📍 Test Files Location

- **Test HTML**: `Clickbait-Examples/news.html`
- **Extension Build**: `dist/` folder
- **Documentation**: `docs/TEST-INSTRUCTIONS.md`

---
**Ready for testing!** 🚀

