/**
 * Environment Service - AWS Only
 * Simplified environment detection for AWS-only deployment
 */

export interface EnvironmentInfo {
  environment: 'staging' | 'production' | 'test';
  isStaging: boolean;
  isProduction: boolean;
  hasBackendAPI: boolean;
  enableDebugMode: boolean;
}

interface EnvironmentConfig {
  apiBaseUrl?: string;
  enableDebugMode: boolean;
  enableOfflineMode: boolean;
}

export class EnvironmentService {
  private static config: EnvironmentConfig | null = null;

  /**
   * Initialize the environment service
   */
  static initialize(): void {
    this.config = this.detectEnvironmentConfig();
  }

  /**
   * Check if we're in staging mode
   */
  static isStaging(): boolean {
    return this.getEnvironment() === 'staging';
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
  static getEnvironment(): 'staging' | 'production' | 'test' {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'test') return 'test';
    
    // Check for staging environment indicators
    const awsEnvironment = process.env.REACT_APP_AWS_ENVIRONMENT;
    if (awsEnvironment === 'staging') return 'staging';
    
    // Default to production for AWS deployment
    return 'production';
  }

  /**
   * Check if backend API is available
   */
  static hasBackendAPI(): boolean {
    const config = this.getConfig();
    return !!config.apiBaseUrl;
  }

  /**
   * Get environment information
   */
  static getEnvironmentInfo(): EnvironmentInfo {
    const environment = this.getEnvironment();
    
    return {
      environment,
      isStaging: environment === 'staging',
      isProduction: environment === 'production',
      hasBackendAPI: this.hasBackendAPI(),
      enableDebugMode: this.getConfig().enableDebugMode,
    };
  }

  /**
   * Get environment configuration
   */
  static getConfig(): EnvironmentConfig {
    if (!this.config) {
      this.initialize();
    }
    return this.config!;
  }

  /**
   * Detect environment configuration
   */
  private static detectEnvironmentConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV;
    const awsEnvironment = process.env.REACT_APP_AWS_ENVIRONMENT;
    
    // Get API base URL from environment variables
    const apiBaseUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_AWS_API_URL;
    
    // Enable debug mode in staging or test environments
    const enableDebugMode = awsEnvironment === 'staging' || nodeEnv === 'test';
    
    // Offline mode is not supported in AWS-only architecture
    const enableOfflineMode = false;

    return {
      apiBaseUrl,
      enableDebugMode,
      enableOfflineMode,
    };
  }

  /**
   * Get API base URL
   */
  static getApiBaseUrl(): string {
    const config = this.getConfig();
    if (!config.apiBaseUrl) {
      throw new Error('API base URL is not configured. Please set REACT_APP_API_URL or REACT_APP_AWS_API_URL environment variable.');
    }
    return config.apiBaseUrl;
  }

  /**
   * Get WebSocket URL
   */
  static getWebSocketUrl(): string {
    const wsUrl = process.env.REACT_APP_WS_URL || process.env.REACT_APP_AWS_WS_URL;
    if (!wsUrl) {
      throw new Error('WebSocket URL is not configured. Please set REACT_APP_WS_URL or REACT_APP_AWS_WS_URL environment variable.');
    }
    return wsUrl;
  }

  /**
   * Get AWS region
   */
  static getAwsRegion(): string {
    return process.env.REACT_APP_AWS_REGION || 'us-east-1';
  }

  /**
   * Check if debug mode is enabled
   */
  static isDebugMode(): boolean {
    return this.getConfig().enableDebugMode;
  }

  /**
   * Get environment-specific configuration
   */
  static getEnvironmentSpecificConfig(): {
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    enableMetrics: boolean;
    enableTracing: boolean;
  } {
    const environment = this.getEnvironment();
    
    switch (environment) {
      case 'production':
        return {
          logLevel: 'error',
          enableMetrics: true,
          enableTracing: true,
        };
      case 'staging':
        return {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: true,
        };
      case 'test':
        return {
          logLevel: 'warn',
          enableMetrics: false,
          enableTracing: false,
        };
      default:
        return {
          logLevel: 'error',
          enableMetrics: true,
          enableTracing: true,
        };
    }
  }
}

// Initialize on module load
EnvironmentService.initialize();