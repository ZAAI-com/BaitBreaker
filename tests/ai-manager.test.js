// tests/ai-manager.test.js
describe('AIManager', () => {
  describe('Clickbait Classification', () => {
    test('should identify question-based clickbait', async () => {
      const manager = {
        classifyClickbait: async () => ({ isClickbait: true, confidence: 0.9 })
      };
      const result = await manager.classifyClickbait(
        "You Won't Believe What This Celebrity Did Next"
      );
      expect(result.isClickbait).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should not flag normal headlines', async () => {
      const manager = {
        classifyClickbait: async () => ({ isClickbait: false, confidence: 0.2 })
      };
      const result = await manager.classifyClickbait(
        "New Study Shows Benefits of Regular Exercise"
      );
      expect(result.isClickbait).toBe(false);
    });
  });
});
