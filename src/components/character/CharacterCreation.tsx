/**
 * Character creation component
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setCharacter, setLoading, setError } from '../../store/slices/gameSlice';
import { CharacterService } from '../../services/characterService';
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

  const validateName = (name: string): boolean => {
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
    setNameError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCharacterName(name);
    if (name) {
      validateName(name);
    } else {
      setNameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      dispatch(setError('User not authenticated'));
      return;
    }

    if (!validateName(characterName)) {
      return;
    }

    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const character = await CharacterService.createCharacter({
        userId: user.userId,
        name: characterName,
      });

      dispatch(setCharacter(character));
      
      if (onCharacterCreated) {
        onCharacterCreated();
      }
    } catch (error) {
      dispatch(setError(error instanceof Error ? error.message : 'Failed to create character'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="character-creation">
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
            <input
              type="text"
              id="characterName"
              value={characterName}
              onChange={handleNameChange}
              className={`form-input ${nameError ? 'form-input-error' : ''}`}
              placeholder="Enter your character name"
              disabled={loading}
              maxLength={20}
            />
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

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="create-character-button"
            disabled={loading || !characterName || !!nameError}
          >
            {loading ? 'Creating Character...' : 'Create Character'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CharacterCreation;