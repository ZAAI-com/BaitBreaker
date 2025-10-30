// src/background/service-worker.js
import { AIManager } from './ai-manager.js';
import { CacheManager } from './cache-manager.js';
import { ArticleFetcher } from './article-fetcher.js';
import { regexDetect } from '../content/clickbait-detector.js';
import { TIMEOUT_CONFIG, PERFORMANCE_CONFIG, SENSITIVITY_CONFIG, getClassificationTimeout } from '../../config/config.js';

class BaitBreakerService {
  constructor() {
    this.aiManager = new AIManager();
    this.cacheManager = new CacheManager();
    this.articleFetcher = new ArticleFetcher();
    this.initialized = false;
    this.initError = null;
    this.keepaliveInterval = null;
  }

  // Aggressive keepalive mechanism to prevent service worker from going idle
  // Uses multiple methods and shorter intervals for maximum reliability
  startKeepalive() {
    if (this.keepaliveInterval) return; // Already active

    console.log('BaitBreaker: Starting aggressive keepalive');

    // Ping every 5 seconds during active operations (previously 10s - too slow)
    // Chrome can terminate service workers after 30s, so we need frequent pings
    let pingCount = 0;
    this.keepaliveInterval = setInterval(() => {
      pingCount++;
      console.log(`BaitBreaker: Keepalive ping #${pingCount}`);

      // Use multiple methods to keep worker alive
      chrome.storage.local.get('_keepalive', () => {
        // Method 1: Storage API access
      });

      // Method 2: Check if we can access runtime
      if (chrome.runtime && chrome.runtime.id) {
        // Still alive
      }

      // Method 3: Update timestamp to track last activity
      chrome.storage.local.set({ '_lastKeepalive': Date.now() });
    }, TIMEOUT_CONFIG.KEEPALIVE_INTERVAL); // Keepalive ping interval
  }

  stopKeepalive() {
    console.log('BaitBreaker: Stopping keepalive');
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  async initialize() {
    try {
      console.log('BaitBreaker: Initializing service worker...');
      await this.aiManager.initialize();
      await this.cacheManager.initialize();
      this.initialized = true;
      console.log('BaitBreaker: Service worker initialized successfully');
    } catch (error) {
      this.initError = error;
      console.error('BaitBreaker: Failed to initialize service worker:', error);
      console.error('Error details:', error.message, error.stack);
    }
  }

  async handleMessage(request) {
    console.log('BaitBreaker: Received message:', request.action);

    // Check if service is initialized (allow cache-related actions regardless)
    if (!this.initialized && request.action !== 'clearCache' && request.action !== 'getCacheStats') {
      const errorMsg = this.initError
        ? `Service failed to initialize: ${this.initError.message}`
        : 'Service not initialized. Chrome AI APIs may not be available.';
      console.error('BaitBreaker:', errorMsg);
      return { error: true, message: errorMsg };
    }

    try {
      // Start keepalive for long-running operations
      if (request.action === 'classifyLinks' || request.action === 'getSummary') {
        this.startKeepalive();
      }

      let result;
      switch (request.action) {
        case 'classifyLinks':
          result = await this.classifyMultipleLinksWithTimeout(request.links, request.detectionMode, request.sensitivity);
          break;
        case 'getSummary':
          result = await this.getSummaryWithTimeout(request.url);
          break;
        case 'clearCache':
          result = await this.cacheManager.clearAll();
          break;
        case 'getCacheStats':
          result = await this.cacheManager.getStats();
          break;
        default:
          console.warn('BaitBreaker: Unknown action:', request.action);
          result = { error: true, message: 'Unknown action: ' + request.action };
      }

      // Keepalive will be stopped after sendResponse is called in the message listener
      return result;

    } catch (error) {
      // Keepalive will be stopped after sendResponse is called in the message listener
      console.error('BaitBreaker: Error handling message:', error);
      return { error: true, message: error.message || String(error) };
    }
  }

  // Timeout wrapper for classifyLinks to prevent indefinite hangs
  // Dynamic timeout based on number of links: ~8 seconds per link with concurrency
  async classifyMultipleLinksWithTimeout(links, detectionMode = 'regex', sensitivity = SENSITIVITY_CONFIG.DEFAULT) {
    // Calculate timeout based on config: base + per-link timeout
    const TIMEOUT_MS = getClassificationTimeout(links.length);

    console.log(`BaitBreaker: Setting classification timeout to ${TIMEOUT_MS}ms for ${links.length} links`);

    return Promise.race([
      this.classifyMultipleLinks(links, detectionMode, sensitivity),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Classification timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      )
    ]);
  }

  // Timeout wrapper for getSummary to prevent indefinite hangs
  async getSummaryWithTimeout(url) {
    const TIMEOUT_MS = TIMEOUT_CONFIG.SUMMARY;

    return Promise.race([
      this.getSummaryForUrl(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Summary generation timed out after 30s')), TIMEOUT_MS)
      )
    ]);
  }

  async classifyMultipleLinks(links, detectionMode = 'regex', sensitivity = SENSITIVITY_CONFIG.DEFAULT) {
    console.log(`BaitBreaker: Classifying ${links.length} links (mode=${detectionMode}, sensitivity=${sensitivity})`);

    // Process links in parallel with concurrency limit to improve performance
    // while not overwhelming the AI service
    const CONCURRENT_LIMIT = PERFORMANCE_CONFIG.CONCURRENT_LIMIT;

    const classifyLink = async (link) => {
      try {
        const cached = await this.cacheManager.getClassification(link.text);
        if (cached && detectionMode === 'chrome-ai') {
          console.log('BaitBreaker: Using cached classification for:', link.text.substring(0, 50));
          return cached;
        } else {
          if (detectionMode === 'regex') {
            const result = regexDetect(link.text);
            console.log('BaitBreaker: RegEx result:', result.isClickbait ? 'CLICKBAIT' : 'NOT CLICKBAIT',
                        `(${Math.round((result.confidence || 0) * 100)}%)`);
            return result;
          } else {
            console.log('BaitBreaker: Classifying (AI):', link.text.substring(0, 50));
            const classification = await this.aiManager.classifyClickbait(link.text);
            await this.cacheManager.saveClassification(link.text, classification);
            const threshold = Math.max(1, Math.min(10, Number(sensitivity) || SENSITIVITY_CONFIG.DEFAULT)) / 10;
            const isClickbait = (classification.confidence || 0) >= threshold && !!classification.isClickbait;
            const adjusted = { ...classification, isClickbait };
            console.log('BaitBreaker: AI result:', adjusted.isClickbait ? 'CLICKBAIT' : 'NOT CLICKBAIT',
                        `(${Math.round((adjusted.confidence || 0) * 100)}%)`, `threshold=${Math.round(threshold*100)}%`);
            return adjusted;
          }
        }
      } catch (error) {
        console.error('BaitBreaker: Error classifying link:', error);
        return { isClickbait: false, error: true, errorMessage: error.message };
      }
    };

    // Process in batches to control concurrency
    const results = [];
    for (let i = 0; i < links.length; i += CONCURRENT_LIMIT) {
      const batch = links.slice(i, i + CONCURRENT_LIMIT);
      const batchResults = await Promise.all(batch.map(classifyLink));
      results.push(...batchResults);
    }

    console.log(`BaitBreaker: Classification complete. Found ${results.filter(r => r.isClickbait).length} clickbait links`);
    return results;
  }

  async getSummaryForUrl(url) {
    try {
      const cached = await this.cacheManager.getSummary(url);
      if (cached) return cached;

      const articleContent = await this.articleFetcher.fetchAndParse(url);
      const summary = await this.aiManager.summarizeArticle(articleContent);
      await this.cacheManager.saveSummary(url, summary);
      return summary;
    } catch (error) {
      console.error('Error getting summary:', error);
      return 'Unable to generate summary. ' + error.message;
    }
  }
}

const service = new BaitBreakerService();
service.initialize();

// Service worker lifecycle logging
self.addEventListener('install', (event) => {
  console.log('BaitBreaker: Service worker INSTALLED');
});

self.addEventListener('activate', (event) => {
  console.log('BaitBreaker: Service worker ACTIVATED');
});

// Log when service worker starts (this runs on every wake-up)
console.log('BaitBreaker: Service worker script executed at', new Date().toISOString());

// Ultra-robust message listener with extensive logging and error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BaitBreaker: Message listener triggered for action:', request?.action);

  // Wrapper function to ensure sendResponse is ALWAYS called
  const handleAsync = async () => {
    try {
      console.log('BaitBreaker: Starting handleMessage for:', request?.action);
      const result = await service.handleMessage(request);
      console.log('BaitBreaker: handleMessage completed successfully for:', request?.action);

      // Ensure we always call sendResponse
      if (sendResponse) {
        sendResponse(result);
        console.log('BaitBreaker: sendResponse called with result');
      } else {
        console.error('BaitBreaker: sendResponse is null/undefined!');
      }

      // Stop keepalive after response is sent
      service.stopKeepalive();
    } catch (err) {
      console.error('BaitBreaker: Error in handleAsync:', err);
      console.error('BaitBreaker: Error stack:', err.stack);

      // Always send error response
      const errorResponse = { error: true, message: err.message || String(err) };
      if (sendResponse) {
        sendResponse(errorResponse);
        console.log('BaitBreaker: sendResponse called with error');
      } else {
        console.error('BaitBreaker: Cannot send error - sendResponse is null!');
      }

      // Stop keepalive after error response is sent
      service.stopKeepalive();
    }
  };

  // Execute async handler
  handleAsync();

  // CRITICAL: Return true to keep message channel open
  console.log('BaitBreaker: Returning true to keep channel open');
  return true;
});
