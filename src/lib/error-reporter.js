// src/lib/error-reporter.js
export class ErrorReporter {
  constructor() {
    this.queue = [];
    this.maxQueueSize = 50;
  }
  captureError(error, context = {}) {
    const errorInfo = {
      message: error?.message || String(error),
      stack: error?.stack || '',
      context,
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent
    };
    this.queue.push(errorInfo);
    if (this.queue.length >= this.maxQueueSize) this.flush();
  }
  async flush() {
    if (!this.queue.length) return;
    try {
      // Placeholder for remote reporting
      await chrome.storage.local.set({ error_log: this.queue });
      this.queue = [];
    } catch (e) {
      console.error('Failed to report errors:', e);
    }
  }
}
