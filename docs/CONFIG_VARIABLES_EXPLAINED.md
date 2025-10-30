# Config Variables Documentation

This document explains every variable in `config/config.js` and shows which files use them and why.

## Variable Explanations

### 1. DETECTION_MODES
**Type:** Object (constant)  
**Value:** `{ REGEX: 'regex', CHROME_AI: 'chrome-ai' }`  
**Purpose:** Defines the available detection modes for clickbait detection. Currently supports two modes:
- `REGEX`: Pattern-based detection using regular expressions
- `CHROME_AI`: AI-powered detection using Chrome's built-in AI capabilities

**Used By:** Currently not directly used in the codebase (may be reserved for future use)

---

### 2. DEFAULT_DETECTION_MODE
**Type:** String (constant)  
**Value:** `'regex'` (from `DETECTION_MODES.REGEX`)  
**Purpose:** The default detection mode used when a user hasn't explicitly set a preference. This ensures the extension always has a valid detection method.

**Used By:**
- `src/lib/settings-manager.js`: Sets the default value in `SettingsManager.DEFAULTS.detectionMode` when initializing user settings

---

### 3. REGEX_PATTERNS
**Type:** Array of strings  
**Value:** Array containing 7 regex pattern strings for detecting clickbait phrases  
**Purpose:** Contains raw regex pattern strings that are compiled into RegExp objects at runtime. These patterns detect common clickbait phrases like:
- "you won't believe", "shocking", "secret"
- List formats ("10 ways", "top 5")
- Question-based headlines
- Emotional language ("unbelievable", "mind-blowing")
- Curiosity gaps ("this one trick", "doctors hate")

**Used By:**
- `config/config.js`: Compiled by `getCompiledRegexPatterns()` function

---

### 4. SENSITIVITY_CONFIG
**Type:** Object (constant)  
**Value:** 
```javascript
{
  MIN: 1,
  MAX: 10,
  DEFAULT: 5
}
```
**Purpose:** Configures the sensitivity threshold for AI-based clickbait detection. Higher values mean stricter detection (more items flagged as clickbait).

**Used By:**
- `src/lib/settings-manager.js`: Sets default sensitivity in `SettingsManager.DEFAULTS.sensitivity`
- `src/content/content-script.js`: Uses `SENSITIVITY_CONFIG.DEFAULT` as fallback when loading settings and creating settings objects
- `src/background/service-worker.js`: Uses `SENSITIVITY_CONFIG.DEFAULT` to normalize user-provided sensitivity values and calculate threshold

---

### 5. TIMEOUT_CONFIG
**Type:** Object (constant)  
**Value:**
```javascript
{
  CLASSIFICATION_BASE: 30000,        // 30 seconds
  CLASSIFICATION_PER_LINK: 5000,     // 5 seconds per link
  SUMMARY: 30000,                    // 30 seconds
  MESSAGE: 45000,                    // 45 seconds
  KEEPALIVE_INTERVAL: 5000           // 5 seconds
}
```
**Purpose:** Centralizes all timeout values used throughout the extension to prevent service worker timeouts and handle long-running operations.

**Used By:**
- `src/background/service-worker.js`: 
  - `KEEPALIVE_INTERVAL`: Interval for keepalive pings to prevent service worker from going idle
  - `SUMMARY`: Timeout for article fetching and summarization operations
- `src/content/content-script.js`: 
  - `MESSAGE`: Timeout for message channel requests to background script
- `config/config.js`: Used by `getClassificationTimeout()` function

---

### 6. PERFORMANCE_CONFIG
**Type:** Object (constant)  
**Value:**
```javascript
{
  CONCURRENT_LIMIT: 5,
  CACHE: {
    MAX_SIZE: 1000,
    DURATION_DAYS: 7
  },
  ARTICLE_LENGTH_LIMIT: 10000,
  TOOLTIP_SUMMARY_LIMIT: 1000,
  ERROR_QUEUE_MAX_SIZE: 50
}
```
**Purpose:** Controls performance-related settings including concurrency limits, cache configuration, and content size limits to optimize extension performance and memory usage.

**Used By:**
- `src/background/service-worker.js`: 
  - `CONCURRENT_LIMIT`: Limits how many links can be processed simultaneously
- `src/background/cache-manager.js`: 
  - `CACHE.MAX_SIZE`: Maximum number of cache entries to store
  - `CACHE.DURATION_DAYS`: Used by `getCacheDurationMs()` to calculate cache TTL
- `src/background/article-fetcher.js`: 
  - `ARTICLE_LENGTH_LIMIT`: Truncates article content before sending to AI to limit processing cost/time
- `src/content/content-script.js`: 
  - `TOOLTIP_SUMMARY_LIMIT`: Limits tooltip summary text length for UI display
- `src/lib/error-reporter.js`: 
  - `ERROR_QUEUE_MAX_SIZE`: Maximum size of error queue to prevent memory bloat

---

### 7. RETRY_CONFIG
**Type:** Object (constant)  
**Value:**
```javascript
{
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,      // 1 second
  DEBOUNCE_DELAY: 500     // 0.5 seconds
}
```
**Purpose:** Configures retry logic and debouncing to handle transient failures and prevent excessive API calls.

**Used By:**
- `src/content/content-script.js`: 
  - `MAX_RETRIES`: Maximum number of retry attempts for failed requests
  - `RETRY_DELAY`: Delay between retry attempts
  - `DEBOUNCE_DELAY`: Delay for debouncing link scanning operations to avoid rapid-fire requests

---

### 8. UI_CONFIG
**Type:** Object (constant)  
**Value:**
```javascript
{
  METRICS_UPDATE_INTERVAL: 1000,     // 1 second
  CLEAR_CACHE_TIMEOUT: 2000           // 2 seconds
}
```
**Purpose:** Controls UI update frequencies and display timeouts for the popup interface.

**Used By:**
- `src/popup/popup.js`: 
  - `METRICS_UPDATE_INTERVAL`: Interval for updating metrics display (clickbait count, cache size, etc.)
  - `CLEAR_CACHE_TIMEOUT`: Timeout for displaying success message after cache clearing

---

### 9. CONFIDENCE_CONFIG
**Type:** Object (constant)  
**Value:**
```javascript
{
  REGEX: {
    BASE: 0.3,
    MULTIPLIER: 0.15,
    MAX: 0.95
  },
  HEURISTIC: {
    BASE: 0.2,
    MULTIPLIER: 0.2,
    MAX: 0.95
  }
}
```
**Purpose:** Defines formulas for calculating confidence scores in clickbait detection. Each detection method has a base confidence, multiplier per match/reason, and maximum confidence cap.

**Used By:**
- `src/content/clickbait-detector.js`: 
  - `HEURISTIC`: Used in `heuristicDetect()` to calculate confidence based on number of detected reasons
  - `REGEX`: Used in `regexDetect()` to calculate confidence based on number of regex pattern matches

---

## Helper Functions

### 10. getCompiledRegexPatterns()
**Type:** Function  
**Returns:** `RegExp[]` - Array of compiled RegExp objects  
**Purpose:** Compiles the raw regex pattern strings from `REGEX_PATTERNS` into RegExp objects with case-insensitive flag (`'i'`). This ensures patterns are ready to use and only compiled once when needed.

**Used By:**
- `src/content/clickbait-detector.js`: Called by `getRegexPatterns()` which is used in `regexDetect()` function to get compiled patterns for detection

---

### 11. getClassificationTimeout(linkCount)
**Type:** Function  
**Parameters:** `linkCount` (number) - Number of links to process  
**Returns:** `number` - Timeout in milliseconds  
**Purpose:** Calculates dynamic timeout based on number of links to classify. Formula: `base + (linkCount * per_link_timeout)`, ensuring enough time for larger batches.

**Used By:**
- `src/background/service-worker.js`: Calculates timeout for batch link classification operations to ensure all links are processed before timeout

---

### 12. getCacheDurationMs()
**Type:** Function  
**Returns:** `number` - Cache duration in milliseconds  
**Purpose:** Converts cache duration from days (in `PERFORMANCE_CONFIG.CACHE.DURATION_DAYS`) to milliseconds for use with timestamp comparisons.

**Used By:**
- `src/background/cache-manager.js`: Sets `this.CACHE_DURATION` property to determine when cache entries expire

---

## Usage Table

| Variable/Function | Files Using It | Purpose/Reason |
|------------------|----------------|----------------|
| **DETECTION_MODES** | *None currently* | Reserved for future detection mode selection UI |
| **DEFAULT_DETECTION_MODE** | `src/lib/settings-manager.js` | Initialize default detection mode in user settings when no preference exists |
| **REGEX_PATTERNS** | `config/config.js` (via `getCompiledRegexPatterns()`) | Source data for regex pattern compilation |
| **getCompiledRegexPatterns()** | `src/content/clickbait-detector.js` | Provide compiled regex patterns for clickbait detection in `regexDetect()` |
| **SENSITIVITY_CONFIG** | `src/lib/settings-manager.js`<br>`src/content/content-script.js`<br>`src/background/service-worker.js` | Initialize default sensitivity (5/10)<br>Fallback when loading settings<br>Normalize user input and calculate AI threshold |
| **TIMEOUT_CONFIG.CLASSIFICATION_BASE** | `config/config.js` (via `getClassificationTimeout()`) | Base timeout value for classification operations |
| **TIMEOUT_CONFIG.CLASSIFICATION_PER_LINK** | `config/config.js` (via `getClassificationTimeout()`) | Additional timeout per link in batch |
| **TIMEOUT_CONFIG.SUMMARY** | `src/background/service-worker.js` | Timeout for article fetching and summarization operations |
| **TIMEOUT_CONFIG.MESSAGE** | `src/content/content-script.js` | Timeout for message channel requests to background script |
| **TIMEOUT_CONFIG.KEEPALIVE_INTERVAL** | `src/background/service-worker.js` | Interval for keepalive pings to prevent service worker idle termination |
| **getClassificationTimeout()** | `src/background/service-worker.js` | Calculate dynamic timeout for batch link classification |
| **PERFORMANCE_CONFIG.CONCURRENT_LIMIT** | `src/background/service-worker.js` | Limit concurrent link processing to prevent overload |
| **PERFORMANCE_CONFIG.CACHE.MAX_SIZE** | `src/background/cache-manager.js` | Maximum cache entries to prevent excessive memory usage |
| **PERFORMANCE_CONFIG.CACHE.DURATION_DAYS** | `config/config.js` (via `getCacheDurationMs()`) | Cache TTL in days, converted to milliseconds |
| **PERFORMANCE_CONFIG.ARTICLE_LENGTH_LIMIT** | `src/background/article-fetcher.js` | Truncate article content to limit AI processing cost/time |
| **PERFORMANCE_CONFIG.TOOLTIP_SUMMARY_LIMIT** | `src/content/content-script.js` | Limit tooltip text length for UI display |
| **PERFORMANCE_CONFIG.ERROR_QUEUE_MAX_SIZE** | `src/lib/error-reporter.js` | Maximum error queue size to prevent memory bloat |
| **getCacheDurationMs()** | `src/background/cache-manager.js` | Convert cache duration from days to milliseconds for expiration checks |
| **RETRY_CONFIG.MAX_RETRIES** | `src/content/content-script.js` | Maximum retry attempts for failed requests |
| **RETRY_CONFIG.RETRY_DELAY** | `src/content/content-script.js` | Delay between retry attempts (prevents rapid retries) |
| **RETRY_CONFIG.DEBOUNCE_DELAY** | `src/content/content-script.js` | Debounce delay for link scanning (prevents excessive API calls) |
| **UI_CONFIG.METRICS_UPDATE_INTERVAL** | `src/popup/popup.js` | Update frequency for metrics display in popup |
| **UI_CONFIG.CLEAR_CACHE_TIMEOUT** | `src/popup/popup.js` | Display duration for cache clear success message |
| **CONFIDENCE_CONFIG.HEURISTIC** | `src/content/clickbait-detector.js` | Calculate confidence score in heuristic detection based on number of reasons |
| **CONFIDENCE_CONFIG.REGEX** | `src/content/clickbait-detector.js` | Calculate confidence score in regex detection based on number of pattern matches |

---

## Summary Statistics

- **Total Variables/Constants:** 9
- **Total Functions:** 3
- **Total Files Using Config:** 8
  - `src/background/service-worker.js`
  - `src/background/article-fetcher.js`
  - `src/background/cache-manager.js`
  - `src/content/content-script.js`
  - `src/content/clickbait-detector.js`
  - `src/lib/settings-manager.js`
  - `src/lib/error-reporter.js`
  - `src/popup/popup.js`

---

## Configuration Philosophy

All configuration values are centralized in `config/config.js` to:
1. **Maintainability:** Single source of truth for all settings
2. **Consistency:** Ensures same values are used across the codebase
3. **Tunability:** Easy to adjust performance, timeouts, and behavior without searching multiple files
4. **Type Safety:** Exporting constants prevents typos and ensures valid values

