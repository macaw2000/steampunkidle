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
      state.character = action.payload;
      state.hasCharacter = true;
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
        state.character = { ...state.character, ...action.payload };
      }
    },
    addExperience: (state, action: PayloadAction<number>) => {
      if (state.character) {
        state.character.experience += action.payload;
        // Recalculate level if needed (this would normally be done server-side)
        const newLevel = Math.floor(Math.sqrt(state.character.experience / 100)) + 1;
        if (newLevel > state.character.level) {
          state.character.level = newLevel;
        }
      }
    },
    updateCurrency: (state, action: PayloadAction<number>) => {
      if (state.character) {
        state.character.currency = action.payload;
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
        action.payload.forEach(reward => {
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
          }
        });
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
} = gameSlice.actions;

export default gameSlice.reducer;