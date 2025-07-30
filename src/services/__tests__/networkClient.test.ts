/**
 * Tests for NetworkClient
 */

import { NetworkClient, NetworkFallbackError } from '../networkClient';
import { EnvironmentService } from '../environmentService';

// Mock dependencies
jest.mock('../environmentService');
jest.mock('../../utils/networkUtils');

const mockEnvironmentService = EnvironmentService as jest.Mocked<typeof EnvironmentService>;

describe('NetworkClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default to production mode (not using localStorage)
    mockEnvironmentService.getEnvironmentInfo.mockReturnValue({
      // useLocalStorage removed in AWS-only mode
      isDevelopment: false,
      apiUrl: '/api',
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        timeout: 20000,
        retries: 5,
        enableMockFallback: false,
      };

      NetworkClient.configure(newConfig);
      const config = NetworkClient.getConfig();

      expect(config.timeout).toBe(20000);
      expect(config.retries).toBe(5);
      expect(config.enableMockFallback).toBe(false);
    });
  });

  describe('local storage mode', () => {
    it('should skip network requests in local storage mode', async () => {
      mockEnvironmentService.getEnvironmentInfo.mockReturnValue({
        // useLocalStorage removed in AWS-only mode
        isDevelopment: true,
        apiUrl: '/api',
      });

      await expect(NetworkClient.post('/character', { name: 'test' }))
        .rejects.toThrow('Local storage mode - network requests disabled');
    });
  });

  describe('fallback behavior', () => {
    it('should throw NetworkFallbackError for network connectivity issues', async () => {
      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch error'));

      NetworkClient.configure({ enableMockFallback: true });

      await expect(NetworkClient.post('/character', { name: 'test' }))
        .rejects.toThrow(NetworkFallbackError);
    });

    it('should throw NetworkFallbackError for 404 errors', async () => {
      // Mock fetch to return 404
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      } as Response);

      NetworkClient.configure({ enableMockFallback: true });

      await expect(NetworkClient.post('/character', { name: 'test' }))
        .rejects.toThrow(NetworkFallbackError);
    });

    it('should not fallback when mock fallback is disabled', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch error'));

      NetworkClient.configure({ enableMockFallback: false });

      await expect(NetworkClient.post('/character', { name: 'test' }))
        .rejects.toThrow('Network error occurred');
    });
  });

  describe('error enhancement', () => {
    it('should provide user-friendly error messages for common HTTP status codes', async () => {
      const testCases = [
        { status: 400, expectedMessage: 'Invalid request' },
        { status: 401, expectedMessage: 'Authentication required' },
        { status: 403, expectedMessage: 'Access denied' },
        { status: 404, expectedMessage: 'Service not found' },
        { status: 429, expectedMessage: 'Too many requests' },
        { status: 500, expectedMessage: 'Server error occurred' },
        { status: 503, expectedMessage: 'Service temporarily unavailable' },
      ];

      NetworkClient.configure({ enableMockFallback: false });

      for (const testCase of testCases) {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: testCase.status,
          statusText: 'Error',
          headers: new Headers(),
        } as Response);

        await expect(NetworkClient.post('/character', { name: 'test' }))
          .rejects.toThrow(testCase.expectedMessage);
      }
    });
  });

  describe('connectivity testing', () => {
    it('should test network connectivity', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      } as Response);

      const result = await NetworkClient.testConnectivity();

      expect(result.isOnline).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle connectivity test failures', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await NetworkClient.testConnectivity();

      expect(result.isOnline).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});