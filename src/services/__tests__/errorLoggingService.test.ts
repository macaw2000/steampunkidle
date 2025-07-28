/**
 * Error Logging Service Tests
 */

import { ErrorLoggingService, ErrorReport, Breadcrumb } from '../errorLoggingService';
import { EnvironmentService } from '../environmentService';

// Mock EnvironmentService
jest.mock('../environmentService', () => ({
  EnvironmentService: {
    getEnvironmentInfo: jest.fn().mockReturnValue({
      isDevelopment: true,
      isProduction: false,
    }),
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    getEntriesByType: jest.fn().mockReturnValue([{
      loadEventEnd: 1000,
      loadEventStart: 500,
      domContentLoadedEventEnd: 800,
      domContentLoadedEventStart: 600,
    }]),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ErrorLoggingService', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
  const mockConsoleGroup = jest.spyOn(console, 'group').mockImplementation();
  const mockConsoleGroupEnd = jest.spyOn(console, 'groupEnd').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset the service state
    ErrorLoggingService.clearErrorReports();
    
    // Initialize with test config
    ErrorLoggingService.initialize({
      enabled: true,
      logToConsole: true,
      logToLocalStorage: true,
      logToRemote: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with default configuration', () => {
      const config = ErrorLoggingService.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.logToConsole).toBe(true);
      expect(config.logToLocalStorage).toBe(true);
      expect(config.maxLocalStorageEntries).toBe(100);
      expect(config.enableStackTrace).toBe(true);
      expect(config.enableBreadcrumbs).toBe(true);
    });

    it('allows configuration override during initialization', () => {
      ErrorLoggingService.initialize({
        enabled: false,
        maxLocalStorageEntries: 50,
        enableStackTrace: false,
      });

      const config = ErrorLoggingService.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.maxLocalStorageEntries).toBe(50);
      expect(config.enableStackTrace).toBe(false);
    });

    it('sets up global error handlers', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      ErrorLoggingService.initialize();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('adds initialization breadcrumb', () => {
      ErrorLoggingService.initialize();
      
      const breadcrumbs = ErrorLoggingService.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(1);
      expect(breadcrumbs[0].category).toBe('system');
      expect(breadcrumbs[0].message).toBe('Error logging service initialized');
    });
  });

  describe('Configuration', () => {
    it('updates configuration', () => {
      ErrorLoggingService.configure({
        logToRemote: true,
        remoteEndpoint: 'https://api.example.com/errors',
      });

      const config = ErrorLoggingService.getConfig();
      expect(config.logToRemote).toBe(true);
      expect(config.remoteEndpoint).toBe('https://api.example.com/errors');
    });

    it('returns current configuration', () => {
      const config = ErrorLoggingService.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('logToConsole');
      expect(config).toHaveProperty('logToLocalStorage');
    });
  });

  describe('Error Logging', () => {
    it('logs error with basic information', async () => {
      const error = new Error('Test error');
      const errorId = await ErrorLoggingService.logError(error);

      expect(errorId).toBeTruthy();
      
      const reports = ErrorLoggingService.getErrorReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].message).toBe('Test error');
      expect(reports[0].name).toBe('Error');
      expect(reports[0].severity).toBe('medium');
    });

    it('logs error with custom context', async () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        componentStack: 'TestComponent',
        additionalData: { customField: 'value' },
      };

      await ErrorLoggingService.logError(error, context, 'high');

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports[0].context.userId).toBe('user123');
      expect(reports[0].context.componentStack).toBe('TestComponent');
      expect(reports[0].context.additionalData?.customField).toBe('value');
      expect(reports[0].severity).toBe('high');
    });

    it('includes environment information in context', async () => {
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      const context = reports[0].context;
      
      expect(context.environment).toBe('development');
      expect(context.userAgent).toBe(navigator.userAgent);
      expect(context.url).toBe(window.location.href);
      expect(context.timestamp).toBeTruthy();
    });

    it('includes performance metrics when enabled', async () => {
      ErrorLoggingService.configure({ enablePerformanceMetrics: true });
      
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      const additionalData = reports[0].context.additionalData;
      
      expect(additionalData?.performanceMetrics).toBeDefined();
      expect(additionalData?.memoryUsage).toBeDefined();
    });

    it('includes breadcrumbs when enabled', async () => {
      ErrorLoggingService.addBreadcrumb('test', 'Test breadcrumb', 'info');
      
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      const breadcrumbs = reports[0].context.additionalData?.breadcrumbs as Breadcrumb[];
      
      expect(breadcrumbs).toHaveLength(2); // initialization + test breadcrumb
      expect(breadcrumbs[1].message).toBe('Test breadcrumb');
    });

    it('does not log when disabled', async () => {
      ErrorLoggingService.configure({ enabled: false });
      
      const error = new Error('Test error');
      const errorId = await ErrorLoggingService.logError(error);

      expect(errorId).toBe('');
      expect(ErrorLoggingService.getErrorReports()).toHaveLength(0);
    });

    it('handles logging errors gracefully', async () => {
      // Mock console.error to throw an error
      mockConsoleError.mockImplementationOnce(() => {
        throw new Error('Console error');
      });

      const error = new Error('Test error');
      const errorId = await ErrorLoggingService.logError(error);

      expect(errorId).toBe('');
    });
  });

  describe('Error Deduplication', () => {
    it('deduplicates identical errors', async () => {
      const error1 = new Error('Same error');
      const error2 = new Error('Same error');

      await ErrorLoggingService.logError(error1);
      await ErrorLoggingService.logError(error2);

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].occurrences).toBe(2);
    });

    it('updates last seen timestamp for duplicate errors', async () => {
      const error1 = new Error('Same error');
      const error2 = new Error('Same error');

      await ErrorLoggingService.logError(error1);
      const firstTimestamp = ErrorLoggingService.getErrorReports()[0].lastSeen;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await ErrorLoggingService.logError(error2);
      const secondTimestamp = ErrorLoggingService.getErrorReports()[0].lastSeen;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });
  });

  describe('Error Categorization', () => {
    it('categorizes network errors', async () => {
      const error = new Error('Network request failed');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports[0].category).toBe('network');
    });

    it('categorizes auth errors', async () => {
      const error = new Error('Authentication token expired');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports[0].category).toBe('auth');
    });

    it('categorizes JavaScript errors', async () => {
      const error = new TypeError('Cannot read property of undefined');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports[0].category).toBe('javascript');
    });

    it('categorizes unknown errors', async () => {
      const error = new Error('Unknown error type');
      await ErrorLoggingService.logError(error);

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports[0].category).toBe('unknown');
    });
  });

  describe('Breadcrumbs', () => {
    it('adds breadcrumbs', () => {
      ErrorLoggingService.addBreadcrumb('test', 'Test message', 'info', { data: 'value' });

      const breadcrumbs = ErrorLoggingService.getBreadcrumbs();
      const testBreadcrumb = breadcrumbs.find(b => b.category === 'test');
      
      expect(testBreadcrumb).toBeDefined();
      expect(testBreadcrumb?.message).toBe('Test message');
      expect(testBreadcrumb?.level).toBe('info');
      expect(testBreadcrumb?.data).toEqual({ data: 'value' });
    });

    it('limits breadcrumb count', () => {
      ErrorLoggingService.configure({ maxBreadcrumbs: 3 });

      // Add more breadcrumbs than the limit
      for (let i = 0; i < 5; i++) {
        ErrorLoggingService.addBreadcrumb('test', `Message ${i}`, 'info');
      }

      const breadcrumbs = ErrorLoggingService.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[2].message).toBe('Message 4'); // Should keep the most recent
    });

    it('does not add breadcrumbs when disabled', () => {
      ErrorLoggingService.configure({ enableBreadcrumbs: false });
      
      const initialCount = ErrorLoggingService.getBreadcrumbs().length;
      ErrorLoggingService.addBreadcrumb('test', 'Test message', 'info');

      expect(ErrorLoggingService.getBreadcrumbs()).toHaveLength(initialCount);
    });
  });

  describe('Console Logging', () => {
    it('logs to console when enabled', async () => {
      ErrorLoggingService.configure({ logToConsole: true });
      
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockConsoleGroup).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith('Message:', 'Test error');
      expect(mockConsoleGroupEnd).toHaveBeenCalled();
    });

    it('does not log to console when disabled', async () => {
      ErrorLoggingService.configure({ logToConsole: false });
      
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockConsoleGroup).not.toHaveBeenCalled();
    });

    it('uses different styles for different severity levels', async () => {
      const criticalError = new Error('Critical error');
      await ErrorLoggingService.logError(criticalError, {}, 'critical');

      expect(mockConsoleGroup).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Error Report [CRITICAL]'),
        expect.stringContaining('background-color: #F44336')
      );
    });
  });

  describe('Remote Logging', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);
    });

    it('logs to remote endpoint when enabled', async () => {
      ErrorLoggingService.configure({
        logToRemote: true,
        remoteEndpoint: 'https://api.example.com/errors',
      });

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/errors',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test error'),
        })
      );
    });

    it('does not log to remote when disabled', async () => {
      ErrorLoggingService.configure({ logToRemote: false });

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retries failed remote requests', async () => {
      ErrorLoggingService.configure({
        logToRemote: true,
        remoteEndpoint: 'https://api.example.com/errors',
        enableRetry: true,
        retryAttempts: 2,
        retryDelay: 10,
      });

      // Mock first call to fail, second to succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        } as Response);

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after maximum retry attempts', async () => {
      ErrorLoggingService.configure({
        logToRemote: true,
        remoteEndpoint: 'https://api.example.com/errors',
        enableRetry: true,
        retryAttempts: 2,
        retryDelay: 10,
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to report error (attempt 2/2)'),
        expect.any(Error)
      );
    });
  });

  describe('Local Storage', () => {
    it('saves error reports to localStorage when enabled', async () => {
      ErrorLoggingService.configure({ logToLocalStorage: true });

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'errorReports',
        expect.stringContaining('Test error')
      );
    });

    it('does not save to localStorage when disabled', async () => {
      ErrorLoggingService.configure({ logToLocalStorage: false });

      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('loads error reports from localStorage on initialization', () => {
      const mockReports = [
        {
          id: 'error-1',
          message: 'Stored error',
          fingerprint: 'fp1',
          occurrences: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        },
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockReports));

      ErrorLoggingService.initialize();

      const reports = ErrorLoggingService.getErrorReports();
      expect(reports.some(r => r.message === 'Stored error')).toBe(true);
    });

    it('limits stored error reports', async () => {
      ErrorLoggingService.configure({
        logToLocalStorage: true,
        maxLocalStorageEntries: 2,
      });

      // Add more errors than the limit
      for (let i = 0; i < 3; i++) {
        const error = new Error(`Error ${i}`);
        await ErrorLoggingService.logError(error);
      }

      const saveCall = localStorageMock.setItem.mock.calls.find(
        call => call[0] === 'errorReports'
      );
      const savedReports = JSON.parse(saveCall![1]);
      expect(savedReports).toHaveLength(2);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(async () => {
      // Add some test errors
      await ErrorLoggingService.logError(new Error('Error 1'), {}, 'critical');
      await ErrorLoggingService.logError(new Error('Error 2'), {}, 'high');
      await ErrorLoggingService.logError(new Error('Error 1'), {}, 'critical'); // Duplicate
    });

    it('calculates total errors', () => {
      const stats = ErrorLoggingService.getErrorStatistics();
      expect(stats.totalErrors).toBe(3); // 2 + 1 duplicate
    });

    it('calculates unique errors', () => {
      const stats = ErrorLoggingService.getErrorStatistics();
      expect(stats.uniqueErrors).toBe(2);
    });

    it('calculates critical errors', () => {
      const stats = ErrorLoggingService.getErrorStatistics();
      expect(stats.criticalErrors).toBe(1); // Only unique critical errors
    });

    it('provides top errors by occurrence', () => {
      const stats = ErrorLoggingService.getErrorStatistics();
      expect(stats.topErrors).toHaveLength(2);
      expect(stats.topErrors[0].occurrences).toBe(2); // Error 1 occurred twice
      expect(stats.topErrors[1].occurrences).toBe(1); // Error 2 occurred once
    });
  });

  describe('Cleanup', () => {
    it('clears error reports', async () => {
      const error = new Error('Test error');
      await ErrorLoggingService.logError(error);

      expect(ErrorLoggingService.getErrorReports()).toHaveLength(1);

      ErrorLoggingService.clearErrorReports();

      expect(ErrorLoggingService.getErrorReports()).toHaveLength(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('errorReports');
    });
  });
});