// popup.js (root) - small loader that works without bundling
(async () => {
  // Dynamically import the module version if allowed
  try {
    const src = chrome.runtime.getURL('src/popup/popup.js');
    await import(src);
  } catch (e) {
    console.warn('Module popup failed to load:', e);
  }
})();
