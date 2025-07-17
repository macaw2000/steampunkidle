import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('Global Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // In development, also log to help with debugging
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Runtime Error Details');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffe0e0',
          fontFamily: 'monospace'
        }}>
          <h2 style={{ color: '#d63031', marginTop: 0 }}>
            🚨 Application Error
          </h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2d3436' }}>Error Message:</h3>
            <p style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              color: '#d63031',
              fontWeight: 'bold'
            }}>
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <>
              <details style={{ marginBottom: '20px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  Stack Trace
                </summary>
                <pre style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  overflow: 'auto',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}>
                  {this.state.error?.stack}
                </pre>
              </details>

              {this.state.errorInfo && (
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Component Stack
                  </summary>
                  <pre style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '10px', 
                    overflow: 'auto',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </>
          )}

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#0984e3',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              🔄 Reload Page
            </button>
            
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                backgroundColor: '#e17055',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear Data & Reload
            </button>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px'
          }}>
            <strong>💡 Troubleshooting Tips:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li>Try refreshing the page</li>
              <li>Clear browser data and reload</li>
              <li>Check the browser console for more details</li>
              <li>Ensure all required services are running</li>
            </ul>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;