/**
 * Legacy Error Boundary - Wrapper for Enhanced Error Boundary
 * Maintains backward compatibility while using the enhanced implementation
 */

import React, { ReactNode, ErrorInfo } from 'react';
import { EnhancedErrorBoundary } from './EnhancedErrorBoundary';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Legacy ErrorBoundary component that wraps the EnhancedErrorBoundary
 * for backward compatibility
 */
const ErrorBoundary: React.FC<Props> = ({ children, fallback, onError }) => {
  return (
    <EnhancedErrorBoundary
      fallback={fallback}
      onError={onError}
      enableRecovery={true}
      enableReporting={true}
      componentName="ErrorBoundary"
      level="component"
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

export default ErrorBoundary;