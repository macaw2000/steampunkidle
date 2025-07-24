import { createAsyncThunkWithErrorHandling, AsyncErrorHandler, StateRecovery } from '../utils/asyncThunkUtils';
import { 
  setCharacter, 
  setHasCharacter, 
  setCharacterLoading, 
  clearCharacter,
  updateCharacterStats,
  setError,
  setOnlineStatus,
  updateLastSyncTime,
  setActivityProgress
} from '../slices/gameSlice';
import type { RootState } from '../store';
import type { Character } from '../../types/character';

// Mock game service interfaces - replace with actual service imports
interface GameService {
  loadCharacter: (userId: string) => Promise<Character>;
  createCharacter: (userId: string, characterData: Partial<Character>) => Promise<Character>;
  updateCharacter: (character: Character) => Promise<Character>;
  syncGameState: (userId: string) => Promise<{ character: Character; serverTime: number }>;
}

interface TaskQueueService {
  getCurrentProgress: () => Promise<any>;
  syncWithServer: () => Promise<void>;
  removeTask: (playerId: string, taskId: string) => Promise<void>;
}

// These would normally be imported from your services
declare const gameService: GameService;
declare const taskQueueService: TaskQueueService;

/**
 * Load character with error handling and state recovery
 */
export const loadCharacterAsync = createAsyncThunkWithErrorHandling(
  'game/loadCharacterAsync',
  async (userId: string, { dispatch, getState }) => {
    dispatch(setCharacterLoading(true));
    dispatch(setError(null));
    
    try {
      const character = await AsyncErrorHandler.withErrorHandling(
        () => gameService.loadCharacter(userId),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
            retryCondition: (error) => error.retryable,
          },
          onError: (error) => {
            console.error('Character loading error:', error);
            dispatch(setError(`Failed to load character: ${error.message}`));
          },
        }
      );
      
      // Validate and sanitize character data
      const validatedCharacter = StateRecovery.sanitizeState(
        character,
        (char) => char && char.characterId && char.name && typeof char.level === 'number',
        null
      );
      
      if (validatedCharacter) {
        dispatch(setCharacter(validatedCharacter));
        dispatch(setHasCharacter(true));
        dispatch(updateLastSyncTime());
      } else {
        dispatch(setHasCharacter(false));
        throw new Error('Invalid character data received from server');
      }
      
      return validatedCharacter;
    } catch (error) {
      dispatch(setHasCharacter(false));
      const errorMessage = error instanceof Error ? error.message : 'Failed to load character';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setCharacterLoading(false));
    }
  },
  {
    maxRetries: 3,
    retryDelay: 1000,
  }
);

/**
 * Create new character with validation
 */
export const createCharacterAsync = createAsyncThunkWithErrorHandling(
  'game/createCharacterAsync',
  async ({ userId, characterData }: { userId: string; characterData: Partial<Character> }, { dispatch }) => {
    dispatch(setCharacterLoading(true));
    dispatch(setError(null));
    
    try {
      // Validate character data before sending
      if (!characterData.name || characterData.name.trim().length === 0) {
        throw new Error('Character name is required');
      }
      
      const character = await AsyncErrorHandler.withErrorHandling(
        () => gameService.createCharacter(userId, characterData),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
            retryCondition: (error) => error.retryable && !error.message.includes('name'),
          },
        }
      );
      
      dispatch(setCharacter(character));
      dispatch(setHasCharacter(true));
      dispatch(updateLastSyncTime());
      
      return character;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create character';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setCharacterLoading(false));
    }
  }
);

/**
 * Update character with optimistic updates and rollback on failure
 */
export const updateCharacterAsync = createAsyncThunkWithErrorHandling(
  'game/updateCharacterAsync',
  async (updates: Partial<Character>, { dispatch, getState }) => {
    const state = getState() as RootState;
    const currentCharacter = state.game.character;
    
    if (!currentCharacter) {
      throw new Error('No character to update');
    }
    
    // Optimistic update
    dispatch(updateCharacterStats(updates));
    
    try {
      const updatedCharacter = { ...currentCharacter, ...updates };
      
      const serverCharacter = await AsyncErrorHandler.withErrorHandling(
        () => gameService.updateCharacter(updatedCharacter),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
          },
        }
      );
      
      // Update with server response
      dispatch(setCharacter(serverCharacter));
      dispatch(updateLastSyncTime());
      
      return serverCharacter;
    } catch (error) {
      // Rollback optimistic update
      dispatch(setCharacter(currentCharacter));
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update character';
      dispatch(setError(errorMessage));
      throw error;
    }
  }
);

/**
 * Sync game state with server
 */
export const syncGameStateAsync = createAsyncThunkWithErrorHandling(
  'game/syncGameStateAsync',
  async (userId: string, { dispatch, getState }) => {
    const state = getState() as RootState;
    
    try {
      dispatch(setOnlineStatus(true));
      
      const syncResult = await AsyncErrorHandler.withErrorHandling(
        () => gameService.syncGameState(userId),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 2000,
          },
          onError: (error) => {
            if (!error.retryable) {
              dispatch(setOnlineStatus(false));
            }
          },
        }
      );
      
      // Merge server state with local state
      const currentCharacter = state.game.character;
      const mergedCharacter = StateRecovery.recoverState(syncResult.character, currentCharacter);
      
      if (mergedCharacter) {
        dispatch(setCharacter(mergedCharacter));
      }
      dispatch(updateLastSyncTime());
      
      return syncResult;
    } catch (error) {
      dispatch(setOnlineStatus(false));
      
      // Don't throw error for sync failures - app should continue working offline
      console.warn('Game state sync failed:', error);
      return null;
    }
  },
  {
    maxRetries: 2,
    retryDelay: 2000,
  }
);

/**
 * Initialize game state on app startup
 */
export const initializeGameAsync = createAsyncThunkWithErrorHandling(
  'game/initializeAsync',
  async (userId: string, { dispatch }) => {
    try {
      // First try to sync with server
      const syncResult = await dispatch(syncGameStateAsync(userId)).unwrap();
      
      if (syncResult) {
        return syncResult.character;
      }
      
      // If sync fails, try to load character directly
      return await dispatch(loadCharacterAsync(userId)).unwrap();
    } catch (error) {
      // If both fail, check if we need to create a character
      dispatch(setHasCharacter(false));
      throw error;
    }
  }
);

/**
 * Sync task queue progress with error recovery
 */
export const syncTaskQueueAsync = createAsyncThunkWithErrorHandling(
  'game/syncTaskQueueAsync',
  async (_, { dispatch }) => {
    try {
      // Get current progress from task queue service
      const progress = await AsyncErrorHandler.withErrorHandling(
        () => taskQueueService.getCurrentProgress(),
        {
          fallback: null,
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
        }
      );
      
      if (progress) {
        dispatch(setActivityProgress(progress));
      }
      
      // Attempt to sync with server
      await AsyncErrorHandler.withErrorHandling(
        () => taskQueueService.syncWithServer(),
        {
          fallback: undefined,
          retryConfig: {
            maxRetries: 1,
            retryDelay: 2000,
          },
          onError: (error) => {
            console.warn('Task queue sync failed:', error);
            dispatch(setOnlineStatus(false));
          },
        }
      );
      
      dispatch(setOnlineStatus(true));
      return progress;
    } catch (error) {
      // Task queue sync failures shouldn't break the game
      console.warn('Task queue sync error:', error);
      return null;
    }
  }
);

/**
 * Periodic game state sync scheduler
 */
export const scheduleGameSync = (dispatch: any, getState: () => RootState) => {
  const syncInterval = 30000; // 30 seconds
  
  const performSync = async () => {
    const state = getState();
    
    if (!state.auth.isAuthenticated || !state.auth.user) {
      return;
    }
    
    try {
      await dispatch(syncGameStateAsync(state.auth.user.userId)).unwrap();
      await dispatch(syncTaskQueueAsync()).unwrap();
    } catch (error) {
      console.warn('Scheduled sync failed:', error);
    }
  };
  
  // Initial sync
  performSync();
  
  // Schedule periodic syncs
  const intervalId = setInterval(performSync, syncInterval);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};