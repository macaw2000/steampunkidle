import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { loginSuccess, refreshTokens, logout } from '../../store/slices/authSlice';
import { setCharacter, setHasCharacter, setCharacterLoading, clearCharacter } from '../../store/slices/gameSlice';
import { authService } from '../../services/authService';
import { CharacterService } from '../../services/characterService';
import { serverTaskQueueService } from '../../services/serverTaskQueueService';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const { tokens, isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  // Initialize authentication on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const result = await authService.initializeAuth();
        if (result) {
          dispatch(loginSuccess(result));
        }
      } catch (error) {
        console.log('Failed to initialize authentication:', error);
      }
    };

    initializeAuth();

    // Handle window focus events to maintain session
    const handleWindowFocus = () => {
      console.log('Window gained focus - checking session');
      // Re-validate session when window regains focus
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        const currentTokens = authService.getAuthTokens();
        if (currentUser && currentTokens && !isAuthenticated) {
          console.log('Restoring session from localStorage');
          dispatch(loginSuccess({ user: currentUser, tokens: currentTokens }));
        }
      }
    };

    const handleWindowBlur = () => {
      // Don't logout on blur - just log the event
      console.log('Window lost focus - maintaining session');
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dispatch, isAuthenticated]);

  // Token refresh logic
  const refreshTokensIfNeeded = useCallback(async () => {
    if (!tokens || !isAuthenticated) return;

    if (authService.isTokenExpired(tokens)) {
      try {
        const newTokens = await authService.refreshToken(tokens.refreshToken);
        dispatch(refreshTokens(newTokens));
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, logout the user
        dispatch(logout());
      }
    }
  }, [tokens, isAuthenticated, dispatch]);

  // Set up token refresh interval and session validation
  useEffect(() => {
    if (!isAuthenticated || !tokens) return;

    // Check token expiration every 5 minutes
    const tokenInterval = setInterval(refreshTokensIfNeeded, 5 * 60 * 1000);

    // Session validation and heartbeat every 5 minutes
    const sessionInterval = setInterval(async () => {
      try {
        const isValid = await authService.validateSession();
        if (!isValid) {
          console.log('Session expired, logging out');
          dispatch(logout());
        } else {
          // Send heartbeat to keep session alive
          await authService.sendHeartbeat();
        }
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    }, 5 * 60 * 1000);

    // Send an immediate heartbeat
    authService.sendHeartbeat().catch(error => {
      console.error('Initial heartbeat failed:', error);
    });

    return () => {
      clearInterval(tokenInterval);
      clearInterval(sessionInterval);
    };
  }, [isAuthenticated, tokens, refreshTokensIfNeeded, dispatch]);

  // Refresh tokens on window focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && tokens) {
        refreshTokensIfNeeded();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, tokens, refreshTokensIfNeeded]);

  // Check for character existence and restore game state after authentication
  useEffect(() => {
    const initializeGameState = async () => {
      if (!isAuthenticated || !user) {
        dispatch(setHasCharacter(null));
        dispatch(clearCharacter()); // Clear character state when not authenticated
        
        // Clean up task queue callbacks when user logs out
        // Note: We can't get the character ID here since user is logging out,
        // so we'll need to clean up all callbacks or use a different approach
        try {
          // For now, we'll just log this - the taskQueueService should handle cleanup
          console.log('AuthProvider: User logged out, task queue callbacks should be cleaned up');
        } catch (error) {
          console.warn('AuthProvider: Error during logout cleanup:', error);
        }
        return;
      }

      dispatch(setCharacterLoading(true));
      
      try {
        const character = await CharacterService.getCharacter(user.userId);
        if (character) {
          dispatch(setCharacter(character));
          dispatch(setHasCharacter(true));
          
          // Note: Task queue system disabled - using simple activity system instead
          console.log('AuthProvider: Character loaded, using simple activity system');
        } else {
          dispatch(setHasCharacter(false));
        }
      } catch (error) {
        console.error('AuthProvider: Failed to initialize game state:', error);
        dispatch(setHasCharacter(false));
        
        // Show user-friendly error message
        console.error('AuthProvider: Character loading failed. Please try refreshing the page.');
      } finally {
        dispatch(setCharacterLoading(false));
      }
    };

    initializeGameState();
  }, [isAuthenticated, user, dispatch]);

  return <>{children}</>;
};

export default AuthProvider;