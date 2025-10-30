// src/popup/popup.js
import { SettingsManager } from '../lib/settings-manager.js';
import { UI_CONFIG, SENSITIVITY_CONFIG } from '../../config/config.js';

const settingsManager = new SettingsManager();

async function init() {
  const settings = await settingsManager.load();
  const enabled = document.getElementById('enabled');
  const sensitivity = document.getElementById('sensitivity');
  const sensitivityPercent = document.getElementById('sensitivity-percent');
  const clearCacheBtn = document.getElementById('clear-cache');
  let metricsTimer = null;

  // Set initial values
  enabled.checked = !!settings.enabled;
  sensitivity.value = settings.sensitivity ?? SENSITIVITY_CONFIG.DEFAULT;
  
  // Detection mode is preset to 'regex' in config, no need for switch
  // Hide sensitivity slider since it only applies to Chrome AI mode
  const sensitivitySliderLabel = document.querySelector('.slider');
  if (sensitivitySliderLabel) {
    sensitivitySliderLabel.classList.add('hidden');
  }

  // Add event listeners
  enabled.addEventListener('change', async () => {
    await persist({ ...settings, enabled: enabled.checked });
    updateMetrics(); // Refresh metrics after settings change
  });

  sensitivity.addEventListener('input', () => {
    persist({ ...settings, sensitivity: Number(sensitivity.value) });
    if (sensitivityPercent) {
      sensitivityPercent.textContent = String((Number(sensitivity.value) || SENSITIVITY_CONFIG.DEFAULT) * 10);
    }
  });

  clearCacheBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
    }, UI_CONFIG.CLEAR_CACHE_TIMEOUT);
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

  // Detection mode is fixed to 'regex', no mode change listeners needed

  // Load metrics and mode display initially
  await updateMetrics();
  await updateModeDisplay();
  // Auto-refresh metrics every second while popup is open
  metricsTimer = setInterval(async () => {
    await updateMetrics();
    await updateModeDisplay();
  }, UI_CONFIG.METRICS_UPDATE_INTERVAL);

  window.addEventListener('beforeunload', () => {
    if (metricsTimer) clearInterval(metricsTimer);
  });

  // Model status
  document.getElementById('model-state').textContent = 'Ready';
}

/**
 * Helper function to set all metrics display to a given value
 * @param {string} value - The value to display for all metrics
 */
function setMetricsDisplay(value) {
  document.getElementById('links-detected').textContent = value;
  document.getElementById('links-processed').textContent = value;
  document.getElementById('clickbait-detected').textContent = value;
  document.getElementById('clickbait-summarized').textContent = value;
}

/**
 * Reset metrics display to show dashes (e.g., when extension is disabled or unavailable)
 */
function resetMetricsDisplay() {
  setMetricsDisplay('-');
}

function startMetricsPolling() {
  // Clear any existing interval
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  // Poll metrics every 1 second for real-time updates
  metricsInterval = setInterval(() => {
    updateMetrics();
    updateModeDisplay();
  }, UI_CONFIG.METRICS_UPDATE_INTERVAL);
}

// Clean up interval when popup closes
window.addEventListener('unload', () => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }
});

async function updateMetrics() {
  try {
    // Check if extension is enabled
    const settings = await settingsManager.load();

    // If disabled, show dashes
    if (!settings.enabled) {
      resetMetricsDisplay();
      return;
    }

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setMetricsDisplay('0');
      return;
    }

    // Send message to content script to get metrics
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMetrics' });

    if (response && !response.error) {
      const detectedCount =
        (typeof response.linksDetected === 'number' && response.linksDetected >= 0)
          ? response.linksDetected
          : (Array.isArray(response.detectedLinks)
              ? response.detectedLinks.length
              : (typeof response.linksProcessed === 'number' ? response.linksProcessed : 0));

      document.getElementById('links-detected').textContent = String(detectedCount);
      document.getElementById('links-processed').textContent = String(response.linksProcessed || 0);
      document.getElementById('clickbait-detected').textContent = String(response.clickbaitDetected || 0);
      document.getElementById('clickbait-summarized').textContent = String(response.clickbaitSummarized || 0);
    } else {
      // Content script not loaded or error
      setMetricsDisplay('0');
    }
  } catch (error) {
    // Content script not available on this page (chrome://, extensions page, etc.)
    console.log('Could not get metrics from current tab:', error.message);
    resetMetricsDisplay();
  }
}

async function persist(newSettings) {
  await settingsManager.save(newSettings);
}

document.addEventListener('DOMContentLoaded', init);

async function updateModeDisplay() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getCacheStats' });
    const detectionCacheEl = document.getElementById('detection-cache-count');
    const summarizationCacheEl = document.getElementById('summarization-cache-count');
    
    if (stats && !stats.error) {
      if (detectionCacheEl) {
        detectionCacheEl.textContent = String(stats.classification || 0);
      }
      if (summarizationCacheEl) {
        summarizationCacheEl.textContent = String(stats.summary || 0);
      }
    } else {
      if (detectionCacheEl) detectionCacheEl.textContent = '-';
      if (summarizationCacheEl) summarizationCacheEl.textContent = '-';
    }
  } catch (e) {
    const detectionCacheEl = document.getElementById('detection-cache-count');
    const summarizationCacheEl = document.getElementById('summarization-cache-count');
    if (detectionCacheEl) detectionCacheEl.textContent = '-';
    if (summarizationCacheEl) summarizationCacheEl.textContent = '-';
  }
}
