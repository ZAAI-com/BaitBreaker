// src/content/clickbait-detector.js
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
  return { isClickbait: reasons.length > 0, confidence: Math.min(0.2 + reasons.length * 0.2, 0.95), reason: reasons.join(', ') };
}

// Alias used by background/service-worker.js for simple detection mode
export function regexDetect(text) { return heuristicDetect(text); }
