import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    
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
        <div style={{
          padding: '20px',
          margin: '10px',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          backgroundColor: '#ffe0e0'
        }}>
          <h3 style={{ color: '#d63031', marginTop: 0 }}>
            ⚠️ Component Error
          </h3>
          <p>Something went wrong in this section.</p>
          <details>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {this.state.error?.message}
            </p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;