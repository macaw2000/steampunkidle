/**
 * Global Error Boundary - Enhanced version for application-level error handling
 */

import React, { ReactNode, ErrorInfo } from 'react';
import { EnhancedErrorBoundary } from './EnhancedErrorBoundary';
import { ErrorLoggingService } from '../../services/errorLoggingService';

interface Props {
  children: ReactNode;
}

/**
 * Global Error Boundary that catches all unhandled errors at the application level
 */
const GlobalErrorBoundary: React.FC<Props> = ({ children }) => {
  const handleGlobalError = (error: Error, errorInfo: ErrorInfo) => {
    // Log additional context for global errors
    console.error('Global Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Add breadcrumb for global error
    ErrorLoggingService.addBreadcrumb(
      'error',
      'global-error',
      'Global error boundary activated',
      {
        errorMessage: error.message,
        errorName: error.name,
      }
    );

    // Always provide detailed logging for AWS CloudWatch
    console.group('🚨 Global Runtime Error Details');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  };

  const customFallback = (
    <div style={{
      padding: '40px',
      margin: '20px',
      border: '2px solid #dc2626',
      borderRadius: '12px',
      backgroundColor: '#fef2f2',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: '10vh',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
        <h1 style={{ 
          color: '#dc2626', 
          marginTop: 0, 
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Application Error
        </h1>
        <p style={{ 
          color: '#6b7280', 
          fontSize: '16px',
          lineHeight: '1.5',
          margin: '0 0 20px 0'
        }}>
          The application encountered an unexpected error and cannot continue.
        </p>
      </div>

      <div style={{ 
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          color: '#374151', 
          marginTop: 0, 
          marginBottom: '12px',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          What happened?
        </h3>
        <p style={{ 
          color: '#6b7280',
          fontSize: '14px',
          lineHeight: '1.5',
          margin: 0
        }}>
          A critical error occurred that prevented the application from functioning properly. 
          This error has been logged and will be investigated.
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
        >
          🔄 Reload Application
        </button>
        
        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
        >
          🗑️ Clear Data & Reload
        </button>

        <button
          onClick={() => window.location.href = '/'}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        >
          🏠 Go Home
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#fffbeb',
        border: '1px solid #fbbf24',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <div style={{ fontSize: '20px', flexShrink: 0 }}>💡</div>
          <div>
            <h4 style={{ 
              color: '#92400e', 
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Troubleshooting Tips:
            </h4>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '16px',
              color: '#92400e',
              fontSize: '13px',
              lineHeight: '1.5'
            }}>
              <li>Try refreshing the page first</li>
              <li>Clear browser data if the problem persists</li>
              <li>Check your internet connection</li>
              <li>Ensure all required services are running</li>
              <li>Contact support if the issue continues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <EnhancedErrorBoundary
      fallback={customFallback}
      onError={handleGlobalError}
      enableRecovery={false} // Global errors typically need full reload
      enableReporting={true}
      componentName="GlobalErrorBoundary"
      level="page"
      showErrorDetails={true}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

export default GlobalErrorBoundary;