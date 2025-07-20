/**
 * Network Error Boundary Component
 * Handles network-related errors gracefully with appropriate fallbacks
 */

import React, { Component, ReactNode } from 'react';
import { NetworkError } from '../../utils/networkUtils';
import { offlineService } from '../../services/offlineService';

interface NetworkErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: NetworkError, retry: () => void) => ReactNode;
  onNetworkError?: (error: NetworkError) => void;
}

interface NetworkErrorBoundaryState {
  hasError: boolean;
  error: NetworkError | null;
  retryCount: number;
}

export class NetworkErrorBoundary extends Component<NetworkErrorBoundaryProps, NetworkErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: NetworkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: any): Partial<NetworkErrorBoundaryState> {
    // Check if it's a network error
    if (error.isNetworkError) {
      return {
        hasError: true,
        error: error as NetworkError,
      };
    }
    
    // Not a network error, let other error boundaries handle it
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if ((error as any).isNetworkError) {
      console.error('Network error caught by boundary:', error, errorInfo);
      
      // Call the error callback if provided
      if (this.props.onNetworkError) {
        this.props.onNetworkError(error as NetworkError);
      }
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default network error UI
      return (
        <NetworkErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          canRetry={this.state.retryCount < this.maxRetries}
          retryCount={this.state.retryCount}
        />
      );
    }

    return this.props.children;
  }
}

interface NetworkErrorFallbackProps {
  error: NetworkError;
  onRetry: () => void;
  onReset: () => void;
  canRetry: boolean;
  retryCount: number;
}

const NetworkErrorFallback: React.FC<NetworkErrorFallbackProps> = ({
  error,
  onRetry,
  onReset,
  canRetry,
  retryCount,
}) => {
  const getErrorMessage = () => {
    if (error.isOffline) {
      return 'You appear to be offline. Please check your internet connection.';
    } else if (error.isTimeout) {
      return 'The request timed out. Please check your connection and try again.';
    } else if (error.statusCode) {
      switch (error.statusCode) {
        case 429:
          return 'Too many requests. Please wait a moment before trying again.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Server is temporarily unavailable. Please try again in a few moments.';
        default:
          return `Network error (${error.statusCode}). Please try again.`;
      }
    } else {
      return 'A network error occurred. Please check your connection and try again.';
    }
  };

  const getErrorIcon = () => {
    if (error.isOffline) {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01L16.17 16l1.42 1.42 1.27-1.27z"/>
        </svg>
      );
    } else {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      );
    }
  };

  return (
    <div className="network-error-fallback">
      <div className="network-error-fallback__content">
        <div className="network-error-fallback__icon">
          {getErrorIcon()}
        </div>
        
        <h3 className="network-error-fallback__title">
          {error.isOffline ? 'Connection Lost' : 'Network Error'}
        </h3>
        
        <p className="network-error-fallback__message">
          {getErrorMessage()}
        </p>

        {retryCount > 0 && (
          <p className="network-error-fallback__retry-info">
            Retry attempt {retryCount} of 3
          </p>
        )}

        <div className="network-error-fallback__actions">
          {canRetry && (
            <button
              className="network-error-fallback__button network-error-fallback__button--primary"
              onClick={onRetry}
              disabled={offlineService.isOffline()}
            >
              {offlineService.isOffline() ? 'Waiting for connection...' : 'Try Again'}
            </button>
          )}
          
          <button
            className="network-error-fallback__button network-error-fallback__button--secondary"
            onClick={onReset}
          >
            Reset
          </button>
        </div>

        {error.isOffline && (
          <div className="network-error-fallback__offline-notice">
            <p>Some features may be limited while offline.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkErrorBoundary;