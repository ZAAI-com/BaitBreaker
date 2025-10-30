// src/popup/popup.js
import { SettingsManager } from '../lib/settings-manager.js';

const settingsManager = new SettingsManager();

async function init() {
  const settings = await settingsManager.load();
  const enabled = document.getElementById('enabled');
  const sensitivity = document.getElementById('sensitivity');
  const clearCacheBtn = document.getElementById('clear-cache');
  const detectionMode = document.getElementById('detection-mode');
  let metricsTimer = null;

  // Set initial values
  enabled.checked = !!settings.enabled;
  sensitivity.value = settings.sensitivity ?? 5;
  if (detectionMode) detectionMode.value = settings.detectionMode || 'simple-regex';

  // Add event listeners
  enabled.addEventListener('change', async () => {
    await persist({ ...settings, enabled: enabled.checked });
    updateMetrics(); // Refresh metrics after settings change
  });

  sensitivity.addEventListener('input', () => {
    persist({ ...settings, sensitivity: Number(sensitivity.value) });
  });

  if (detectionMode) {
    detectionMode.addEventListener('change', async () => {
      await persist({ ...settings, detectionMode: detectionMode.value });
      updateMetrics();
    });
  }

  clearCacheBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
    }, 2000);
    updateMetrics(); // Refresh metrics after clearing cache
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'rescan' });
      }
    } catch (e) {
      // ignore if content script isn't available
    }
  });

  // Load metrics
  await updateMetrics();
  // Auto-refresh metrics every second while popup is open
  metricsTimer = setInterval(updateMetrics, 1000);

  window.addEventListener('beforeunload', () => {
    if (metricsTimer) clearInterval(metricsTimer);
  });

  // Model status
  document.getElementById('model-state').textContent = 'Ready';
}

async function updateMetrics() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      document.getElementById('links-processed').textContent = '0';
      document.getElementById('clickbait-detected').textContent = '0';
      return;
    }

    // Send message to content script to get metrics
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMetrics' });

    if (response && !response.error) {
      document.getElementById('links-processed').textContent = String(response.linksProcessed || 0);
      document.getElementById('clickbait-detected').textContent = String(response.clickbaitDetected || 0);
      if (document.getElementById('links-detected')) {
        document.getElementById('links-detected').textContent = String(response.linksDetected || 0);
      }
    } else {
      // Content script not loaded or error
      document.getElementById('links-processed').textContent = '0';
      document.getElementById('clickbait-detected').textContent = '0';
      if (document.getElementById('links-detected')) {
        document.getElementById('links-detected').textContent = '0';
      }
    }
  } catch (error) {
    // Content script not available on this page (chrome://, extensions page, etc.)
    console.log('Could not get metrics from current tab:', error.message);
    document.getElementById('links-processed').textContent = '-';
    document.getElementById('clickbait-detected').textContent = '-';
    if (document.getElementById('links-detected')) {
      document.getElementById('links-detected').textContent = '-';
    }
  }
}

async function persist(newSettings) {
  await settingsManager.save(newSettings);
}

document.addEventListener('DOMContentLoaded', init);
