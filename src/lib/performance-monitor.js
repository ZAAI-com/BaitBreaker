// src/lib/performance-monitor.js
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      classificationsPerformed: 0,
      summariesGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errors: []
    };
  }
  updateAverageResponseTime(duration) {
    const n = this.metrics.classificationsPerformed + this.metrics.summariesGenerated;
    const prev = this.metrics.averageResponseTime;
    this.metrics.averageResponseTime = (prev * (n - 1) + duration) / Math.max(n, 1);
  }
  trackClassification(duration) {
    this.metrics.classificationsPerformed++;
    this.updateAverageResponseTime(duration);
  }
  trackSummary(duration, fromCache = false) {
    this.metrics.summariesGenerated++;
    if (fromCache) this.metrics.cacheHits++; else this.metrics.cacheMisses++;
    this.updateAverageResponseTime(duration);
  }
  async reportMetrics() {
    console.log('BB Performance Metrics:', this.metrics);
    await chrome.storage.local.set({ bb_metrics: this.metrics });
  }
}
