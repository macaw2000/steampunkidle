import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import gameReducer from './slices/gameSlice';
import chatReducer from './slices/chatSlice';
import { errorLoggingMiddleware, stateValidationMiddleware } from './middleware/errorMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
        ignoredActionsPaths: ['payload.lastActiveAt', 'payload.createdAt', 'payload.currentActivity.startedAt'],
        ignoredPaths: ['game.character.lastActiveAt', 'game.character.createdAt', 'game.character.currentActivity.startedAt'],
      },
    })
    .concat(errorLoggingMiddleware)
    .concat(stateValidationMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;