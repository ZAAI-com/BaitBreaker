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

// Flat regex list for Simple RegEx mode (provided + extras)
export const CLICKBAIT_REGEXES = [
  /\b(you won't believe|shocking|revealed|secret|this one trick|this one food|this simple habit|doctors (?:hate|are (?:stunned|shocked))|never guess|what happened next|number \d+ will|will change your life|jaw[- ]?dropping|mind[- ]?blowing|burns fat)\b/i,
  /^\s*\d+\s+(ways|things|reasons|tips)/i,
  /\?$/,
  /^(what|why|how|when|where|who|which)\b/i,
  /top\s+\d+/i,
  /unbelievable|insane|crazy|epic|ultimate/i,
  /can't believe|stop what you're doing|must see/i
];

export function regexDetect(text) {
  const t = text.trim();
  if (!t) return { isClickbait: false, confidence: 0 };

  const matches = CLICKBAIT_REGEXES.filter(r => r.test(t));
  const isClickbait = matches.length > 0;
  // Confidence scales with number of distinct regex matches
  const confidence = isClickbait ? Math.min(0.3 + matches.length * 0.15, 0.95) : 0;
  return { isClickbait, confidence };
}

// Alias used by background/service-worker.js for simple detection mode
export function regexDetect(text) { return heuristicDetect(text); }
