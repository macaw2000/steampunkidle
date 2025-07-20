import { initializationManager } from '../initializationManager';

// Mock dependencies
jest.mock('../authService', () => ({
  authService: {
    initializeAuth: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../offlineService', () => ({
  offlineService: {
    isOffline: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../store/store', () => ({
  store: {
    getState: jest.fn().mockReturnValue({
      auth: {},
      game: {},
      chat: {},
    }),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('InitializationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initializationManager.reset();
    
    // Setup default mocks
    (fetch as jest.Mock).mockResolvedValue(new Response('OK', { status: 200 }));
    mockLocalStorage.getItem.mockReturnValue('test');
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
  });

  describe('initialization process', () => {
    it('should initialize successfully with all steps passing', async () => {
      const status = await initializationManager.initialize();

      expect(status.isInitialized).toBe(true);
      expect(status.progress).toBe(100);
      expect(status.errors).toHaveLength(0);
      expect(status.completedSteps).toContain('store-validation');
      expect(status.completedSteps).toContain('auth-initialization');
      expect(status.completedSteps).toContain('local-storage');
    });

    it('should handle non-critical step failures gracefully', async () => {
      // Make network check fail
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const status = await initializationManager.initialize();

      expect(status.isInitialized).toBe(true);
      expect(status.failedSteps).toContain('network-check');
      expect(status.errors.some(e => e.step === 'network-check' && e.recoverable)).toBe(true);
    });

    it('should fail initialization when critical step fails', async () => {
      // Make store validation fail
      const mockStore = require('../../store/store');
      mockStore.store.getState.mockReturnValue(null);

      const status = await initializationManager.initialize();

      expect(status.isInitialized).toBe(false);
      expect(status.failedSteps).toContain('store-validation');
      expect(status.errors.some(e => e.step === 'store-validation' && !e.recoverable)).toBe(true);
    });
  });

  describe('status tracking', () => {
    it('should track initialization progress', async () => {
      const progressUpdates: number[] = [];
      
      const unsubscribe = initializationManager.addListener((status) => {
        progressUpdates.push(status.progress);
      });

      await initializationManager.initialize();
      unsubscribe();

      expect(progressUpdates.length).toBeGreaterThan(1);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should notify listeners of status changes', async () => {
      const statusUpdates: any[] = [];
      
      const unsubscribe = initializationManager.addListener((status) => {
        statusUpdates.push({ ...status });
      });

      await initializationManager.initialize();
      unsubscribe();

      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates[0].isInitializing).toBe(true);
      expect(statusUpdates[statusUpdates.length - 1].isInitializing).toBe(false);
    });
  });

  describe('error recovery', () => {
    it('should retry failed steps', async () => {
      // Make network check fail initially
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(new Response('OK', { status: 200 }));

      // Initial initialization with failure
      await initializationManager.initialize();
      expect(initializationManager.getStatus().failedSteps).toContain('network-check');

      // Retry failed steps
      await initializationManager.retryFailedSteps();
      
      const status = initializationManager.getStatus();
      expect(status.failedSteps).not.toContain('network-check');
      expect(status.completedSteps).toContain('network-check');
    });

    it('should reset initialization state', () => {
      initializationManager.reset();
      
      const status = initializationManager.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isInitializing).toBe(false);
      expect(status.completedSteps).toHaveLength(0);
      expect(status.failedSteps).toHaveLength(0);
      expect(status.errors).toHaveLength(0);
      expect(status.progress).toBe(0);
    });
  });

  describe('step implementations', () => {
    it('should validate Redux store correctly', async () => {
      const mockStore = require('../../store/store');
      mockStore.store.getState.mockReturnValue({
        auth: { user: null },
        game: { character: null },
        chat: { messages: {} },
      });

      const status = await initializationManager.initialize();
      expect(status.completedSteps).toContain('store-validation');
    });

    it('should validate localStorage correctly', async () => {
      mockLocalStorage.getItem.mockReturnValue('test');
      
      const status = await initializationManager.initialize();
      expect(status.completedSteps).toContain('local-storage');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('__init_test__', 'test');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('__init_test__');
    });

    it('should load feature flags correctly', async () => {
      const status = await initializationManager.initialize();
      expect(status.completedSteps).toContain('feature-flags');
      expect((window as any).__FEATURE_FLAGS__).toBeDefined();
    });
  });
});