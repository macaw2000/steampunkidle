/**
 * Conditional Rendering Helpers
 * Utilities for safe conditional rendering and optional features
 */

import { ReactNode } from 'react';

/**
 * Safely renders a component only if a condition is met
 * Prevents rendering errors when dependencies are not available
 */
export function renderIf(condition: boolean | (() => boolean), component: ReactNode): ReactNode {
  try {
    const shouldRender = typeof condition === 'function' ? condition() : condition;
    return shouldRender ? component : null;
  } catch (error) {
    console.warn('renderIf condition check failed:', error);
    return null;
  }
}

/**
 * Renders a component with a fallback if the main component fails
 */
export function renderWithFallback(
  component: ReactNode,
  fallback: ReactNode = null
): ReactNode {
  try {
    return component;
  } catch (error) {
    console.warn('Component rendering failed, using fallback:', error);
    return fallback;
  }
}

/**
 * Conditionally renders a component based on feature flags or service availability
 */
export function renderFeature(
  featureKey: string,
  component: ReactNode,
  fallback?: ReactNode
): ReactNode {
  try {
    // Check if feature is enabled (this could be extended to check feature flags)
    const isFeatureEnabled = checkFeatureAvailability(featureKey);
    
    if (isFeatureEnabled) {
      return component;
    }
    
    return fallback || null;
  } catch (error) {
    console.warn(`Feature ${featureKey} check failed:`, error);
    return fallback || null;
  }
}

/**
 * Renders a component only if required services are available
 */
export function renderWithServices(
  requiredServices: string[],
  component: ReactNode,
  fallback?: ReactNode
): ReactNode {
  try {
    const servicesAvailable = requiredServices.every(service => 
      checkServiceAvailability(service)
    );
    
    if (servicesAvailable) {
      return component;
    }
    
    return fallback || null;
  } catch (error) {
    console.warn('Service availability check failed:', error);
    return fallback || null;
  }
}

/**
 * Renders different components based on loading, error, or success states
 */
export function renderAsyncState<T>(
  state: {
    loading: boolean;
    error?: Error | string | null;
    data?: T;
  },
  components: {
    loading: ReactNode;
    error: (error: Error | string) => ReactNode;
    success: (data: T) => ReactNode;
    empty?: ReactNode;
  }
): ReactNode {
  try {
    if (state.loading) {
      return components.loading;
    }
    
    if (state.error) {
      return components.error(state.error);
    }
    
    if (state.data !== undefined && state.data !== null) {
      return components.success(state.data);
    }
    
    return components.empty || null;
  } catch (error) {
    console.warn('Async state rendering failed:', error);
    return components.error(error as Error);
  }
}

/**
 * Helper to check if a feature is available/enabled
 * This can be extended to integrate with feature flag systems
 */
function checkFeatureAvailability(featureKey: string): boolean {
  try {
    // Basic feature availability check
    // This could be extended to check environment variables, feature flags, etc.
    const features = {
      'chat': true,
      'marketplace': true,
      'guilds': true,
      'leaderboard': true,
      'crafting': true,
      'harvesting': true,
      'combat': true,
    };
    
    return features[featureKey as keyof typeof features] ?? false;
  } catch (error) {
    console.warn(`Feature availability check failed for ${featureKey}:`, error);
    return false;
  }
}

/**
 * Helper to check if a service is available
 * This can be extended to perform actual health checks
 */
function checkServiceAvailability(serviceName: string): boolean {
  try {
    // Basic service availability check
    // This could be extended to perform actual health checks
    const services = {
      'auth': typeof window !== 'undefined' && window.localStorage !== undefined,
      'database': true, // Assume database is available
      'websocket': typeof WebSocket !== 'undefined',
      'notifications': 'Notification' in window,
      'storage': typeof window !== 'undefined' && window.localStorage !== undefined,
    };
    
    return services[serviceName as keyof typeof services] ?? false;
  } catch (error) {
    console.warn(`Service availability check failed for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Higher-order function to create a safe renderer with default fallback
 */
export function createSafeRenderer(defaultFallback: ReactNode = null) {
  return function safeRender(component: ReactNode, fallback: ReactNode = defaultFallback): ReactNode {
    return renderWithFallback(component, fallback);
  };
}

/**
 * Utility to safely access nested properties and render based on their existence
 */
export function renderIfExists<T>(
  obj: any,
  path: string,
  renderer: (value: T) => ReactNode,
  fallback?: ReactNode
): ReactNode {
  try {
    const value = getNestedValue(obj, path);
    if (value !== undefined && value !== null) {
      return renderer(value);
    }
    return fallback || null;
  } catch (error) {
    console.warn(`Failed to access path ${path}:`, error);
    return fallback || null;
  }
}

/**
 * Helper to safely get nested object values
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}