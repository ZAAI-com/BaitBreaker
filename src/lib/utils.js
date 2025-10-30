// src/lib/utils.js
export const Utils = {
  domainFrom(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'unknown'; }
  },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};
