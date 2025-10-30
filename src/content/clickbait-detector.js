// src/content/clickbait-detector.js
import { getCompiledRegexPatterns, CONFIDENCE_CONFIG } from '../../config/config.js';

export const CLICKBAIT_PATTERNS = {
  questions: [/^(what|why|how|when|where|who|which)\s/i, /\?$/],
  curiosityGap: [/you won't believe/i, /shocking/i, /this one trick/i, /doctors hate/i, /number \d+ will shock you/i],
  emotional: [/heartbreaking/i, /jaw-dropping/i, /mind-blowing/i, /unbelievable/i],
  listicles: [/^\d+\s+(ways|things|reasons|tips)/i, /top\s+\d+/i]
};

export function heuristicDetect(text) {
  const reasons = [];
  const t = text.trim();
  if (CLICKBAIT_PATTERNS.questions.some(r => r.test(t))) reasons.push('question form');
  if (CLICKBAIT_PATTERNS.curiosityGap.some(r => r.test(t))) reasons.push('curiosity gap');
  if (CLICKBAIT_PATTERNS.emotional.some(r => r.test(t))) reasons.push('emotional language');
  if (CLICKBAIT_PATTERNS.listicles.some(r => r.test(t))) reasons.push('listicle');
  const confidence = reasons.length > 0 
    ? Math.min(CONFIDENCE_CONFIG.HEURISTIC.BASE + reasons.length * CONFIDENCE_CONFIG.HEURISTIC.MULTIPLIER, CONFIDENCE_CONFIG.HEURISTIC.MAX)
    : 0;
  return { isClickbait: reasons.length > 0, confidence, reason: reasons.join(', ') };
}

// Get compiled regex patterns from config
function getRegexPatterns() {
  return getCompiledRegexPatterns();
}

export function regexDetect(text) {
  const t = text.trim();
  if (!t) return { isClickbait: false, confidence: 0 };

  const patterns = getRegexPatterns();
  const matches = patterns.filter(r => r.test(t));
  const isClickbait = matches.length > 0;
  // Confidence scales with number of distinct regex matches
  const confidence = isClickbait 
    ? Math.min(CONFIDENCE_CONFIG.REGEX.BASE + matches.length * CONFIDENCE_CONFIG.REGEX.MULTIPLIER, CONFIDENCE_CONFIG.REGEX.MAX)
    : 0;
  return { isClickbait, confidence };
}
