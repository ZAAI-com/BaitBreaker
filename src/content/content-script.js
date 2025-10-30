/**
 * BaitBreaker Content Script
 * Scans pages for clickbait links and displays summaries on hover
 */

import {
  TIMEOUT_CONFIG,
  RETRY_CONFIG,
  PERFORMANCE_CONFIG,
  SENSITIVITY_CONFIG
} from '../../config/config.js';

/**
 * Main Content Manager Class
 * Handles all content script functionality
 */
class BaitBreakerContentManager {
  constructor() {
    // State management
    this.processedLinks = new Set();
    this.summaryCache = new Map();
    this.summaryLoadingStatus = new Map(); // 'loading' | 'ready' | 'error'
    this.summarizedClickbait = new Set();
    
    // UI elements
    this.tooltip = null;
    
    // Observers and timers
    this.mutationObserver = null;
    this.scanTimeout = null;
    
    // Flags
    this.isScanning = false;
    this.contextInvalidated = false;
    this.clickbaitCount = 0;
    
    // Settings
    this.settings = {
      enabled: true,
      detectionMode: 'regex',
      sensitivity: SENSITIVITY_CONFIG.DEFAULT
    };

    // Bind methods to preserve context
    this.handleMessage = this.handleMessage.bind(this);
    this.scanPageForLinks = this.scanPageForLinks.bind(this);
  }

  /**
   * Initialize the content script
   */
  async initialize() {
    console.log('BaitBreaker: Content script initializing...');

    try {
      // Check if extension APIs are available
      if (!this.isExtensionContextValid()) {
        throw new Error('Chrome extension APIs not available');
      }

      // Load settings from storage
      await this.loadSettings();

      // Start scanning if enabled
      if (this.settings.enabled !== false) {
        await this.scanPageForLinks();
      }

      // Set up mutation observer for dynamic content
      this.setupMutationObserver();

      // Listen for messages from background script
      chrome.runtime.onMessage.addListener(this.handleMessage);

      console.log('BaitBreaker: Content script initialized successfully');
    } catch (error) {
      console.error('BaitBreaker: Failed to initialize content script:', error);
      this.contextInvalidated = true;
    }
  }

  /**
   * Check if extension context is still valid
   * @returns {boolean} True if context is valid
   */
  isExtensionContextValid() {
    try {
      return !!(chrome?.runtime?.id);
    } catch (e) {
      return false;
    }
  }

  /**
   * Load settings from chrome.storage.sync
   */
  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get('settings');
      if (stored?.settings) {
        this.settings = {
          enabled: stored.settings.enabled !== false,
          detectionMode: stored.settings.detectionMode || 'regex',
          sensitivity: stored.settings.sensitivity ?? SENSITIVITY_CONFIG.DEFAULT
        };
      }
    } catch (error) {
      console.warn('BaitBreaker: Failed to load settings:', error);
    }
  }

  /**
   * Safely send message to background service worker with retry and timeout
   * @param {Object} message - Message to send
   * @param {Object} options - Options for timeout and retry
   * @returns {Promise<any>} Response from service worker
   */
  async safeRuntimeMessage(message, options = {}) {
    const {
      timeout = TIMEOUT_CONFIG.MESSAGE,
      maxRetries = RETRY_CONFIG.MAX_RETRIES,
      retryDelay = RETRY_CONFIG.RETRY_DELAY
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
        // Race between message and timeout
        const response = await Promise.race([
          chrome.runtime.sendMessage(message),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeout)
          )
        ]);

        return response;
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || '';

        // Context invalidation - don't retry
        if (errorMsg.includes('Extension context invalidated')) {
          this.contextInvalidated = true;
          throw new Error('CONTEXT_INVALIDATED');
        }

        // Message channel closed - retry might help
        if (errorMsg.includes('message channel closed') ||
            errorMsg.includes('message port closed') ||
            errorMsg.includes('receiving end does not exist')) {
          console.warn(`BaitBreaker: Message channel closed (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            continue;
          }
          
          throw new Error('MESSAGE_CHANNEL_CLOSED');
        }

        // Timeout - retry might help
        if (errorMsg === 'TIMEOUT') {
          console.warn(`BaitBreaker: Operation timed out after ${timeout}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            continue;
          }
          
          throw new Error('TIMEOUT');
        }

        // Unknown error - don't retry
        throw error;
      }
    }

    throw lastError || new Error('Unknown error in safeRuntimeMessage');
  }

  /**
   * Scan page for links to process
   */
  async scanPageForLinks() {
    // Prevent multiple simultaneous scans
    if (this.isScanning) {
      console.log('BaitBreaker: Scan already in progress, skipping...');
      return;
    }

    // Check if enabled
    if (this.settings?.enabled === false) {
      console.log('BaitBreaker: Extension disabled, skipping scan');
      return;
    }

    this.isScanning = true;
    
    try {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const linksToProcess = links.filter(link => this.shouldProcessLink(link));

      if (linksToProcess.length > 0) {
        console.log(`BaitBreaker: Found ${linksToProcess.length} new links to process`);
        await this.processLinks(linksToProcess);
      }
    } catch (error) {
      console.error('BaitBreaker: Error scanning page:', error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Check if a link should be processed
   * @param {HTMLElement} link - Link element to check
   * @returns {boolean} True if link should be processed
   */
  shouldProcessLink(link) {
    // Skip if already processed
    if (this.processedLinks.has(link)) {
      return false;
    }

    // Check link text length
    const text = (link.textContent || '').trim();
    if (!text || text.length < 10) {
      return false;
    }

    // Check href validity
    const href = link.href;
    if (!href || href.startsWith('#')) {
      return false;
    }

    return true;
  }

  /**
   * Process multiple links for clickbait detection
   * @param {Array<HTMLElement>} links - Array of link elements
   */
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

      // Check for error response
      if (results?.error) {
        console.warn('BaitBreaker: Service error:', results.message);
        return;
      }

      // Ensure results is an array
      if (!Array.isArray(results)) {
        console.warn('BaitBreaker: Invalid response format');
        return;
      }

      // Process results
      results.forEach((result, index) => {
        const linkElement = linkData[index].element;
        
        // Mark link as processed
        this.processedLinks.add(linkElement);

        // If clickbait detected, mark it
        if (result?.isClickbait) {
          this.markAsClickbait(linkElement, result);
          this.clickbaitCount++;
        }
      });
    } catch (error) {
      const errorType = error.message;

      // Handle specific error types
      if (errorType === 'CONTEXT_INVALIDATED') {
        console.warn('BaitBreaker: Cannot classify links - extension context invalidated');
        this.markBadgesAsInactive();
        return;
      }

      if (errorType === 'MESSAGE_CHANNEL_CLOSED' || errorType === 'TIMEOUT') {
        console.warn(`BaitBreaker: Cannot classify links - service worker ${errorType.toLowerCase()}`);
        return;
      }

      console.error('BaitBreaker: Failed to classify links:', error);
    }
  }

  /**
   * Mark a link as clickbait and add indicator
   * @param {HTMLElement} linkElement - Link element
   * @param {Object} classificationResult - Classification result
   */
  markAsClickbait(linkElement, classificationResult) {
    // Create indicator badge
    const indicator = document.createElement('span');
    indicator.className = 'bb-indicator';
    indicator.textContent = '[B]';
    indicator.title = `Clickbait (p≈${Math.round((classificationResult.confidence || 0) * 100)}%)`;
    indicator.dataset.confidence = classificationResult.confidence || 0;
    indicator.dataset.href = linkElement.href;
    indicator.dataset.linkText = (linkElement.textContent || '').trim();

    // Insert badge after link
    linkElement.insertAdjacentElement('afterend', indicator);

    // Attach hover handler
    this.attachHoverHandler(indicator, linkElement);

    // Start background summarization
    this.prefetchSummary(linkElement.href, indicator);
  }

  /**
   * Prefetch summary for a URL in the background
   * @param {string} url - URL to prefetch summary for
   * @param {HTMLElement} indicator - Indicator badge element
   */
  async prefetchSummary(url, indicator) {
    // Skip if already cached or loading
    if (this.summaryCache.has(url) || this.summaryLoadingStatus.get(url) === 'loading') {
      return;
    }

    // Mark as loading
    this.summaryLoadingStatus.set(url, 'loading');

    try {
      const response = await this.safeRuntimeMessage({ action: 'getSummary', url });

      if (response?.error) {
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, 'Service unavailable: ' + response.message);
      } else {
        this.summaryLoadingStatus.set(url, 'ready');
        this.summaryCache.set(url, response);
        this.summarizedClickbait.add(url);

        // Update indicator visual state
        indicator.classList.add('bb-summary-ready');
      }
    } catch (error) {
      const errorType = error.message;

      if (errorType === 'CONTEXT_INVALIDATED') {
        console.warn('BaitBreaker: Cannot prefetch summary - extension context invalidated');
        this.summaryLoadingStatus.set(url, 'error');
        this.summaryCache.set(url, '⚠️ Extension was reloaded. Please refresh this page.');
        return;
      }

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

      console.error('BaitBreaker: Background summary failed:', error);
      this.summaryLoadingStatus.set(url, 'error');
    }
  }

  /**
   * Attach hover handler to indicator badge
   * @param {HTMLElement} indicator - Indicator badge
   * @param {HTMLElement} link - Original link element
   */
  attachHoverHandler(indicator, link) {
    indicator.addEventListener('mouseenter', async () => {
      const linkText = indicator.dataset.linkText || 'Article';
      const url = indicator.dataset.href;

      try {
        // Check if summary is cached
        let summary = this.summaryCache.get(url);

        if (summary) {
          // Summary ready - show immediately
          this.showSummary(indicator, summary, {
            linkText: linkText,
            domain: new URL(url).hostname.replace(/^www\./, '')
          });
        } else {
          // Show loading state
          this.showLoading(indicator, linkText);

          // Fetch summary if not started
          if (!this.summaryLoadingStatus.has(url)) {
            try {
              const response = await this.safeRuntimeMessage({ action: 'getSummary', url });

              if (response?.error) {
                summary = 'Service unavailable: ' + response.message;
              } else {
                summary = response;
              }

              this.summaryCache.set(url, summary);
            } catch (error) {
              const errorType = error.message;

              if (errorType === 'CONTEXT_INVALIDATED') {
                this.handleContextInvalidation(indicator, linkText);
                return;
              }

              if (errorType === 'MESSAGE_CHANNEL_CLOSED' || errorType === 'TIMEOUT') {
                this.handleServiceWorkerFailure(indicator, linkText, errorType);
                return;
              }

              summary = 'Could not summarize this article.';
            }
          } else {
            // Wait for prefetch to complete
            const MAX_ATTEMPTS = 30; // 3 seconds max wait
            let attempts = 0;
            
            while (!this.summaryCache.has(url) && attempts++ < MAX_ATTEMPTS) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (this.summaryCache.has(url)) {
              summary = this.summaryCache.get(url);
            } else {
              summary = 'Could not summarize this article (timed out).';
            }
          }

          // Show summary
          this.showSummary(indicator, summary, {
            linkText: linkText,
            domain: new URL(url).hostname.replace(/^www\./, '')
          });
        }
      } catch (error) {
        console.error('BaitBreaker: Failed to get summary:', error);
        this.showSummary(indicator, 'Could not summarize this article.', {
          linkText: linkText,
          domain: 'unknown'
        });
      }
    });

    // Hide tooltip on mouse leave
    indicator.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * Handle context invalidation
   * @param {HTMLElement} anchor - Element to anchor message to
   * @param {string} linkText - Link text
   */
  handleContextInvalidation(anchor, linkText) {
    console.warn('BaitBreaker: Extension context invalidated. User needs to refresh page.');

    this.showSummary(
      anchor,
      '⚠️ Extension was reloaded or updated. Please refresh this page to continue using BaitBreaker.',
      {
        linkText: linkText || 'Action Required',
        domain: 'BaitBreaker Extension'
      }
    );

    this.markBadgesAsInactive();
  }

  /**
   * Handle service worker failure
   * @param {HTMLElement} anchor - Element to anchor message to
   * @param {string} linkText - Link text
   * @param {string} errorType - Error type
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
   * Mark all badges as inactive
   */
  markBadgesAsInactive() {
    document.querySelectorAll('.bb-indicator').forEach(badge => {
      badge.style.opacity = '0.5';
      badge.style.cursor = 'not-allowed';
      badge.title = 'Extension needs refresh - please reload this page';
    });
  }

  /**
   * Handle messages from background script
   * @param {Object} msg - Message object
   * @param {Object} sender - Sender object
   * @param {Function} sendResponse - Response callback
   * @returns {boolean} True if response is async
   */
  handleMessage(msg, sender, sendResponse) {
    if (msg?.action === 'settingsUpdated') {
      // Update settings
      const oldMode = this.settings?.detectionMode;
      const oldSensitivity = this.settings?.sensitivity;
      this.settings = msg.settings;
      console.log('BaitBreaker: Settings updated', this.settings);

      // If extension was disabled, remove all badges
      if (this.settings.enabled === false) {
        this.clearAllBadges();
      } else {
        // If mode/sensitivity changed, reset and rescan
        if (oldMode !== this.settings.detectionMode || oldSensitivity !== this.settings.sensitivity) {
          this.clearAllBadges();
        }
        this.scanPageForLinks();
      }
      return false;
    }

    if (msg?.action === 'getMetrics') {
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
      return true; // Async response
    }

    if (msg?.action === 'rescan') {
      this.clearAllBadges();
      this.scanPageForLinks();
      return false;
    }

    return false;
  }

  /**
   * Clear all badges and reset state
   */
  clearAllBadges() {
    document.querySelectorAll('.bb-indicator').forEach(badge => badge.remove());
    this.processedLinks.clear();
    this.summaryLoadingStatus.clear();
    this.clickbaitCount = 0;
    this.summarizedClickbait.clear();
    this.summaryCache.clear();
  }

  /**
   * Set up mutation observer for dynamic content
   */
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver(() => {
      // Debounce: clear existing timeout and set new one
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }
      this.scanTimeout = setTimeout(() => {
        this.scanPageForLinks();
      }, RETRY_CONFIG.DEBOUNCE_DELAY);
    });

    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Show loading tooltip
   * @param {HTMLElement} anchor - Element to anchor tooltip to
   * @param {string} linkText - Link text
   */
  showLoading(anchor, linkText) {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'bb-tooltip bb-loading';
    tooltip.innerHTML = `
      <div class="bb-header"><h4 class="bb-link-title"></h4></div>
      <div class="bb-content">
        <div class="bb-spinner"></div><p>Analyzing article...</p>
      </div>
    `;
    tooltip.querySelector('.bb-link-title').textContent = linkText || 'Article';
    
    this.positionTooltip(tooltip, anchor);
    document.body.appendChild(tooltip);
    this.tooltip = tooltip;
  }

  /**
   * Show summary tooltip
   * @param {HTMLElement} anchor - Element to anchor tooltip to
   * @param {string} summary - Summary text
   * @param {Object} meta - Metadata object
   */
  showSummary(anchor, summary, meta) {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'bb-tooltip';
    tooltip.innerHTML = `
      <div class="bb-header"><h4 class="bb-link-title"></h4></div>
      <div class="bb-content">
        <p class="bb-summary"></p>
        <div class="bb-metadata">
          <span class="bb-source">${meta.domain}</span>
        </div>
      </div>
    `;
    
    tooltip.querySelector('.bb-link-title').textContent = meta.linkText || 'Article';
    tooltip.querySelector('.bb-summary').textContent = String(summary || '').slice(
      0,
      PERFORMANCE_CONFIG.TOOLTIP_SUMMARY_LIMIT
    );

    this.positionTooltip(tooltip, anchor);
    document.body.appendChild(tooltip);
    this.tooltip = tooltip;
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.tooltip?.parentNode) {
      this.tooltip.remove();
    }
    this.tooltip = null;
  }

  /**
   * Position tooltip relative to anchor element
   * @param {HTMLElement} tooltip - Tooltip element
   * @param {HTMLElement} anchor - Anchor element
   */
  positionTooltip(tooltip, anchor) {
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = 320;
    let left = rect.left;
    let top = rect.bottom + 10;

    // Adjust horizontal position if tooltip would overflow
    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 10;
    }

    // Adjust vertical position if tooltip would overflow
    if (top + 200 > window.innerHeight) {
      top = rect.top - 210;
    }

    tooltip.style.position = 'absolute';
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  }
}

// Initialize content manager
try {
  const manager = new BaitBreakerContentManager();
  manager.initialize();
} catch (error) {
  console.error('BaitBreaker: Failed to create content manager:', error);
}
