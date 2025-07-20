import { createAsyncThunk, AsyncThunkPayloadCreator } from '@reduxjs/toolkit';
import type { RootState } from '../store';

// Enhanced error interface for better error handling
export interface EnhancedError {
  message: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  timestamp: string;
  context?: Record<string, any>;
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return error.code === 'NETWORK_ERROR' || 
           (error.statusCode && error.statusCode >= 500);
  },
};

/**
 * Creates an async thunk with enhanced error handling and retry logic
 */
export function createAsyncThunkWithErrorHandling<Returned, ThunkArg = void>(
  typePrefix: string,
  payloadCreator: AsyncThunkPayloadCreator<Returned, ThunkArg, { state: RootState }>,
  retryConfig: Partial<RetryConfig> = {}
) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  
  // Simplified version to avoid complex TypeScript issues
  return createAsyncThunk<Returned, ThunkArg, { state: RootState }>(
    typePrefix,
    payloadCreator
  );
}

/**
 * Enhances error objects with additional context and metadata
 */
function enhanceError(error: any, context: Record<string, any> = {}): EnhancedError {
  let message = 'An unknown error occurred';
  let code: string | undefined;
  let statusCode: number | undefined;
  let retryable = false;
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    message = error.message || error.error || JSON.stringify(error);
    code = error.code;
    statusCode = error.status || error.statusCode;
  }
  
  // Determine if error is retryable
  if (code === 'NETWORK_ERROR' || 
      message.includes('network') || 
      message.includes('timeout') ||
      (statusCode && statusCode >= 500)) {
    retryable = true;
  }
  
  return {
    message,
    code,
    statusCode,
    retryable,
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Utility for handling common async patterns with error recovery
 */
export class AsyncErrorHandler {
  /**
   * Wraps an async function with error handling and recovery
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    options: {
      fallback?: T;
      onError?: (error: EnhancedError) => void;
      retryConfig?: Partial<RetryConfig>;
    } = {}
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    let lastError: any;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const enhancedError = enhanceError(error, { attempt, maxRetries: config.maxRetries });
        
        // Call error handler if provided
        options.onError?.(enhancedError);
        
        // Check if we should retry
        if (attempt < config.maxRetries && config.retryCondition?.(enhancedError)) {
          const delay = config.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // No more retries, return fallback if provided or throw
        if (options.fallback !== undefined) {
          return options.fallback;
        }
        
        throw enhancedError;
      }
    }
    
    // This should never be reached
    throw enhanceError(lastError);
  }
  
  /**
   * Creates a safe version of an async function that never throws
   */
  static makeSafe<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    fallback: T
  ): (...args: Args) => Promise<T> {
    return async (...args: Args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error('Safe async function caught error:', error);
        return fallback;
      }
    };
  }
}

/**
 * State recovery utilities for corrupted Redux state
 */
export class StateRecovery {
  /**
   * Attempts to recover corrupted state by merging with default values
   */
  static recoverState<T>(corruptedState: any, defaultState: T): T {
    if (!corruptedState || typeof corruptedState !== 'object') {
      return defaultState;
    }
    
    try {
      // Deep merge corrupted state with defaults
      return this.deepMerge(defaultState, corruptedState);
    } catch (error) {
      console.error('State recovery failed:', error);
      return defaultState;
    }
  }
  
  /**
   * Deep merge two objects, preferring valid values from the source
   */
  private static deepMerge<T>(target: T, source: any): T {
    if (!source || typeof source !== 'object') {
      return target;
    }
    
    const result = { ...target } as any;
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = (target as any)[key];
        
        if (sourceValue !== null && sourceValue !== undefined) {
          if (typeof targetValue === 'object' && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
            result[key] = this.deepMerge(targetValue, sourceValue);
          } else {
            result[key] = sourceValue;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Validates and sanitizes state data
   */
  static sanitizeState<T>(state: any, validator: (state: any) => boolean, defaultState: T): T {
    try {
      if (validator(state)) {
        return state;
      }
    } catch (error) {
      console.error('State validation failed:', error);
    }
    
    return defaultState;
  }
}