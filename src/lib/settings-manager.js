// src/lib/settings-manager.js
import { DEFAULT_DETECTION_MODE, SENSITIVITY_CONFIG } from '../../config/config.js';

export class SettingsManager {
  static DEFAULTS = {
    enabled: true,
    sensitivity: SENSITIVITY_CONFIG.DEFAULT,
    detectionMode: DEFAULT_DETECTION_MODE,
    showConfidence: false,
    cacheEnabled: true,
    domains: { whitelist: [], blacklist: [] }
  };

  async load() {
    const stored = await chrome.storage.sync.get('settings');
    return { ...SettingsManager.DEFAULTS, ...(stored?.settings || {}) };
  }

  async save(settings) {
    await chrome.storage.sync.set({ settings });

    // Notify all tabs about settings update
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        // Skip invalid tabs or system pages
        if (!tab?.id || !tab.url) return;
        if (tab.url.startsWith('chrome://') ||
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
          return;
        }

        // Send message and ignore errors (tab might not have content script)
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings }, () => {
          // Ignore "receiving end does not exist" errors silently
          if (chrome.runtime.lastError) {
            // This is expected for tabs without content script
            return;
          }
        });
      });
    });
  }
}
