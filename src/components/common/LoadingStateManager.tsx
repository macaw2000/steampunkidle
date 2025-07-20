/**
 * LoadingStateManager - Manages loading states for async component initialization
 * Provides consistent loading UI and error handling for async operations
 */

import React, { ReactNode, useState, useEffect, useCallback } from 'react';
import SafeComponent from './SafeComponent';

export interface LoadingState {
  loading: boolean;
  error?: Error | string | null;
  data?: any;
}

export interface LoadingStateManagerProps {
  children: (state: LoadingState, actions: LoadingActions) => ReactNode;
  initialLoading?: boolean;
  loadingComponent?: ReactNode;
  errorComponent?: (error: Error | string, retry: () => void) => ReactNode;
  onError?: (error: Error | string) => void;
}

export interface LoadingActions {
  setLoading: (loading: boolean) => void;
  setError: (error: Error | string | null) => void;
  setData: (data: any) => void;
  retry: () => void;
  reset: () => void;
}

export const LoadingStateManager: React.FC<LoadingStateManagerProps> = ({
  children,
  initialLoading = false,
  loadingComponent,
  errorComponent,
  onError,
}) => {
  const [state, setState] = useState<LoadingState>({
    loading: initialLoading,
    error: null,
    data: undefined,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading, error: loading ? null : prev.error }));
  }, []);

  const setError = useCallback((error: Error | string | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
    if (error && onError) {
      onError(error);
    }
  }, [onError]);

  const setData = useCallback((data: any) => {
    setState(prev => ({ ...prev, data, loading: false, error: null }));
  }, []);

  const retry = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: undefined });
  }, []);

  const actions: LoadingActions = {
    setLoading,
    setError,
    setData,
    retry,
    reset,
  };

  // Handle loading state
  if (state.loading && loadingComponent) {
    return <SafeComponent>{loadingComponent}</SafeComponent>;
  }

  // Handle error state
  if (state.error && errorComponent) {
    return <SafeComponent>{errorComponent(state.error, retry)}</SafeComponent>;
  }

  // Render children with state and actions
  return (
    <SafeComponent>
      {children(state, actions)}
    </SafeComponent>
  );
};

/**
 * Hook for managing loading states in functional components
 */
export function useLoadingState(initialLoading = false) {
  const [state, setState] = useState<LoadingState>({
    loading: initialLoading,
    error: null,
    data: undefined,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading, error: loading ? null : prev.error }));
  }, []);

  const setError = useCallback((error: Error | string | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  const setData = useCallback((data: any) => {
    setState(prev => ({ ...prev, data, loading: false, error: null }));
  }, []);

  const retry = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: undefined });
  }, []);

  return {
    ...state,
    setLoading,
    setError,
    setData,
    retry,
    reset,
  };
}

/**
 * Higher-order component for adding loading state management to any component
 */
export function withLoadingState<P extends object>(
  WrappedComponent: React.ComponentType<P & { loadingState: LoadingState; loadingActions: LoadingActions }>
) {
  return function LoadingStateWrapper(props: P) {
    const loadingState = useLoadingState();
    const { setLoading, setError, setData, retry, reset, ...state } = loadingState;
    
    const actions: LoadingActions = {
      setLoading,
      setError,
      setData,
      retry,
      reset,
    };

    return (
      <SafeComponent>
        <WrappedComponent
          {...props}
          loadingState={state}
          loadingActions={actions}
        />
      </SafeComponent>
    );
  };
}

export default LoadingStateManager;