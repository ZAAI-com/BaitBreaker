// BaitBreaker content script
(() => {
  const CLICKBAIT_REGEXES = [
    /\b(you won't believe|shocking|revealed|secret|this one trick|this one food|this simple habit|doctors (?:hate|are (?:stunned|shocked))|never guess|what happened next|number \d+ will|will change your life|jaw[- ]?dropping|mind[- ]?blowing|burns fat)\b/i,
    /^\s*\d+\s+(ways|things|reasons|tips)/i,
    /\?$/,
    /^(what|why|how|when|where|who|which)\b/i
  ];

  function injectInpage() {
    if (document.documentElement.dataset.bbInpageInjected) return;
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/content/inpage.js');
    s.async = false;
    document.documentElement.appendChild(s);
    document.documentElement.dataset.bbInpageInjected = '1';
    s.remove();
  }
  injectInpage();

  const inpageReady = { value: false };
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data) return;
    if (ev.data.type === 'BB_INPAGE_READY') inpageReady.value = true;
    if (ev.data.type === 'BB_SUMMARY_RESULT') {
      const { id, ok, summary, error, meta } = ev.data;
      const pending = pendingSummaries.get(id);
      if (pending) { pending.resolve({ ok, summary, error, meta }); pendingSummaries.delete(id); }
    }
    if (ev.data.type === 'BB_CLASSIFY_RESULT') {
      const { id, ok, result } = ev.data;
      const pending = pendingClassifications.get(id);
      if (pending) { pending.resolve({ ok, result }); pendingClassifications.delete(id); }
    }
  });

  const pendingSummaries = new Map();
  const pendingClassifications = new Map();
  const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  function classifyWithAI(text) {
    const id = uuid();
    return new Promise((resolve) => {
      pendingClassifications.set(id, { resolve });
      window.postMessage({ source:'BB_CONTENT', type:'BB_CLASSIFY', id, text }, '*');
    });
  }

  function summarizeWithAI(articleText, context) {
    const id = uuid();
    return new Promise((resolve) => {
      pendingSummaries.set(id, { resolve });
      window.postMessage({ source:'BB_CONTENT', type:'BB_SUMMARIZE', id, articleText, context }, '*');
    });
  }

  function shouldConsiderClickbait(text) {
    const t = (text || '').trim();
    if (t.length < 10) return false;
    return CLICKBAIT_REGEXES.some(r => r.test(t));
  }

  function createIndicator(linkEl) {
    const b = document.createElement('span');
    b.className = 'bb-indicator';
    b.textContent = '[B]';
    b.title = 'BaitBreaker: Hover to get the answer';
    linkEl.insertAdjacentElement('afterend', b);
    return b;
  }

  function showTooltipNear(anchor, html, classes = '') {
    removeTooltip();
    const t = document.createElement('div');
    t.className = `bb-tooltip ${classes}`.trim();
    t.innerHTML = html;
    positionTooltip(t, anchor);
    document.body.appendChild(t);
    currentTooltip = t;
    return t;
  }
  function positionTooltip(t, anchor) {
    const rect = anchor.getBoundingClientRect();
    const w = 360;
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + w > window.innerWidth) left = window.innerWidth - w - 8;
    if (top + 220 > window.innerHeight) top = rect.top - 230;
    t.style.left = (left + window.scrollX) + 'px';
    t.style.top = (top + window.scrollY) + 'px';
  }
  function removeTooltip() {
    if (currentTooltip && currentTooltip.parentNode) currentTooltip.parentNode.removeChild(currentTooltip);
    currentTooltip = null;
  }
  let currentTooltip = null;

  async function fetchArticle(url) {
    return await chrome.runtime.sendMessage({ type: 'BB_FETCH_ARTICLE', url });
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  async function handleHover(indicator, link) {
    const url = link.href;
    const text = (link.textContent || '').trim();
    if (!text || !url) return;

    const t = showTooltipNear(indicator, `
      <div class="bb-header"><strong>Quick Answer</strong></div>
      <div class="bb-loading"><div class="bb-spinner"></div> Analyzing…</div>
      <div class="bb-note bb-hidden" id="bb-activation-note">Click [B] once to enable on-device AI.</div>
    `, 'bb-loading-state');

    let isClickbait = shouldConsiderClickbait(text);
    try {
      const cls = await classifyWithAI(text);
      if (cls.ok) {
        isClickbait = !!cls.result.isClickbait;
        indicator.dataset.bbConfidence = String(cls.result.confidence || 0);
        indicator.classList.toggle('bb-high', (cls.result.confidence || 0) > 0.7);
      }
    } catch {}

    if (!isClickbait) {
      t.querySelector('.bb-loading').innerHTML = 'Not clickbait — no answer needed.';
      return;
    }

    let article;
    try {
      article = await fetchArticle(url);
      if (!article || !article.ok) throw new Error((article && article.error) || 'Fetch failed');
    } catch (e) {
      t.querySelector('.bb-loading').innerHTML = 'Could not fetch the article content.';
      return;
    }

    try {
      const result = await summarizeWithAI(article.text, {
        questionLikeTitle: text,
        goal: "Answer the clickbait title succinctly for a fast hover tooltip."
      });
      if (!result.ok) {
        t.classList.remove('bb-loading-state');
        const note = t.querySelector('#bb-activation-note');
        if (note) note.classList.remove('bb-hidden');
        t.innerHTML = `
          <div class="bb-header"><strong>Quick Answer</strong></div>
          <div class="bb-activation">
            🚀 First use: click <b>[B]</b> to enable on-device AI, then hover again.
          </div>
        `;
        indicator.classList.add('bb-need-activation');
        return;
      }
      t.classList.remove('bb-loading-state');
      t.innerHTML = `
        <div class="bb-header">
          <strong>Quick Answer</strong>
          <a href="${url}" target="_blank" rel="noopener" class="bb-source">Source</a>
        </div>
        <div class="bb-summary">${escapeHtml(result.summary)}</div>
        <div class="bb-meta">Confidence: ${result.meta && result.meta.confidence ? Math.round(result.meta.confidence*100) : 80}%</div>
      `;
    } catch (e) {
      t.classList.remove('bb-loading-state');
      t.innerHTML = `<div class="bb-error">AI not ready yet. Click [B] once to enable, then try again.</div>`;
      indicator.classList.add('bb-need-activation');
    }
  }

  function scanAndMark() {
    const links = document.querySelectorAll('a[href]');
    for (const a of links) {
      if (a.dataset.bbProcessed) continue;
      a.dataset.bbProcessed = '1';
      const text = (a.textContent || '').trim();
      if (!text || text.length < 10) continue;
      if (shouldConsiderClickbait(text)) {
        const ind = createIndicator(a);
        ind.addEventListener('mouseenter', () => handleHover(ind, a));
        ind.addEventListener('click', () => {
          window.postMessage({ source:'BB_CONTENT', type:'BB_INIT' }, '*');
          setTimeout(() => handleHover(ind, a), 50);
        });
      }
    }
  }

  scanAndMark();
  const mo = new MutationObserver(() => scanAndMark());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
