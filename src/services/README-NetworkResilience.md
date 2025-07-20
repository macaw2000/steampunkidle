# Network Resilience Implementation

This document describes the network resilience features implemented to handle network errors, timeouts, and offline scenarios gracefully.

## Overview

The network resilience system provides:
- Automatic retry logic with exponential backoff
- Timeout handling for network requests
- Offline mode detection and appropriate UI states
- Graceful error handling and user feedback
- Service fallback mechanisms

## Components

### NetworkUtils (`src/utils/networkUtils.ts`)

Core utility class providing network resilience features:

```typescript
// Enhanced fetch with retry logic
const data = await NetworkUtils.fetchJson('/api/data', {}, {
  timeout: 10000,      // 10 second timeout
  retries: 3,          // Retry up to 3 times
  exponentialBackoff: true,  // Use exponential backoff
});

// POST request with resilience
const result = await NetworkUtils.postJson('/api/create', data, {
  timeout: 15000,
  retries: 2,
});
```

**Features:**
- Automatic retries for network errors and retryable HTTP status codes
- Exponential backoff with jitter to prevent thundering herd
- Configurable timeouts to prevent hanging requests
- Offline detection and appropriate error handling
- Support for AbortSignal for request cancellation

### OfflineService (`src/services/offlineService.ts`)

Singleton service for offline detection and management:

```typescript
import { offlineService } from '../services/offlineService';

// Check current status
const isOffline = offlineService.isOffline();
const offlineDuration = offlineService.getOfflineDuration();

// Subscribe to status changes
const unsubscribe = offlineService.subscribe((state) => {
  console.log('Network state:', state);
});

// Wait for network to come back online
await offlineService.waitForOnline(30000);
```

**Features:**
- Real-time offline/online detection
- Offline duration tracking
- Connectivity testing
- Event-based status updates

### Network Error Boundary (`src/components/common/NetworkErrorBoundary.tsx`)

React error boundary for handling network errors:

```tsx
<NetworkErrorBoundary
  onNetworkError={(error) => console.log('Network error:', error)}
  fallback={(error, retry) => <CustomErrorUI error={error} onRetry={retry} />}
>
  <YourComponent />
</NetworkErrorBoundary>
```

**Features:**
- Catches and handles network-related errors
- Provides retry functionality
- Customizable fallback UI
- Automatic error categorization

### Offline Indicator (`src/components/common/OfflineIndicator.tsx`)

Visual indicator for offline status:

```tsx
<OfflineIndicator 
  className="offline-indicator--fixed-top"
  showDuration={true}
/>
```

**Features:**
- Shows offline status to users
- Displays offline duration
- Customizable positioning and styling
- Auto-hides when online

### Network Status Hook (`src/hooks/useNetworkStatus.ts`)

React hook for network status in components:

```tsx
const { isOnline, isOffline, offlineDuration, testConnectivity } = useNetworkStatus();

// Test connectivity
const handleTest = async () => {
  const isConnected = await testConnectivity();
  console.log('Connected:', isConnected);
};
```

## Enhanced Services

### AuthService

Enhanced with network resilience:
- Token refresh with retry logic and timeout handling
- Graceful logout even when server is unavailable
- User sync with exponential backoff
- Offline detection for auth operations

### CharacterService

Enhanced with network resilience:
- Character operations with retry logic
- Timeout handling for character creation/updates
- Graceful error handling with user-friendly messages
- Offline state detection

### ServerTaskQueueService

Enhanced with network resilience:
- Automatic fallback to local processing when server unavailable
- Retry logic for server communication
- Graceful degradation during network issues
- Real-time sync with error handling

### WebSocketService

Enhanced with network resilience:
- Connection timeout handling
- Automatic reconnection with exponential backoff
- Offline-aware reconnection logic
- Connection status monitoring

## Error Types

### NetworkError

Extended Error class with network-specific metadata:

```typescript
interface NetworkError extends Error {
  isNetworkError: boolean;
  isTimeout: boolean;
  isOffline: boolean;
  statusCode?: number;
  retryAfter?: number;
}
```

## Configuration

### Default Settings

```typescript
const DEFAULT_TIMEOUT = 10000;      // 10 seconds
const DEFAULT_RETRIES = 3;          // 3 retry attempts
const DEFAULT_RETRY_DELAY = 1000;   // 1 second base delay
const MAX_RETRY_DELAY = 30000;      // 30 seconds max delay
```

### Retryable Status Codes

- 408 (Request Timeout)
- 429 (Too Many Requests)
- 500 (Internal Server Error)
- 502 (Bad Gateway)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)

## Usage Examples

### Basic API Call with Resilience

```typescript
import { NetworkUtils } from '../utils/networkUtils';

try {
  const data = await NetworkUtils.fetchJson('/api/data', {}, {
    timeout: 8000,
    retries: 2,
    exponentialBackoff: true,
  });
  
  // Handle success
  setData(data);
} catch (error) {
  if (error.isNetworkError) {
    if (error.isOffline) {
      setError('You are offline. Please check your connection.');
    } else if (error.isTimeout) {
      setError('Request timed out. Please try again.');
    } else {
      setError(`Network error: ${error.message}`);
    }
  } else {
    setError(`Error: ${error.message}`);
  }
}
```

### Service with Fallback

```typescript
class MyService {
  async getData(id: string) {
    try {
      // Try server first
      return await NetworkUtils.fetchJson(`/api/data/${id}`, {}, {
        timeout: 5000,
        retries: 2,
      });
    } catch (error) {
      if (error.isNetworkError) {
        // Fall back to local cache
        return this.getFromCache(id);
      }
      throw error;
    }
  }
}
```

### Component with Network Awareness

```tsx
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineIndicator } from '../components/common/OfflineIndicator';

const MyComponent = () => {
  const { isOnline, isOffline } = useNetworkStatus();
  
  return (
    <div>
      <OfflineIndicator />
      
      {isOffline && (
        <div className="offline-notice">
          Some features are limited while offline.
        </div>
      )}
      
      <button disabled={isOffline}>
        {isOffline ? 'Offline' : 'Sync Data'}
      </button>
    </div>
  );
};
```

## Testing

### Unit Tests

Tests are provided for:
- NetworkUtils functionality
- OfflineService behavior
- Error handling scenarios
- Retry logic and backoff calculations

### Integration Testing

Test network resilience by:
1. Disconnecting network during operations
2. Simulating slow network conditions
3. Testing server unavailability scenarios
4. Verifying fallback mechanisms

## Best Practices

1. **Always use NetworkUtils** for API calls instead of raw fetch
2. **Configure appropriate timeouts** based on operation type
3. **Provide user feedback** for network states and errors
4. **Implement fallback mechanisms** for critical functionality
5. **Test offline scenarios** during development
6. **Use error boundaries** to catch network errors gracefully
7. **Monitor network status** in components that depend on connectivity

## Troubleshooting

### Common Issues

1. **Requests hanging**: Ensure timeouts are configured
2. **Too many retries**: Adjust retry count for non-critical operations
3. **Poor offline UX**: Add offline indicators and appropriate messaging
4. **Service failures**: Implement fallback mechanisms for critical services

### Debugging

Enable network debugging by setting:
```typescript
// In development
console.log('Network request:', url, options);
```

Monitor network events:
```typescript
NetworkUtils.onNetworkStatusChange((isOnline) => {
  console.log('Network status changed:', isOnline);
});
```

## Future Enhancements

- Request queuing for offline scenarios
- Background sync when connection is restored
- Network quality detection and adaptive timeouts
- Request deduplication for identical concurrent requests
- Circuit breaker pattern for failing services