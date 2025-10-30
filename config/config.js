// config/config.js
// Centralized configuration for BaitBreaker extension

/**
 * Detection Mode Configuration
 * Available modes: 'regex' and 'chrome-ai'
 */
export const DETECTION_MODES = {
  REGEX: 'regex',
  CHROME_AI: 'chrome-ai'
};

export const DEFAULT_DETECTION_MODE = DETECTION_MODES.REGEX;

/**
 * RegEx Patterns Configuration
 * Array of pattern strings that will be compiled to RegExp objects at runtime
 */
export const REGEX_PATTERNS = [
  '\\b(you won\'t believe|shocking|revealed|secret|this one trick|this one food|this simple habit|doctors (?:hate|are (?:stunned|shocked))|never guess|what happened next|number \\d+ will|will change your life|jaw[- ]?dropping|mind[- ]?blowing|burns fat)\\b',
  '^\\s*\\d+\\s+(ways|things|reasons|tips)',
  '\\?$',
  '^(what|why|how|when|where|who|which)\\b',
  'top\\s+\\d+',
  'unbelievable|insane|crazy|epic|ultimate',
  'can\'t believe|stop what you\'re doing|must see'
];

/**
 * Chrome AI Sensitivity Configuration
 * Controls the threshold for AI-detected clickbait
 */
export const SENSITIVITY_CONFIG = {
  MIN: 1,
  MAX: 10,
  DEFAULT: 5
};

/**
 * Get compiled RegEx patterns from pattern strings
 * @returns {RegExp[]} Array of compiled RegExp objects
 */
export function getCompiledRegexPatterns() {
  return REGEX_PATTERNS.map(pattern => new RegExp(pattern, 'i'));
}

