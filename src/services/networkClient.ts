/**
 * Enhanced Network Client for Character Operations
 * Provides robust network handling with automatic fallback to mock services
 */

import { NetworkUtils, NetworkRequestOptions } from '../utils/networkUtils';
import { EnvironmentService } from './environmentService';

export interface NetworkClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableMockFallback: boolean;
  mockFallbackDelay: number;
}

export interface NetworkResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  fromMock?: boolean;
}

export class NetworkClient {
  private static config: NetworkClientConfig = {
    baseURL: process.env.REACT_APP_API_URL || 'https://ks7h6drcjd.execute-api.us-west-2.amazonaws.com/prod',
    timeout: 15000, // 15 seconds for character operations
    retries: 2,
    retryDelay: 1000,
    enableMockFallback: true,
    mockFallbackDelay: 3000, // Wait 3 seconds before falling back to mock
  };

  private static isOnline: boolean = true;
  private static lastNetworkCheck: number = 0;
  private static networkCheckInterval: number = 5000; // Check every 5 seconds

  /**
   * Configure the network client
   */
  static configure(config: Partial<NetworkClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  static getConfig(): NetworkClientConfig {
    return { ...this.config };
  }

  /**
   * Check network connectivity with caching
   */
  private static async checkNetworkConnectivity(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if recent
    if (now - this.lastNetworkCheck < this.networkCheckInterval) {
      return this.isOnline;
    }

    // Always use AWS network connectivity check

    try {
      // Try a simple health check
      const healthData = await NetworkUtils.fetchJson(`${this.config.baseURL}/health`, {}, {
        timeout: 3000,
        retries: 0,
      });
      
      // Check if the health response indicates healthy status
      this.isOnline = healthData && (healthData.status === 'healthy' || healthData.status === 'degraded');
      this.lastNetworkCheck = now;
      return this.isOnline;
    } catch (error) {
      console.warn('[NetworkClient] Health check failed:', error);
      this.isOnline = false;
      this.lastNetworkCheck = now;
      return false;
    }
  }

  /**
   * Enhanced POST request with automatic fallback
   */
  static async post<T>(
    endpoint: string,
    data: any,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    // Always use AWS network requests

    // Check network connectivity first
    const isConnected = await this.checkNetworkConnectivity();
    if (!isConnected && this.config.enableMockFallback) {
      console.warn('[NetworkClient] Network appears to be down, will attempt request but may fallback to mock');
    }

    try {
      console.log(`[NetworkClient] Attempting POST to ${url}`);
      
      const requestOptions: NetworkRequestOptions = {
        timeout: this.config.timeout,
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        exponentialBackoff: true,
        ...options,
      };

      const result = await NetworkUtils.postJson<T>(url, data, requestOptions);
      
      console.log(`[NetworkClient] POST to ${url} successful`);
      return {
        data: result,
        success: true,
        fromMock: false,
      };

    } catch (error: any) {
      console.error(`[NetworkClient] POST to ${url} failed:`, error.message);
      
      // Determine if we should fallback to mock
      if (this.shouldFallbackToMock(error)) {
        console.warn('[NetworkClient] Falling back to mock service due to network error');
        throw new NetworkFallbackError(error.message, error);
      }

      // Re-throw with enhanced error information
      throw this.enhanceNetworkError(error, 'POST', url);
    }
  }

  /**
   * Enhanced GET request with automatic fallback
   */
  static async get<T>(
    endpoint: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    // Check if we should use local storage mode
    // Always use AWS network requests

    try {
      console.log(`[NetworkClient] Attempting GET to ${url}`);
      
      const requestOptions: NetworkRequestOptions = {
        timeout: this.config.timeout,
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        exponentialBackoff: true,
        ...options,
      };

      const result = await NetworkUtils.fetchJson<T>(url, {}, requestOptions);
      
      console.log(`[NetworkClient] GET to ${url} successful`);
      return {
        data: result,
        success: true,
        fromMock: false,
      };

    } catch (error: any) {
      console.error(`[NetworkClient] GET to ${url} failed:`, error.message);
      
      // Determine if we should fallback to mock
      if (this.shouldFallbackToMock(error)) {
        console.warn('[NetworkClient] Falling back to mock service due to network error');
        throw new NetworkFallbackError(error.message, error);
      }

      // Re-throw with enhanced error information
      throw this.enhanceNetworkError(error, 'GET', url);
    }
  }

  /**
   * Enhanced PUT request with automatic fallback
   */
  static async put<T>(
    endpoint: string,
    data: any,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    // Check if we should use local storage mode
    // Always use AWS network requests

    try {
      console.log(`[NetworkClient] Attempting PUT to ${url}`);
      
      const requestOptions: NetworkRequestOptions = {
        timeout: this.config.timeout,
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        exponentialBackoff: true,
        ...options,
      };

      const result = await NetworkUtils.putJson<T>(url, data, requestOptions);
      
      console.log(`[NetworkClient] PUT to ${url} successful`);
      return {
        data: result,
        success: true,
        fromMock: false,
      };

    } catch (error: any) {
      console.error(`[NetworkClient] PUT to ${url} failed:`, error.message);
      
      // Determine if we should fallback to mock
      if (this.shouldFallbackToMock(error)) {
        console.warn('[NetworkClient] Falling back to mock service due to network error');
        throw new NetworkFallbackError(error.message, error);
      }

      // Re-throw with enhanced error information
      throw this.enhanceNetworkError(error, 'PUT', url);
    }
  }

  /**
   * Enhanced DELETE request with automatic fallback
   */
  static async delete(
    endpoint: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<void>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    // Check if we should use local storage mode
    // Always use AWS network requests

    try {
      console.log(`[NetworkClient] Attempting DELETE to ${url}`);
      
      const requestOptions: NetworkRequestOptions = {
        timeout: this.config.timeout,
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        exponentialBackoff: true,
        ...options,
      };

      await NetworkUtils.delete(url, requestOptions);
      
      console.log(`[NetworkClient] DELETE to ${url} successful`);
      return {
        data: undefined as any,
        success: true,
        fromMock: false,
      };

    } catch (error: any) {
      console.error(`[NetworkClient] DELETE to ${url} failed:`, error.message);
      
      // Determine if we should fallback to mock
      if (this.shouldFallbackToMock(error)) {
        console.warn('[NetworkClient] Falling back to mock service due to network error');
        throw new NetworkFallbackError(error.message, error);
      }

      // Re-throw with enhanced error information
      throw this.enhanceNetworkError(error, 'DELETE', url);
    }
  }

  /**
   * Determine if we should fallback to mock service
   */
  private static shouldFallbackToMock(error: any): boolean {
    if (!this.config.enableMockFallback) {
      return false;
    }

    // Fallback for network connectivity issues
    if (error.isNetworkError) {
      return true;
    }

    // Fallback for connection refused (no server running)
    if (error.message && error.message.includes('fetch')) {
      return true;
    }

    // Fallback for CORS issues in development
    if (error.message && error.message.includes('CORS')) {
      return true;
    }

    // Fallback for 404 (API endpoint not found)
    if (error.statusCode === 404) {
      return true;
    }

    // Fallback for 500+ server errors
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Enhance network error with additional context
   */
  private static enhanceNetworkError(error: any, method: string, url: string): Error {
    let message = `${method} request to ${url} failed`;
    
    if (error.isNetworkError) {
      if (error.isOffline) {
        message = 'You appear to be offline. Please check your internet connection and try again.';
      } else if (error.isTimeout) {
        message = 'The request timed out. Please try again.';
      } else {
        message = 'Network error occurred. Please check your connection and try again.';
      }
    } else if (error.statusCode) {
      switch (error.statusCode) {
        case 400:
          message = 'Invalid request. Please check your input and try again.';
          break;
        case 401:
          message = 'Authentication required. Please log in and try again.';
          break;
        case 403:
          message = 'Access denied. You do not have permission to perform this action.';
          break;
        case 404:
          message = 'Service not found. The server may be unavailable.';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          message = 'Server error occurred. Please try again later.';
          break;
        case 503:
          message = 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          message = `Server returned error ${error.statusCode}. Please try again.`;
      }
    }

    const enhancedError = new Error(message);
    (enhancedError as any).originalError = error;
    (enhancedError as any).statusCode = error.statusCode;
    (enhancedError as any).isNetworkError = error.isNetworkError;
    
    return enhancedError;
  }

  /**
   * Test network connectivity
   */
  static async testConnectivity(): Promise<{
    isOnline: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    // Always use AWS network connectivity check
    try {
      await this.checkNetworkConnectivity();
      const latency = Date.now() - startTime;
      
      return {
        isOnline: this.isOnline,
        latency,
      };
    } catch (error: any) {
      return {
        isOnline: false,
        error: error.message,
      };
    }
  }
}

/**
 * Special error class to indicate network fallback should occur
 */
export class NetworkFallbackError extends Error {
  public readonly originalError: any;
  public readonly shouldFallback: boolean = true;

  constructor(message: string, originalError: any) {
    super(message);
    this.name = 'NetworkFallbackError';
    this.originalError = originalError;
  }
}

export default NetworkClient;

