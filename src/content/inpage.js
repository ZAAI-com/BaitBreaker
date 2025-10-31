// Page-context script for Chrome Built-in AI
// Prompts are injected via window.__BB_PROMPTS__ (Approach B)
(() => {
  // Prompts are injected here by content script
  const PROMPTS = window.__BB_PROMPTS__ || {
    CLASSIFICATION_PROMPT_TEMPLATE: 'Analyze if this title is clickbait (uses curiosity gap, emotional triggers, or withholds key information).\nTitle: "{title}"\n\nReturn JSON with fields: isClickbait (boolean), confidence (0-1), reason (short).',
    SUMMARIZATION_CONTEXT_TEMPLATE: 'Answer the clickbait-style question concisely in one short sentence. Title: {title}',
    CLASSIFICATION_SCHEMA: {
      "type": "object",
      "properties": {
        "isClickbait": { "type": "boolean" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "reason": { "type": "string" }
      },
      "required": ["isClickbait", "confidence"]
    }
  };

  let promptSession = null;
  let summarizer = null;

  async function ensurePromptSession() {
    if (promptSession) return promptSession;
    try {
      const availability = await LanguageModel.availability();
      if (availability === 'unavailable') throw new Error('Prompt API unavailable');
      promptSession = await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {});
        }
      });
      return promptSession;
    } catch (e) { return null; }
  }

  async function ensureSummarizer() {
    if (summarizer) return summarizer;
    try {
      const availability = await Summarizer.availability();
      if (availability === 'unavailable') throw new Error('Summarizer unavailable');
      summarizer = await Summarizer.create({
        type: 'tldr', format: 'plain-text', length: 'short',
        monitor(m){ m.addEventListener('downloadprogress', (e)=>{}); }
      });
      return summarizer;
    } catch (e) { return null; }
  }

  function buildClassificationPrompt(text) {
    return PROMPTS.CLASSIFICATION_PROMPT_TEMPLATE.replace('{title}', text.replace(/"/g, '\\"'));
  }

  function buildSummarizationContext(title = '') {
    return PROMPTS.SUMMARIZATION_CONTEXT_TEMPLATE.replace('{title}', title);
  }

  async function classify(text) {
    const session = await ensurePromptSession();
    if (!session) throw new Error('Prompt session not ready');
    const prompt = buildClassificationPrompt(text);
    const res = await session.prompt(prompt, { responseConstraint: PROMPTS.CLASSIFICATION_SCHEMA });
    return JSON.parse(res);
  }

  async function summarize(text, context) {
    const s = await ensureSummarizer();
    if (!s) throw new Error('Summarizer not ready');
    const title = context && context.questionLikeTitle ? context.questionLikeTitle : '';
    const ctx = {
      context: buildSummarizationContext(title)
    };
    const out = await s.summarize(text, ctx);
    return out;
  }

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || !ev.data || ev.data.source !== 'BB_CONTENT') return;
    const d = ev.data;
    if (d.type === 'BB_INIT') {
      try { await ensurePromptSession(); await ensureSummarizer(); } catch {}
    } else if (d.type === 'BB_CLASSIFY') {
      const { id, text } = d;
      try {
        const result = await classify(text);
        window.postMessage({ type:'BB_CLASSIFY_RESULT', id, ok:true, result }, '*');
      } catch (e) {
        window.postMessage({ type:'BB_CLASSIFY_RESULT', id, ok:false, error: e && e.message }, '*');
      }
    } else if (d.type === 'BB_SUMMARIZE') {
      const { id, articleText, context } = d;
      try {
        const summary = await summarize(articleText, context);
        window.postMessage({ type:'BB_SUMMARY_RESULT', id, ok:true, summary, meta:{ confidence: 0.85 } }, '*');
      } catch (e) {
        window.postMessage({ type:'BB_SUMMARY_RESULT', id, ok:false, error: e && e.message }, '*');
      }
    }
  });

  window.postMessage({ type:'BB_INPAGE_READY' }, '*');
})();
