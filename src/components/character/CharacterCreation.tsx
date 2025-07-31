/**
 * Character creation component
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setCharacter, setLoading, setError } from '../../store/slices/gameSlice';
import { AdaptiveCharacterService } from '../../services/adaptiveCharacterService';
import NetworkStatusIndicator from '../common/NetworkStatusIndicator';
import './CharacterCreation.css';

interface CharacterCreationProps {
  onCharacterCreated?: () => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreated }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { loading, error } = useSelector((state: RootState) => state.game);
  
  const [characterName, setCharacterName] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameValidating, setNameValidating] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);

  const validateNameFormat = (name: string): boolean => {
    if (name.length < 3) {
      setNameError('Character name must be at least 3 characters long');
      return false;
    }
    if (name.length > 20) {
      setNameError('Character name must be no more than 20 characters long');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setNameError('Character name can only contain letters, numbers, underscores, and hyphens');
      return false;
    }
    return true;
  };

  const validateNameUniqueness = async (name: string) => {
    if (!validateNameFormat(name)) {
      setNameAvailable(null);
      return;
    }

    setNameValidating(true);
    setNameError('');
    setNameAvailable(null);

    try {
      const result = await AdaptiveCharacterService.validateCharacterName(name);
      setNameAvailable(result.available);
      if (!result.available) {
        setNameError(result.message);
      }
    } catch (error) {
      console.error('Name validation error:', error);
      setNameError('Unable to validate name. Please try again.');
      setNameAvailable(null);
    } finally {
      setNameValidating(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCharacterName(name);
    setNameAvailable(null);

    // Clear existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    if (name) {
      // Validate format immediately
      if (validateNameFormat(name)) {
        setNameError('');
        // Debounce uniqueness validation
        const timeout = setTimeout(() => {
          validateNameUniqueness(name);
        }, 500);
        setValidationTimeout(timeout);
      }
    } else {
      setNameError('');
      setNameValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      dispatch(setError('User not authenticated'));
      return;
    }

    if (!validateNameFormat(characterName) || nameAvailable !== true) {
      if (nameAvailable === false) {
        setNameError('Character name is already taken. Please choose a different name.');
      }
      return;
    }

    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const character = await AdaptiveCharacterService.createCharacter({
        userId: user.userId,
        name: characterName,
      });

      dispatch(setCharacter(character));
      
      if (onCharacterCreated) {
        onCharacterCreated();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create character';
      console.error('[CharacterCreation] Character creation failed:', errorMessage);
      dispatch(setError(errorMessage));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    dispatch(setError(null));
    handleSubmit(new Event('submit') as any);
  };

  const handleNetworkRetry = () => {
    // Clear any existing errors and allow user to retry
    dispatch(setError(null));
    setRetryCount(0);
  };

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, [validationTimeout]);

  return (
    <div className="character-creation">
      <NetworkStatusIndicator onRetry={handleNetworkRetry} />
      <div className="character-creation-container">
        <h2 className="character-creation-title">Create Your Steampunk Character</h2>
        <p className="character-creation-description">
          Welcome to the world of steam and gears! Create your character to begin your idle adventure.
        </p>

        <form onSubmit={handleSubmit} className="character-creation-form">
          <div className="form-group">
            <label htmlFor="characterName" className="form-label">
              Character Name
            </label>
            <div className="name-input-container">
              <input
                type="text"
                id="characterName"
                value={characterName}
                onChange={handleNameChange}
                className={`form-input ${nameError ? 'form-input-error' : nameAvailable === true ? 'form-input-success' : ''}`}
                placeholder="Enter your character name"
                disabled={loading}
                maxLength={20}
              />
              {nameValidating && (
                <div className="name-validation-indicator">
                  <span className="validation-spinner">⚙️</span>
                  <span>Checking availability...</span>
                </div>
              )}
              {nameAvailable === true && !nameValidating && (
                <div className="name-validation-success">
                  <span className="validation-check">✅</span>
                  <span>Name is available!</span>
                </div>
              )}
            </div>
            {nameError && <span className="form-error">{nameError}</span>}
          </div>

          <div className="character-preview">
            <h3>Starting Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-name">Strength</span>
                <span className="stat-value">10</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Dexterity</span>
                <span className="stat-value">10</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Intelligence</span>
                <span className="stat-value">10</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Vitality</span>
                <span className="stat-value">10</span>
              </div>
            </div>
            
            <h3>Starting Skills</h3>
            <div className="skills-grid">
              <div className="skill-category">
                <h4>Crafting Skills</h4>
                <div className="skill-item">Clockmaking: Level 1</div>
                <div className="skill-item">Engineering: Level 1</div>
                <div className="skill-item">Alchemy: Level 1</div>
                <div className="skill-item">Steamcraft: Level 1</div>
              </div>
              <div className="skill-category">
                <h4>Other Skills</h4>
                <div className="skill-item">Harvesting: Level 1</div>
                <div className="skill-item">Combat: Level 1</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <div className="error-text">{error}</div>
              {retryCount < 3 && (
                <button 
                  type="button" 
                  onClick={handleRetry}
                  className="retry-button"
                  disabled={loading}
                >
                  Try Again
                </button>
              )}
              {retryCount >= 3 && (
                <div className="error-help">
                  <p>Having trouble? The app is now using offline mode with mock data.</p>
                  <p>You can still create a character and play the game!</p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="create-character-button"
            disabled={loading || !characterName || !!nameError || nameValidating || nameAvailable !== true}
          >
            {loading ? 'Creating Character...' : 'Create Character'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CharacterCreation;