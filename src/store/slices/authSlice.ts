import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  userId: string;
  email: string;
  name?: string;
  socialProviders: string[];
  lastLogin: string;
}

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
      try {
        // Validate payload before updating state
        const { user, tokens } = action.payload;
        
        if (!user || !user.userId || !user.email) {
          throw new Error('Invalid user data in login success');
        }
        
        if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
          throw new Error('Invalid token data in login success');
        }
        
        state.isAuthenticated = true;
        state.user = user;
        state.tokens = tokens;
        state.loading = false;
        state.error = null;
      } catch (error) {
        // Fallback to error state if validation fails
        state.isAuthenticated = false;
        state.user = null;
        state.tokens = null;
        state.loading = false;
        state.error = error instanceof Error ? error.message : 'Login validation failed';
      }
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.tokens = null;
      state.loading = false;
      state.error = action.payload || 'Login failed';
    },
    logout: (state) => {
      // Always reset to initial state on logout
      Object.assign(state, initialState);
    },
    refreshTokens: (state, action: PayloadAction<AuthTokens>) => {
      try {
        const tokens = action.payload;
        
        if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
          throw new Error('Invalid tokens for refresh');
        }
        
        state.tokens = tokens;
        state.error = null; // Clear any previous errors on successful refresh
      } catch (error) {
        // If token refresh data is invalid, logout user
        Object.assign(state, initialState);
        state.error = error instanceof Error ? error.message : 'Token refresh failed';
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    // New reducer for handling corrupted state recovery
    recoverState: (state, action: PayloadAction<Partial<AuthState>>) => {
      try {
        const recoveryData = action.payload;
        
        // Only recover valid data
        if (recoveryData.user && recoveryData.user.userId && recoveryData.user.email) {
          state.user = recoveryData.user;
        }
        
        if (recoveryData.tokens && recoveryData.tokens.accessToken) {
          state.tokens = recoveryData.tokens;
          state.isAuthenticated = true;
        }
        
        // Clear loading and error states during recovery
        state.loading = false;
        state.error = null;
      } catch (error) {
        // If recovery fails, reset to initial state
        Object.assign(state, initialState);
        state.error = 'State recovery failed';
      }
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, refreshTokens, clearError, recoverState } = authSlice.actions;
export default authSlice.reducer;