// src/background/article-fetcher.js
// Service workers don't have access to DOMParser, so we use regex-based parsing
import { PERFORMANCE_CONFIG } from '../../config/config.js';

export class ArticleFetcher {
  async fetchAndParse(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract content using regex since DOMParser isn't available in service workers
      const content = this.extractContent(html);
      return content;
    } catch (error) {
      console.error('Failed to fetch article:', error);
      throw new Error(`Unable to fetch article: ${error.message}`);
    }
  }

  extractContent(html) {
    // Try to find article/main content using common patterns
    const patterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i
    ];

    let content = '';

    // Try each pattern
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        content = match[1];
        break;
      }
    }

    // If no pattern matched, use the whole body
    if (!content) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : html;
    }

    // Strip HTML tags and clean text
    return this.cleanText(this.stripHtml(content));
  }

  stripHtml(html) {
    return html
      // Remove script and style tags with their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  cleanText(text) {
    return (text || '')
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double
      .trim()
      .slice(0, PERFORMANCE_CONFIG.ARTICLE_LENGTH_LIMIT);  // Limit length for AI processing
  }
}
