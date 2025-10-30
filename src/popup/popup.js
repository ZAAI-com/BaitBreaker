// src/popup/popup.js
import { SettingsManager } from '../lib/settings-manager.js';

const settingsManager = new SettingsManager();
let metricsInterval = null;

async function init() {
  const settings = await settingsManager.load();
  const enabled = document.getElementById('enabled');
  const sensitivity = document.getElementById('sensitivity');
  const sensitivityPercent = document.getElementById('sensitivity-percent');
  const clearCacheBtn = document.getElementById('clear-cache');
  const detectionMode = document.getElementById('detection-mode');
  let metricsTimer = null;

  // Set initial values
  enabled.checked = !!settings.enabled;
  sensitivity.value = settings.sensitivity ?? 5;
  if (detectionMode) detectionMode.value = settings.detectionMode || 'simple-regex';

  // Initialize detection mode (default: chrome-ai)
  const detectionMode = settings.detectionMode || 'simple-regex';
  if (modeSimple && modeAi) {
    if (detectionMode === 'simple-regex') {
      modeSimple.checked = true;
    } else {
      modeAi.checked = true;
    }
  }

  // Toggle sensitivity visibility based on mode (hide for simple-regex)
  function updateSensitivityVisibility(mode) {
    if (!sensitivitySliderLabel) return;
    if (mode === 'simple-regex') {
      sensitivitySliderLabel.classList.add('hidden');
    } else {
      sensitivitySliderLabel.classList.remove('hidden');
    }
  }
  updateSensitivityVisibility(detectionMode);

  // Add event listeners
  enabled.addEventListener('change', async () => {
    await persist({ ...settings, enabled: enabled.checked });
    updateMetrics(); // Refresh metrics after settings change
  });

  sensitivity.addEventListener('input', () => {
    persist({ ...settings, sensitivity: Number(sensitivity.value) });
    if (sensitivityPercent) {
      sensitivityPercent.textContent = String((Number(sensitivity.value) || 5) * 10);
    }
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

  // Mode change listeners
  function onModeChange(mode) {
    updateSensitivityVisibility(mode);
    persist({ ...settings, detectionMode: mode });
    updateMetrics();
  }
  modeSimple?.addEventListener('change', (e) => {
    if (e.target && e.target.checked) onModeChange('simple-regex');
  });
  modeAi?.addEventListener('change', (e) => {
    if (e.target && e.target.checked) onModeChange('chrome-ai');
  });

  // Load metrics initially
  await updateMetrics();
  // Auto-refresh metrics every second while popup is open
  metricsTimer = setInterval(updateMetrics, 1000);

  window.addEventListener('beforeunload', () => {
    if (metricsTimer) clearInterval(metricsTimer);
  });

  // Model status
  document.getElementById('model-state').textContent = 'Ready';
}

function startMetricsPolling() {
  // Clear any existing interval
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  // Poll metrics every 1 second for real-time updates
  metricsInterval = setInterval(() => {
    updateMetrics();
    updateCacheStats();
  }, 1000);
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
      document.getElementById('links-detected').textContent = '-';
      document.getElementById('links-processed').textContent = '-';
      document.getElementById('clickbait-detected').textContent = '-';
    document.getElementById('clickbait-summarized').textContent = '-';
      return;
    }

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      document.getElementById('links-detected').textContent = '0';
      document.getElementById('links-processed').textContent = '0';
      document.getElementById('clickbait-detected').textContent = '0';
    document.getElementById('clickbait-summarized').textContent = '0';
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
      if (document.getElementById('links-detected')) {
        document.getElementById('links-detected').textContent = String(response.linksDetected || 0);
      }
    } else {
      // Content script not loaded or error
      document.getElementById('links-detected').textContent = '0';
      document.getElementById('links-processed').textContent = '0';
      document.getElementById('clickbait-detected').textContent = '0';
      if (document.getElementById('links-detected')) {
        document.getElementById('links-detected').textContent = '0';
      }
    }
  } catch (error) {
    // Content script not available on this page (chrome://, extensions page, etc.)
    console.log('Could not get metrics from current tab:', error.message);
    document.getElementById('links-detected').textContent = '-';
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

async function updateCacheStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getCacheStats' });
    const el = document.getElementById('cache-stats');
    if (!el) return;
    if (stats && !stats.error) {
      el.textContent = `Cache storage contains ${stats.classification} classification results and ${stats.summary} article summaries.`;
    } else {
      el.textContent = 'Cache entries: -';
    }
  } catch (e) {
    const el = document.getElementById('cache-stats');
    if (el) el.textContent = 'Cache entries: -';
  }
}
