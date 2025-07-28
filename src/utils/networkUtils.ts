/**
 * Network Utility Functions
 * Helper functions for making HTTP requests with retry logic and error handling
 */

export interface NetworkRequestOptions {
  timeout?: number;
  retries?: number;
  exponentialBackoff?: boolean;
  headers?: Record<string, string>;
  retryDelay?: number;
}

export interface NetworkResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class NetworkUtils {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly BASE_DELAY = 1000; // 1 second

  /**
   * Make a GET request with JSON response
   */
  static async fetchJson<T = any>(
    url: string,
    headers: Record<string, string> = {},
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    return this.makeRequest<T>(url, requestOptions, options);
  }

  /**
   * Make a POST request with JSON body and response
   */
  static async postJson<T = any>(
    url: string,
    body: any,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    };

    return this.makeRequest<T>(url, requestOptions, options);
  }

  /**
   * Make a PUT request with JSON body and response
   */
  static async putJson<T = any>(
    url: string,
    body: any,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    };

    return this.makeRequest<T>(url, requestOptions, options);
  }

  /**
   * Make a DELETE request
   */
  static async deleteJson<T = any>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    return this.makeRequest<T>(url, requestOptions, options);
  }

  /**
   * Make a DELETE request (alias for deleteJson)
   */
  static async delete<T = any>(
    url: string,
    requestOptions: RequestInit,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    return this.makeRequest<T>(url, requestOptions, options);
  }

  /**
   * Core request method with retry logic and timeout handling
   */
  private static async makeRequest<T>(
    url: string,
    requestOptions: RequestInit,
    options: NetworkRequestOptions
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      exponentialBackoff = true,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new NetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.statusText,
            url
          );
        }

        // Try to parse JSON response
        try {
          const data = await response.json();
          return data;
        } catch (parseError) {
          // If JSON parsing fails, return the response text
          const text = await response.text();
          return text as unknown as T;
        }

      } catch (error: any) {
        lastError = error;

        // Check if we're offline
        const isOffline = !navigator.onLine;

        // Don't retry on certain errors
        if (error.name === 'AbortError') {
          throw new NetworkError(
            `Request timeout after ${timeout}ms`,
            408,
            'Request Timeout',
            url,
            { isTimeout: true, isOffline }
          );
        }

        // Handle network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new NetworkError(
            isOffline ? 'You appear to be offline' : 'Network request failed',
            0,
            'Network Error',
            url,
            { isOffline }
          );
        }

        if (error instanceof NetworkError && error.status >= 400 && error.status < 500) {
          // Don't retry client errors (4xx)
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw error;
        }

        // Calculate delay for next attempt
        const delay = exponentialBackoff
          ? this.BASE_DELAY * Math.pow(2, attempt)
          : this.BASE_DELAY;

        console.warn(
          `NetworkUtils: Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
          error.message
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a URL is reachable
   */
  static async isReachable(url: string, timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get network status information
   */
  static getNetworkStatus(): {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const navigator = window.navigator as any;
    
    return {
      online: navigator.onLine,
      effectiveType: navigator.connection?.effectiveType,
      downlink: navigator.connection?.downlink,
      rtt: navigator.connection?.rtt,
    };
  }

  /**
   * Check if the browser is online
   */
  static isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Wait for the browser to come online
   */
  static waitForOnline(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isOnline()) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        window.removeEventListener('online', onlineHandler);
        reject(new Error('Timeout waiting for online connection'));
      }, timeout);

      const onlineHandler = () => {
        clearTimeout(timeoutId);
        window.removeEventListener('online', onlineHandler);
        resolve();
      };

      window.addEventListener('online', onlineHandler);
    });
  }

  /**
   * Listen for network status changes
   */
  static onNetworkStatusChange(callback: (isOnline: boolean) => void): () => void {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(
    attempt: number, 
    baseDelay: number = 1000, 
    exponentialBackoff: boolean = true
  ): number {
    if (!exponentialBackoff) {
      return baseDelay;
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(30000, exponentialDelay + jitter); // Cap at 30 seconds
  }

  /**
   * Create a request with custom headers for authentication
   */
  static withAuth(token: string): {
    fetchJson: <T>(url: string, options?: NetworkRequestOptions) => Promise<T>;
    postJson: <T>(url: string, body: any, options?: NetworkRequestOptions) => Promise<T>;
    putJson: <T>(url: string, body: any, options?: NetworkRequestOptions) => Promise<T>;
    deleteJson: <T>(url: string, options?: NetworkRequestOptions) => Promise<T>;
  } {
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
    };

    return {
      fetchJson: <T>(url: string, options: NetworkRequestOptions = {}) =>
        this.fetchJson<T>(url, authHeaders, options),
      
      postJson: <T>(url: string, body: any, options: NetworkRequestOptions = {}) =>
        this.postJson<T>(url, body, { ...options, headers: { ...authHeaders, ...options.headers } }),
      
      putJson: <T>(url: string, body: any, options: NetworkRequestOptions = {}) =>
        this.putJson<T>(url, body, { ...options, headers: { ...authHeaders, ...options.headers } }),
      
      deleteJson: <T>(url: string, options: NetworkRequestOptions = {}) =>
        this.deleteJson<T>(url, { ...options, headers: { ...authHeaders, ...options.headers } }),
    };
  }

  /**
   * Create a NetworkError with specific options
   */
  static createNetworkError(
    message: string, 
    options: { 
      status?: number; 
      statusText?: string; 
      url?: string; 
      isTimeout?: boolean; 
      isOffline?: boolean; 
    } = {}
  ): NetworkError {
    return new NetworkError(
      message,
      options.status || 0,
      options.statusText || 'Network Error',
      options.url || '',
      { 
        isTimeout: options.isTimeout || false, 
        isOffline: options.isOffline || false 
      }
    );
  }

  /**
   * Fetch with retry logic (alias for fetchJson for backward compatibility)
   */
  static async fetchWithRetry<T = any>(
    url: string,
    headers: Record<string, string> = {},
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    return this.fetchJson<T>(url, headers, options);
  }
}

/**
 * Custom network error class
 */
export class NetworkError extends Error {
  public isNetworkError: boolean = true;
  public isTimeout: boolean = false;
  public isOffline: boolean = false;

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public url: string,
    options: { isTimeout?: boolean; isOffline?: boolean } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout || false;
    this.isOffline = options.isOffline || false;
  }

  get statusCode(): number {
    return this.status;
  }
}

export default NetworkUtils;