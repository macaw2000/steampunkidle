/**
 * Character manager component that handles character loading and display
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setCharacter, setLoading, setError } from '../../store/slices/gameSlice';
import { CharacterService } from '../../services/characterService';
import CharacterCreation from './CharacterCreation';
import CharacterProfile from './CharacterProfile';
import './CharacterManager.css';

export const CharacterManager: React.FC = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, loading, error } = useSelector((state: RootState) => state.game);
  
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !character && !initialLoadComplete) {
      loadCharacter();
    }
  }, [isAuthenticated, user, character, initialLoadComplete]);

  const loadCharacter = async () => {
    if (!user) return;

    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const loadedCharacter = await CharacterService.getCharacter(user.userId);
      if (loadedCharacter) {
        dispatch(setCharacter(loadedCharacter));
      }
      // If loadedCharacter is null, it means no character exists yet, which is fine
    } catch (error) {
      console.error('Error loading character:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to load character'));
    } finally {
      dispatch(setLoading(false));
      setInitialLoadComplete(true);
    }
  };

  const handleCharacterCreated = () => {
    // Character creation component will update the Redux store
    // We don't need to do anything here
  };

  const handleRefresh = () => {
    setInitialLoadComplete(false);
    loadCharacter();
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="character-manager">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to access your character.</p>
        </div>
      </div>
    );
  }

  if (loading && !initialLoadComplete) {
    return (
      <div className="character-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your character...</p>
        </div>
      </div>
    );
  }

  if (error && !character) {
    return (
      <div className="character-manager">
        <div className="error-container">
          <h2>Error Loading Character</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="character-manager">
        <CharacterCreation onCharacterCreated={handleCharacterCreated} />
      </div>
    );
  }

  return (
    <div className="character-manager">
      <div className="character-header-actions">
        <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <CharacterProfile character={character} />
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default CharacterManager;