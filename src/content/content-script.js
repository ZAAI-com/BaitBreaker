// src/content/content-script.js
// Content scripts run as classic scripts (not modules) per manifest; avoid imports.
// Minimal self-contained implementation using window-scoped helpers.
// Note: Webpack bundles this, so imports are allowed at build time.
import { TIMEOUT_CONFIG, RETRY_CONFIG, PERFORMANCE_CONFIG, SENSITIVITY_CONFIG } from '../../config/config.js';

// Check if chrome extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.error('BaitBreaker: Chrome extension APIs not available. Content script may be running in wrong context.');
  throw new Error('Chrome extension APIs not available');
}

class BBContentManager {
  constructor() {
    this.processedLinks = new Set();
    this.summaryCache = new Map();
    this.summaryLoadingStatus = new Map(); // url -> 'loading' | 'ready' | 'error'
    this.summarizedClickbait = new Set(); // urls with summary ready
    this.observer = null;
    this.tooltip = null;
    this.isScanning = false;
    this.scanTimeout = null;
    this.clickbaitCount = 0;
    this.settings = null;
    this.contextInvalidated = false;
  }

  /**
   * Check if the extension context is still valid.
   * Context becomes invalid when extension is reloaded, updated, or disabled.
   * @returns {boolean} True if context is valid, false otherwise
   */
  isExtensionContextValid() {
    try {
      // chrome.runtime.id becomes undefined when context is invalidated
      return !!(chrome?.runtime?.id);
    } catch (e) {
      return false;
    }
  }

  /**
   * Safely send a message to the background service worker with context validation,
   * timeout handling, and automatic retry.
   * @param {Object} message - The message to send
   * @param {Object} options - Options for retry and timeout
   * @param {number} options.timeout - Timeout in ms (default: 45000)
   * @param {number} options.maxRetries - Max retry attempts (default: 2)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @returns {Promise<any>} Response from service worker
   * @throws {Error} Throws CONTEXT_INVALIDATED, TIMEOUT, or MESSAGE_CHANNEL_CLOSED errors
   */
  async safeRuntimeMessage(message, options = {}) {
    const {
      timeout = TIMEOUT_CONFIG.MESSAGE,      // Message timeout from config
      maxRetries = RETRY_CONFIG.MAX_RETRIES,  // Max retries from config
      retryDelay = RETRY_CONFIG.RETRY_DELAY   // Retry delay from config
    } = options;

    // Validate context before attempting
    if (!this.isExtensionContextValid()) {
      this.contextInvalidated = true;
      throw new Error('CONTEXT_INVALIDATED');
    }

    let lastError = null;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`BaitBreaker: Retry attempt ${attempt}/${maxRetries} for action: ${message.action}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Re-check context before retry
        if (!this.isExtensionContextValid()) {
          this.contextInvalidated = true;
          throw new Error('CONTEXT_INVALIDATED');
        }
      }

      try {
        // Race between the actual message and a timeout
        const response = await Promise.race([
          chrome.runtime.sendMessage(message),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeout)
          )
        ]);

        // Success!
        return response;

      } catch (error) {
        lastError = error;

        // Check for specific error types
        const errorMsg = error.message || '';

        // Context invalidation - don't retry
        if (errorMsg.includes('Extension context invalidated')) {
          this.contextInvalidated = true;
          throw new Error('CONTEXT_INVALIDATED');
        }

        // Message channel closed - service worker died, retry might help
        if (errorMsg.includes('message channel closed') ||
            errorMsg.includes('message port closed') ||
            errorMsg.includes('receiving end does not exist')) {
          console.warn(`BaitBreaker: Message channel closed (attempt ${attempt + 1}/${maxRetries + 1})`);

          // If this is not the last attempt, continue to retry
          if (attempt < maxRetries) {
            continue;
          }

          // Last attempt failed - throw specific error
          throw new Error('MESSAGE_CHANNEL_CLOSED');
        }

        // Timeout - maybe service worker is slow, retry might help
        if (errorMsg === 'TIMEOUT') {
          console.warn(`BaitBreaker: Operation timed out after ${timeout}ms (attempt ${attempt + 1}/${maxRetries + 1})`);

          // If this is not the last attempt, continue to retry
          if (attempt < maxRetries) {
            continue;
          }

          // Last attempt timed out
          throw new Error('TIMEOUT');
        }

        // Unknown error - don't retry
        throw error;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Unknown error in safeRuntimeMessage');
  }

  /**
   * Handle context invalidation by showing helpful message to user.
   * @param {HTMLElement} anchor - Element to anchor the message to
   * @param {string} linkText - Text of the link being processed
   */
  handleContextInvalidation(anchor, linkText) {
    console.warn('BaitBreaker: Extension context invalidated. User needs to refresh page.');

    this.showSummary(anchor,
      '⚠️ Extension was reloaded or updated. Please refresh this page to continue using BaitBreaker.',
      {
        linkText: linkText || 'Action Required',
        domain: 'BaitBreaker Extension'
      }
    );

    // Mark all existing badges as inactive
    this.markBadgesAsInactive();
  }

  /**
   * Handle service worker timeout or crash.
   * @param {HTMLElement} anchor - Element to anchor the message to
   * @param {string} linkText - Text of the link being processed
   * @param {string} errorType - Type of error (TIMEOUT or MESSAGE_CHANNEL_CLOSED)
   */
  handleServiceWorkerFailure(anchor, linkText, errorType) {
    console.error(`BaitBreaker: Service worker failure (${errorType})`);

    let message;
    if (errorType === 'TIMEOUT') {
      message = '⏱️ Request timed out. The AI service may be slow or unavailable. Try refreshing the page.';
    } else if (errorType === 'MESSAGE_CHANNEL_CLOSED') {
      message = '⚠️ Connection lost to extension service. The extension may need to be restarted or the page refreshed.';
    } else {
      message = '❌ Unable to connect to extension service. Please refresh this page.';
    }

    this.showSummary(anchor, message, {
      linkText: linkText || 'Error',
      domain: 'BaitBreaker Extension'
    });
  }

  /**
   * Visually mark all existing badges as inactive when context is invalidated.
   */
  markBadgesAsInactive() {
    document.querySelectorAll('.bb-indicator').forEach(badge => {
      badge.style.opacity = '0.5';
      badge.style.cursor = 'not-allowed';
      badge.title = 'Extension needs refresh - please reload this page';
    });
  }

  async initialize() {
    console.log('BaitBreaker: Content script initializing...');

    // Load settings
    const stored = await chrome.storage.sync.get('settings');
    this.settings = stored?.settings || { enabled: true, sensitivity: SENSITIVITY_CONFIG.DEFAULT };

    // Only scan if enabled
    if (this.settings.enabled !== false) {
      await this.scanPageForLinks();
    }

    this.setupMutationObserver();
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    console.log('BaitBreaker: Content script initialized');
  }

  async scanPageForLinks() {
    // Prevent multiple simultaneous scans
    if (this.isScanning) {
      console.log('BaitBreaker: Scan already in progress, skipping...');
      return;
    }

    // Check if enabled
    if (this.settings && this.settings.enabled === false) {
      console.log('BaitBreaker: Extension disabled, skipping scan');
      return;
    }

    this.isScanning = true;
    try {
      const links = document.querySelectorAll('a[href]');
      const linksToProcess = [];
      for (const link of links) {
        if (this.shouldProcessLink(link)) linksToProcess.push(link);
      }

      if (linksToProcess.length > 0) {
        console.log(`BaitBreaker: Found ${linksToProcess.length} new links to process`);
        await this.processLinks(linksToProcess);
      }
    } finally {
      this.isScanning = false;
    }
  }

  shouldProcessLink(link) {
    if (this.processedLinks.has(link)) return false;
    const text = (link.textContent || '').trim();
    if (!text || text.length < 10) return false;
    const href = link.href;
    if (!href || href.startsWith('#')) return false;
    return true;
  }

  // Eligibility without considering whether we've processed it yet
  isEligibleLink(link) {
    const text = (link.textContent || '').trim();
    if (!text || text.length < 10) return false;
    const href = link.href;
    if (!href || href.startsWith('#')) return false;
    return true;
  }

  async processLinks(links) {
    if (!links.length) return;
    const linkData = links.map(link => ({
      element: link,
      text: (link.textContent || '').trim(),
      href: link.href
    }));

    try {
      const results = await this.safeRuntimeMessage({
        action: 'classifyLinks',
        links: linkData.map(l => ({ text: l.text, href: l.href })),
        detectionMode: this.settings?.detectionMode || 'regex',
        sensitivity: this.settings?.sensitivity ?? SENSITIVITY_CONFIG.DEFAULT
      });

      // Check if we got an error response
      if (results?.error) {
        console.warn('BaitBreaker service error:', results.message);
        return;
      }

      // Ensure results is an array
      if (!Array.isArray(results)) {
        console.warn('BaitBreaker: Invalid response format');
        return;
      }

      results.forEach((result, index) => {
        if (result?.isClickbait) {
          this.markAsClickbait(linkData[index].element, result);
          this.clickbaitCount++;
        }
        this.processedLinks.add(linkData[index].element);
      });
    } catch (error) {
      const errorType = error.message;

      // Check if error is due to context invalidation
      if (errorType === 'CONTEXT_INVALIDATED') {
        console.warn('BaitBreaker: Cannot classify links - extension context invalidated');
        this.markBadgesAsInactive();
        return;
      }

      // Check if error is due to service worker failure
      if (errorType === 'MESSAGE_CHANNEL_CLOSED' || errorType === 'TIMEOUT') {
        console.warn(`BaitBreaker: Cannot classify links - service worker ${errorType.toLowerCase()}`);
        // Don't mark badges as inactive - this might be temporary
        return;
      }

      console.error('BaitBreaker: Failed to classify links:', error);
    }
  }

  markAsClickbait(linkElement, classificationResult) {
    const indicator = document.createElement('span');
    indicator.className = 'bb-indicator';
    indicator.textContent = '[B]';
    indicator.title = `Clickbait (p≈${Math.round((classificationResult.confidence || 0) * 100)}%)`;
    indicator.dataset.confidence = classificationResult.confidence;
    indicator.dataset.href = linkElement.href;
    indicator.dataset.linkText = (linkElement.textContent || '').trim();

    linkElement.insertAdjacentElement('afterend', indicator);
    this.attachHoverHandler(indicator, linkElement);

    // Start background summarization immediately
    this.prefetchSummary(linkElement.href, indicator);
  }

  async prefetchSummary(url, indicator) {
    // Check if already cached or loading
    if (this.summaryCache.has(url) || this.summaryLoadingStatus.get(url) === 'loading') {
      return;
    }

    // Mark as loading
    this.summaryLoadingStatus.set(url, 'loading');

    try {
      // Fetch summary in background
      const response = await this.safeRuntimeMessage({ action: 'getSummary', url });

      if (response?.error) {
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, 'Service unavailable: ' + response.message);
      } else {
        this.summaryLoadingStatus.set(url, 'ready');
        this.summaryCache.set(url, response);
        this.summarizedClickbait.add(url);

        // Update indicator visual state to darker purple
        indicator.classList.add('bb-summary-ready');
      }
    } catch (e) {
      const errorType = e.message;

      // Check if error is due to context invalidation
      if (errorType === 'CONTEXT_INVALIDATED') {
        console.warn('BaitBreaker: Cannot prefetch summary - extension context invalidated');
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, '⚠️ Extension was reloaded. Please refresh this page.');
        return;
      }

      // Check if error is due to service worker failure
      if (errorType === 'MESSAGE_CHANNEL_CLOSED') {
        console.warn('BaitBreaker: Cannot prefetch summary - message channel closed');
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, '⚠️ Connection lost to extension service. Hover to retry.');
        return;
      }

      if (errorType === 'TIMEOUT') {
        console.warn('BaitBreaker: Cannot prefetch summary - timeout');
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, '⏱️ Request timed out. Hover to retry.');
        return;
      }

      console.error('BaitBreaker: Background summary failed:', e);
      this.summaryLoadingStatus.set(url, 'error');
    }
  }

  attachHoverHandler(indicator, link) {
    indicator.addEventListener('mouseenter', async () => {
      const linkText = indicator.dataset.linkText || 'Article';
      const url = indicator.dataset.href;

      try {
        // Check if summary is already in cache (from background prefetch)
        let summary = this.summaryCache.get(url);

        if (summary) {
          // Summary is ready, show it immediately without loading state
          this.showSummary(indicator, summary, {
            linkText: linkText,
            domain: new URL(url).hostname.replace(/^www\./, '')
          });
        } else {
          // Summary not ready yet, show loading state
          this.showLoading(indicator, linkText);

          // Wait for the background fetch to complete or fetch now if not started
          if (!this.summaryLoadingStatus.has(url)) {
            const response = await this.safeRuntimeMessage({ action: 'getSummary', url });

            // Check if we got an error response
            if (response?.error) {
              summary = 'Service unavailable: ' + response.message;
            } else {
              summary = response;
            }

            this.summaryCache.set(url, summary);
          } else {
            // Wait for prefetch to complete, but avoid infinite loop
            const MAX_ATTEMPTS = 30; // 30 * 100ms = 3 seconds
            let attempts = 0;
            while (!this.summaryCache.has(url) && attempts++ < MAX_ATTEMPTS) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!this.summaryCache.has(url)) {
              // Timed out waiting for summary
              summary = 'Could not summarize this article (timed out).';
            } else {
              summary = this.summaryCache.get(url);
            }
          }

          this.showSummary(indicator, summary, {
            linkText: linkText,
            domain: new URL(url).hostname.replace(/^www\./, '')
          });
        }
      } catch (e) {
        const errorType = e.message;

        // Check if error is due to context invalidation
        if (errorType === 'CONTEXT_INVALIDATED') {
          console.error('BaitBreaker: Failed to get summary:', e);
          this.handleContextInvalidation(indicator, linkText);
          return;
        }

        // Check if error is due to service worker failure
        if (errorType === 'MESSAGE_CHANNEL_CLOSED' || errorType === 'TIMEOUT') {
          console.error('BaitBreaker: Failed to get summary:', e);
          this.handleServiceWorkerFailure(indicator, linkText, errorType);
          return;
        }

        // Unknown error
        console.error('BaitBreaker: Failed to get summary:', e);
        this.showSummary(indicator, 'Could not summarize this article.', {
          linkText: linkText,
          domain: 'unknown'
        });
      }
    });

    // Hide tooltip when mouse leaves the [B] badge
    indicator.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  handleMessage(msg, sender, sendResponse) {
    if (msg?.action === 'settingsUpdated') {
      // Update settings
      const oldMode = this.settings?.detectionMode;
      const oldSensitivity = this.settings?.sensitivity;
      this.settings = msg.settings;
      console.log('BaitBreaker: Settings updated', this.settings);

      // If extension was disabled, remove all badges
      if (this.settings.enabled === false) {
        document.querySelectorAll('.bb-indicator').forEach(badge => badge.remove());
        this.processedLinks.clear();
        this.summaryLoadingStatus.clear();
        this.clickbaitCount = 0;
        this.summarizedClickbait.clear();
      }
      // If extension was re-enabled, rescan
      else {
        // Reset state if mode/sensitivity changed
        if (oldMode !== this.settings.detectionMode || oldSensitivity !== this.settings.sensitivity) {
          document.querySelectorAll('.bb-indicator').forEach(badge => badge.remove());
          this.processedLinks.clear();
          this.summaryLoadingStatus.clear();
          this.clickbaitCount = 0;
          this.summarizedClickbait.clear();
        }
        this.scanPageForLinks();
      }
    }
    else if (msg?.action === 'getMetrics') {
      try {
        const allAnchors = Array.from(document.querySelectorAll('a[href]'));
        const linksDetected = allAnchors.filter(a => {
          const text = (a.textContent || '').trim();
          const href = a.href;
          return !!text && text.length >= 10 && !!href && !href.startsWith('#');
        }).length;

        sendResponse({
          linksProcessed: this.processedLinks.size,
          clickbaitDetected: this.clickbaitCount,
          linksDetected,
          clickbaitSummarized: this.summarizedClickbait.size
        });
      } catch (e) {
        sendResponse({
          linksProcessed: this.processedLinks.size,
          clickbaitDetected: this.clickbaitCount,
          clickbaitSummarized: this.summarizedClickbait.size
        });
      }
      return true; // Indicate async response
    }
    else if (msg?.action === 'rescan') {
      document.querySelectorAll('.bb-indicator').forEach(badge => badge.remove());
      this.processedLinks.clear();
      this.summaryLoadingStatus.clear();
      this.clickbaitCount = 0;
      this.summarizedClickbait.clear();
      this.scanPageForLinks();
      return false;
    }

    return false; // Sync response
  }

  // Lightweight tooltip functions
  showLoading(anchor, linkText) {
    this.hideTooltip();
    const t = document.createElement('div');
    t.className = 'bb-tooltip bb-loading';
    t.innerHTML = `
      <div class="bb-header"><h4 class="bb-link-title"></h4></div>
      <div class="bb-content">
        <div class="bb-spinner"></div><p>Analyzing article...</p>
      </div>`;
    t.querySelector('.bb-link-title').textContent = linkText || 'Article';
    this.positionTooltip(t, anchor);
    document.body.appendChild(t);
    this.tooltip = t;
  }

  showSummary(anchor, summary, meta) {
    this.hideTooltip();
    const t = document.createElement('div');
    t.className = 'bb-tooltip';
    t.innerHTML = `
      <div class="bb-header"><h4 class="bb-link-title"></h4></div>
      <div class="bb-content">
        <p class="bb-summary"></p>
        <div class="bb-metadata">
          <span class="bb-source">${meta.domain}</span>
        </div>
      </div>`;
    t.querySelector('.bb-link-title').textContent = meta.linkText || 'Article';
    t.querySelector('.bb-summary').textContent = String(summary || '').slice(0, PERFORMANCE_CONFIG.TOOLTIP_SUMMARY_LIMIT);
    this.positionTooltip(t, anchor);
    document.body.appendChild(t);
    this.tooltip = t;
  }

  hideTooltip() { this.tooltip?.remove(); this.tooltip = null; }

  positionTooltip(t, anchor) {
    const r = anchor.getBoundingClientRect();
    const w = 320;
    let left = r.left, top = r.bottom + 10;
    if (left + w > innerWidth) left = innerWidth - w - 10;
    if (top + 200 > innerHeight) top = r.top - 210;
    t.style.position = 'absolute';
    t.style.left = `${left + scrollX}px`;
    t.style.top = `${top + scrollY}px`;
  }

  setupMutationObserver() {
    this.observer = new MutationObserver(() => {
      // Debounce: clear existing timeout and set new one
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }
      this.scanTimeout = setTimeout(() => {
        this.scanPageForLinks();
      }, RETRY_CONFIG.DEBOUNCE_DELAY); // Debounce delay from config
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

(new BBContentManager()).initialize();
