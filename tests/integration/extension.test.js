// tests/integration/extension.test.js
const puppeteer = require('puppeteer');
const path = require('path');

describe('Extension Integration', () => {
  let browser;
  const pathToExtension = path.join(__dirname, '../../');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });
  });

  afterAll(async () => {
    await browser?.close();
  });

  test('should mark clickbait links on page load', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <a href="https://example.com">You Won't Believe What Happened Next</a>
      <a href="https://example.com">Climate Summit Reaches Agreement on Carbon Emissions</a>
    `);
    await page.waitForTimeout(1500);
    const indicators = await page.$$eval('.bb-indicator', els => els.length);
    expect(indicators).toBeGreaterThan(0);
  });
});
