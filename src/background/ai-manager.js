// src/background/ai-manager.js
export class AIManager {
  constructor() {
    this.promptSession = null;
    this.summarizer = null;
    this.initialized = false;
  }

  async initialize() {
    // Check for Chrome AI APIs - they might be under window.ai or global
    const hasAI = ('ai' in self && self.ai) || ('LanguageModel' in self && 'Summarizer' in self);

    if (!hasAI) {
      console.error('Chrome AI APIs not found. Checked:', {
        hasAiProperty: 'ai' in self,
        aiType: typeof self.ai,
        hasLanguageModel: 'LanguageModel' in self,
        hasSummarizer: 'Summarizer' in self
      });
      throw new Error('Chrome AI APIs not available');
    }

    // Use the appropriate API namespace
    const languageModelAPI = self.ai?.languageModel || self.LanguageModel;
    const summarizerAPI = self.ai?.summarizer || self.Summarizer;

    if (!languageModelAPI || !summarizerAPI) {
      throw new Error('Chrome AI APIs not properly initialized');
    }

    const promptAvailability = await languageModelAPI.availability();
    const summarizerAvailability = await summarizerAPI.availability();

    await this.initializePromptAPI(promptAvailability, languageModelAPI);
    await this.initializeSummarizer(summarizerAvailability, summarizerAPI);
    this.initialized = true;
  }

  async initializePromptAPI(availability, languageModelAPI) {
    if (availability === 'unavailable') {
      throw new Error('Prompt API unavailable on this device');
    }

    console.log('Prompt API availability:', availability);

    this.promptSession = await languageModelAPI.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Prompt model download: ${Math.round((e.loaded || 0) * 100)}%`);
        });
      }
    });
  }

  async initializeSummarizer(availability, summarizerAPI) {
    if (availability === 'unavailable') {
      throw new Error('Summarizer API unavailable on this device');
    }

    console.log('Summarizer API availability:', availability);

    this.summarizer = await summarizerAPI.create({
      type: 'tldr',
      format: 'plain-text',
      length: 'short',
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Summarizer model download: ${Math.round((e.loaded || 0) * 100)}%`);
        });
      }
    });
  }

  async classifyClickbait(linkText) {
    const schema = {
      type: "object",
      properties: {
        isClickbait: { type: "boolean" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" }
      },
      required: ["isClickbait", "confidence"]
    };

    const prompt = `Analyze if this title is clickbait (uses curiosity gap, emotional triggers, or withholds key information):
"${linkText}"

Return JSON with isClickbait (boolean), confidence (0-1), and reason.`;

    const result = await this.promptSession.prompt(prompt, {
      responseConstraint: schema
    });

    try {
      return JSON.parse(result);
    } catch {
      return { isClickbait: false, confidence: 0, reason: "Parse error" };
    }
  }

  async summarizeArticle(articleContent) {
    return await this.summarizer.summarize(articleContent);
  }
}
