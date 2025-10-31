// config/prompts.js
/**
 * AI Prompts Configuration
 * Centralized storage for all AI prompts used in the extension
 */

/**
 * Classification schema for structured output
 */
export const CLASSIFICATION_SCHEMA = {
  "type": "object",
  "properties": {
    "isClickbait": { "type": "boolean" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "reason": { "type": "string" }
  },
  "required": ["isClickbait", "confidence"]
};

/**
 * Prompt template for clickbait classification
 * Placeholder: {title} will be replaced with the actual link text
 */
export const CLASSIFICATION_PROMPT_TEMPLATE = `Analyze if this title is clickbait (uses curiosity gap, emotional triggers, or withholds key information).
Title: "{title}"

Return JSON with fields: isClickbait (boolean), confidence (0-1), reason (short).`;

/**
 * Function to build classification prompt with title
 * @param {string} title - The link title to analyze
 * @returns {string} Complete prompt with title inserted
 */
export function buildClassificationPrompt(title) {
  return CLASSIFICATION_PROMPT_TEMPLATE.replace('{title}', title.replace(/"/g, '\\"'));
}

/**
 * Prompt template for summarization context
 * Placeholder: {title} will be replaced with the actual link text
 */
export const SUMMARIZATION_CONTEXT_TEMPLATE = 'Answer the clickbait-style question concisely in one short sentence. Title: {title}';

/**
 * Function to build summarization context with title
 * @param {string} title - The link title (optional)
 * @returns {string} Complete summarization context
 */
export function buildSummarizationContext(title = '') {
  return SUMMARIZATION_CONTEXT_TEMPLATE.replace('{title}', title);
}

/**
 * All prompts exported for easy access
 */
export const PROMPTS = {
  CLASSIFICATION_SCHEMA,
  CLASSIFICATION_PROMPT_TEMPLATE,
  SUMMARIZATION_CONTEXT_TEMPLATE,
  buildClassificationPrompt,
  buildSummarizationContext
};

