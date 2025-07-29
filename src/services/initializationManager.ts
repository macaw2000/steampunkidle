import { store } from '../store/store';
import { authService } from './authService';


export interface InitializationStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  timeout?: number;
  execute: () => Promise<void>;
}

export interface InitializationStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  currentStep: string | null;
  completedSteps: string[];
  failedSteps: string[];
  errors: Array<{
    step: string;
    error: string;
    timestamp: Date;
    recoverable: boolean;
  }>;
  progress: number;
}

export interface InitializationConfig {
  enableProgressiveLoading: boolean;
  skipNonCriticalOnError: boolean;
  maxRetries: number;
  retryDelay: number;
}

class InitializationManager {
  private status: InitializationStatus = {
    isInitialized: false,
    isInitializing: false,
    currentStep: null,
    completedSteps: [],
    failedSteps: [],
    errors: [],
    progress: 0,
  };

  private config: InitializationConfig = {
    enableProgressiveLoading: true,
    skipNonCriticalOnError: true,
    maxRetries: 3,
    retryDelay: 1000,
  };

  private listeners: Array<(status: InitializationStatus) => void> = [];
  private steps: InitializationStep[] = [];

  constructor() {
    this.setupInitializationSteps();
  }

  private setupInitializationSteps(): void {
    this.steps = [
      {
        id: 'store-validation',
        name: 'Store Validation',
        description: 'Validating Redux store configuration',
        required: true,
        timeout: 5000,
        execute: this.validateStore.bind(this),
      },
      {
        id: 'network-check',
        name: 'Network Check',
        description: 'Checking network connectivity',
        required: false,
        timeout: 3000,
        execute: this.checkNetworkConnectivity.bind(this),
      },
      {
        id: 'auth-initialization',
        name: 'Authentication',
        description: 'Initializing authentication system',
        required: true,
        timeout: 10000,
        execute: this.initializeAuthentication.bind(this),
      },
      {
        id: 'service-health',
        name: 'Service Health',
        description: 'Checking external service availability',
        required: false,
        timeout: 5000,
        execute: this.checkServiceHealth.bind(this),
      },
      {
        id: 'local-storage',
        name: 'Local Storage',
        description: 'Validating local storage access',
        required: true,
        timeout: 2000,
        execute: this.validateLocalStorage.bind(this),
      },
      {
        id: 'feature-flags',
        name: 'Feature Flags',
        description: 'Loading feature configuration',
        required: false,
        timeout: 3000,
        execute: this.loadFeatureFlags.bind(this),
      },
    ];
  }

  async initialize(): Promise<InitializationStatus> {
    if (this.status.isInitializing || this.status.isInitialized) {
      return this.status;
    }

    this.status.isInitializing = true;
    this.status.currentStep = null;
    this.status.completedSteps = [];
    this.status.failedSteps = [];
    this.status.errors = [];
    this.status.progress = 0;

    this.notifyListeners();

    try {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        this.status.currentStep = step.id;
        this.status.progress = (i / this.steps.length) * 100;
        this.notifyListeners();

        try {
          await this.executeStepWithRetry(step);
          this.status.completedSteps.push(step.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.status.failedSteps.push(step.id);
          this.status.errors.push({
            step: step.id,
            error: errorMessage,
            timestamp: new Date(),
            recoverable: !step.required,
          });

          if (step.required && !this.config.skipNonCriticalOnError) {
            throw new Error(`Critical initialization step failed: ${step.name} - ${errorMessage}`);
          }

          console.warn(`Non-critical initialization step failed: ${step.name} - ${errorMessage}`);
        }
      }

      this.status.isInitialized = true;
      this.status.progress = 100;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Application initialization failed:', errorMessage);
      
      // Add final error to status
      this.status.errors.push({
        step: 'initialization',
        error: errorMessage,
        timestamp: new Date(),
        recoverable: false,
      });
    } finally {
      this.status.isInitializing = false;
      this.status.currentStep = null;
      this.notifyListeners();
    }

    return this.status;
  }

  private async executeStepWithRetry(step: InitializationStep): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (step.timeout) {
          await this.executeWithTimeout(step.execute, step.timeout);
        } else {
          await step.execute();
        }
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.maxRetries) {
          console.warn(`Step ${step.id} failed (attempt ${attempt}/${this.config.maxRetries}):`, lastError.message);
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  private async executeWithTimeout(fn: () => Promise<void>, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Initialization step implementations
  private async validateStore(): Promise<void> {
    try {
      const state = store.getState();
      if (!state || typeof state !== 'object') {
        throw new Error('Invalid Redux store state');
      }

      // Check required slices
      if (!state.auth || !state.game || !state.chat) {
        throw new Error('Missing required Redux slices');
      }

      console.log('Redux store validation successful');
    } catch (error) {
      throw new Error(`Store validation failed: ${error}`);
    }
  }

  private async checkNetworkConnectivity(): Promise<void> {
    try {
      // Check if we're online
      if (!navigator.onLine) {
        throw new Error('Device is offline');
      }

      // Try to reach a reliable endpoint
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });

      console.log('Network connectivity check successful');
    } catch (error) {
      // Network is unavailable, but this is a non-critical step
      console.warn('Network connectivity check failed, continuing in offline mode');
      throw new Error(`Network connectivity check failed: ${error}`);
    }
  }

  private async initializeAuthentication(): Promise<void> {
    try {
      // This will attempt to restore existing session or return null
      const result = await authService.initializeAuth();
      
      if (result) {
        console.log('Authentication initialized with existing session');
        // Dispatch the authentication data to Redux store
        const { loginSuccess } = await import('../store/slices/authSlice');
        store.dispatch(loginSuccess(result));
        
        // After successful authentication, try to load the user's character
        await this.loadUserCharacter(result.user.userId);
      } else {
        console.log('Authentication initialized without existing session');
      }
    } catch (error) {
      throw new Error(`Authentication initialization failed: ${error}`);
    }
  }

  private async loadUserCharacter(userId: string): Promise<void> {
    try {
      const { CharacterService } = await import('./characterService');
      const character = await CharacterService.getCharacter(userId);
      
      if (character) {
        console.log('Character loaded for user:', userId);
        const { setCharacter } = await import('../store/slices/gameSlice');
        store.dispatch(setCharacter(character));
      } else {
        console.log('No character found for user:', userId);
        // Set hasCharacter to false so the UI shows character creation
        const { setLoading } = await import('../store/slices/gameSlice');
        store.dispatch(setLoading(false));
      }
    } catch (error) {
      console.error('Failed to load character:', error);
      // Don't throw error here as character loading is not critical for auth
    }
  }

  private async checkServiceHealth(): Promise<void> {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      // Check if API is reachable
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        throw new Error(`API health check failed with status: ${response.status}`);
      }

      console.log('Service health check successful');
    } catch (error) {
      throw new Error(`Service health check failed: ${error}`);
    }
  }

  private async validateLocalStorage(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('Local storage is not available');
      }

      // Test localStorage functionality
      const testKey = '__init_test__';
      const testValue = 'test';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        throw new Error('Local storage read/write test failed');
      }

      console.log('Local storage validation successful');
    } catch (error) {
      throw new Error(`Local storage validation failed: ${error}`);
    }
  }

  private async loadFeatureFlags(): Promise<void> {
    try {
      // Load feature flags from environment or API
      const featureFlags = {
        enableOfflineMode: process.env.REACT_APP_ENABLE_OFFLINE_MODE === 'true',
        enableDebugMode: false, // Debug mode disabled in AWS-only deployment
        enableMockAuth: false, // Always use AWS Cognito
      };

      // Store feature flags in a way that components can access them
      if (typeof window !== 'undefined') {
        (window as any).__FEATURE_FLAGS__ = featureFlags;
      }

      console.log('Feature flags loaded:', featureFlags);
    } catch (error) {
      throw new Error(`Feature flags loading failed: ${error}`);
    }
  }

  // Public API
  getStatus(): InitializationStatus {
    return { ...this.status };
  }

  isInitialized(): boolean {
    return this.status.isInitialized;
  }

  isInitializing(): boolean {
    return this.status.isInitializing;
  }

  hasErrors(): boolean {
    return this.status.errors.length > 0;
  }

  getCriticalErrors(): Array<{ step: string; error: string; timestamp: Date }> {
    return this.status.errors.filter(error => !error.recoverable);
  }

  addListener(listener: (status: InitializationStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.status });
      } catch (error) {
        console.error('Error in initialization status listener:', error);
      }
    });
  }

  // Recovery methods
  async retryFailedSteps(): Promise<void> {
    if (this.status.isInitializing) {
      throw new Error('Cannot retry while initialization is in progress');
    }

    const failedSteps = this.steps.filter(step => 
      this.status.failedSteps.includes(step.id)
    );

    if (failedSteps.length === 0) {
      return;
    }

    console.log(`Retrying ${failedSteps.length} failed initialization steps`);

    for (const step of failedSteps) {
      try {
        this.status.currentStep = step.id;
        this.notifyListeners();

        await this.executeStepWithRetry(step);
        
        // Remove from failed steps and add to completed
        const failedIndex = this.status.failedSteps.indexOf(step.id);
        if (failedIndex > -1) {
          this.status.failedSteps.splice(failedIndex, 1);
        }
        
        if (!this.status.completedSteps.includes(step.id)) {
          this.status.completedSteps.push(step.id);
        }

        // Remove related errors
        this.status.errors = this.status.errors.filter(error => error.step !== step.id);

      } catch (error) {
        console.error(`Retry failed for step ${step.id}:`, error);
      }
    }

    this.status.currentStep = null;
    this.status.isInitialized = this.status.failedSteps.length === 0;
    this.notifyListeners();
  }

  reset(): void {
    this.status = {
      isInitialized: false,
      isInitializing: false,
      currentStep: null,
      completedSteps: [],
      failedSteps: [],
      errors: [],
      progress: 0,
    };
    this.notifyListeners();
  }
}

export const initializationManager = new InitializationManager();