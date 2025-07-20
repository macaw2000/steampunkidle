/**
 * Service Fallback Components
 * Provides fallback UI components when services are unavailable
 */

import React, { ReactNode } from 'react';
import SafeComponent from './SafeComponent';

export interface ServiceFallbackProps {
  serviceName: string;
  children?: ReactNode;
  onRetry?: () => void;
  showRetry?: boolean;
  message?: string;
}

/**
 * Generic service unavailable fallback
 */
export const ServiceUnavailableFallback: React.FC<ServiceFallbackProps> = ({
  serviceName,
  children,
  onRetry,
  showRetry = true,
  message,
}) => {
  const defaultMessage = `${serviceName} service is currently unavailable. Some features may be limited.`;

  return (
    <div className="service-fallback">
      <div className="service-fallback__content">
        <div className="service-fallback__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        
        <h4 className="service-fallback__title">Service Unavailable</h4>
        
        <p className="service-fallback__message">
          {message || defaultMessage}
        </p>

        {showRetry && onRetry && (
          <button
            className="service-fallback__retry-button"
            onClick={onRetry}
          >
            Try Again
          </button>
        )}

        {children && (
          <div className="service-fallback__additional">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Authentication service fallback
 */
export const AuthServiceFallback: React.FC<Omit<ServiceFallbackProps, 'serviceName'>> = (props) => (
  <ServiceUnavailableFallback
    {...props}
    serviceName="Authentication"
    message="Authentication service is unavailable. Please try refreshing the page or check your connection."
  >
    <div className="auth-fallback-actions">
      <button
        className="auth-fallback__login-button"
        onClick={() => window.location.reload()}
      >
        Refresh Page
      </button>
    </div>
  </ServiceUnavailableFallback>
);

/**
 * Database service fallback
 */
export const DatabaseServiceFallback: React.FC<Omit<ServiceFallbackProps, 'serviceName'>> = (props) => (
  <ServiceUnavailableFallback
    {...props}
    serviceName="Database"
    message="Database connection is unavailable. Your progress may not be saved until the connection is restored."
  />
);

/**
 * WebSocket service fallback
 */
export const WebSocketServiceFallback: React.FC<Omit<ServiceFallbackProps, 'serviceName'>> = (props) => (
  <ServiceUnavailableFallback
    {...props}
    serviceName="Real-time Communication"
    message="Real-time features are unavailable. Chat and live updates may not work properly."
  />
);

/**
 * Game Engine service fallback
 */
export const GameEngineServiceFallback: React.FC<Omit<ServiceFallbackProps, 'serviceName'>> = (props) => (
  <ServiceUnavailableFallback
    {...props}
    serviceName="Game Engine"
    message="Game engine is unavailable. Your game will run in local mode with limited features."
  >
    <div className="game-engine-fallback-info">
      <p className="game-engine-fallback__note">
        ℹ️ Progress will be saved locally and synced when the service is restored.
      </p>
    </div>
  </ServiceUnavailableFallback>
);

/**
 * Network service fallback (for offline state)
 */
export const NetworkServiceFallback: React.FC<Omit<ServiceFallbackProps, 'serviceName'>> = (props) => (
  <ServiceUnavailableFallback
    {...props}
    serviceName="Network"
    message="You appear to be offline. Some features may be limited until your connection is restored."
    showRetry={false}
  >
    <div className="network-fallback-info">
      <p className="network-fallback__note">
        📱 The game will continue to work in offline mode.
      </p>
    </div>
  </ServiceUnavailableFallback>
);

/**
 * Generic loading fallback for async initialization
 */
export const LoadingFallback: React.FC<{
  message?: string;
  showSpinner?: boolean;
}> = ({
  message = "Loading...",
  showSpinner = true,
}) => (
  <div className="loading-fallback">
    <div className="loading-fallback__content">
      {showSpinner && (
        <div className="loading-fallback__spinner">
          <div className="spinner"></div>
        </div>
      )}
      <p className="loading-fallback__message">{message}</p>
    </div>
  </div>
);

/**
 * Empty state fallback
 */
export const EmptyStateFallback: React.FC<{
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({
  title = "Nothing here yet",
  message = "This section is empty.",
  action,
}) => (
  <div className="empty-state-fallback">
    <div className="empty-state-fallback__content">
      <div className="empty-state-fallback__icon">📭</div>
      <h4 className="empty-state-fallback__title">{title}</h4>
      <p className="empty-state-fallback__message">{message}</p>
      
      {action && (
        <button
          className="empty-state-fallback__action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  </div>
);

/**
 * Higher-order component that wraps components with service fallbacks
 */
export function withServiceFallback<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  serviceName: string,
  checkService: () => boolean,
  FallbackComponent: React.ComponentType<ServiceFallbackProps> = ServiceUnavailableFallback
) {
  return function ServiceFallbackWrapper(props: P) {
    const [isServiceAvailable, setIsServiceAvailable] = React.useState(checkService);
    const [retryCount, setRetryCount] = React.useState(0);

    const handleRetry = React.useCallback(() => {
      setRetryCount(prev => prev + 1);
      setIsServiceAvailable(checkService());
    }, []);

    React.useEffect(() => {
      // Periodically check service availability
      const interval = setInterval(() => {
        const available = checkService();
        if (available !== isServiceAvailable) {
          setIsServiceAvailable(available);
        }
      }, 5000);

      return () => clearInterval(interval);
    }, [isServiceAvailable]);

    if (!isServiceAvailable) {
      return (
        <SafeComponent>
          <FallbackComponent
            serviceName={serviceName}
            onRetry={handleRetry}
            showRetry={retryCount < 3}
          />
        </SafeComponent>
      );
    }

    return (
      <SafeComponent>
        <WrappedComponent {...props} />
      </SafeComponent>
    );
  };
}

export default ServiceUnavailableFallback;