/**
 * Safe Component Utilities - Main Export File
 * Provides all safe component rendering utilities in one place
 */

// Core safe component wrapper
export { default as SafeComponent } from './SafeComponent';
export type { SafeComponentProps } from './SafeComponent';

// Loading state management
export {
  LoadingStateManager,
  useLoadingState,
  withLoadingState,
  default as LoadingStateManagerDefault
} from './LoadingStateManager';
export type {
  LoadingState,
  LoadingStateManagerProps,
  LoadingActions
} from './LoadingStateManager';

// Service fallback components
export {
  ServiceUnavailableFallback,
  AuthServiceFallback,
  DatabaseServiceFallback,
  WebSocketServiceFallback,
  GameEngineServiceFallback,
  NetworkServiceFallback,
  LoadingFallback,
  EmptyStateFallback,
  withServiceFallback,
  default as ServiceFallbacksDefault
} from './ServiceFallbacks';
export type { ServiceFallbackProps } from './ServiceFallbacks';

// Rendering helper utilities
export {
  renderIf,
  renderWithFallback,
  renderFeature,
  renderWithServices,
  renderAsyncState,
  renderIfExists,
  createSafeRenderer
} from '../../utils/renderingHelpers';

// Re-export existing error boundaries for convenience
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as GlobalErrorBoundary } from './GlobalErrorBoundary';
export { default as NetworkErrorBoundary } from './NetworkErrorBoundary';