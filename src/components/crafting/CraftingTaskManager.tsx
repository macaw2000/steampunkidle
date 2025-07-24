import React, { useState, useEffect } from 'react';
import { CraftingRecipe, CraftingWorkstation } from '../../types/crafting';
import { CharacterStats } from '../../types/character';
import { CraftingStation } from '../../types/taskQueue';
import { CraftingTaskIntegration, craftingTaskIntegration } from '../../services/craftingTaskIntegration';
import './CraftingTaskManager.css';

interface CraftingTaskManagerProps {
  playerId: string;
  playerStats: CharacterStats;
  playerLevel: number;
  playerInventory: { [itemId: string]: number };
  onTaskAdded?: () => void;
}

const CraftingTaskManager: React.FC<CraftingTaskManagerProps> = ({
  playerId,
  playerStats,
  playerLevel,
  playerInventory,
  onTaskAdded
}) => {
  const [availableRecipes, setAvailableRecipes] = useState<CraftingRecipe[]>([]);
  const [availableStations, setAvailableStations] = useState<CraftingStation[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [selectedStation, setSelectedStation] = useState<CraftingStation | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load available recipes and stations
  useEffect(() => {
    // Get available recipes based on player level and skills
    const recipes = CraftingTaskIntegration.getAvailableRecipes(playerLevel, playerStats);
    setAvailableRecipes(recipes);

    // Get available crafting stations
    const stations = CraftingTaskIntegration.getAvailableCraftingStations(playerLevel, playerStats);
    setAvailableStations(stations);
  }, [playerLevel, playerStats]);

  // Check if player has enough materials for selected recipe
  const hasSufficientMaterials = (recipe: CraftingRecipe, qty: number): boolean => {
    if (!recipe) return false;

    for (const material of recipe.materials) {
      const available = playerInventory[material.materialId] || 0;
      if (available < material.quantity * qty) {
        return false;
      }
    }

    return true;
  };

  // Handle recipe selection
  const handleRecipeSelect = (recipeId: string) => {
    const recipe = availableRecipes.find(r => r.recipeId === recipeId);
    setSelectedRecipe(recipe || null);
    setError(null);
    setSuccessMessage(null);
  };

  // Handle station selection
  const handleStationSelect = (stationId: string) => {
    if (stationId === 'none') {
      setSelectedStation(null);
      return;
    }
    
    const station = availableStations.find(s => s.stationId === stationId);
    setSelectedStation(station || null);
  };

  // Handle quantity change
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value, 10);
    if (isNaN(qty) || qty < 1) {
      setQuantity(1);
    } else {
      setQuantity(qty);
    }
  };

  // Start crafting immediately
  const handleStartCrafting = async () => {
    if (!selectedRecipe) {
      setError('Please select a recipe first');
      return;
    }

    if (!hasSufficientMaterials(selectedRecipe, quantity)) {
      setError('Insufficient materials for crafting');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await CraftingTaskIntegration.startCraftingTask(
        playerId,
        selectedRecipe.recipeId,
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity,
          craftingStationId: selectedStation?.stationId
        }
      );

      setSuccessMessage(`Started crafting ${quantity} ${selectedRecipe.name}`);
      if (onTaskAdded) onTaskAdded();
    } catch (err: any) {
      setError(err.message || 'Failed to start crafting');
    } finally {
      setIsLoading(false);
    }
  };

  // Queue crafting task
  const handleQueueCrafting = async () => {
    if (!selectedRecipe) {
      setError('Please select a recipe first');
      return;
    }

    if (!hasSufficientMaterials(selectedRecipe, quantity)) {
      setError('Insufficient materials for crafting');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await CraftingTaskIntegration.queueCraftingTask(
        playerId,
        selectedRecipe.recipeId,
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity,
          craftingStationId: selectedStation?.stationId
        }
      );

      setSuccessMessage(`Queued crafting ${quantity} ${selectedRecipe.name}`);
      if (onTaskAdded) onTaskAdded();
    } catch (err: any) {
      setError(err.message || 'Failed to queue crafting');
    } finally {
      setIsLoading(false);
    }
  };

  // Render material requirements with availability
  const renderMaterialRequirements = () => {
    if (!selectedRecipe) return null;

    return (
      <div className="crafting-materials">
        <h4>Required Materials:</h4>
        <ul>
          {selectedRecipe.materials.map(material => {
            const requiredAmount = material.quantity * quantity;
            const availableAmount = playerInventory[material.materialId] || 0;
            const isAvailable = availableAmount >= requiredAmount;

            return (
              <li key={material.materialId} className={isAvailable ? 'available' : 'unavailable'}>
                {material.name}: {requiredAmount} (Available: {availableAmount})
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Render expected outputs
  const renderExpectedOutputs = () => {
    if (!selectedRecipe) return null;

    return (
      <div className="crafting-outputs">
        <h4>Expected Output:</h4>
        <ul>
          {selectedRecipe.outputs.map(output => (
            <li key={output.itemId}>
              {output.name} x {output.quantity * quantity}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Render station bonuses
  const renderStationBonuses = () => {
    if (!selectedStation) return null;

    return (
      <div className="station-bonuses">
        <h4>Station Bonuses:</h4>
        <ul>
          {selectedStation.bonuses.map((bonus, index) => (
            <li key={index}>
              {bonus.description}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="crafting-task-manager">
      <h2>Crafting Workshop</h2>
      
      {/* Recipe Selection */}
      <div className="recipe-selection">
        <label htmlFor="recipe-select">Select Recipe:</label>
        <select 
          id="recipe-select" 
          onChange={(e) => handleRecipeSelect(e.target.value)}
          disabled={isLoading}
        >
          <option value="">-- Select a Recipe --</option>
          {availableRecipes.map(recipe => (
            <option key={recipe.recipeId} value={recipe.recipeId}>
              {recipe.name} (Level {recipe.requiredLevel} {recipe.requiredSkill})
            </option>
          ))}
        </select>
      </div>

      {/* Crafting Station Selection */}
      <div className="station-selection">
        <label htmlFor="station-select">Crafting Station:</label>
        <select 
          id="station-select" 
          onChange={(e) => handleStationSelect(e.target.value)}
          disabled={isLoading}
        >
          <option value="none">-- No Station (Basic Crafting) --</option>
          {availableStations.map(station => (
            <option key={station.stationId} value={station.stationId}>
              {station.name} ({station.type})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity Selection */}
      <div className="quantity-selection">
        <label htmlFor="quantity-input">Quantity:</label>
        <input
          id="quantity-input"
          type="number"
          min="1"
          max="100"
          value={quantity}
          onChange={handleQuantityChange}
          disabled={isLoading}
        />
      </div>

      {/* Recipe Details */}
      {selectedRecipe && (
        <div className="recipe-details">
          <h3>{selectedRecipe.name}</h3>
          <p>{selectedRecipe.description}</p>
          <p>Required Skill: {selectedRecipe.requiredSkill} (Level {selectedRecipe.requiredLevel})</p>
          <p>Base Crafting Time: {Math.round(selectedRecipe.craftingTime / 60)} minutes</p>
          <p>Experience Gain: {selectedRecipe.experienceGain * quantity}</p>
          
          {renderMaterialRequirements()}
          {renderExpectedOutputs()}
          {renderStationBonuses()}
          
          <div className="crafting-flavor">
            <em>{selectedRecipe.steampunkTheme.flavorText}</em>
          </div>
        </div>
      )}

      {/* Error and Success Messages */}
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Action Buttons */}
      <div className="crafting-actions">
        <button 
          onClick={handleStartCrafting} 
          disabled={isLoading || !selectedRecipe || !hasSufficientMaterials(selectedRecipe!, quantity)}
          className="start-crafting-btn"
        >
          {isLoading ? 'Processing...' : 'Start Crafting Now'}
        </button>
        
        <button 
          onClick={handleQueueCrafting} 
          disabled={isLoading || !selectedRecipe || !hasSufficientMaterials(selectedRecipe!, quantity)}
          className="queue-crafting-btn"
        >
          {isLoading ? 'Processing...' : 'Add to Queue'}
        </button>
      </div>
    </div>
  );
};

export default CraftingTaskManager;