/**
 * Centralized environment detection service
 * Provides consistent environment information across the application
 */

export interface EnvironmentInfo {
  environment: 'development' | 'production' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  hasBackendAPI: boolean;
  useLocalStorage: boolean;
  enableMockAuth: boolean;
}

export interface EnvironmentConfig {
  apiBaseUrl?: string;
  enableMockAuth: boolean;
  useLocalStorage: boolean;
  enableOfflineMode: boolean;
  enableDebugMode: boolean;
}

export class EnvironmentService {
  private static _config: EnvironmentConfig | null = null;

  /**
   * Get the current environment configuration
   */
  static getConfig(): EnvironmentConfig {
    if (!this._config) {
      this._config = this.detectEnvironment();
    }
    return this._config;
  }

  /**
   * Check if we're in development mode
   */
  static isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Check if we're in production mode
   */
  static isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Get the current environment
   */
  static getEnvironment(): 'development' | 'production' | 'test' {
    const config = this.getConfig();
    
    // If we're using localStorage and mock auth, treat as development
    if (config.useLocalStorage && config.enableMockAuth) {
      return 'development';
    }

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'development') return 'development';
    
    // Default to production
    return 'production';
  }

  /**
   * Check if backend API is available
   */
  static hasBackendAPI(): boolean {
    const config = this.getConfig();
    return !!config.apiBaseUrl && !config.useLocalStorage;
  }

  /**
   * Get environment information
   */
  static getEnvironmentInfo(): EnvironmentInfo {
    const environment = this.getEnvironment();
    const config = this.getConfig();
    
    return {
      environment,
      isDevelopment: environment === 'development',
      isProduction: environment === 'production',
      hasBackendAPI: this.hasBackendAPI(),
      useLocalStorage: config.useLocalStorage,
      enableMockAuth: config.enableMockAuth,
    };
  }

  /**
   * Detect the current environment and create configuration
   */
  private static detectEnvironment(): EnvironmentConfig {
    // Check if we're running in a browser
    const isBrowser = typeof window !== 'undefined';
    
    // Check various environment indicators
    const nodeEnv = process.env.NODE_ENV;
    const isLocalhost = isBrowser && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.endsWith('.local')
    );
    
    // Check if we're running on a development server
    const isDevelopmentServer = isBrowser && (
      window.location.port === '3000' || // React dev server
      window.location.port === '3001' || // Alternative dev port
      window.location.protocol === 'http:' && isLocalhost
    );

    // Check for backend API availability
    const hasApiBaseUrl = !!process.env.REACT_APP_API_BASE_URL;
    
    // Determine if we should use localStorage (no backend available)
    const useLocalStorage = !hasApiBaseUrl || isDevelopmentServer || nodeEnv === 'development';
    
    // Enable mock auth when using localStorage
    const enableMockAuth = useLocalStorage;
    
    // Enable offline mode in development or when no backend
    const enableOfflineMode = useLocalStorage;
    
    // Enable debug mode in development
    const enableDebugMode = nodeEnv === 'development' || isDevelopmentServer;

    return {
      apiBaseUrl: process.env.REACT_APP_API_BASE_URL,
      enableMockAuth,
      useLocalStorage,
      enableOfflineMode,
      enableDebugMode,
    };
  }

  /**
   * Force refresh of environment detection
   */
  static refresh(): void {
    this._config = null;
  }

  /**
   * Override configuration for testing
   */
  static setConfig(config: Partial<EnvironmentConfig>): void {
    this._config = {
      ...this.detectEnvironment(),
      ...config,
    };
  }
}

export default EnvironmentService;