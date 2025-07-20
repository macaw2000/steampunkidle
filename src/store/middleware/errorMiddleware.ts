import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { RootState } from '../store';

// Error logging interface
interface ErrorLog {
  timestamp: string;
  action: string;
  error: string;
  state?: Partial<RootState>;
  userId?: string;
}

// Error recovery actions
const ERROR_RECOVERY_ACTIONS = {
  RESET_AUTH_ERROR: 'auth/clearError',
  RESET_GAME_ERROR: 'game/setError',
  RESET_CHAT_ERROR: 'chat/setError',
} as const;

/**
 * Middleware for logging Redux errors and providing recovery mechanisms
 */
export const errorLoggingMiddleware = (store: any) => (next: any) => (action: any) => {
  try {
    const result = next(action);
    
    // Check if this is a rejected async thunk action
    if (isRejectedWithValue(action) || (action.type.endsWith('/rejected') && action.payload)) {
      const state = store.getState();
      const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        action: action.type,
        error: action.payload?.message || action.error?.message || 'Unknown error',
        state: {
          auth: { 
            error: state.auth.error, 
            loading: state.auth.loading,
            isAuthenticated: state.auth.isAuthenticated,
            user: state.auth.user,
            tokens: state.auth.tokens
          },
          game: { 
            error: state.game.error, 
            loading: state.game.loading,
            character: state.game.character,
            hasCharacter: state.game.hasCharacter,
            characterLoading: state.game.characterLoading,
            activityProgress: state.game.activityProgress,
            isOnline: state.game.isOnline,
            lastSyncTime: state.game.lastSyncTime,
            activitySwitching: state.game.activitySwitching
          },
          chat: { 
            error: state.chat.error, 
            loading: state.chat.loading,
            channels: state.chat.channels,
            messages: state.chat.messages,
            activeChannelId: state.chat.activeChannelId,
            unreadCounts: state.chat.unreadCounts,
            isConnected: state.chat.isConnected,
            typingUsers: state.chat.typingUsers
          },
        },
        userId: state.auth.user?.userId,
      };
      
      // Log error to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Redux Error:', errorLog);
      }
      
      // In production, you would send this to your error tracking service
      // Example: errorTrackingService.logError(errorLog);
      
      // Attempt automatic error recovery for certain error types
      attemptErrorRecovery(store, action);
    }
    
    return result;
  } catch (error) {
    // Catch any errors in the middleware itself
    console.error('Error in errorLoggingMiddleware:', error);
    return next(action);
  }
};

/**
 * Attempts to recover from certain types of errors automatically
 */
function attemptErrorRecovery(store: any, action: any) {
  const errorType = action.type;
  const errorMessage = action.payload?.message || action.error?.message || '';
  
  // Recovery for authentication errors
  if (errorType.includes('auth/') && errorMessage.includes('token')) {
    // Clear auth error after a delay to allow user to see the message
    setTimeout(() => {
      store.dispatch({ type: ERROR_RECOVERY_ACTIONS.RESET_AUTH_ERROR });
    }, 5000);
  }
  
  // Recovery for network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    // Set offline status and attempt reconnection
    store.dispatch({ type: 'game/setOnlineStatus', payload: false });
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      store.dispatch({ type: 'game/setOnlineStatus', payload: true });
    }, 10000);
  }
  
  // Recovery for corrupted state errors
  if (errorMessage.includes('state') || errorMessage.includes('invalid')) {
    // Reset the specific slice that had the error
    if (errorType.includes('game/')) {
      store.dispatch({ type: ERROR_RECOVERY_ACTIONS.RESET_GAME_ERROR, payload: null });
    } else if (errorType.includes('chat/')) {
      store.dispatch({ type: ERROR_RECOVERY_ACTIONS.RESET_CHAT_ERROR, payload: null });
    }
  }
}

/**
 * Middleware for state validation to prevent invalid states
 */
export const stateValidationMiddleware = (store: any) => (next: any) => (action: any) => {
  const result = next(action);
  
  try {
    const state = store.getState();
    
    // Validate auth state
    validateAuthState(state.auth);
    
    // Validate game state
    validateGameState(state.game);
    
    // Validate chat state
    validateChatState(state.chat);
    
  } catch (validationError) {
    console.error('State validation error:', validationError);
    
    // Dispatch recovery action based on validation error
    if (validationError instanceof Error) {
      const errorMessage = validationError.message;
      
      if (errorMessage.includes('auth')) {
        store.dispatch({ type: 'auth/logout' });
      } else if (errorMessage.includes('game')) {
        store.dispatch({ type: 'game/setError', payload: 'Game state corrupted, please refresh' });
      } else if (errorMessage.includes('chat')) {
        store.dispatch({ type: 'chat/setError', payload: 'Chat state corrupted, reconnecting...' });
      }
    }
  }
  
  return result;
};

/**
 * Validates auth state integrity
 */
function validateAuthState(authState: any) {
  // Check for inconsistent authentication state
  if (authState.isAuthenticated && !authState.user) {
    throw new Error('Invalid auth state: authenticated but no user data');
  }
  
  if (authState.isAuthenticated && !authState.tokens) {
    throw new Error('Invalid auth state: authenticated but no tokens');
  }
  
  // Validate token structure if present
  if (authState.tokens) {
    const requiredTokenFields = ['accessToken', 'idToken', 'refreshToken'];
    for (const field of requiredTokenFields) {
      if (!authState.tokens[field]) {
        throw new Error(`Invalid auth state: missing ${field}`);
      }
    }
  }
  
  // Validate user structure if present
  if (authState.user) {
    if (!authState.user.userId || !authState.user.email) {
      throw new Error('Invalid auth state: incomplete user data');
    }
  }
}

/**
 * Validates game state integrity
 */
function validateGameState(gameState: any) {
  // Check for inconsistent character state
  if (gameState.hasCharacter === true && !gameState.character) {
    throw new Error('Invalid game state: hasCharacter is true but no character data');
  }
  
  if (gameState.character) {
    // Validate required character fields
    const requiredFields = ['characterId', 'name', 'level', 'experience', 'currency'];
    for (const field of requiredFields) {
      if (gameState.character[field] === undefined || gameState.character[field] === null) {
        throw new Error(`Invalid game state: character missing ${field}`);
      }
    }
    
    // Validate numeric fields are actually numbers
    if (typeof gameState.character.level !== 'number' || gameState.character.level < 1) {
      throw new Error('Invalid game state: character level must be a positive number');
    }
    
    if (typeof gameState.character.experience !== 'number' || gameState.character.experience < 0) {
      throw new Error('Invalid game state: character experience must be a non-negative number');
    }
    
    if (typeof gameState.character.currency !== 'number' || gameState.character.currency < 0) {
      throw new Error('Invalid game state: character currency must be a non-negative number');
    }
  }
}

/**
 * Validates chat state integrity
 */
function validateChatState(chatState: any) {
  // Validate channels array
  if (!Array.isArray(chatState.channels)) {
    throw new Error('Invalid chat state: channels must be an array');
  }
  
  // Validate messages object
  if (typeof chatState.messages !== 'object' || chatState.messages === null) {
    throw new Error('Invalid chat state: messages must be an object');
  }
  
  // Validate unread counts
  if (typeof chatState.unreadCounts !== 'object' || chatState.unreadCounts === null) {
    throw new Error('Invalid chat state: unreadCounts must be an object');
  }
  
  // Validate active channel exists if set
  if (chatState.activeChannelId && !chatState.channels.find((c: any) => c.channelId === chatState.activeChannelId)) {
    throw new Error('Invalid chat state: activeChannelId references non-existent channel');
  }
}