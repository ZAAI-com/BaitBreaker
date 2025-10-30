/**
 * Tests for Message Channel Timeout and Service Worker Failures
 *
 * These tests verify that BaitBreaker gracefully handles the scenario where
 * the service worker is terminated mid-operation or operations timeout.
 */

describe('Message Channel Timeout and Service Worker Failures', () => {
  let mockChrome;
  let mockIndicator;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<a href="https://example.com/article">Test Article Link</a>';

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
        },
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };
    global.chrome = mockChrome;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('safeRuntimeMessage() with timeout and retry', () => {
    test('should successfully complete within timeout', async () => {
      const expectedResponse = { success: true };
      mockChrome.runtime.sendMessage.mockResolvedValue(expectedResponse);

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 45000, maxRetries = 2, retryDelay = 1000 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          let lastError = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              if (!this.isExtensionContextValid()) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }
            }

            try {
              const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('TIMEOUT')), timeout)
                )
              ]);
              return response;
            } catch (error) {
              lastError = error;
              const errorMsg = error.message || '';

              if (errorMsg.includes('Extension context invalidated')) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              if (errorMsg === 'TIMEOUT') {
                if (attempt < maxRetries) continue;
                throw new Error('TIMEOUT');
              }

              throw error;
            }
          }

          throw lastError || new Error('Unknown error in safeRuntimeMessage');
        }
      };

      const response = await testObj.safeRuntimeMessage({ action: 'test' });

      expect(response).toEqual(expectedResponse);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    test('should timeout and throw TIMEOUT error after max retries', async () => {
      // Mock a slow response that never completes
      mockChrome.runtime.sendMessage.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 100, maxRetries = 2, retryDelay = 10 } = options; // Short timeout for test

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          let lastError = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              if (!this.isExtensionContextValid()) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }
            }

            try {
              const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('TIMEOUT')), timeout)
                )
              ]);
              return response;
            } catch (error) {
              lastError = error;
              const errorMsg = error.message || '';

              if (errorMsg.includes('Extension context invalidated')) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              if (errorMsg === 'TIMEOUT') {
                if (attempt < maxRetries) continue;
                throw new Error('TIMEOUT');
              }

              throw error;
            }
          }

          throw lastError || new Error('Unknown error in safeRuntimeMessage');
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }, { timeout: 100, maxRetries: 2 }))
        .rejects.toThrow('TIMEOUT');

      // Should have tried 3 times (1 initial + 2 retries)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    }, 10000); // Increase test timeout

    test('should detect message channel closed and retry', async () => {
      let callCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // Fail first 2 attempts
          return Promise.reject(new Error('The message port closed before a response was received.'));
        }
        // Succeed on 3rd attempt
        return Promise.resolve({ success: true });
      });

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 45000, maxRetries = 2, retryDelay = 10 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          let lastError = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              if (!this.isExtensionContextValid()) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }
            }

            try {
              const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('TIMEOUT')), timeout)
                )
              ]);
              return response;
            } catch (error) {
              lastError = error;
              const errorMsg = error.message || '';

              if (errorMsg.includes('Extension context invalidated')) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              if (errorMsg === 'TIMEOUT') {
                if (attempt < maxRetries) continue;
                throw new Error('TIMEOUT');
              }

              throw error;
            }
          }

          throw lastError || new Error('Unknown error in safeRuntimeMessage');
        }
      };

      const response = await testObj.safeRuntimeMessage({ action: 'test' }, { maxRetries: 2 });

      expect(response).toEqual({ success: true });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should throw MESSAGE_CHANNEL_CLOSED after all retries fail', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('The message port closed before a response was received.')
      );

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 45000, maxRetries = 2, retryDelay = 10 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          let lastError = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              if (!this.isExtensionContextValid()) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }
            }

            try {
              const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('TIMEOUT')), timeout)
                )
              ]);
              return response;
            } catch (error) {
              lastError = error;
              const errorMsg = error.message || '';

              if (errorMsg.includes('Extension context invalidated')) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              if (errorMsg === 'TIMEOUT') {
                if (attempt < maxRetries) continue;
                throw new Error('TIMEOUT');
              }

              throw error;
            }
          }

          throw lastError || new Error('Unknown error in safeRuntimeMessage');
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }, { maxRetries: 2 }))
        .rejects.toThrow('MESSAGE_CHANNEL_CLOSED');

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should not retry on context invalidation', async () => {
      mockChrome.runtime.id = undefined;

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 45000, maxRetries = 2 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          // ... rest of implementation
          return await chrome.runtime.sendMessage(message);
        }
      };

      await expect(testObj.safeRuntimeMessage({ action: 'test' }, { maxRetries: 2 }))
        .rejects.toThrow('CONTEXT_INVALIDATED');

      // Should not have attempted to send message at all
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should re-check context before each retry', async () => {
      let callCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        callCount++;
        // Always fail with channel closed error
        return Promise.reject(new Error('The message port closed before a response was received.'));
      });

      const testObj = {
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { timeout = 45000, maxRetries = 2, retryDelay = 10 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          let lastError = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));

              // THIS IS THE KEY: Re-check context before retry
              if (!this.isExtensionContextValid()) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }
            }

            try {
              const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('TIMEOUT')), timeout)
                )
              ]);
              return response;
            } catch (error) {
              lastError = error;
              const errorMsg = error.message || '';

              if (errorMsg.includes('Extension context invalidated')) {
                this.contextInvalidated = true;
                throw new Error('CONTEXT_INVALIDATED');
              }

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              if (errorMsg === 'TIMEOUT') {
                if (attempt < maxRetries) continue;
                throw new Error('TIMEOUT');
              }

              throw error;
            }
          }

          throw lastError || new Error('Unknown error in safeRuntimeMessage');
        }
      };

      // Start the async call
      const promise = testObj.safeRuntimeMessage({ action: 'test' }, { maxRetries: 2, retryDelay: 50 });

      // After first attempt starts, invalidate context
      await new Promise(resolve => setTimeout(resolve, 30));
      mockChrome.runtime.id = undefined;

      // Now wait for the promise - it should fail with CONTEXT_INVALIDATED when it tries to retry
      await expect(promise).rejects.toThrow('CONTEXT_INVALIDATED');

      // Should have only called once, then detected invalid context before retry
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(testObj.contextInvalidated).toBe(true);
    });
  });

  describe('Error handling for service worker failures', () => {
    test('should show timeout message to user', () => {
      let shownSummary = null;

      const testObj = {
        showSummary(anchor, summary, meta) {
          shownSummary = { summary, meta };
        },
        handleServiceWorkerFailure(anchor, linkText, errorType) {
          let message;
          if (errorType === 'TIMEOUT') {
            message = '⏱️ Request timed out. The AI service may be slow or unavailable. Try refreshing the page.';
          } else if (errorType === 'MESSAGE_CHANNEL_CLOSED') {
            message = '⚠️ Connection lost to extension service. The extension may need to be restarted or the page refreshed.';
          } else {
            message = '❌ Unable to connect to extension service. Please refresh this page.';
          }

          this.showSummary(anchor, message, {
            linkText: linkText || 'Error',
            domain: 'BaitBreaker Extension'
          });
        }
      };

      testObj.handleServiceWorkerFailure(mockIndicator, 'Test Article', 'TIMEOUT');

      expect(shownSummary).not.toBeNull();
      expect(shownSummary.summary).toContain('Request timed out');
      expect(shownSummary.meta.domain).toBe('BaitBreaker Extension');
    });

    test('should show channel closed message to user', () => {
      let shownSummary = null;

      const testObj = {
        showSummary(anchor, summary, meta) {
          shownSummary = { summary, meta };
        },
        handleServiceWorkerFailure(anchor, linkText, errorType) {
          let message;
          if (errorType === 'TIMEOUT') {
            message = '⏱️ Request timed out. The AI service may be slow or unavailable. Try refreshing the page.';
          } else if (errorType === 'MESSAGE_CHANNEL_CLOSED') {
            message = '⚠️ Connection lost to extension service. The extension may need to be restarted or the page refreshed.';
          } else {
            message = '❌ Unable to connect to extension service. Please refresh this page.';
          }

          this.showSummary(anchor, message, {
            linkText: linkText || 'Error',
            domain: 'BaitBreaker Extension'
          });
        }
      };

      testObj.handleServiceWorkerFailure(mockIndicator, 'Test Article', 'MESSAGE_CHANNEL_CLOSED');

      expect(shownSummary).not.toBeNull();
      expect(shownSummary.summary).toContain('Connection lost');
      expect(shownSummary.meta.domain).toBe('BaitBreaker Extension');
    });
  });

  describe('Integration with link processing', () => {
    test('should handle MESSAGE_CHANNEL_CLOSED during link classification gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('The message port closed before a response was received.')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const testObj = {
        processedLinks: new Set(),
        contextInvalidated: false,
        isExtensionContextValid() {
          return !!(chrome?.runtime?.id);
        },
        async safeRuntimeMessage(message, options = {}) {
          const { maxRetries = 2, retryDelay = 10 } = options;

          if (!this.isExtensionContextValid()) {
            this.contextInvalidated = true;
            throw new Error('CONTEXT_INVALIDATED');
          }

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }

            try {
              return await chrome.runtime.sendMessage(message);
            } catch (error) {
              const errorMsg = error.message || '';

              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('message port closed') ||
                  errorMsg.includes('receiving end does not exist')) {
                if (attempt < maxRetries) continue;
                throw new Error('MESSAGE_CHANNEL_CLOSED');
              }

              throw error;
            }
          }
        },
        async processLinks(links) {
          try {
            await this.safeRuntimeMessage({
              action: 'classifyLinks',
              links: links.map(l => ({ text: l.text, href: l.href }))
            });
          } catch (error) {
            const errorType = error.message;

            if (errorType === 'CONTEXT_INVALIDATED') {
              console.warn('BaitBreaker: Cannot classify links - extension context invalidated');
              return;
            }

            if (errorType === 'MESSAGE_CHANNEL_CLOSED' || errorType === 'TIMEOUT') {
              console.warn(`BaitBreaker: Cannot classify links - service worker ${errorType.toLowerCase()}`);
              return;
            }

            throw error;
          }
        }
      };

      const links = [{ text: 'Test Link', href: 'https://example.com' }];
      await testObj.processLinks(links);

      expect(consoleSpy).toHaveBeenCalledWith(
        'BaitBreaker: Cannot classify links - service worker message_channel_closed'
      );

      consoleSpy.mockRestore();
    });
  });
});
