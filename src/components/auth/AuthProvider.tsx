import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { loginSuccess, refreshTokens, logout } from '../../store/slices/authSlice';
import { setCharacter, setHasCharacter, setCharacterLoading, clearCharacter } from '../../store/slices/gameSlice';
import { authService } from '../../services/authService';
import { CharacterService } from '../../services/characterService';

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

  // Check for character existence after authentication
  useEffect(() => {
    const checkCharacterExists = async () => {
      if (!isAuthenticated || !user) {
        dispatch(setHasCharacter(null));
        dispatch(clearCharacter()); // Clear character state when not authenticated
        return;
      }

      dispatch(setCharacterLoading(true));
      
      try {
        const character = await CharacterService.getCharacter(user.userId);
        if (character) {
          dispatch(setCharacter(character));
          dispatch(setHasCharacter(true));
        } else {
          dispatch(setHasCharacter(false));
        }
      } catch (error) {
        console.error('Failed to check character existence:', error);
        dispatch(setHasCharacter(false));
      } finally {
        dispatch(setCharacterLoading(false));
      }
    };

    checkCharacterExists();
  }, [isAuthenticated, user, dispatch]);

  return <>{children}</>;
};

export default AuthProvider;