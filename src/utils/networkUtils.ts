/**
 * Network utility functions for handling API requests with resilience
 * Provides retry logic, timeout handling, and offline detection
 */

export interface NetworkRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  abortSignal?: AbortSignal;
}

export interface NetworkError extends Error {
  isNetworkError: boolean;
  isTimeout: boolean;
  isOffline: boolean;
  statusCode?: number;
  retryAfter?: number;
}

export class NetworkUtils {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private static readonly MAX_RETRY_DELAY = 30000; // 30 seconds

  /**
   * Check if the browser is online
   */
  static isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Create a network error with additional metadata
   */
  static createNetworkError(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
      retryAfter?: number;
    } = {}
  ): NetworkError {
    const error = new Error(message) as NetworkError;
    error.isNetworkError = true;
    error.isTimeout = options.isTimeout || false;
    error.isOffline = options.isOffline || false;
    error.statusCode = options.statusCode;
    error.retryAfter = options.retryAfter;
    return error;
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.isNetworkError) {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Fetch API network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    exponentialBackoff: boolean = true,
    jitter: boolean = true
  ): number {
    let delay = exponentialBackoff ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;
    
    // Cap the delay
    delay = Math.min(delay, this.MAX_RETRY_DELAY);
    
    // Add jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  static createTimeoutPromise(timeout: number, abortSignal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(this.createNetworkError('Request timeout', { isTimeout: true }));
      }, timeout);

      // Clear timeout if request is aborted
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Request aborted'));
        });
      }
    });
  }

  /**
   * Enhanced fetch with timeout, retries, and error handling
   */
  static async fetchWithRetry(
    url: string,
    init: RequestInit = {},
    options: NetworkRequestOptions = {}
  ): Promise<Response> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      exponentialBackoff = true,
      abortSignal
    } = options;

    // Check if offline
    if (!this.isOnline()) {
      throw this.createNetworkError('Device is offline', { isOffline: true });
    }

    let lastError: any;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine abort signals
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => controller.abort());
        }

        // Make the request with timeout
        const response = await Promise.race([
          fetch(url, {
            ...init,
            signal: controller.signal,
          }),
          this.createTimeoutPromise(timeout, controller.signal),
        ]);

        clearTimeout(timeoutId);

        // Check for HTTP errors
        if (!response.ok) {
          const error = this.createNetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            { statusCode: response.status }
          );

          // Check for Retry-After header
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            error.retryAfter = parseInt(retryAfter) * 1000; // Convert to milliseconds
          }

          throw error;
        }

        return response;

      } catch (error: any) {
        lastError = error;

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt > retries || !this.isRetryableError(error)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = error.retryAfter || this.calculateRetryDelay(
          attempt,
          retryDelay,
          exponentialBackoff
        );

        console.warn(`Request failed (attempt ${attempt}/${retries + 1}), retrying in ${delay}ms:`, error.message);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check if still online before retrying
        if (!this.isOnline()) {
          throw this.createNetworkError('Device went offline during retry', { isOffline: true });
        }
      }
    }

    // All retries exhausted
    throw lastError;
  }

  /**
   * Enhanced fetch with JSON parsing and error handling
   */
  static async fetchJson<T = any>(
    url: string,
    init: RequestInit = {},
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const response = await this.fetchWithRetry(url, init, options);
    
    try {
      return await response.json();
    } catch (error) {
      throw this.createNetworkError('Failed to parse JSON response');
    }
  }

  /**
   * POST request with JSON body
   */
  static async postJson<T = any>(
    url: string,
    data: any,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    return this.fetchJson<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }, options);
  }

  /**
   * PUT request with JSON body
   */
  static async putJson<T = any>(
    url: string,
    data: any,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    return this.fetchJson<T>(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }, options);
  }

  /**
   * DELETE request
   */
  static async delete(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<Response> {
    return this.fetchWithRetry(url, {
      method: 'DELETE',
    }, options);
  }

  /**
   * Listen for online/offline events
   */
  static onNetworkStatusChange(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Wait for network to come back online
   */
  static waitForOnline(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isOnline()) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(this.createNetworkError('Timeout waiting for network', { isTimeout: true }));
      }, timeout);

      const handleOnline = () => {
        cleanup();
        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        window.removeEventListener('online', handleOnline);
      };

      window.addEventListener('online', handleOnline);
    });
  }
}

export default NetworkUtils;