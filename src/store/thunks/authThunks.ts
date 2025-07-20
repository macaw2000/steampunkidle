import { createAsyncThunkWithErrorHandling, AsyncErrorHandler } from '../utils/asyncThunkUtils';
import { loginStart, loginSuccess, loginFailure, logout, refreshTokens } from '../slices/authSlice';
import type { RootState } from '../store';

// Mock auth service - replace with actual service imports
interface AuthService {
  login: (credentials: LoginCredentials) => Promise<{ user: any; tokens: any }>;
  refreshToken: (refreshToken: string) => Promise<any>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
}

interface LoginCredentials {
  email: string;
  password: string;
}

// This would normally be imported from your auth service
declare const authService: AuthService;

/**
 * Enhanced login thunk with error handling and retry logic
 */
export const loginAsync = createAsyncThunkWithErrorHandling(
  'auth/loginAsync',
  async (credentials: LoginCredentials, { dispatch }) => {
    // Dispatch loading state
    dispatch(loginStart());
    
    try {
      const result = await AsyncErrorHandler.withErrorHandling(
        () => authService.login(credentials),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
            retryCondition: (error) => error.retryable && !error.message.includes('credentials'),
          },
        }
      );
      
      dispatch(loginSuccess(result));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch(loginFailure(errorMessage));
      throw error;
    }
  },
  {
    maxRetries: 2,
    retryDelay: 1000,
    retryCondition: (error) => error.retryable && !error.message.includes('credentials'),
  }
);

/**
 * Enhanced token refresh thunk with automatic retry
 */
export const refreshTokenAsync = createAsyncThunkWithErrorHandling(
  'auth/refreshTokenAsync',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const currentRefreshToken = state.auth.tokens?.refreshToken;
    
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const newTokens = await AsyncErrorHandler.withErrorHandling(
        () => authService.refreshToken(currentRefreshToken),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 500,
          },
        }
      );
      
      dispatch(refreshTokens(newTokens));
      return newTokens;
    } catch (error) {
      // If refresh fails, logout the user
      dispatch(logout());
      throw error;
    }
  },
  {
    maxRetries: 3,
    retryDelay: 500,
  }
);

/**
 * Enhanced logout thunk with cleanup
 */
export const logoutAsync = createAsyncThunkWithErrorHandling(
  'auth/logoutAsync',
  async (_, { dispatch }) => {
    try {
      // Attempt to logout on server, but don't fail if it doesn't work
      await AsyncErrorHandler.withErrorHandling(
        () => authService.logout(),
        {
          fallback: undefined,
          retryConfig: { maxRetries: 1 },
        }
      );
    } catch (error) {
      // Log error but don't prevent local logout
      console.warn('Server logout failed, proceeding with local logout:', error);
    }
    
    // Always clear local state
    dispatch(logout());
  }
);

/**
 * Initialize authentication state on app startup
 */
export const initializeAuthAsync = createAsyncThunkWithErrorHandling(
  'auth/initializeAsync',
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    
    // Check if we have stored tokens
    const storedTokens = state.auth.tokens;
    if (!storedTokens) {
      return null;
    }
    
    try {
      // Verify current user is still valid
      const user = await AsyncErrorHandler.withErrorHandling(
        () => authService.getCurrentUser(),
        {
          fallback: null,
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
        }
      );
      
      if (user) {
        dispatch(loginSuccess({ user, tokens: storedTokens }));
        return { user, tokens: storedTokens };
      } else {
        // User is no longer valid, try to refresh token
        try {
          await dispatch(refreshTokenAsync()).unwrap();
          return getState().auth;
        } catch (refreshError) {
          // Refresh failed, logout
          dispatch(logout());
          return null;
        }
      }
    } catch (error) {
      // If initialization fails, clear auth state
      dispatch(logout());
      throw error;
    }
  },
  {
    maxRetries: 1,
    retryDelay: 2000,
  }
);

/**
 * Automatic token refresh scheduler
 */
export const scheduleTokenRefresh = (dispatch: any, getState: () => RootState) => {
  const checkAndRefreshToken = async () => {
    const state = getState();
    const tokens = state.auth.tokens;
    
    if (!tokens || !state.auth.isAuthenticated) {
      return;
    }
    
    // Check if token expires within the next 5 minutes
    const expirationTime = tokens.expiresIn * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (timeUntilExpiry <= fiveMinutes) {
      try {
        await dispatch(refreshTokenAsync()).unwrap();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        // The refreshTokenAsync thunk will handle logout on failure
      }
    }
  };
  
  // Check every minute
  const intervalId = setInterval(checkAndRefreshToken, 60 * 1000);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};