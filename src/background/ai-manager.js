// src/background/ai-manager.js
export class AIManager {
  constructor() {
    this.promptSession = null;
    this.summarizer = null;
    this.initialized = false;
  }

  async initialize() {
    if (!('LanguageModel' in self) || !('Summarizer' in self)) {
      throw new Error('Chrome AI APIs not available');
    }

    const promptAvailability = await LanguageModel.availability();
    const summarizerAvailability = await Summarizer.availability();

    await this.initializePromptAPI(promptAvailability);
    await this.initializeSummarizer(summarizerAvailability);
    this.initialized = true;
  }

  async initializePromptAPI(availability) {
    if (availability === 'unavailable') {
      throw new Error('Prompt API unavailable on this device');
    }
    this.promptSession = await LanguageModel.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Prompt model download: ${Math.round((e.loaded || 0) * 100)}%`);
        });
      }
    });
  }

  async initializeSummarizer(availability) {
    if (availability === 'unavailable') {
      throw new Error('Summarizer API unavailable on this device');
    }
    this.summarizer = await Summarizer.create({
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
