/**
 * App Header Component
 * Combines the game title with the unified progress bar
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import UnifiedProgressBar from './UnifiedProgressBar';
import './AppHeader.css';

const AppHeader: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter } = useSelector((state: RootState) => state.game);

  // Only show progress bar if user is authenticated and has a character
  const showProgressBar = isAuthenticated && hasCharacter && character;

  return (
    <header className="app-header">
      <div className="header-title">
        <h1>Steampunk Idle Game</h1>
      </div>
      
      {showProgressBar && (
        <div className="header-progress">
          <UnifiedProgressBar
            playerId={character?.characterId || 'mock-player'}
          />
        </div>
      )}
    </header>
  );
};

export default AppHeader;