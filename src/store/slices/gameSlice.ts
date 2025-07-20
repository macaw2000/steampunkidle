import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Character, ActivityType, ActivityReward } from '../../types/character';
import { ActivityProgress } from '../../services/activityService';

interface GameState {
  character: Character | null;
  hasCharacter: boolean | null; // null = unknown, true = has character, false = needs to create
  characterLoading: boolean;
  activityProgress: ActivityProgress | null;
  isOnline: boolean;
  lastSyncTime: number | null;
  loading: boolean;
  error: string | null;
  activitySwitching: boolean;
}

const initialState: GameState = {
  character: null,
  hasCharacter: null,
  characterLoading: false,
  activityProgress: null,
  isOnline: false,
  lastSyncTime: null,
  loading: false,
  error: null,
  activitySwitching: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setCharacter: (state, action: PayloadAction<Character>) => {
      try {
        const character = action.payload;
        
        // Validate character data
        if (!character || !character.characterId || !character.name) {
          throw new Error('Invalid character data: missing required fields');
        }
        
        if (typeof character.level !== 'number' || character.level < 1) {
          throw new Error('Invalid character data: level must be a positive number');
        }
        
        if (typeof character.experience !== 'number' || character.experience < 0) {
          throw new Error('Invalid character data: experience must be non-negative');
        }
        
        if (typeof character.currency !== 'number' || character.currency < 0) {
          throw new Error('Invalid character data: currency must be non-negative');
        }
        
        state.character = character;
        state.hasCharacter = true;
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Character validation failed';
        state.hasCharacter = false;
      }
    },
    setHasCharacter: (state, action: PayloadAction<boolean | null>) => {
      state.hasCharacter = action.payload;
    },
    setCharacterLoading: (state, action: PayloadAction<boolean>) => {
      state.characterLoading = action.payload;
    },
    clearCharacter: (state) => {
      state.character = null;
      state.hasCharacter = false;
    },
    updateCharacterActivity: (state, action: PayloadAction<ActivityType>) => {
      if (state.character) {
        state.character.currentActivity = {
          ...state.character.currentActivity,
          type: action.payload,
          startedAt: new Date(),
        };
      }
    },
    updateCharacterStats: (state, action: PayloadAction<Partial<Character>>) => {
      if (state.character) {
        try {
          const updates = action.payload;
          
          // Validate numeric fields if they're being updated
          if (updates.level !== undefined && (typeof updates.level !== 'number' || updates.level < 1)) {
            throw new Error('Invalid level update: must be a positive number');
          }
          
          if (updates.experience !== undefined && (typeof updates.experience !== 'number' || updates.experience < 0)) {
            throw new Error('Invalid experience update: must be non-negative');
          }
          
          if (updates.currency !== undefined && (typeof updates.currency !== 'number' || updates.currency < 0)) {
            throw new Error('Invalid currency update: must be non-negative');
          }
          
          state.character = { ...state.character, ...updates };
          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : 'Character update validation failed';
        }
      }
    },
    addExperience: (state, action: PayloadAction<number>) => {
      if (state.character) {
        try {
          const experienceGain = action.payload;
          
          if (typeof experienceGain !== 'number' || experienceGain < 0) {
            throw new Error('Invalid experience gain: must be a non-negative number');
          }
          
          state.character.experience += experienceGain;
          
          // Recalculate level if needed (this would normally be done server-side)
          const newLevel = Math.floor(Math.sqrt(state.character.experience / 100)) + 1;
          if (newLevel > state.character.level) {
            state.character.level = newLevel;
          }
          
          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : 'Experience update failed';
        }
      }
    },
    updateCurrency: (state, action: PayloadAction<number>) => {
      if (state.character) {
        try {
          const newCurrency = action.payload;
          
          if (typeof newCurrency !== 'number' || newCurrency < 0) {
            throw new Error('Invalid currency update: must be a non-negative number');
          }
          
          state.character.currency = newCurrency;
          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : 'Currency update failed';
        }
      }
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    updateLastSyncTime: (state) => {
      state.lastSyncTime = Date.now();
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setActivityProgress: (state, action: PayloadAction<ActivityProgress | null>) => {
      state.activityProgress = action.payload;
    },
    setActivitySwitching: (state, action: PayloadAction<boolean>) => {
      state.activitySwitching = action.payload;
    },
    applyActivityRewards: (state, action: PayloadAction<ActivityReward[]>) => {
      if (state.character) {
        try {
          const rewards = action.payload;
          
          if (!Array.isArray(rewards)) {
            throw new Error('Invalid rewards: must be an array');
          }
          
          rewards.forEach(reward => {
            if (!reward || typeof reward.amount !== 'number' || reward.amount < 0) {
              throw new Error('Invalid reward: must have positive amount');
            }
            
            switch (reward.type) {
              case 'experience':
                state.character!.experience += reward.amount;
                // Recalculate level
                const newLevel = Math.floor(Math.sqrt(state.character!.experience / 100)) + 1;
                if (newLevel > state.character!.level) {
                  state.character!.level = newLevel;
                }
                break;
              case 'currency':
                state.character!.currency += reward.amount;
                break;
              // Additional reward types can be handled here
              default:
                console.warn(`Unknown reward type: ${reward.type}`);
            }
          });
          
          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : 'Reward application failed';
        }
      }
    },
    // New reducer for handling corrupted state recovery
    recoverGameState: (state, action: PayloadAction<Partial<GameState>>) => {
      try {
        const recoveryData = action.payload;
        
        // Recover character data if valid
        if (recoveryData.character) {
          const character = recoveryData.character;
          if (character.characterId && character.name && 
              typeof character.level === 'number' && character.level > 0 &&
              typeof character.experience === 'number' && character.experience >= 0 &&
              typeof character.currency === 'number' && character.currency >= 0) {
            state.character = character;
            state.hasCharacter = true;
          }
        }
        
        // Recover other valid state properties
        if (typeof recoveryData.isOnline === 'boolean') {
          state.isOnline = recoveryData.isOnline;
        }
        
        if (typeof recoveryData.lastSyncTime === 'number') {
          state.lastSyncTime = recoveryData.lastSyncTime;
        }
        
        if (recoveryData.activityProgress) {
          state.activityProgress = recoveryData.activityProgress;
        }
        
        // Clear error and loading states during recovery
        state.loading = false;
        state.characterLoading = false;
        state.activitySwitching = false;
        state.error = null;
      } catch (error) {
        // If recovery fails, reset to safe state
        Object.assign(state, initialState);
        state.error = 'Game state recovery failed';
      }
    },
  },
});

export const {
  setCharacter,
  setHasCharacter,
  setCharacterLoading,
  clearCharacter,
  updateCharacterActivity,
  updateCharacterStats,
  addExperience,
  updateCurrency,
  setOnlineStatus,
  updateLastSyncTime,
  setLoading,
  setError,
  setActivityProgress,
  setActivitySwitching,
  applyActivityRewards,
  recoverGameState,
} = gameSlice.actions;

export default gameSlice.reducer;