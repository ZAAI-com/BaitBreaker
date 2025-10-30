// src/popup/popup.js
import { SettingsManager } from '../lib/settings-manager.js';

const settingsManager = new SettingsManager();

async function init() {
  const settings = await settingsManager.load();
  const enabled = document.getElementById('enabled');
  const sensitivity = document.getElementById('sensitivity');
  const clearCacheBtn = document.getElementById('clear-cache');

  // Set initial values
  enabled.checked = !!settings.enabled;
  sensitivity.value = settings.sensitivity ?? 5;

  // Add event listeners
  enabled.addEventListener('change', async () => {
    await persist({ ...settings, enabled: enabled.checked });
    updateMetrics(); // Refresh metrics after settings change
  });

  sensitivity.addEventListener('input', () => {
    persist({ ...settings, sensitivity: Number(sensitivity.value) });
  });

  clearCacheBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
    }, 2000);
    updateMetrics(); // Refresh metrics after clearing cache
  });

  // Load metrics
  await updateMetrics();

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
    } else {
      // Content script not loaded or error
      document.getElementById('links-processed').textContent = '0';
      document.getElementById('clickbait-detected').textContent = '0';
    }
  } catch (error) {
    // Content script not available on this page (chrome://, extensions page, etc.)
    console.log('Could not get metrics from current tab:', error.message);
    document.getElementById('links-processed').textContent = '-';
    document.getElementById('clickbait-detected').textContent = '-';
  }
}

async function persist(newSettings) {
  await settingsManager.save(newSettings);
}

document.addEventListener('DOMContentLoaded', init);
