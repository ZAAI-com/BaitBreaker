# BaitBreaker (formerly AntiClickBait) — Complete Engineering Plan
> **Goal**: For any clickbait‑style link on a web page, show a hover tooltip that *directly answers the clickbait question* by summarizing the target article. All AI runs **on‑device** via Chrome’s built‑in AI (Gemini Nano).

## 1) Architecture (MV3)
**Why this shape:** Chrome’s **Prompt API** and **Summarizer API** are not available in Service Workers or Web Workers; they are available in the **top‑level window** (and same‑origin iframes). Therefore, AI calls must execute in the **page context**. We achieve this from an extension via a small **in‑page script** injected by the content script.

- **Content Script**
  - Scans DOM for links, uses fast regex to flag potential clickbait.
  - Injects `inpage.js` (page context) for AI.
  - Adds `[B]` badges and manages tooltips.
  - On hover: asks background to **fetch** the article (cross‑origin), then asks in‑page script to **summarize** the text.
- **In‑Page Script (`inpage.js`)**
  - Creates **Prompt API session** (`LanguageModel`) for structured *clickbait classification*.
  - Creates **Summarizer** for one‑sentence quick answers.
  - Requires **user activation** once to permit initial model download (clicking `[B]` or using popup “Preload”).
- **Background Service Worker**
  - Cross‑origin **fetch** (with `host_permissions`) and light caching via `chrome.storage.local`.
  - No AI calls here (APIs not available in workers).

## 2) Key API integration (Chrome Built‑in AI)
- **Prompt API (LanguageModel)**
  - `LanguageModel.availability()` → determine readiness.
  - `LanguageModel.create({ monitor })` → create session (may trigger download).
  - `session.prompt(text, { responseConstraint: jsonSchema })` → structured output (JSON).
- **Summarizer API**
  - `Summarizer.availability()` + `Summarizer.create({ type:'tldr', format:'plain-text', length:'short' })`
  - `summarize(text, { context })` → one‑sentence answer.
- **User Activation**
  - First use may require a **click**. We surface a gentle note on first hover and handle click on `[B]` to initialize sessions.

## 3) Clickbait detection
- **Fast pass:** Regex heuristics for questions, curiosity‑gap phrases, emotional hooks, and listicles.
- **AI pass:** Prompt API structured classification returning `{ isClickbait, confidence, reason }`.

## 4) Summarization prompt design
- Summarizer `type:"tldr"`, `format:"plain-text"`, `length:"short"`.
- Context example: “Answer the clickbait‑style question concisely… Output one short sentence that directly answers the question.”

## 5) Tooltip UX
- `[B]` badge next to links.
- Hover → “Analyzing…” spinner; if AI not ready → “Click [B] once to enable on‑device AI.”
- When ready → quick answer + source link; subtle confidence indicator.

## 6) Caching & performance
- Background caches article text (7 days, per‑URL).
- Debounced DOM scans with `MutationObserver`.
- AI sessions kept warm in page; destroyed automatically when page unloads.
- Minimal CSS/JS footprint; no external deps.

## 7) Privacy & security
- AI runs **on‑device**. No external model calls.
- Sanitize tooltip HTML (we render plain text).
- Minimal permissions (`host_permissions` for fetch, `storage` for cache).

## 8) Testing strategy
- Unit: regex detection, cache hashing, HTML extraction fallback.
- Manual: open various news pages; validate first‑time activation flow; verify hover answers.

## 9) Build & ship
- No bundler required to run unpacked; optional Webpack/Vite can be added later.
- Ship `README.md`, this plan, MIT license, icons.

## 10) Future work
- Options page: sensitivity slider, domain allow/deny list.
- Integrate Rewriter API for tone control of answers (subject to origin trial).
- Streamed summarization for ultra‑fast perceived latency.

**Renaming note:** The original “AntiClickBait (ACB)” is now **BaitBreaker** throughout the codebase and docs.
