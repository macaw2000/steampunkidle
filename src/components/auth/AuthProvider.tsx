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
  }, [dispatch]);

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

  // Set up token refresh interval
  useEffect(() => {
    if (!isAuthenticated || !tokens) return;

    // Check token expiration every 5 minutes
    const interval = setInterval(refreshTokensIfNeeded, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, tokens, refreshTokensIfNeeded]);

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
          
          // Restore task queue state for idle game continuity
          console.log('AuthProvider: Restoring task queue for character:', character.characterId);
          try {
            await serverTaskQueueService.loadPlayerQueue(character.characterId);
            console.log('AuthProvider: Task queue restored successfully');
            
            // Verify queue status after restoration
            const queueStatus = serverTaskQueueService.getQueueStatus(character.characterId);
            console.log('AuthProvider: Queue status after restoration:', {
              hasCurrentTask: !!queueStatus.currentTask,
              isRunning: queueStatus.isRunning,
              queueLength: queueStatus.queueLength,
              totalCompleted: queueStatus.totalCompleted
            });
            
          } catch (queueError) {
            console.error('AuthProvider: Failed to restore task queue:', queueError);
            // Create user-friendly error message for task queue issues
            console.warn('AuthProvider: Task queue restoration failed, but character loading will continue');
          }
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