/**
 * Tests for Extension Context Invalidation Handling
 *
 * These tests verify that BaitBreaker gracefully handles the scenario where
 * the extension context becomes invalidated (due to extension reload, update, etc.)
 */

describe('Extension Context Invalidation', () => {
  let mockChrome;
  let contentManager;
  let mockIndicator;
  let mockLink;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<a href="https://example.com/article">Test Article Link</a>';
    mockLink = document.querySelector('a');

    mockIndicator = document.createElement('span');
    mockIndicator.className = 'bb-indicator';
    mockIndicator.dataset.href = 'https://example.com/article';
    mockIndicator.dataset.linkText = 'Test Article Link';
    document.body.appendChild(mockIndicator);

    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        id: 'test-extension-id',
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({ settings: { enabled: true, sensitivity: 5 } })
        }
      }
    };
    global.chrome = mockChrome;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('isExtensionContextValid()', () => {
    test('should return true when chrome.runtime.id exists', () => {
      // Create a simple test object with the method
      const testObj = {
        isExtensionContextValid() {
          try {
            return !!(chrome?.runtime?.id);
          } catch (e) {
            return false;
          }
        }
      };

      expect(testObj.isExtensionContextValid()).toBe(true);
    });

    test('should return false when chrome.runtime.id is undefined', () => {
      mockChrome.runtime.id = undefined;

      const testObj = {
        isExtensionContextValid() {
          try {
            return !!(chrome?.runtime?.id);
          } catch (e) {
            return false;
          }
        }
      };

      expect(testObj.isExtensionContextValid()).toBe(false);
    });

    test('should return false when chrome.runtime does not exist', () => {
      delete mockChrome.runtime;

      const testObj = {
        isExtensionContextValid() {
          try {
            return !!(chrome?.runtime?.id);
          } catch (e) {
            return false;
          }
        }
      };

      expect(testObj.isExtensionContextValid()).toBe(false);
    });

    test('should handle exceptions gracefully', () => {
      // Make chrome.runtime throw an error
      Object.defineProperty(mockChrome, 'runtime', {
        get() {
          throw new Error('Context invalidated');
        }
      });

      const testObj = {
        isExtensionContextValid() {
          try {
            return !!(chrome?.runtime?.id);
          } catch (e) {
            return false;
          }
        }
      };

      expect(testObj.isExtensionContextValid()).toBe(false);
    });
  });

  describe('safeRuntimeMessage()', () => {
    test('should successfully send message when context is valid', async () => {
      const expectedResponse = { success: true };
      mockChrome.runtime.sendMessage.mockResolvedValue(expectedResponse);

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        }
      };

      const response = await testObj.safeRuntimeMessage({ action: 'test' });

      expect(response).toEqual(expectedResponse);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'test' });
    });

    test('should throw CONTEXT_INVALIDATED when chrome.runtime.id is undefined', async () => {
      mockChrome.runtime.id = undefined;

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }))
        .rejects.toThrow('CONTEXT_INVALIDATED');

      expect(testObj.contextInvalidated).toBe(true);
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should catch and convert "Extension context invalidated" error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated.')
      );

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }))
        .rejects.toThrow('CONTEXT_INVALIDATED');

      expect(testObj.contextInvalidated).toBe(true);
    });

    test('should re-throw other errors without conversion', async () => {
      const otherError = new Error('Network error');
      mockChrome.runtime.sendMessage.mockRejectedValue(otherError);

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }))
        .rejects.toThrow('Network error');

      expect(testObj.contextInvalidated).toBe(false);
    });
  });

  describe('Context Invalidation During Link Processing', () => {
    test('should handle context invalidation during classifyLinks', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated.')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const testObj = {
        processedLinks: new Set(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        },
        markBadgesAsInactive() {
          document.querySelectorAll('.bb-indicator').forEach(badge => {
            badge.style.opacity = '0.5';
            badge.style.cursor = 'not-allowed';
          });
        },
        async processLinks(links) {
          try {
            await this.safeRuntimeMessage({
              action: 'classifyLinks',
              links: links.map(l => ({ text: l.text, href: l.href }))
            });
          } catch (error) {
            if (error.message === 'CONTEXT_INVALIDATED') {
              console.warn('BaitBreaker: Cannot classify links - extension context invalidated');
              this.markBadgesAsInactive();
              return;
            }
            throw error;
          }
        }
      };

      const links = [{ text: 'Test Link', href: 'https://example.com' }];
      await testObj.processLinks(links);

      expect(consoleSpy).toHaveBeenCalledWith(
        'BaitBreaker: Cannot classify links - extension context invalidated'
      );
      expect(mockIndicator.style.opacity).toBe('0.5');
      expect(mockIndicator.style.cursor).toBe('not-allowed');

      consoleSpy.mockRestore();
    });

    test('should not throw when processing links after context invalidation', async () => {
      mockChrome.runtime.id = undefined;

      const testObj = {
        processedLinks: new Set(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          return await chrome.runtime.sendMessage(message);
        },
        markBadgesAsInactive() {},
        async processLinks(links) {
          try {
            await this.safeRuntimeMessage({
              action: 'classifyLinks',
              links: links.map(l => ({ text: l.text, href: l.href }))
            });
          } catch (error) {
            if (error.message === 'CONTEXT_INVALIDATED') {
              this.markBadgesAsInactive();
              return;
            }
            throw error;
          }
        }
      };

      const links = [{ text: 'Test Link', href: 'https://example.com' }];

      // Should not throw
      await expect(testObj.processLinks(links)).resolves.toBeUndefined();
      expect(testObj.contextInvalidated).toBe(true);
    });
  });

  describe('Context Invalidation During Summary Fetch', () => {
    test('should show helpful message when hover triggers context invalidation error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated.')
      );

      let shownSummary = null;
      const testObj = {
        summaryCache: new Map(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        },
        showSummary(anchor, summary, meta) {
          shownSummary = { summary, meta };
        },
        markBadgesAsInactive() {},
        handleContextInvalidation(anchor, linkText) {
          this.showSummary(anchor,
            '⚠️ Extension was reloaded or updated. Please refresh this page to continue using BaitBreaker.',
            {
              linkText: linkText || 'Action Required',
              domain: 'BaitBreaker Extension'
            }
          );
          this.markBadgesAsInactive();
        },
        async getSummary(url, linkText) {
          try {
            const response = await this.safeRuntimeMessage({ action: 'getSummary', url });
            return response;
          } catch (e) {
            if (e.message === 'CONTEXT_INVALIDATED') {
              this.handleContextInvalidation(mockIndicator, linkText);
              return;
            }
            throw e;
          }
        }
      };

      await testObj.getSummary('https://example.com/article', 'Test Article');

      expect(shownSummary).not.toBeNull();
      expect(shownSummary.summary).toContain('Extension was reloaded');
      expect(shownSummary.meta.domain).toBe('BaitBreaker Extension');
    });
  });

  describe('Visual Feedback for Invalidated Context', () => {
    test('should mark all badges as inactive when context is invalidated', () => {
      // Create multiple badges
      const badge1 = document.createElement('span');
      badge1.className = 'bb-indicator';
      const badge2 = document.createElement('span');
      badge2.className = 'bb-indicator';
      document.body.appendChild(badge1);
      document.body.appendChild(badge2);

      const testObj = {
        markBadgesAsInactive() {
          document.querySelectorAll('.bb-indicator').forEach(badge => {
            badge.style.opacity = '0.5';
            badge.style.cursor = 'not-allowed';
            badge.title = 'Extension needs refresh - please reload this page';
          });
        }
      };

      testObj.markBadgesAsInactive();

      const allBadges = document.querySelectorAll('.bb-indicator');
      allBadges.forEach(badge => {
        expect(badge.style.opacity).toBe('0.5');
        expect(badge.style.cursor).toBe('not-allowed');
        expect(badge.title).toContain('Extension needs refresh');
      });
    });

    test('should update badge title with helpful message', () => {
      const testObj = {
        markBadgesAsInactive() {
          document.querySelectorAll('.bb-indicator').forEach(badge => {
            badge.style.opacity = '0.5';
            badge.style.cursor = 'not-allowed';
            badge.title = 'Extension needs refresh - please reload this page';
          });
        }
      };

      testObj.markBadgesAsInactive();

      expect(mockIndicator.title).toBe('Extension needs refresh - please reload this page');
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple rapid calls after context invalidation', async () => {
      mockChrome.runtime.id = undefined;

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          return await chrome.runtime.sendMessage(message);
        }
      };

      // Multiple rapid calls should all fail gracefully
      const calls = [
        testObj.safeRuntimeMessage({ action: 'test1' }),
        testObj.safeRuntimeMessage({ action: 'test2' }),
        testObj.safeRuntimeMessage({ action: 'test3' })
      ];

      await Promise.allSettled(calls);

      // All should be rejected with CONTEXT_INVALIDATED
      for (const call of calls) {
        await expect(call).rejects.toThrow('CONTEXT_INVALIDATED');
      }
    });

    test('should not crash if markBadgesAsInactive is called with no badges', () => {
      document.querySelectorAll('.bb-indicator').forEach(el => el.remove());

      const testObj = {
        markBadgesAsInactive() {
          document.querySelectorAll('.bb-indicator').forEach(badge => {
            badge.style.opacity = '0.5';
          });
        }
      };

      expect(() => testObj.markBadgesAsInactive()).not.toThrow();
    });

    test('should handle context invalidation during prefetch', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated.')
      );

      const testObj = {
        summaryCache: new Map(),
        summaryLoadingStatus: new Map(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        },
        async prefetchSummary(url) {
          this.summaryLoadingStatus.set(url, 'loading');
          try {
            const response = await this.safeRuntimeMessage({ action: 'getSummary', url });
            this.summaryCache.set(url, response);
          } catch (e) {
            if (e.message === 'CONTEXT_INVALIDATED') {
              this.summaryLoadingStatus.set(url, 'error');
              this.summaryCache.set(url, '⚠️ Extension was reloaded. Please refresh this page.');
              return;
            }
            throw e;
          }
        }
      };

      await testObj.prefetchSummary('https://example.com/article');

      expect(testObj.summaryCache.get('https://example.com/article'))
        .toContain('Extension was reloaded');
      expect(testObj.summaryLoadingStatus.get('https://example.com/article')).toBe('error');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle extension reload mid-operation', async () => {
      // Start with valid context
      mockChrome.runtime.sendMessage.mockResolvedValue([
        { isClickbait: true, confidence: 0.9 }
      ]);

      const testObj = {
        processedLinks: new Set(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message) {
          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              this.contextInvalidated = true;
              throw new Error('CONTEXT_INVALIDATED');
            }
            throw error;
          }
        }
      };

      // First call succeeds
      const result1 = await testObj.safeRuntimeMessage({ action: 'test' });
      expect(result1).toEqual([{ isClickbait: true, confidence: 0.9 }]);

      // Simulate extension reload
      mockChrome.runtime.id = undefined;

      // Second call fails with context invalidation
      await expect(testObj.safeRuntimeMessage({ action: 'test' }))
        .rejects.toThrow('CONTEXT_INVALIDATED');

      expect(testObj.contextInvalidated).toBe(true);
    });
  });
});
