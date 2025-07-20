/**
 * Tests for NetworkUtils
 */

import { NetworkUtils } from '../networkUtils';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('NetworkUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigator as any).onLine = true;
  });

  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', () => {
      (navigator as any).onLine = true;
      expect(NetworkUtils.isOnline()).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      (navigator as any).onLine = false;
      expect(NetworkUtils.isOnline()).toBe(false);
    });
  });

  describe('createNetworkError', () => {
    it('should create a network error with correct properties', () => {
      const error = NetworkUtils.createNetworkError('Test error', {
        isTimeout: true,
        statusCode: 500,
      });

      expect(error.message).toBe('Test error');
      expect(error.isNetworkError).toBe(true);
      expect(error.isTimeout).toBe(true);
      expect(error.isOffline).toBe(false);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = NetworkUtils.createNetworkError('Network error');
      expect(NetworkUtils.isRetryableError(error)).toBe(true);
    });

    it('should return true for retryable status codes', () => {
      const retryableCodes = [408, 429, 500, 502, 503, 504];
      
      retryableCodes.forEach(code => {
        const error = { statusCode: code };
        expect(NetworkUtils.isRetryableError(error)).toBe(true);
      });
    });

    it('should return false for non-retryable status codes', () => {
      const nonRetryableCodes = [400, 401, 403, 404];
      
      nonRetryableCodes.forEach(code => {
        const error = { statusCode: code };
        expect(NetworkUtils.isRetryableError(error)).toBe(false);
      });
    });

    it('should return true for fetch TypeError', () => {
      const error = new TypeError('fetch error');
      expect(NetworkUtils.isRetryableError(error)).toBe(true);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const baseDelay = 1000;
      
      expect(NetworkUtils.calculateRetryDelay(1, baseDelay, true)).toBeGreaterThanOrEqual(500);
      expect(NetworkUtils.calculateRetryDelay(1, baseDelay, true)).toBeLessThanOrEqual(1000);
      
      expect(NetworkUtils.calculateRetryDelay(2, baseDelay, true)).toBeGreaterThanOrEqual(1000);
      expect(NetworkUtils.calculateRetryDelay(2, baseDelay, true)).toBeLessThanOrEqual(2000);
    });

    it('should use fixed delay when exponential backoff is disabled', () => {
      const baseDelay = 1000;
      
      expect(NetworkUtils.calculateRetryDelay(1, baseDelay, false)).toBeGreaterThanOrEqual(500);
      expect(NetworkUtils.calculateRetryDelay(1, baseDelay, false)).toBeLessThanOrEqual(1000);
      
      expect(NetworkUtils.calculateRetryDelay(3, baseDelay, false)).toBeGreaterThanOrEqual(500);
      expect(NetworkUtils.calculateRetryDelay(3, baseDelay, false)).toBeLessThanOrEqual(1000);
    });

    it('should cap delay at maximum', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;
      
      const delay = NetworkUtils.calculateRetryDelay(10, baseDelay, true);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    });
  });

  describe('fetchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = new Response('{"success": true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await NetworkUtils.fetchWithRetry('/test', {}, {
        retries: 2,
        retryDelay: 100,
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error', async () => {
      const networkError = new TypeError('Network error');
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));

      const response = await NetworkUtils.fetchWithRetry('/test', {}, {
        retries: 2,
        retryDelay: 10, // Short delay for testing
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when offline', async () => {
      (navigator as any).onLine = false;

      await expect(
        NetworkUtils.fetchWithRetry('/test')
      ).rejects.toThrow('Device is offline');
    });

    it('should throw error after max retries', async () => {
      const networkError = new TypeError('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        NetworkUtils.fetchWithRetry('/test', {}, {
          retries: 2,
          retryDelay: 10,
        })
      ).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('fetchJson', () => {
    it('should parse JSON response correctly', async () => {
      const testData = { message: 'Hello, World!' };
      const mockResponse = new Response(JSON.stringify(testData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await NetworkUtils.fetchJson('/test');
      expect(result).toEqual(testData);
    });

    it('should throw error for invalid JSON', async () => {
      const mockResponse = new Response('Invalid JSON', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(NetworkUtils.fetchJson('/test')).rejects.toThrow('Failed to parse JSON response');
    });
  });

  describe('postJson', () => {
    it('should send POST request with JSON body', async () => {
      const testData = { name: 'Test' };
      const responseData = { id: 1, ...testData };
      
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await NetworkUtils.postJson('/test', testData);
      
      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
        signal: expect.any(AbortSignal),
      });
    });
  });
});