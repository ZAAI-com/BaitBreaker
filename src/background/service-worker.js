// src/background/service-worker.js
import { AIManager } from './ai-manager.js';
import { CacheManager } from './cache-manager.js';
import { ArticleFetcher } from './article-fetcher.js';

class BaitBreakerService {
  constructor() {
    this.aiManager = new AIManager();
    this.cacheManager = new CacheManager();
    this.articleFetcher = new ArticleFetcher();
    this.initialized = false;
    this.initError = null;
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

  async handleMessage(request, sender, sendResponse) {
    console.log('BaitBreaker: Received message:', request.action);

    // Check if service is initialized
    if (!this.initialized && request.action !== 'clearCache') {
      const errorMsg = this.initError
        ? `Service failed to initialize: ${this.initError.message}`
        : 'Service not initialized. Chrome AI APIs may not be available.';
      console.error('BaitBreaker:', errorMsg);
      return { error: true, message: errorMsg };
    }

    try {
      switch (request.action) {
        case 'classifyLinks':
          return await this.classifyMultipleLinks(request.links);
        case 'getSummary':
          return await this.getSummaryForUrl(request.url);
        case 'clearCache':
          return await this.cacheManager.clearAll();
        default:
          console.warn('BaitBreaker: Unknown action:', request.action);
          return { error: true, message: 'Unknown action: ' + request.action };
      }
    } catch (error) {
      console.error('BaitBreaker: Error handling message:', error);
      return { error: true, message: error.message || String(error) };
    }
  }

  async classifyMultipleLinks(links) {
    console.log(`BaitBreaker: Classifying ${links.length} links`);
    const results = [];

    for (const link of links) {
      try {
        const cached = await this.cacheManager.getClassification(link.text);
        if (cached) {
          console.log('BaitBreaker: Using cached classification for:', link.text.substring(0, 50));
          results.push(cached);
        } else {
          console.log('BaitBreaker: Classifying:', link.text.substring(0, 50));
          const classification = await this.aiManager.classifyClickbait(link.text);
          await this.cacheManager.saveClassification(link.text, classification);
          console.log('BaitBreaker: Result:', classification.isClickbait ? 'CLICKBAIT' : 'NOT CLICKBAIT',
                     `(${Math.round(classification.confidence * 100)}%)`);
          results.push(classification);
        }
      } catch (error) {
        console.error('BaitBreaker: Error classifying link:', error);
        results.push({ isClickbait: false, error: true, errorMessage: error.message });
      }
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async message with proper error handling
  (async () => {
    try {
      const result = await service.handleMessage(request, sender, sendResponse);
      sendResponse(result);
    } catch (err) {
      console.error('BaitBreaker: Uncaught error in message handler:', err);
      sendResponse({ error: true, message: err.message || String(err) });
    }
  })();

  // Return true to indicate we'll send response asynchronously
  return true;
});
