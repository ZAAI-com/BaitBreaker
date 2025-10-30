// src/background/cache-manager.js
export class CacheManager {
  constructor() {
    this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.MAX_CACHE_SIZE = 1000;
  }

  async initialize() {
    await this.cleanOldEntries();
  }

  async getClassification(text) {
    const key = this._classificationKey(text);
    const result = await chrome.storage.local.get(key);
    if (result[key] && this.isValid(result[key])) {
      return result[key].data;
    }
    return null;
  }

  async saveClassification(text, classification) {
    const key = this._classificationKey(text);
    const entry = { data: classification, timestamp: Date.now(), type: 'classification' };
    await chrome.storage.local.set({ [key]: entry });
    await this.enforceMaxSize();
  }

  async getSummary(url) {
    const key = `summary_${this.hashText(url)}`;
    const result = await chrome.storage.local.get(key);
    if (result[key] && this.isValid(result[key])) {
      return result[key].data;
    }
    return null;
  }

  async saveSummary(url, summary) {
    const key = `summary_${this.hashText(url)}`;
    const entry = { data: summary, timestamp: Date.now(), url, type: 'summary' };
    await chrome.storage.local.set({ [key]: entry });
    await this.enforceMaxSize();
  }

  async cleanOldEntries() {
    const all = await chrome.storage.local.get();
    const toRemove = [];
    for (const [key, value] of Object.entries(all)) {
      if (!this.isValid(value)) {
        toRemove.push(key);
      }
    }
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
    }
  }

  async clearAll() {
    // Clear all cache entries (both classifications and summaries)
    const all = await chrome.storage.local.get();
    const cacheKeys = [];

    for (const [key, value] of Object.entries(all)) {
      // Only remove cache entries (classifications and summaries)
      // Keep other storage like settings
      if (value?.type === 'classification' || value?.type === 'summary') {
        cacheKeys.push(key);
      }
    }

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
      console.log(`BaitBreaker: Cleared ${cacheKeys.length} cache entries`);
    }

    return { success: true, cleared: cacheKeys.length };
  }

  async getStats() {
    const all = await chrome.storage.local.get();
    let classification = 0;
    let summary = 0;
    for (const value of Object.values(all)) {
      if (value?.type === 'classification') classification++;
      else if (value?.type === 'summary') summary++;
    }
    return {
      classification,
      summary,
      total: classification + summary
    };
  }

  async enforceMaxSize() {
    const all = await chrome.storage.local.get();
    const entries = Object.entries(all).map(([key, value]) => ({ key, value }));
    if (entries.length <= this.MAX_CACHE_SIZE) return;

    // sort oldest first
    entries.sort((a, b) => (a.value.timestamp || 0) - (b.value.timestamp || 0));
    const overflow = entries.length - this.MAX_CACHE_SIZE;
    const toRemove = entries.slice(0, overflow).map(e => e.key);
    if (toRemove.length) {
      await chrome.storage.local.remove(toRemove);
    }
  }

  isValid(entry) {
    return entry &&
           entry.timestamp &&
           (Date.now() - entry.timestamp) < this.CACHE_DURATION;
  }

  _classificationKey(text) {
    return `class_${this.hashText(text)}`;
  }

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `bb_${hash}`;
  }
}
