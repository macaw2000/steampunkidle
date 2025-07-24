import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

const GameDashboardDebug: React.FC = () => {
  console.log('GameDashboardDebug: Component rendering...');
  
  // Hooks must be called at the top level
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter, characterLoading, isOnline } = useSelector((state: RootState) => state.game);
  
  try {
    console.log('GameDashboardDebug: Auth state:', { isAuthenticated });
    console.log('GameDashboardDebug: Game state:', { character, hasCharacter, characterLoading, isOnline });
    
    return (
      <div style={{ padding: '20px' }}>
        <h1>Game Dashboard Debug</h1>
        <div>
          <h3>Auth State:</h3>
          <p>Authenticated: {String(isAuthenticated)}</p>
        </div>
        <div>
          <h3>Game State:</h3>
          <p>Has Character: {String(hasCharacter)}</p>
          <p>Character Loading: {String(characterLoading)}</p>
          <p>Is Online: {String(isOnline)}</p>
          <p>Character: {character ? character.name : 'None'}</p>
        </div>
      </div>
    );
  } catch (error) {
    console.error('GameDashboardDebug: Error in component:', error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>Debug Error</h1>
        <p>Error: {error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }
};

export default GameDashboardDebug;