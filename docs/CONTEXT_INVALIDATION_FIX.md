# Context Invalidation Bug Fix

## Bug Summary

**Error**: `Extension context invalidated`

**Location**: [content-script.js:138](../src/content/content-script.js#L138) (previously line 138, now integrated throughout)

**Impact**: Users would see confusing error messages when the extension was reloaded during development or updated in production, breaking all BaitBreaker functionality until page refresh.

## Root Cause Analysis

### What Caused the Bug

The "Extension context invalidated" error occurs when:

1. **Extension Reload**: Developer reloads extension via `chrome://extensions` while pages are still open
2. **Extension Update**: Chrome auto-updates the extension while content scripts are running
3. **Service Worker Termination**: Chrome MV3 service workers can be terminated, invalidating connections
4. **Extension Disabled**: User disables extension while content script is active

### Technical Details

When any of these events occur:
- Old content scripts remain injected in existing pages
- The connection to the background service worker is severed
- `chrome.runtime.id` becomes `undefined`
- Any `chrome.runtime.sendMessage()` calls throw: **"Extension context invalidated"**

### Why It Was a Problem

The original code made three critical runtime message calls without validation:
1. **Line 88**: `classifyLinks` - Used during page scanning to classify headlines
2. **Line 138**: `getSummary` - Called when user hovers over `[B]` badge (reported in bug)
3. **Line 215**: `prefetchSummary` - Background pre-fetching of article summaries

None of these calls checked if the extension context was still valid, resulting in:
- Cryptic error messages in console
- Non-functional UI elements
- Confusing user experience

## The Solution

### 1. Context Validation Utility

Added `isExtensionContextValid()` method:

```javascript
isExtensionContextValid() {
  try {
    // chrome.runtime.id becomes undefined when context is invalidated
    return !!(chrome?.runtime?.id);
  } catch (e) {
    return false;
  }
}
```

**Why this works**: `chrome.runtime.id` is the most reliable indicator of a valid extension context. When the context is invalidated, this property becomes `undefined`.

### 2. Safe Runtime Message Wrapper

Created `safeRuntimeMessage()` to wrap all runtime communications:

```javascript
async safeRuntimeMessage(message) {
  if (!this.isExtensionContextValid()) {
    this.contextInvalidated = true;
    throw new Error('CONTEXT_INVALIDATED');
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      this.contextInvalidated = true;
      throw new Error('CONTEXT_INVALIDATED');
    }
    throw error;
  }
}
```

**Features**:
- Pre-validates context before sending message
- Catches and normalizes "Extension context invalidated" errors
- Sets flag to track invalidation state
- Provides consistent error handling

### 3. User-Friendly Error Handling

Added `handleContextInvalidation()` to show helpful messages:

```javascript
handleContextInvalidation(anchor, linkText) {
  console.warn('BaitBreaker: Extension context invalidated. User needs to refresh page.');

  this.showSummary(anchor,
    '⚠️ Extension was reloaded or updated. Please refresh this page to continue using BaitBreaker.',
    {
      linkText: linkText || 'Action Required',
      domain: 'BaitBreaker Extension'
    }
  );

  this.markBadgesAsInactive();
}
```

**User Experience**:
- Clear, actionable message
- Visual warning emoji
- Explains why extension stopped working
- Tells user exactly what to do (refresh page)

### 4. Visual Feedback

Added `markBadgesAsInactive()` to update UI:

```javascript
markBadgesAsInactive() {
  document.querySelectorAll('.bb-indicator').forEach(badge => {
    badge.style.opacity = '0.5';
    badge.style.cursor = 'not-allowed';
    badge.title = 'Extension needs refresh - please reload this page';
  });
}
```

**Visual Changes**:
- Badges fade to 50% opacity
- Cursor changes to "not-allowed"
- Hover tooltip explains the issue

### 5. Updated All Runtime Calls

Replaced all direct `chrome.runtime.sendMessage()` calls with safe wrapper:

#### processLinks() - Line 159
```javascript
// Before
const results = await chrome.runtime.sendMessage({...});

// After
const results = await this.safeRuntimeMessage({...});

// With error handling
catch (error) {
  if (error.message === 'CONTEXT_INVALIDATED') {
    console.warn('BaitBreaker: Cannot classify links - extension context invalidated');
    this.markBadgesAsInactive();
    return;
  }
  // ... handle other errors
}
```

#### prefetchSummary() - Line 222
```javascript
// Before
const response = await chrome.runtime.sendMessage({...});

// After
const response = await this.safeRuntimeMessage({...});

// With error handling
catch (e) {
  if (e.message === 'CONTEXT_INVALIDATED') {
    this.summaryCache.set(url, '⚠️ Extension was reloaded. Please refresh this page.');
    return;
  }
  // ... handle other errors
}
```

#### attachHoverHandler() - Line 268
```javascript
// Before
const response = await chrome.runtime.sendMessage({...});

// After
const response = await this.safeRuntimeMessage({...});

// With error handling
catch (e) {
  if (e.message === 'CONTEXT_INVALIDATED') {
    this.handleContextInvalidation(indicator, linkText);
    return;
  }
  // ... handle other errors
}
```

## Testing

Created comprehensive test suite: [tests/context-invalidation.test.js](../tests/context-invalidation.test.js)

### Test Coverage

✅ **19 tests passing**, covering:

1. **Context Validation**
   - Valid context detection
   - Invalid context detection (undefined runtime.id)
   - Missing runtime object
   - Exception handling

2. **Safe Message Wrapper**
   - Successful message sending
   - Pre-validation failure
   - Runtime error conversion
   - Other error pass-through

3. **Link Processing**
   - Context invalidation during classification
   - Graceful degradation
   - Badge marking

4. **Summary Fetching**
   - Hover-triggered invalidation
   - Helpful error messages
   - Prefetch handling

5. **Visual Feedback**
   - Multiple badge updates
   - Title updates
   - Style changes

6. **Edge Cases**
   - Multiple rapid calls
   - No badges present
   - Mid-operation reload

### Running Tests

```bash
npm test                 # Run all tests
npm test:watch          # Watch mode
npm test:coverage       # With coverage report
```

## Benefits

### Before Fix
❌ Cryptic error: "Extension context invalidated"
❌ No indication of what went wrong
❌ User confused about how to fix it
❌ Non-functional badges remain visible
❌ Possible crashes from repeated errors

### After Fix
✅ Clear message: "Extension was reloaded. Please refresh this page."
✅ Visual feedback (grayed out badges)
✅ User knows exactly what to do
✅ Graceful degradation, no crashes
✅ Comprehensive test coverage

## Files Modified

1. **[src/content/content-script.js](../src/content/content-script.js)**
   - Added context validation utilities
   - Added safe message wrapper
   - Updated all runtime communication calls
   - Added visual feedback methods
   - Improved error handling

2. **[package.json](../package.json)**
   - Added Jest test framework
   - Added test scripts
   - Configured Jest for Chrome extension testing

3. **[tests/setup.js](../tests/setup.js)** (new)
   - Jest test environment setup
   - Chrome API mocks

4. **[tests/context-invalidation.test.js](../tests/context-invalidation.test.js)** (new)
   - 19 comprehensive test cases
   - Edge case coverage
   - Integration scenarios

## Developer Notes

### When Does This Happen?

**During Development** (Most Common):
- Clicking "Reload" in `chrome://extensions`
- Saving changes with auto-reload enabled
- Testing extension updates

**In Production** (Less Common):
- Chrome auto-updates the extension
- User manually updates extension
- Service worker timeout (rare)

### Best Practices

1. **Always use `safeRuntimeMessage()`** for runtime communication
2. **Check context before operations** that depend on background service
3. **Provide clear user feedback** when context is lost
4. **Test with extension reload** during development
5. **Handle errors gracefully** without breaking page

### Future Improvements

Possible enhancements:
- Auto-reconnect mechanism when context restored
- Browser notification when extension updated
- Automatic page refresh option
- Context validation on timer (proactive checking)

## Related Issues

- Chrome Extension Manifest V3 service worker lifecycle
- Content script persistence after extension reload
- Runtime message channel invalidation

## References

- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Chrome Extension Lifecycle](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Handling Context Invalidation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#host-page-communication)
