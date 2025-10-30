# BaitBreaker — Chrome Extension
**Instant answers to clickbait.** BaitBreaker scans pages for clickbait‑style links, adds a `[B]` badge, and on hover shows a concise answer distilled from the target article—so you don't have to click.

## Key features
- Detects likely clickbait titles (regex + on‑device AI)
- Appends `[B]` badge next to links
- Hover the badge to see the **quick answer**
- All AI runs **on‑device** with Chrome’s built‑in Gemini Nano
- One‑time model download; privacy‑friendly (no server calls for AI)

## Install (Unpacked)
1. Download and unzip this repo.
2. Visit `chrome://extensions` → **Load unpacked** → select the folder.
3. Open any news site and hover a `[B]` badge.

## How it works
- **Content script** finds candidate links and injects an **in‑page script** (`inpage.js`) to access the Prompt and Summarizer APIs. Those APIs are not available in service workers or web workers.
- On hover, the content script asks the **service worker** to fetch the article HTML (cross‑origin), then requests a **summary** from the in‑page script.
- First‑time usage may require a click to allow the **model download** (Chrome requirement). After that, hover works seamlessly.

## Permissions
- `host_permissions`: cross‑origin fetch from background for article HTML
- `storage`: lightweight caching
- `activeTab` / `scripting`: standard MV3 patterns

## Notes
- If the model isn’t ready on first hover, click any `[B]` badge once (user activation) or click the toolbar icon and press **Preload on‑device AI** in the popup.
- Works on Chrome 138+ with hardware requirements for on‑device AI.

## License
MIT
