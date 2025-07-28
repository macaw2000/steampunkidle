/**
 * Enhanced Error Boundary Component
 * Provides comprehensive error handling with detailed logging and user-friendly recovery options
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLoggingService, ErrorContext } from '../../services/errorLoggingService';
import { DevServiceManager } from '../../services/devServiceManager';
import './EnhancedErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRecovery?: boolean;
  enableReporting?: boolean;
  componentName?: string;
  level?: 'page' | 'section' | 'component';
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRecovering: boolean;
  showDetails: boolean;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[EnhancedErrorBoundary] Caught error:', error);
    console.error('[EnhancedErrorBoundary] Error info:', errorInfo);

    // Create error context
    const context: Partial<ErrorContext> = {
      component: this.props.componentName || 'EnhancedErrorBoundary',
      additionalData: {
        level: this.props.level || 'component',
        retryCount: this.state.retryCount,
        props: this.sanitizeProps(this.props),
        componentStack: errorInfo.componentStack,
      },
    };

    // Log error with detailed context
    const errorId = await ErrorLoggingService.logError(error, context, 'high');

    // Add breadcrumb
    ErrorLoggingService.addBreadcrumb(
      'error',
      'error-boundary',
      `Error caught in ${this.props.componentName || 'component'}`,
      {
        errorMessage: error.message,
        componentStack: errorInfo.componentStack,
      }
    );

    // Update state with error details
    this.setState({
      errorInfo,
      errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private sanitizeProps(props: Props): Record<string, any> {
    // Remove functions and complex objects to avoid circular references
    const sanitized: Record<string, any> = {};
    Object.keys(props).forEach(key => {
      const value = (props as any)[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null || value === undefined) {
        sanitized[key] = value;
      } else {
        sanitized[key] = '[Complex Object]';
      }
    });
    return sanitized;
  }

  private handleRetry = () => {
    const maxRetries = 3;
    if (this.state.retryCount >= maxRetries) {
      console.warn('[EnhancedErrorBoundary] Maximum retry attempts reached');
      return;
    }

    this.setState({ isRecovering: true });

    // Add breadcrumb for retry attempt
    ErrorLoggingService.addBreadcrumb(
      'info',
      'error-boundary',
      `Retry attempt ${this.state.retryCount + 1}`
    );

    // Delay retry to allow for any cleanup
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: this.state.retryCount + 1,
        isRecovering: false,
      });
    }, 1000);
  };

  private handleReload = () => {
    ErrorLoggingService.addBreadcrumb(
      'info',
      'error-boundary',
      'User initiated page reload'
    );
    window.location.reload();
  };

  private handleReportError = async () => {
    if (!this.state.error || !this.props.enableReporting) {
      return;
    }

    try {
      // Re-log the error with user-initiated flag
      await ErrorLoggingService.logError(this.state.error, {
        additionalData: {
          userInitiated: true,
        },
      }, 'medium');
      
      console.log('[EnhancedErrorBoundary] Error reported by user');
    } catch (error) {
      console.error('[EnhancedErrorBoundary] Failed to report error:', error);
    }
  };

  private toggleDetails = () => {
    this.setState({ showDetails: !this.state.showDetails });
  };

  private handleGoHome = () => {
    ErrorLoggingService.addBreadcrumb(
      'info',
      'error-boundary',
      'User navigated to home'
    );
    window.location.href = '/';
  };

  private renderErrorDetails() {
    if (!this.state.showDetails || !this.state.error) {
      return null;
    }

    return (
      <div className="error-details">
        <h4>Technical Details</h4>
        <div className="error-info">
          <div className="error-field">
            <strong>Error ID:</strong> {this.state.errorId || 'N/A'}
          </div>
          <div className="error-field">
            <strong>Error Type:</strong> {this.state.error.name}
          </div>
          <div className="error-field">
            <strong>Message:</strong> {this.state.error.message}
          </div>
          <div className="error-field">
            <strong>Component:</strong> {this.props.componentName || 'Unknown'}
          </div>
          <div className="error-field">
            <strong>Level:</strong> {this.props.level || 'component'}
          </div>
          <div className="error-field">
            <strong>Retry Count:</strong> {this.state.retryCount}
          </div>
          {this.state.error.stack && (
            <div className="error-field">
              <strong>Stack Trace:</strong>
              <pre className="stack-trace">{this.state.error.stack}</pre>
            </div>
          )}
          {this.state.errorInfo?.componentStack && (
            <div className="error-field">
              <strong>Component Stack:</strong>
              <pre className="component-stack">{this.state.errorInfo.componentStack}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  private renderRecoveryActions() {
    const { enableRecovery = true, enableReporting = true } = this.props;
    const canRetry = this.state.retryCount < 3;

    return (
      <div className="error-actions">
        {enableRecovery && canRetry && (
          <button
            className="error-button error-button-primary"
            onClick={this.handleRetry}
            disabled={this.state.isRecovering}
          >
            {this.state.isRecovering ? 'Retrying...' : 'Try Again'}
          </button>
        )}
        
        <button
          className="error-button error-button-secondary"
          onClick={this.handleReload}
        >
          Reload Page
        </button>

        <button
          className="error-button error-button-secondary"
          onClick={this.handleGoHome}
        >
          Go Home
        </button>

        {enableReporting && (
          <button
            className="error-button error-button-tertiary"
            onClick={this.handleReportError}
          >
            Report Issue
          </button>
        )}

        <button
          className="error-button error-button-tertiary"
          onClick={this.toggleDetails}
        >
          {this.state.showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
    );
  }

  private renderErrorMessage() {
    const { level = 'component' } = this.props;
    
    const messages = {
      page: {
        title: 'Page Error',
        description: 'This page encountered an unexpected error and cannot be displayed.',
      },
      section: {
        title: 'Section Error',
        description: 'This section encountered an error and cannot be displayed.',
      },
      component: {
        title: 'Component Error',
        description: 'A component on this page encountered an error.',
      },
    };

    const message = messages[level];

    return (
      <div className="error-message">
        <div className="error-icon">⚠️</div>
        <div className="error-content">
          <h3>{message.title}</h3>
          <p>{message.description}</p>
          {this.state.error && (
            <p className="error-summary">
              <strong>Error:</strong> {this.state.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render enhanced error UI
      return (
        <div className={`enhanced-error-boundary enhanced-error-boundary--${this.props.level || 'component'}`}>
          <div className="error-container">
            {this.renderErrorMessage()}
            {this.renderRecoveryActions()}
            {this.renderErrorDetails()}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;