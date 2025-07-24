import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CraftingTaskManager from '../CraftingTaskManager';
import { craftingTaskIntegration } from '../../../services/craftingTaskIntegration';
import { CRAFTING_RECIPES, CRAFTING_WORKSTATIONS } from '../../../data/craftingRecipes';

// Mock the crafting task integration
jest.mock('../../../services/craftingTaskIntegration', () => ({
  craftingTaskIntegration: {
    getAvailableRecipes: jest.fn(),
    getAvailableCraftingStations: jest.fn(),
    startCraftingTask: jest.fn(),
    queueCraftingTask: jest.fn()
  }
}));

describe('CraftingTaskManager', () => {
  // Sample player data for testing
  const playerId = 'player123';
  const playerStats = {
    level: 10,
    experience: 5000,
    strength: 15,
    dexterity: 12,
    intelligence: 18,
    vitality: 14,
    perception: 10,
    craftingSkills: {
      clockmaking: 8,
      engineering: 6,
      alchemy: 10,
      steamcraft: 5
    },
    harvestingSkills: {
      mining: 5,
      foraging: 3,
      salvaging: 7,
      crystal_extraction: 4
    },
    combatSkills: {
      melee: 6,
      ranged: 4,
      defense: 5,
      tactics: 3
    }
  };
  const playerLevel = 10;
  const playerInventory = {
    'brass-ingot': 10,
    'coal': 15,
    'silver-ingot': 5,
    'crystal-lens': 3
  };

  // Sample recipes and stations for testing
  const mockRecipes = [
    CRAFTING_RECIPES.find(r => r.recipeId === 'clockwork-gear-basic'),
    CRAFTING_RECIPES.find(r => r.recipeId === 'pocket-chronometer')
  ].filter(Boolean);

  const mockStations = [
    {
      stationId: 'basic-forge',
      name: 'Basic Steam Forge',
      type: 'basic',
      bonuses: [
        { type: 'speed', value: 10, description: '+10% crafting speed for basic recipes' }
      ],
      requirements: []
    }
  ];

  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (craftingTaskIntegration.getAvailableRecipes as jest.Mock).mockReturnValue(mockRecipes);
    (craftingTaskIntegration.getAvailableCraftingStations as jest.Mock).mockReturnValue(mockStations);
    (craftingTaskIntegration.startCraftingTask as jest.Mock).mockResolvedValue(undefined);
    (craftingTaskIntegration.queueCraftingTask as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders the crafting manager with recipe options', () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
      />
    );

    // Check that the component renders
    expect(screen.getByText('Crafting Workshop')).toBeInTheDocument();
    
    // Check that recipe selection is rendered
    expect(screen.getByLabelText(/Select Recipe:/i)).toBeInTheDocument();
    
    // Check that station selection is rendered
    expect(screen.getByLabelText(/Crafting Station:/i)).toBeInTheDocument();
    
    // Check that quantity selection is rendered
    expect(screen.getByLabelText(/Quantity:/i)).toBeInTheDocument();
    
    // Check that action buttons are rendered
    expect(screen.getByText('Start Crafting Now')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeInTheDocument();
  });

  it('displays recipe details when a recipe is selected', () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Check that recipe details are displayed
    expect(screen.getByText('Basic Clockwork Gear')).toBeInTheDocument();
    expect(screen.getByText(/Required Skill:/i)).toBeInTheDocument();
    expect(screen.getByText(/Required Materials:/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected Output:/i)).toBeInTheDocument();
  });

  it('shows material availability status', () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Check that material availability is shown
    expect(screen.getByText(/Brass Ingot:/i)).toBeInTheDocument();
    expect(screen.getByText(/Coal:/i)).toBeInTheDocument();
  });

  it('calls startCraftingTask when Start Crafting button is clicked', async () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
        onTaskAdded={() => {}}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Click the start crafting button
    const startButton = screen.getByText('Start Crafting Now');
    fireEvent.click(startButton);

    // Check that startCraftingTask was called
    await waitFor(() => {
      expect(craftingTaskIntegration.startCraftingTask).toHaveBeenCalledWith(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 1,
          craftingStationId: undefined
        }
      );
    });
  });

  it('calls queueCraftingTask when Add to Queue button is clicked', async () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
        onTaskAdded={() => {}}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Click the queue crafting button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);

    // Check that queueCraftingTask was called
    await waitFor(() => {
      expect(craftingTaskIntegration.queueCraftingTask).toHaveBeenCalledWith(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 1,
          craftingStationId: undefined
        }
      );
    });
  });

  it('handles quantity changes', async () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
        onTaskAdded={() => {}}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Change quantity
    const quantityInput = screen.getByLabelText(/Quantity:/i);
    fireEvent.change(quantityInput, { target: { value: '3' } });

    // Click the queue crafting button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);

    // Check that queueCraftingTask was called with quantity 3
    await waitFor(() => {
      expect(craftingTaskIntegration.queueCraftingTask).toHaveBeenCalledWith(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 3,
          craftingStationId: undefined
        }
      );
    });
  });

  it('handles crafting station selection', async () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
        onTaskAdded={() => {}}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Select a station
    const stationSelect = screen.getByLabelText(/Crafting Station:/i);
    fireEvent.change(stationSelect, { target: { value: 'basic-forge' } });

    // Click the queue crafting button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);

    // Check that queueCraftingTask was called with the station
    await waitFor(() => {
      expect(craftingTaskIntegration.queueCraftingTask).toHaveBeenCalledWith(
        playerId,
        'clockwork-gear-basic',
        playerStats,
        playerLevel,
        playerInventory,
        {
          quantity: 1,
          craftingStationId: 'basic-forge'
        }
      );
    });
  });

  it('displays error message when crafting fails', async () => {
    // Mock the queueCraftingTask to reject
    (craftingTaskIntegration.queueCraftingTask as jest.Mock).mockRejectedValue(
      new Error('Insufficient materials')
    );

    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Click the queue crafting button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);

    // Check that error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Insufficient materials')).toBeInTheDocument();
    });
  });

  it('displays success message when crafting succeeds', async () => {
    render(
      <CraftingTaskManager
        playerId={playerId}
        playerStats={playerStats}
        playerLevel={playerLevel}
        playerInventory={playerInventory}
      />
    );

    // Select a recipe
    const recipeSelect = screen.getByLabelText(/Select Recipe:/i);
    fireEvent.change(recipeSelect, { target: { value: 'clockwork-gear-basic' } });

    // Click the queue crafting button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);

    // Check that success message is displayed
    await waitFor(() => {
      expect(screen.getByText(/Queued crafting/)).toBeInTheDocument();
    });
  });
});