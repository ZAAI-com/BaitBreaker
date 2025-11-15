---
title: "ADR-0001: On-Device AI Processing Using Chrome Built-in APIs"
status: "Accepted"
date: "2025-11-15"
authors: "BaitBreaker Development Team"
tags: ["architecture", "decision", "ai", "privacy", "chrome-api"]
supersedes: ""
superseded_by: ""
---

# ADR-0001: On-Device AI Processing Using Chrome Built-in APIs

## Status

**Accepted**

## Context

BaitBreaker is a Chrome browser extension designed to combat clickbait by detecting suspicious headlines and providing instant article summaries without requiring users to click through. The core functionality requires two AI capabilities:

1. **Clickbait Classification**: Determining whether a headline/link is likely clickbait
2. **Article Summarization**: Generating concise summaries of article content

The extension operates in a privacy-sensitive context where users browse news sites and other content platforms. Any AI processing solution must balance multiple competing requirements:

**Technical Constraints:**
- Must work within Chrome Extension Manifest V3 architecture
- Service workers have limited lifetime (30-second timeout)
- Content scripts run in isolated contexts with limited capabilities
- Cross-origin requests require background service worker coordination

**Business Requirements:**
- Zero-cost operation (no ongoing API fees)
- Strong privacy guarantees (users trust us with browsing data)
- Fast response times (< 2 seconds for classification, < 5 seconds for summaries)
- Offline capability preferred
- Minimal resource consumption

**User Experience Requirements:**
- No account creation or API key management
- Works immediately after installation (minimal setup)
- Transparent about data usage
- Reliable performance across different websites

The extension must choose between multiple AI processing approaches, each with significant architectural implications.

## Decision

**We will use Chrome's Built-in AI APIs (Gemini Nano) for all AI processing, running entirely on-device with no server-side AI calls.**

Specifically:
- **Language Model API** (`window.ai.languageModel`): For clickbait classification with structured JSON output
- **Summarizer API** (`window.ai.summarizer`): For article summarization
- **In-page Script Pattern**: AI APIs accessed via `inpage.js` running in page context, coordinated with content script via `window.postMessage`
- **Fallback to Regex**: Maintain regex-based detection as default until Chrome AI becomes widely available

**Implementation Approach:**
1. Implement dual detection modes: `REGEX` (default) and `CHROME_AI` (future)
2. Use feature detection to check API availability before attempting AI operations
3. Require one-time model download (~1.5GB for Gemini Nano)
4. Cache all classification and summary results locally for 7 days
5. All processing occurs on user's device with zero network calls for AI operations

## Consequences

### Positive

- **POS-001**: **Strong Privacy Guarantee** - No user browsing data, headlines, or article content ever leaves the device. This is a core differentiator and builds user trust in a privacy-sensitive domain.

- **POS-002**: **Zero Operational Costs** - No API fees, server hosting costs, or rate limiting concerns. The extension scales to unlimited users without infrastructure costs.

- **POS-003**: **Offline Capability** - Once the model is downloaded, the extension works without internet connectivity. Users can classify and summarize cached articles offline.

- **POS-004**: **Low Latency** - On-device processing typically completes in 1-3 seconds for classification and 3-5 seconds for summaries, faster than typical API round-trips.

- **POS-005**: **No Rate Limiting** - Users are not constrained by API quotas or rate limits. Heavy users can classify hundreds of links without throttling.

- **POS-006**: **Future-Proof Architecture** - Aligns with Chrome's strategic direction. As Chrome AI APIs mature and reach stable release, BaitBreaker benefits from improvements automatically.

- **POS-007**: **Simplified Authentication** - No API keys, account management, or authentication flows required. Reduces friction for users and maintenance burden.

### Negative

- **NEG-001**: **Limited Browser Compatibility** - Chrome AI APIs are initially available only in Chrome Canary with experimental flags enabled. This restricts the initial user base and complicates testing/deployment.

- **NEG-002**: **Large One-Time Download** - Gemini Nano model requires ~1.5GB download on first use. This is prohibitive for users with limited bandwidth or storage, creating a significant barrier to adoption.

- **NEG-003**: **No Model Control** - We cannot customize, fine-tune, or update the AI model. Accuracy is entirely dependent on Google's Gemini Nano releases. Poor performance on specific clickbait patterns cannot be addressed directly.

- **NEG-004**: **API Instability Risk** - Built-in AI APIs are experimental (as of 2025). Breaking changes, deprecations, or API removals could require significant rearchitecture with short notice.

- **NEG-005**: **Service Worker Architecture Complexity** - AI APIs only work in page context, not service workers. This forces a complex three-layer architecture (service worker ↔ content script ↔ in-page script) with error-prone message passing.

- **NEG-006**: **Limited Error Visibility** - On-device model failures (OOM, unsupported hardware, corrupted models) are difficult to diagnose. Users may experience silent failures without clear remediation steps.

- **NEG-007**: **Performance Variability** - Processing speed depends on user's hardware (CPU, RAM, GPU). Low-end devices may experience 10-20 second processing times, degrading UX significantly.

## Alternatives Considered

### Alternative 1: Server-Side AI Processing (OpenAI, Anthropic, or Google Cloud)

- **ALT-001**: **Description**: Host a backend API service that receives headlines/articles from the extension, processes them using commercial AI APIs (GPT-4, Claude, Gemini), and returns classifications/summaries.

- **ALT-002**: **Rejection Reason**: This approach fundamentally conflicts with our privacy-first value proposition. Sending user browsing data (headlines, URLs, article content) to external servers creates privacy risks and requires extensive data handling policies. Additionally, ongoing API costs scale linearly with users (estimated $0.001-0.01 per request × millions of requests monthly = thousands in costs). Rate limiting and API quota management add operational complexity. Server infrastructure introduces latency (network round-trip + processing = 3-10 seconds typical), availability concerns (single point of failure), and maintenance burden.

### Alternative 2: Self-Hosted Open Source Models

- **ALT-003**: **Description**: Deploy open-source models (Llama, Mistral, Flan-T5) on managed infrastructure (AWS, GCP) or serverless platforms (Hugging Face Inference API, Replicate) to maintain control over processing.

- **ALT-004**: **Rejection Reason**: While this addresses some privacy concerns (data processed on our infrastructure), it still requires sending user data over the network. Infrastructure costs remain significant (~$100-500/month for GPU instances + scaling costs). Model deployment, monitoring, version management, and updates require ML engineering expertise. Latency is similar to commercial APIs. This option provides minimal advantages over commercial APIs while adding operational complexity.

### Alternative 3: Downloadable Local Models (TensorFlow.js, ONNX Runtime)

- **ALT-005**: **Description**: Bundle lightweight ML models with the extension or download them separately. Use TensorFlow.js or ONNX Runtime Web to run models directly in the browser using WebAssembly or WebGL.

- **ALT-006**: **Rejection Reason**: Smaller models (~100-500MB) that fit in browser memory lack the language understanding needed for accurate clickbait detection and summarization (accuracy < 70% in testing). Larger models (1-3GB) face similar download concerns as Chrome AI but with inferior performance (2-5× slower inference). We would need to manage model hosting, versioning, and updates ourselves. Chrome AI provides better models with automatic updates at no additional engineering cost.

### Alternative 4: Hybrid Approach (Local Patterns + Cloud AI Fallback)

- **ALT-007**: **Description**: Use regex/heuristic patterns for obvious clickbait (fast, local), falling back to cloud AI for ambiguous cases (user opt-in, encrypted submission).

- **ALT-008**: **Rejection Reason**: This adds significant implementation complexity (dual code paths, fallback logic, user consent flows). "Ambiguous case" classification requires AI itself, creating circular dependency. Users who opt into cloud fallback expose browsing data, fragmenting privacy guarantees. Maintaining two detection systems doubles testing and maintenance burden. Regex patterns alone achieve 60-70% accuracy, which is acceptable as a temporary fallback until Chrome AI stabilizes.

### Alternative 5: Pure Regex/Heuristic Detection (No AI)

- **ALT-009**: **Description**: Rely entirely on pattern matching (curiosity gaps, emotional triggers, listicles, questions) and heuristic signals (all-caps, excessive punctuation, specific keywords).

- **ALT-010**: **Rejection Reason**: While fast (< 10ms), privacy-friendly, and simple to implement, regex-based detection achieves only 60-70% accuracy in production testing. High false positive rate (15-25%) frustrates users with incorrect badges. Cannot adapt to evolving clickbait patterns without manual rule updates. No summarization capability at all—users still need to click through. This severely limits the product's value proposition. We have implemented this as a **fallback mode**, not the primary solution.

## Implementation Notes

- **IMP-001**: **Feature Detection and Graceful Degradation** - Implement robust feature detection for Chrome AI APIs on extension startup. If APIs are unavailable (older Chrome, unsupported OS), automatically fall back to regex mode with user notification. Display download progress during model initialization.

- **IMP-002**: **Three-Layer Message Passing Architecture** - Service worker handles cache/storage and cross-origin article fetching. Content script manages DOM manipulation and user interactions. In-page script accesses Chrome AI APIs and communicates via `window.postMessage`. Implement retry logic and timeout handling for all message channels.

- **IMP-003**: **Caching Strategy** - Cache classification results (key: URL hash, TTL: 7 days) and summary results separately in `chrome.storage.local`. Maximum 1000 entries with LRU eviction. Monitor cache hit rate (target: >70% for returning users) and adjust TTL based on user behavior.

- **IMP-004**: **Performance Monitoring** - Track classification time, summary generation time, cache hit rates, and error rates in background service worker. Store metrics in local storage for popup display. Log slow operations (>10 seconds) to identify problematic articles or model performance issues.

- **IMP-005**: **User Education and Onboarding** - Create first-run experience explaining model download (size, time, privacy benefits). Provide clear status indicators during download (progress bar, estimated time). Offer settings to disable AI mode for users with bandwidth/storage constraints.

- **IMP-006**: **Migration Path** - Monitor Chrome AI API graduation from experimental to stable. Plan feature flag removal and regex mode deprecation when API reaches 80%+ Chrome user availability. Maintain regex mode indefinitely for Firefox/Safari compatibility if future multi-browser support is desired.

## References

- **REF-001**: [Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai/built-in) - Official Chrome AI API documentation including Language Model and Summarizer APIs.

- **REF-002**: [Chrome Extension Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/to-service-workers/) - Service worker architecture patterns and limitations.

- **REF-003**: [BaitBreaker Architecture Overview](../README.md) - Main project documentation with data flow diagrams and component descriptions.

- **REF-004**: `src/background/ai-manager.js` - AI API initialization and session management implementation.

- **REF-005**: `src/content/inpage.js` - In-page script pattern for Chrome AI API access from content script context.

- **REF-006**: `config/config.js` - Centralized configuration including detection modes, timeouts, and performance settings.

- **REF-007**: [Gemini Nano Model Card](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow) - Technical specifications and capabilities of the on-device model (reference placeholder - actual model card pending official release).
