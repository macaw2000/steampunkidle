/**
 * Crafting Station Component - Main crafting interface
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { CraftingRecipe, CraftingSession, CraftingSkillType } from '../../types/crafting';
import { CraftingService } from '../../services/craftingService';
import { CRAFTING_RECIPES } from '../../data/craftingRecipes';
import { setError, setLoading } from '../../store/slices/gameSlice';
import './CraftingStation.css';

interface CraftingStationProps {
  selectedSkill?: CraftingSkillType;
}

const CraftingStation: React.FC<CraftingStationProps> = ({ selectedSkill }) => {
  const dispatch = useDispatch();
  const { character } = useSelector((state: RootState) => state.game);
  
  const [availableRecipes, setAvailableRecipes] = useState<CraftingRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [craftingSession, setCraftingSession] = useState<CraftingSession | null>(null);
  const [craftingInProgress, setCraftingInProgress] = useState(false);
  const [filterSkill, setFilterSkill] = useState<CraftingSkillType | 'all'>(selectedSkill || 'all');

  // Load available recipes when character changes
  useEffect(() => {
    if (character) {
      const recipes = CraftingService.getAvailableRecipes(character);
      setAvailableRecipes(recipes);
    }
  }, [character]);

  // Filter recipes by selected skill
  const filteredRecipes = availableRecipes.filter(recipe => 
    filterSkill === 'all' || recipe.requiredSkill === filterSkill
  );

  const handleStartCrafting = async (recipe: CraftingRecipe) => {
    if (!character || craftingInProgress) return;

    setCraftingInProgress(true);
    dispatch(setError(null));

    try {
      const response = await CraftingService.startCrafting({
        userId: character.userId,
        recipeId: recipe.recipeId,
      });

      setCraftingSession(response.session);
      setSelectedRecipe(recipe);
      
      // Auto-complete after crafting time (for demo purposes)
      const craftingTimeMs = new Date(response.estimatedCompletion).getTime() - Date.now();
      setTimeout(() => {
        handleCompleteCrafting(response.session.sessionId);
      }, Math.max(craftingTimeMs, 0));

    } catch (error) {
      console.error('Failed to start crafting:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to start crafting'));
    } finally {
      setCraftingInProgress(false);
    }
  };

  const handleCompleteCrafting = async (sessionId: string) => {
    if (!character) return;

    try {
      const response = await CraftingService.completeCrafting({
        userId: character.userId,
        sessionId,
      });

      setCraftingSession(null);
      setSelectedRecipe(null);
      
      // Show completion notification
      alert(`Crafting completed! Created ${response.itemsCreated.length} items and gained ${response.experienceGained} experience.`);
      
      if (response.skillLevelUp) {
        alert(`${response.skillLevelUp.skill} leveled up to ${response.skillLevelUp.newLevel}!`);
      }

    } catch (error) {
      console.error('Failed to complete crafting:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to complete crafting'));
    }
  };

  const getSkillLevel = (skillType: CraftingSkillType): number => {
    if (!character) return 0;
    return character.stats.craftingSkills[skillType];
  };

  const getSkillDisplay = (skillType: CraftingSkillType) => {
    return CraftingService.getSkillTreeDisplay(skillType);
  };

  const canCraftRecipe = (recipe: CraftingRecipe): boolean => {
    if (!character) return false;
    return getSkillLevel(recipe.requiredSkill) >= recipe.requiredLevel;
  };

  if (!character) {
    return (
      <div className="crafting-station">
        <div className="crafting-station__loading">
          Loading character data...
        </div>
      </div>
    );
  }

  return (
    <div className="crafting-station">
      <div className="crafting-station__header">
        <h2 className="crafting-station__title">Clockwork Crafting Station</h2>
        <p className="crafting-station__subtitle">
          Create intricate steam-powered devices and mechanical marvels
        </p>
      </div>

      {craftingSession && selectedRecipe && (
        <div className="crafting-station__active-session">
          <div className="crafting-session">
            <div className="crafting-session__header">
              <h3>Crafting in Progress</h3>
              <div className="crafting-session__recipe">
                <span className="crafting-session__recipe-name">{selectedRecipe.name}</span>
                <span className="crafting-session__recipe-time">
                  {CraftingService.formatCraftingTime(selectedRecipe.craftingTime)}
                </span>
              </div>
            </div>
            <div className="crafting-session__status">
              <p>Creating {selectedRecipe.name}... Please wait.</p>
              <p><em>Progress will be shown in Current Operations section</em></p>
            </div>
          </div>
        </div>
      )}

      <div className="crafting-station__controls">
        <div className="crafting-station__filter">
          <label htmlFor="skill-filter">Filter by Skill:</label>
          <select
            id="skill-filter"
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value as CraftingSkillType | 'all')}
            className="crafting-station__filter-select"
          >
            <option value="all">All Skills</option>
            <option value="clockmaking">Clockmaking</option>
            <option value="engineering">Engineering</option>
            <option value="alchemy">Alchemy</option>
            <option value="steamcraft">Steamcraft</option>
          </select>
        </div>
      </div>

      <div className="crafting-station__skills">
        <h3>Your Crafting Skills</h3>
        <div className="crafting-skills-grid">
          {(['clockmaking', 'engineering', 'alchemy', 'steamcraft'] as CraftingSkillType[]).map(skillType => {
            const skillInfo = getSkillDisplay(skillType);
            const skillLevel = getSkillLevel(skillType);
            const skillExp = character.stats.craftingSkills[skillType];
            const nextLevelExp = CraftingService.calculateExperienceForSkillLevel(skillLevel + 1);
            const currentLevelExp = CraftingService.calculateExperienceForSkillLevel(skillLevel);
            const progressPercent = ((skillExp - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

            return (
              <div key={skillType} className="crafting-skill">
                <div className="crafting-skill__header">
                  <span className="crafting-skill__icon">{skillInfo.icon}</span>
                  <div className="crafting-skill__info">
                    <h4 className="crafting-skill__name">{skillInfo.name}</h4>
                    <span className="crafting-skill__level">Level {skillLevel}</span>
                  </div>
                </div>
                <div className="crafting-skill__progress">
                  <span className="crafting-skill__progress-text">
                    {skillExp - currentLevelExp} / {nextLevelExp - currentLevelExp} XP ({Math.round(progressPercent)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="crafting-station__recipes">
        <h3>Available Recipes ({filteredRecipes.length})</h3>
        <div className="crafting-recipes-grid">
          {filteredRecipes.map(recipe => {
            const skillInfo = getSkillDisplay(recipe.requiredSkill);
            const canCraft = canCraftRecipe(recipe);
            const skillLevel = getSkillLevel(recipe.requiredSkill);

            return (
              <div 
                key={recipe.recipeId} 
                className={`crafting-recipe ${canCraft ? 'crafting-recipe--available' : 'crafting-recipe--locked'}`}
              >
                <div className="crafting-recipe__header">
                  <h4 className="crafting-recipe__name">{recipe.name}</h4>
                  <div className="crafting-recipe__skill">
                    <span className="crafting-recipe__skill-icon">{skillInfo.icon}</span>
                    <span className="crafting-recipe__skill-requirement">
                      {recipe.requiredSkill} Lv.{recipe.requiredLevel}
                    </span>
                  </div>
                </div>

                <p className="crafting-recipe__description">{recipe.description}</p>
                <p className="crafting-recipe__flavor">{recipe.steampunkTheme.flavorText}</p>

                <div className="crafting-recipe__details">
                  <div className="crafting-recipe__time">
                    <span className="crafting-recipe__label">Crafting Time:</span>
                    <span className="crafting-recipe__value">
                      {CraftingService.formatCraftingTime(recipe.craftingTime)}
                    </span>
                  </div>
                  <div className="crafting-recipe__experience">
                    <span className="crafting-recipe__label">Experience:</span>
                    <span className="crafting-recipe__value">+{recipe.experienceGain} XP</span>
                  </div>
                </div>

                <div className="crafting-recipe__materials">
                  <h5>Required Materials:</h5>
                  <ul className="crafting-recipe__materials-list">
                    {recipe.materials.map((material, index) => (
                      <li key={index} className="crafting-recipe__material">
                        <span className="crafting-recipe__material-name">{material.name}</span>
                        <span className="crafting-recipe__material-quantity">x{material.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="crafting-recipe__outputs">
                  <h5>Creates:</h5>
                  <ul className="crafting-recipe__outputs-list">
                    {recipe.outputs.map((output, index) => (
                      <li key={index} className="crafting-recipe__output">
                        <span className="crafting-recipe__output-name">{output.name}</span>
                        <span className="crafting-recipe__output-quantity">x{output.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="crafting-recipe__actions">
                  {canCraft ? (
                    <button
                      className="crafting-recipe__craft-button"
                      onClick={() => handleStartCrafting(recipe)}
                      disabled={craftingInProgress || !!craftingSession}
                    >
                      {craftingInProgress ? 'Starting...' : 'Craft Item'}
                    </button>
                  ) : (
                    <div className="crafting-recipe__locked">
                      <span>Requires {recipe.requiredSkill} Level {recipe.requiredLevel}</span>
                      <span>(Current: {skillLevel})</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="crafting-station__no-recipes">
            <p>No recipes available for the selected skill.</p>
            <p>Level up your crafting skills to unlock more recipes!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CraftingStation;