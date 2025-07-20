import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { loginAsync, refreshTokenAsync, scheduleTokenRefresh } from '../thunks/authThunks';
import { loadCharacterAsync, syncGameStateAsync, scheduleGameSync } from '../thunks/gameThunks';
import { initializeChatAsync, reconnectChatAsync } from '../thunks/chatThunks';
import { AsyncErrorHandler } from '../utils/asyncThunkUtils';

/**
 * Example component demonstrating Redux error handling usage
 */
export const ReduxErrorHandlingExample: React.FC = () => {
  const dispatch = useDispatch();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // Select state from Redux store
  const authState = useSelector((state: RootState) => state.auth);
  const gameState = useSelector((state: RootState) => state.game);
  const chatState = useSelector((state: RootState) => state.chat);

  // Initialize application with error handling
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsInitializing(true);
        setInitializationError(null);

        // Initialize authentication with error handling
        await AsyncErrorHandler.withErrorHandling(
          async () => {
            // This would normally check for stored tokens and validate them
            console.log('Initializing authentication...');
            // await dispatch(initializeAuthAsync()).unwrap();
          },
          {
            fallback: undefined,
            onError: (error) => {
              console.warn('Auth initialization failed:', error.message);
            },
            retryConfig: {
              maxRetries: 2,
              retryDelay: 1000,
            },
          }
        );

        // Initialize game state if authenticated
        if (authState.isAuthenticated && authState.user) {
          await AsyncErrorHandler.withErrorHandling(
            async () => {
              console.log('Loading character...');
              // await dispatch(loadCharacterAsync(authState.user!.userId)).unwrap();
            },
            {
              fallback: undefined,
              onError: (error) => {
                console.warn('Character loading failed:', error.message);
              },
            }
          );

          // Initialize chat (optional, should not block app startup)
          AsyncErrorHandler.withErrorHandling(
            async () => {
              console.log('Initializing chat...');
              // await dispatch(initializeChatAsync(authState.user!.userId)).unwrap();
            },
            {
              fallback: undefined,
              onError: (error) => {
                console.warn('Chat initialization failed:', error.message);
              },
            }
          );
        }

        console.log('Application initialized successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Application initialization failed';
        setInitializationError(errorMessage);
        console.error('Application initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [dispatch, authState.isAuthenticated, authState.user]);

  // Set up periodic sync schedulers
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.user) {
      return;
    }

    // Schedule token refresh
    const cleanupTokenRefresh = scheduleTokenRefresh(dispatch, () => ({
      auth: authState,
      game: gameState,
      chat: chatState,
    }));

    // Schedule game sync
    const cleanupGameSync = scheduleGameSync(dispatch, () => ({
      auth: authState,
      game: gameState,
      chat: chatState,
    }));

    return () => {
      cleanupTokenRefresh();
      cleanupGameSync();
    };
  }, [dispatch, authState.isAuthenticated, authState.user, authState, gameState, chatState]);

  // Handle login with error handling
  const handleLogin = async (email: string, password: string) => {
    try {
      await AsyncErrorHandler.withErrorHandling(
        async () => {
          // await dispatch(loginAsync({ email, password })).unwrap();
          console.log('Login successful');
        },
        {
          onError: (error) => {
            console.error('Login failed:', error.message);
            // Show user-friendly error message
            alert(`Login failed: ${error.message}`);
          },
          retryConfig: {
            maxRetries: 1, // Don't retry login failures automatically
            retryCondition: (error) => false, // Never retry login
          },
        }
      );
    } catch (error) {
      // Error already handled by AsyncErrorHandler
      console.log('Login process completed with error');
    }
  };

  // Handle manual sync with error handling
  const handleManualSync = async () => {
    if (!authState.user) return;

    try {
      await AsyncErrorHandler.withErrorHandling(
        async () => {
          // await dispatch(syncGameStateAsync(authState.user!.userId)).unwrap();
          console.log('Manual sync successful');
        },
        {
          onError: (error) => {
            console.error('Manual sync failed:', error.message);
            alert(`Sync failed: ${error.message}`);
          },
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
        }
      );
    } catch (error) {
      console.log('Manual sync completed with error');
    }
  };

  // Handle chat reconnection
  const handleChatReconnect = async () => {
    if (!authState.user) return;

    try {
      await AsyncErrorHandler.withErrorHandling(
        async () => {
          // await dispatch(reconnectChatAsync(authState.user!.userId)).unwrap();
          console.log('Chat reconnection successful');
        },
        {
          onError: (error) => {
            console.error('Chat reconnection failed:', error.message);
          },
        }
      );
    } catch (error) {
      console.log('Chat reconnection completed with error');
    }
  };

  // Handle state recovery
  const handleStateRecovery = () => {
    // Example of manual state recovery
    dispatch({
      type: 'auth/recoverState',
      payload: {
        user: { userId: 'recovered', email: 'recovered@example.com' },
        tokens: { accessToken: 'recovered', refreshToken: 'recovered', idToken: 'recovered' },
      },
    });

    dispatch({
      type: 'game/recoverGameState',
      payload: {
        character: {
          characterId: 'recovered',
          name: 'Recovered Character',
          level: 1,
          experience: 0,
          currency: 100,
        },
        isOnline: true,
      },
    });

    dispatch({
      type: 'chat/recoverChatState',
      payload: {
        channels: [{ channelId: 'general', name: 'General' }],
        messages: {},
        unreadCounts: { general: 0 },
        isConnected: false,
      },
    });
  };

  if (isInitializing) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Redux Error Handling Example</h2>
        <p>Initializing application...</p>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Redux Error Handling Example</h2>
        <div style={{ color: 'red', marginBottom: '20px' }}>
          <strong>Initialization Error:</strong> {initializationError}
        </div>
        <button onClick={() => window.location.reload()}>
          Retry Initialization
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Redux Error Handling Example</h2>
      
      {/* Auth State Display */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Authentication State</h3>
        <p><strong>Authenticated:</strong> {authState.isAuthenticated ? 'Yes' : 'No'}</p>
        <p><strong>Loading:</strong> {authState.loading ? 'Yes' : 'No'}</p>
        <p><strong>User:</strong> {authState.user?.email || 'None'}</p>
        {authState.error && (
          <p style={{ color: 'red' }}><strong>Error:</strong> {authState.error}</p>
        )}
      </div>

      {/* Game State Display */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Game State</h3>
        <p><strong>Has Character:</strong> {gameState.hasCharacter ? 'Yes' : 'No'}</p>
        <p><strong>Character Loading:</strong> {gameState.characterLoading ? 'Yes' : 'No'}</p>
        <p><strong>Online:</strong> {gameState.isOnline ? 'Yes' : 'No'}</p>
        <p><strong>Character:</strong> {gameState.character?.name || 'None'}</p>
        {gameState.error && (
          <p style={{ color: 'red' }}><strong>Error:</strong> {gameState.error}</p>
        )}
      </div>

      {/* Chat State Display */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Chat State</h3>
        <p><strong>Connected:</strong> {chatState.isConnected ? 'Yes' : 'No'}</p>
        <p><strong>Channels:</strong> {chatState.channels.length}</p>
        <p><strong>Loading:</strong> {chatState.loading ? 'Yes' : 'No'}</p>
        {chatState.error && (
          <p style={{ color: 'red' }}><strong>Error:</strong> {chatState.error}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Test Actions</h3>
        <button 
          onClick={() => handleLogin('test@example.com', 'password')}
          style={{ marginRight: '10px', marginBottom: '10px' }}
        >
          Test Login
        </button>
        <button 
          onClick={handleManualSync}
          style={{ marginRight: '10px', marginBottom: '10px' }}
          disabled={!authState.isAuthenticated}
        >
          Manual Sync
        </button>
        <button 
          onClick={handleChatReconnect}
          style={{ marginRight: '10px', marginBottom: '10px' }}
          disabled={!authState.isAuthenticated}
        >
          Reconnect Chat
        </button>
        <button 
          onClick={handleStateRecovery}
          style={{ marginRight: '10px', marginBottom: '10px' }}
        >
          Test State Recovery
        </button>
      </div>

      {/* Error Simulation */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Error Simulation</h3>
        <button 
          onClick={() => dispatch({ type: 'auth/loginSuccess', payload: { user: null, tokens: null } })}
          style={{ marginRight: '10px', marginBottom: '10px' }}
        >
          Trigger Auth Error
        </button>
        <button 
          onClick={() => dispatch({ type: 'game/setCharacter', payload: { level: -1 } })}
          style={{ marginRight: '10px', marginBottom: '10px' }}
        >
          Trigger Game Error
        </button>
        <button 
          onClick={() => dispatch({ type: 'chat/setChannels', payload: 'invalid' })}
          style={{ marginRight: '10px', marginBottom: '10px' }}
        >
          Trigger Chat Error
        </button>
      </div>
    </div>
  );
};

export default ReduxErrorHandlingExample;