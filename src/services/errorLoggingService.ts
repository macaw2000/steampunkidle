/**
 * Error Logging Service
 * Centralized error logging and reporting system
 */

import { EnvironmentService } from './environmentService';

export interface ErrorReport {
  id: string;
  name: string;
  message: string;
  stack?: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'javascript' | 'network' | 'ui' | 'data' | 'auth' | 'unknown';
  context?: ErrorContext;
  breadcrumbs: Breadcrumb[];
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  fingerprint: string;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  additionalData?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface ErrorLoggingConfig {
  enabled: boolean;
  logToConsole: boolean;
  logToRemote: boolean;
  logToLocalStorage: boolean;
  remoteEndpoint?: string;
  maxBreadcrumbs: number;
  maxLocalStorageEntries: number;
  apiKey?: string;
}

class ErrorLoggingServiceClass {
  private config: ErrorLoggingConfig = {
    enabled: true,
    logToConsole: true,
    logToRemote: false,
    logToLocalStorage: true,
    maxBreadcrumbs: 50,
    maxLocalStorageEntries: 100,
  };

  private breadcrumbs: Breadcrumb[] = [];
  private errorReports: ErrorReport[] = [];
  private sessionId: string = this.generateSessionId();

  /**
   * Initialize the error logging service
   */
  initialize(config?: Partial<ErrorLoggingConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }

    // Add initialization breadcrumb
    this.addBreadcrumb('info', 'system', 'ErrorLoggingService initialized');

    console.log('[ErrorLoggingService] Initialized with config:', this.config);
  }

  /**
   * Configure the error logging service
   */
  configure(config: Partial<ErrorLoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorLoggingConfig {
    return { ...this.config };
  }

  /**
   * Log an error with context
   */
  async logError(
    error: Error,
    context?: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const errorId = this.generateErrorId();
    const now = Date.now();
    const fingerprint = this.generateFingerprint(error);
    const errorReport: ErrorReport = {
      id: errorId,
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      timestamp: now,
      severity,
      category: this.categorizeError(error, context),
      context,
      breadcrumbs: [...this.breadcrumbs],
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      userId: context?.userId,
      sessionId: this.sessionId,
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
      fingerprint,
    };

    // Store error report
    this.errorReports.push(errorReport);

    // Log to console if enabled
    if (this.config.logToConsole) {
      console.error('[ErrorLoggingService]', {
        id: errorId,
        message: error.message,
        severity,
        context,
        stack: error.stack,
      });
    }

    // Log to local storage if enabled
    if (this.config.logToLocalStorage) {
      this.saveToLocalStorage(errorReport);
    }

    // Log to remote endpoint if enabled
    if (this.config.logToRemote && this.config.remoteEndpoint) {
      try {
        await this.sendToRemote(errorReport);
      } catch (remoteError) {
        console.warn('[ErrorLoggingService] Failed to send error to remote endpoint:', remoteError);
      }
    }

    return errorId;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(
    level: 'info' | 'warning' | 'error',
    category: string,
    message: string,
    data?: Record<string, any>
  ): void {
    const breadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      category,
      message,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Limit breadcrumbs to max count
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Get all breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Get all error reports
   */
  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    recent: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const bySeverity = this.errorReports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recent = this.errorReports.filter(report => report.timestamp > oneHourAgo).length;

    return {
      total: this.errorReports.length,
      bySeverity,
      recent,
    };
  }

  /**
   * Clear all error reports
   */
  clearErrorReports(): void {
    this.errorReports = [];
    
    // Clear from local storage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('errorLoggingService_errors');
    }
  }

  /**
   * Clear all breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Handle global errors
   */
  private handleGlobalError(event: ErrorEvent): void {
    const error = new Error(event.message);
    error.stack = `${event.filename}:${event.lineno}:${event.colno}`;

    this.logError(error, {
      component: 'global',
      action: 'unhandled-error',
      additionalData: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    }, 'high');
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));

    this.logError(error, {
      component: 'global',
      action: 'unhandled-rejection',
      additionalData: {
        reason: event.reason,
      },
    }, 'high');
  }

  /**
   * Save error to local storage
   */
  private saveToLocalStorage(errorReport: ErrorReport): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const key = 'errorLoggingService_errors';
      const existing = localStorage.getItem(key);
      const errors = existing ? JSON.parse(existing) : [];
      
      errors.push(errorReport);
      
      // Limit stored errors
      if (errors.length > this.config.maxLocalStorageEntries) {
        errors.splice(0, errors.length - this.config.maxLocalStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(errors));
    } catch (error) {
      console.warn('[ErrorLoggingService] Failed to save to localStorage:', error);
    }
  }

  /**
   * Send error to remote endpoint
   */
  private async sendToRemote(errorReport: ErrorReport): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    const payload = {
      ...errorReport,
      environment: EnvironmentService.getEnvironment(),
      buildVersion: process.env.REACT_APP_VERSION || 'unknown',
    };

    const response = await fetch(this.config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Categorize error based on error type and context
   */
  private categorizeError(error: Error, context?: Partial<ErrorContext>): 'javascript' | 'network' | 'ui' | 'data' | 'auth' | 'unknown' {
    // Check error name and message for network errors
    if (error.name === 'NetworkError' || error.message.includes('fetch') || error.message.includes('network')) {
      return 'network';
    }

    // Check for authentication errors
    if (error.message.includes('auth') || error.message.includes('unauthorized') || error.message.includes('token')) {
      return 'auth';
    }

    // Check context for component-related errors
    if (context?.component) {
      return 'ui';
    }

    // Check for data-related errors
    if (error.message.includes('JSON') || error.message.includes('parse') || error.message.includes('data')) {
      return 'data';
    }

    // Check for common JavaScript errors
    if (error.name === 'TypeError' || error.name === 'ReferenceError' || error.name === 'SyntaxError') {
      return 'javascript';
    }

    return 'unknown';
  }

  /**
   * Generate fingerprint for error deduplication
   */
  private generateFingerprint(error: Error): string {
    const message = error.message || '';
    const name = error.name || '';
    const stack = error.stack || '';
    
    // Extract the first line of the stack trace for more specific fingerprinting
    const stackFirstLine = stack.split('\n')[1] || '';
    
    // Create a simple hash-like fingerprint
    const combined = `${name}:${message}:${stackFirstLine}`;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const ErrorLoggingService = new ErrorLoggingServiceClass();
export default ErrorLoggingService;