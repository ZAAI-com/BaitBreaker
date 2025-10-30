// BaitBreaker Service Worker (MV3): cross-origin fetch + cache
const CACHE_PREFIX = 'bb_cache_';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'BB_FETCH_ARTICLE') {
        const url = msg.url;
        const cached = await getCache(url);
        if (cached) { sendResponse({ ok:true, text: cached }); return; }
        const res = await fetch(url, { credentials: 'omit' });
        const html = await res.text();
        const text = extractArticleText(html);
        await setCache(url, text);
        sendResponse({ ok:true, text });
      } else if (msg.type === 'BB_CLEAR_CACHE') {
        await clearOld();
        sendResponse({ ok:true });
      }
    } catch (e) {
      sendResponse({ ok:false, error: e && e.message });
    }
  })();
  return true;
});

function hash(str) {
  let h = 0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return 'h'+(h>>>0).toString(16);
}
async function getCache(url) {
  const key = CACHE_PREFIX + hash(url);
  const obj = await chrome.storage.local.get(key);
  const entry = obj[key];
  if (entry && (Date.now()-entry.ts) < MAX_AGE_MS) return entry.text;
  return null;
}
async function setCache(url, text) {
  const key = CACHE_PREFIX + hash(url);
  await chrome.storage.local.set({ [key]: { ts: Date.now(), text } });
}
async function clearOld() {
  const all = await chrome.storage.local.get();
  const rm = [];
  for (const [k,v] of Object.entries(all)) {
    if (k.startsWith(CACHE_PREFIX)) {
      if (!v || !v.ts || (Date.now()-v.ts) > MAX_AGE_MS) rm.push(k);
    }
  }
  if (rm.length) await chrome.storage.local.remove(rm);
}
function extractArticleText(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sels = ['article','main','[role="main"]','.article-content','.post-content','.entry-content','#content'];
    for (const sel of sels) {
      const el = doc.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 200) return clean(el.textContent);
    }
    return clean(doc.body ? doc.body.textContent : '');
  } catch(e) {
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');
    return clean(text);
  }
}
function clean(t){ return (t||'').replace(/\s+/g,' ').trim().slice(0,20000); }
