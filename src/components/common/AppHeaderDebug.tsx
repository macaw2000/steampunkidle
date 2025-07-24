import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

const AppHeaderDebug: React.FC = () => {
  console.log('AppHeaderDebug: Component rendering...');
  
  // Hooks must be called at the top level
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter } = useSelector((state: RootState) => state.game);
  
  try {
    console.log('AppHeaderDebug: Auth state:', { isAuthenticated });
    console.log('AppHeaderDebug: Game state:', { character, hasCharacter });
    
    return (
      <header style={{ 
        padding: '10px 20px', 
        backgroundColor: '#2c3e50', 
        color: 'white',
        borderBottom: '2px solid #34495e'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Steampunk Idle Game (Debug)</h1>
          <small>Auth: {String(isAuthenticated)} | Has Character: {String(hasCharacter)}</small>
        </div>
      </header>
    );
  } catch (error) {
    console.error('AppHeaderDebug: Error in component:', error);
    return (
      <header style={{ 
        padding: '10px 20px', 
        backgroundColor: '#e74c3c', 
        color: 'white'
      }}>
        <h1>Header Error: {error instanceof Error ? error.message : String(error)}</h1>
      </header>
    );
  }
};

export default AppHeaderDebug;