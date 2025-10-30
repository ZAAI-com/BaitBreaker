// src/content/content-script.js
// Content scripts run as classic scripts (not modules) per manifest; avoid imports.
// Minimal self-contained implementation using window-scoped helpers.

// Check if chrome extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.error('BaitBreaker: Chrome extension APIs not available. Content script may be running in wrong context.');
  throw new Error('Chrome extension APIs not available');
}

class BBContentManager {
  constructor() {
    this.processedLinks = new Set();
    this.summaryCache = new Map();
    this.observer = null;
    this.tooltip = null;
    this.isScanning = false;
    this.scanTimeout = null;
    this.clickbaitCount = 0;
    this.settings = null;
  }

  async initialize() {
    console.log('BaitBreaker: Content script initializing...');

    // Load settings
    const stored = await chrome.storage.sync.get('settings');
    this.settings = stored?.settings || { enabled: true, sensitivity: 5 };

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

  async processLinks(links) {
    if (!links.length) return;
    const linkData = links.map(link => ({
      element: link,
      text: (link.textContent || '').trim(),
      href: link.href
    }));

    try {
      const results = await chrome.runtime.sendMessage({
        action: 'classifyLinks',
        links: linkData.map(l => ({ text: l.text, href: l.href }))
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

    linkElement.insertAdjacentElement('afterend', indicator);
    this.attachHoverHandler(indicator, linkElement);
  }

  attachHoverHandler(indicator, link) {
    indicator.addEventListener('mouseenter', async () => {
      this.showLoading(indicator);
      const url = indicator.dataset.href;
      try {
        let summary = this.summaryCache.get(url);
        if (!summary) {
          const response = await chrome.runtime.sendMessage({ action: 'getSummary', url });

          // Check if we got an error response
          if (response?.error) {
            summary = 'Service unavailable: ' + response.message;
          } else {
            summary = response;
          }

          this.summaryCache.set(url, summary);
        }
        this.showSummary(indicator, summary, {
          domain: new URL(url).hostname.replace(/^www\./, '')
        });
      } catch (e) {
        console.error('BaitBreaker: Failed to get summary:', e);
        this.showSummary(indicator, 'Could not summarize this article.', {
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
      this.settings = msg.settings;
      console.log('BaitBreaker: Settings updated', this.settings);

      // If extension was disabled, remove all badges
      if (this.settings.enabled === false) {
        document.querySelectorAll('.bb-indicator').forEach(badge => badge.remove());
        this.processedLinks.clear();
        this.clickbaitCount = 0;
      }
      // If extension was re-enabled, rescan
      else {
        this.scanPageForLinks();
      }
    }
    else if (msg?.action === 'getMetrics') {
      // Return metrics for this page
      sendResponse({
        linksProcessed: this.processedLinks.size,
        clickbaitDetected: this.clickbaitCount
      });
      return true; // Indicate async response
    }

    return false; // Sync response
  }

  // Lightweight tooltip functions
  showLoading(anchor) {
    this.hideTooltip();
    const t = document.createElement('div');
    t.className = 'bb-tooltip bb-loading';
    t.innerHTML = `<div class="bb-spinner"></div><p>Analyzing article...</p>`;
    this.positionTooltip(t, anchor);
    document.body.appendChild(t);
    this.tooltip = t;
  }

  showSummary(anchor, summary, meta) {
    this.hideTooltip();
    const t = document.createElement('div');
    t.className = 'bb-tooltip';
    t.innerHTML = `
      <div class="bb-header"><h4>Quick Answer</h4></div>
      <div class="bb-content">
        <p class="bb-summary"></p>
        <div class="bb-metadata">
          <span class="bb-source">${meta.domain}</span>
        </div>
      </div>`;
    t.querySelector('.bb-summary').textContent = String(summary || '').slice(0, 1000);
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
      }, 500); // Wait 500ms after last mutation before scanning
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

(new BBContentManager()).initialize();
