# Configuration Migration Plan

This document outlines all hardcoded values to be moved to `/config/config.js` and their current locations.

## Configuration Values to Add

### 1. Timeout Configuration

#### Classification Timeout
- **Base timeout**: 30000ms (30 seconds)
- **Per-link timeout**: 5000ms (5 seconds per link)
- **Formula**: `Math.max(30000, 30000 + (links.length * 5000))`
- **Locations**:
  - `src/background/service-worker.js:120` - `classifyMultipleLinksWithTimeout()` method

#### Summary Generation Timeout
- **Value**: 30000ms (30 seconds)
- **Locations**:
  - `src/background/service-worker.js:134` - `getSummaryWithTimeout()` method

#### Message/Request Timeout
- **Value**: 45000ms (45 seconds)
- **Locations**:
  - `src/content/content-script.js:53` - `safeRuntimeMessage()` method default parameter

#### Service Worker Keepalive Interval
- **Value**: 5000ms (5 seconds)
- **Locations**:
  - `src/background/service-worker.js:43` - `startKeepalive()` method

### 2. Concurrency & Performance

#### Concurrent Link Processing Limit
- **Value**: 5
- **Locations**:
  - `src/background/service-worker.js:149` - `classifyMultipleLinks()` method as `CONCURRENT_LIMIT`

#### Cache Configuration
- **Max cache size**: 1000 entries
- **Cache duration**: 7 days (7 * 24 * 60 * 60 * 1000ms)
- **Locations**:
  - `src/background/cache-manager.js:4-5` - Constructor: `CACHE_DURATION` and `MAX_CACHE_SIZE`
  - `src/background/cache-manager.js:96` - `enforceMaxSize()` check
  - `src/background/cache-manager.js:100` - `enforceMaxSize()` overflow calculation
  - `src/background/cache-manager.js:110` - Cache expiration check

#### Article Content Length Limit
- **Value**: 10000 characters
- **Locations**:
  - `src/background/article-fetcher.js:71` - `cleanText()` method: `.slice(0, 10000)`

#### Tooltip Summary Length Limit
- **Value**: 1000 characters
- **Locations**:
  - `src/content/content-script.js:558` - Tooltip summary display: `.slice(0, 1000)`

#### Error Queue Max Size
- **Value**: 50
- **Locations**:
  - `src/lib/error-reporter.js:5` - Constructor: `maxQueueSize`
  - `src/lib/error-reporter.js:17` - Queue size check before flush

### 3. Retry Configuration

#### Max Retries
- **Value**: 2
- **Locations**:
  - `src/content/content-script.js:54` - `safeRuntimeMessage()` default parameter
  - `src/content/content-script.js:67` - Retry loop: `for (let attempt = 0; attempt <= maxRetries; attempt++)`
  - `src/content/content-script.js:110, 123` - Retry attempt checks: `if (attempt < maxRetries)`

#### Retry Delay
- **Value**: 1000ms (1 second)
- **Locations**:
  - `src/content/content-script.js:55` - `safeRuntimeMessage()` default parameter
  - `src/content/content-script.js:70` - Retry delay: `await new Promise(resolve => setTimeout(resolve, retryDelay))`

#### Debounce Delay for Link Scanning
- **Value**: 500ms
- **Locations**:
  - `src/content/content-script.js:585` - `setupMutationObserver()`: `setTimeout(..., 500)`

### 4. UI/Update Intervals

#### Metrics Update Interval
- **Value**: 1000ms (1 second)
- **Locations**:
  - `src/popup/popup.js:89` - `setInterval(updateMetrics, 1000)`
  - `src/popup/popup.js:106` - `setInterval(() => { updateMetrics(); updateCacheStats(); }, 1000)`

#### Clear Cache Button Display Timeout
- **Value**: 2000ms (2 seconds)
- **Locations**:
  - `src/popup/popup.js:59-61` - `setTimeout(() => { clearCacheBtn.textContent = 'Clear Cache'; }, 2000)`

### 5. Confidence Calculation Formulas

#### RegEx Confidence Formula
- **Base confidence**: 0.3
- **Per-match multiplier**: 0.15
- **Maximum confidence**: 0.95
- **Formula**: `Math.min(0.3 + matches.length * 0.15, 0.95)`
- **Locations**:
  - `src/content/clickbait-detector.js:34` - `regexDetect()` function

#### Heuristic Confidence Formula
- **Base confidence**: 0.2
- **Per-reason multiplier**: 0.2
- **Maximum confidence**: 0.95
- **Formula**: `Math.min(0.2 + reasons.length * 0.2, 0.95)`
- **Locations**:
  - `src/content/clickbait-detector.js:18` - `heuristicDetect()` function

## Files to Update

### 1. `/config/config.js`
- Add all new configuration sections:
  - `TIMEOUT_CONFIG` - All timeout values
  - `PERFORMANCE_CONFIG` - Concurrency, cache, and size limits
  - `RETRY_CONFIG` - Retry settings
  - `UI_CONFIG` - UI update intervals
  - `CONFIDENCE_CONFIG` - Confidence calculation formulas

### 2. `/src/background/service-worker.js`
- Import timeout and performance configs
- Replace hardcoded values in:
  - `classifyMultipleLinksWithTimeout()` - line 120
  - `getSummaryWithTimeout()` - line 134
  - `startKeepalive()` - line 43
  - `classifyMultipleLinks()` - line 149 (CONCURRENT_LIMIT)

### 3. `/src/background/cache-manager.js`
- Import performance config
- Replace hardcoded values in constructor and methods

### 4. `/src/background/article-fetcher.js`
- Import performance config
- Replace article content length limit - line 71

### 5. `/src/content/content-script.js`
- Import timeout and retry configs
- Replace hardcoded values in:
  - `safeRuntimeMessage()` - lines 53, 54, 55
  - Retry logic - lines 67, 70, 110, 123
  - `setupMutationObserver()` - line 585
  - Tooltip summary length - line 558

### 6. `/src/content/clickbait-detector.js`
- Import confidence config
- Replace confidence calculation formulas - lines 18, 34

### 7. `/src/lib/error-reporter.js`
- Import performance config
- Replace maxQueueSize - line 5

### 8. `/src/popup/popup.js`
- Import UI config
- Replace hardcoded intervals - lines 89, 106
- Replace clear cache timeout - lines 59-61

## Implementation Strategy

1. **Add to config.js**: Create comprehensive configuration objects with all values
2. **Update imports**: Add config imports to all affected files
3. **Replace hardcoded values**: Systematically replace each hardcoded value with config reference
4. **Verify**: Test that all functionality works with centralized config
5. **Build**: Ensure webpack build completes successfully

## Verification Checklist

- [ ] All timeout values moved to config
- [ ] All performance limits moved to config
- [ ] All retry settings moved to config
- [ ] All UI intervals moved to config
- [ ] All confidence formulas moved to config
- [ ] All files import config properly
- [ ] No hardcoded values remain (except CSS transitions and visual values)
- [ ] Webpack build succeeds
- [ ] Extension functionality verified

