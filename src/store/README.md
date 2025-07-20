# Redux Error Handling System

This directory contains a comprehensive Redux error handling system that provides:

- **Error logging middleware** for tracking and reporting Redux errors
- **State validation middleware** for preventing invalid states
- **Enhanced async thunks** with retry logic and error recovery
- **State recovery mechanisms** for corrupted data
- **Comprehensive error handling utilities**

## Architecture Overview

### Middleware

#### Error Logging Middleware (`middleware/errorMiddleware.ts`)
- Automatically logs all rejected async thunk actions
- Provides error context including state snapshot and user information
- Attempts automatic error recovery for common error types
- Integrates with error tracking services in production

#### State Validation Middleware (`middleware/errorMiddleware.ts`)
- Validates Redux state after each action
- Prevents invalid states from causing application crashes
- Automatically triggers recovery actions for corrupted state
- Provides detailed validation error messages

### Enhanced Async Thunks (`utils/asyncThunkUtils.ts`)

#### `createAsyncThunkWithErrorHandling`
Creates async thunks with built-in error handling and retry logic:

```typescript
const loginAsync = createAsyncThunkWithErrorHandling(
  'auth/loginAsync',
  async (credentials, { dispatch }) => {
    // Your async logic here
    const result = await authService.login(credentials);
    dispatch(loginSuccess(result));
    return result;
  },
  {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => error.retryable,
  }
);
```

#### `AsyncErrorHandler`
Utility class for wrapping async operations with error handling:

```typescript
const result = await AsyncErrorHandler.withErrorHandling(
  () => apiCall(),
  {
    fallback: defaultValue,
    onError: (error) => console.error(error),
    retryConfig: { maxRetries: 2 },
  }
);
```

### State Recovery (`utils/asyncThunkUtils.ts`)

#### `StateRecovery`
Utilities for recovering from corrupted Redux state:

```typescript
// Recover state by merging with defaults
const recoveredState = StateRecovery.recoverState(corruptedState, defaultState);

// Validate and sanitize state
const validState = StateRecovery.sanitizeState(state, validator, defaultState);
```

## Enhanced Slices

All Redux slices have been enhanced with:

### Input Validation
- Validates action payloads before updating state
- Prevents invalid data from corrupting state
- Provides meaningful error messages

### State Recovery Actions
- `auth/recoverState` - Recovers authentication state
- `game/recoverGameState` - Recovers game state
- `chat/recoverChatState` - Recovers chat state

### Error Handling
- Graceful error handling in all reducers
- Automatic fallback to safe states on validation failures
- Clear error messages for debugging

## Usage Examples

### Basic Async Thunk Usage

```typescript
import { useDispatch } from 'react-redux';
import { loginAsync } from '../store/thunks/authThunks';
import { AsyncErrorHandler } from '../store/utils/asyncThunkUtils';

const MyComponent = () => {
  const dispatch = useDispatch();

  const handleLogin = async (credentials) => {
    try {
      await dispatch(loginAsync(credentials)).unwrap();
      console.log('Login successful');
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  };

  return <button onClick={() => handleLogin({ email, password })}>Login</button>;
};
```

### Manual Error Handling

```typescript
const handleApiCall = async () => {
  const result = await AsyncErrorHandler.withErrorHandling(
    () => fetch('/api/data').then(r => r.json()),
    {
      fallback: [],
      onError: (error) => {
        console.error('API call failed:', error);
        showNotification('Failed to load data');
      },
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        retryCondition: (error) => error.retryable,
      },
    }
  );
};
```

### State Recovery

```typescript
// Recover from corrupted auth state
dispatch({
  type: 'auth/recoverState',
  payload: {
    user: validUserData,
    tokens: validTokenData,
  },
});

// Recover from corrupted game state
dispatch({
  type: 'game/recoverGameState',
  payload: {
    character: validCharacterData,
    isOnline: true,
  },
});
```

### Periodic Sync with Error Handling

```typescript
import { scheduleTokenRefresh } from '../store/thunks/authThunks';
import { scheduleGameSync } from '../store/thunks/gameThunks';

useEffect(() => {
  if (isAuthenticated) {
    // Set up automatic token refresh
    const cleanupTokenRefresh = scheduleTokenRefresh(dispatch, getState);
    
    // Set up periodic game sync
    const cleanupGameSync = scheduleGameSync(dispatch, getState);
    
    return () => {
      cleanupTokenRefresh();
      cleanupGameSync();
    };
  }
}, [isAuthenticated]);
```

## Error Types and Recovery

### Authentication Errors
- **Token expiration**: Automatic token refresh
- **Invalid credentials**: Clear error message, no retry
- **Network errors**: Retry with exponential backoff
- **Corrupted auth state**: Reset to initial state

### Game State Errors
- **Invalid character data**: Validation with fallback
- **Network sync failures**: Offline mode with retry
- **Corrupted game state**: State recovery with defaults
- **Activity errors**: Graceful degradation

### Chat Errors
- **Connection failures**: Automatic reconnection
- **Invalid message data**: Message filtering
- **Channel errors**: Channel recovery
- **WebSocket errors**: Exponential backoff reconnection

## Testing

The error handling system includes comprehensive tests:

```bash
npm test src/store/middleware/__tests__/errorMiddleware.test.ts
```

Tests cover:
- Error logging functionality
- State validation
- Recovery mechanisms
- Input validation
- Error boundary scenarios

## Configuration

### Development vs Production

In development:
- Errors are logged to console
- Detailed error information is available
- State validation is more verbose

In production:
- Errors are sent to error tracking service
- User-friendly error messages
- Automatic recovery is more aggressive

### Error Tracking Integration

To integrate with error tracking services, modify the error logging middleware:

```typescript
// In errorMiddleware.ts
if (process.env.NODE_ENV === 'production') {
  // Send to your error tracking service
  errorTrackingService.logError({
    message: errorLog.error,
    context: errorLog.state,
    userId: errorLog.userId,
    timestamp: errorLog.timestamp,
  });
}
```

## Best Practices

1. **Always use enhanced async thunks** for API calls
2. **Implement fallback values** for critical data
3. **Validate input data** before dispatching actions
4. **Handle errors gracefully** without breaking user experience
5. **Provide meaningful error messages** to users
6. **Test error scenarios** thoroughly
7. **Monitor error rates** in production
8. **Implement progressive enhancement** for optional features

## Migration Guide

To migrate existing Redux code to use the error handling system:

1. **Update store configuration** to include middleware
2. **Replace createAsyncThunk** with createAsyncThunkWithErrorHandling
3. **Add input validation** to existing reducers
4. **Implement state recovery** actions
5. **Update components** to handle errors gracefully
6. **Add error boundaries** around Redux-connected components

## Troubleshooting

### Common Issues

1. **State validation errors**: Check action payload structure
2. **Retry loops**: Verify retry conditions are appropriate
3. **Memory leaks**: Ensure cleanup functions are called
4. **Performance issues**: Monitor error logging overhead

### Debug Mode

Enable debug mode for detailed error information:

```typescript
// Set in development environment
window.__REDUX_ERROR_DEBUG__ = true;
```

This provides additional logging and state snapshots for debugging.