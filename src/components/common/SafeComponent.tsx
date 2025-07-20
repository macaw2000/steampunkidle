/**
 * SafeComponent - A wrapper that catches rendering errors and provides fallbacks
 * This component ensures that rendering errors don't crash the entire application
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';

export interface SafeComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorMessage?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface SafeComponentState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class SafeComponent extends Component<SafeComponentProps, SafeComponentState> {
  constructor(props: SafeComponentProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SafeComponentState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SafeComponent caught an error:', error);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="safe-component-error">
          <div className="safe-component-error__content">
            <span className="safe-component-error__icon">⚠️</span>
            <h4 className="safe-component-error__title">Component Error</h4>
            <p className="safe-component-error__message">
              {this.props.errorMessage || 'This component encountered an error and cannot be displayed.'}
            </p>
            
            {this.props.showErrorDetails && process.env.NODE_ENV === 'development' && (
              <details className="safe-component-error__details">
                <summary>Error Details</summary>
                <pre className="safe-component-error__stack">
                  {this.state.error?.message}
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeComponent;