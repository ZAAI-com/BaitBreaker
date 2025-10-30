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
 * Timeout Configuration
 * All timeout values in milliseconds
 */
export const TIMEOUT_CONFIG = {
  // Classification timeout: base + per-link timeout
  CLASSIFICATION_BASE: 30000,      // 30 seconds base timeout
  CLASSIFICATION_PER_LINK: 5000,    // 5 seconds per link
  // Summary generation timeout
  SUMMARY: 30000,                    // 30 seconds for fetching and summarizing
  // Message/request timeout
  MESSAGE: 45000,                    // 45 seconds - longer than service worker timeout
  // Service worker keepalive interval
  KEEPALIVE_INTERVAL: 5000           // 5 seconds - ping interval to keep worker alive
};

/**
 * Performance Configuration
 * Concurrency limits, cache settings, and size limits
 */
export const PERFORMANCE_CONFIG = {
  // Concurrent link processing limit
  CONCURRENT_LIMIT: 5,
  // Cache configuration
  CACHE: {
    MAX_SIZE: 1000,                  // Maximum cache entries
    DURATION_DAYS: 7                 // Cache duration in days
  },
  // Content length limits
  ARTICLE_LENGTH_LIMIT: 10000,       // Maximum article content length in characters
  TOOLTIP_SUMMARY_LIMIT: 1000,       // Maximum tooltip summary length in characters
  // Error queue configuration
  ERROR_QUEUE_MAX_SIZE: 50            // Maximum error queue size
};

/**
 * Retry Configuration
 * Settings for retry logic and debouncing
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 2,                    // Maximum retry attempts
  RETRY_DELAY: 1000,                  // Delay between retries in milliseconds
  DEBOUNCE_DELAY: 500                 // Debounce delay for link scanning in milliseconds
};

/**
 * UI Configuration
 * Update intervals and UI timeouts
 */
export const UI_CONFIG = {
  METRICS_UPDATE_INTERVAL: 1000,     // Metrics update interval in milliseconds (1 second)
  CLEAR_CACHE_TIMEOUT: 2000           // Clear cache button display timeout in milliseconds (2 seconds)
};

/**
 * Confidence Calculation Configuration
 * Formulas for confidence calculation in detection methods
 */
export const CONFIDENCE_CONFIG = {
  // RegEx detection confidence formula
  REGEX: {
    BASE: 0.3,                        // Base confidence
    MULTIPLIER: 0.15,                 // Per-match multiplier
    MAX: 0.95                          // Maximum confidence
  },
  // Heuristic detection confidence formula
  HEURISTIC: {
    BASE: 0.2,                         // Base confidence
    MULTIPLIER: 0.2,                   // Per-reason multiplier
    MAX: 0.95                          // Maximum confidence
  }
};

/**
 * Get compiled RegEx patterns from pattern strings
 * @returns {RegExp[]} Array of compiled RegExp objects
 */
export function getCompiledRegexPatterns() {
  return REGEX_PATTERNS.map(pattern => new RegExp(pattern, 'i'));
}

/**
 * Calculate classification timeout based on number of links
 * @param {number} linkCount - Number of links to process
 * @returns {number} Timeout in milliseconds
 */
export function getClassificationTimeout(linkCount) {
  return Math.max(
    TIMEOUT_CONFIG.CLASSIFICATION_BASE,
    TIMEOUT_CONFIG.CLASSIFICATION_BASE + (linkCount * TIMEOUT_CONFIG.CLASSIFICATION_PER_LINK)
  );
}

/**
 * Get cache duration in milliseconds
 * @returns {number} Cache duration in milliseconds
 */
export function getCacheDurationMs() {
  return PERFORMANCE_CONFIG.CACHE.DURATION_DAYS * 24 * 60 * 60 * 1000;
}

