/**
 * Tests for Combat Task Manager Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CombatTaskManager from '../CombatTaskManager';
import { CombatTaskIntegration } from '../../../services/combatTaskIntegration';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService.enhanced';
import { CombatService } from '../../../services/combatService';
import { ENEMIES, COMBAT_ZONES } from '../../../data/combatData';

// Mock dependencies
jest.mock('../../../services/combatTaskIntegration', () => ({
  CombatTaskIntegration: {
    getAvailableCombatZones: jest.fn().mockReturnValue([
      { zoneId: 'test-zone', name: 'Test Zone', requiredLevel: 1, enemies: [] }
    ]),
    getAvailableEnemies: jest.fn().mockReturnValue([
      { enemyId: 'test-enemy', name: 'Test Enemy', level: 1 }
    ]),
    getRecommendedEnemy: jest.fn().mockReturnValue({ enemyId: 'test-enemy', name: 'Test Enemy', level: 1 }),
    getCombatZoneById: jest.fn().mockReturnValue({ 
      zoneId: 'test-zone', 
      name: 'Test Zone', 
      description: 'Test zone description',
      requiredLevel: 1, 
      enemies: [] 
    }),
    getEnemyById: jest.fn().mockReturnValue({ 
      enemyId: 'test-enemy', 
      name: 'Test Enemy', 
      description: 'Test enemy description',
      level: 1,
      type: 'automaton',
      stats: { health: 100, attack: 10, defense: 5 }
    }),
    checkCombatRequirements: jest.fn().mockReturnValue({
      meetsRequirements: true,
      errors: [],
      warnings: []
    }),
    getCombatDifficultyDescription: jest.fn().mockReturnValue('Moderate - A fair challenge'),
    calculateCombatDuration: jest.fn().mockReturnValue(30000)
  }
}));

jest.mock('../../../services/serverTaskQueueService.enhanced', () => ({
  serverTaskQueueService: {
    queueCombatTask: jest.fn().mockResolvedValue({ id: 'test-task-id' }),
    startCombatTask: jest.fn().mockResolvedValue({ id: 'test-task-id' })
  }
}));

jest.mock('../../../services/combatService', () => ({
  CombatService: {
    calculatePlayerCombatStats: jest.fn().mockReturnValue({
      health: 100,
      maxHealth: 100,
      attack: 20,
      defense: 10,
      speed: 8,
      abilities: []
    })
  }
}));

describe('CombatTaskManager', () => {
  const defaultProps = {
    playerId: 'player1',
    playerLevel: 5,
    playerStats: {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
      harvestingSkills: { level: 1 },
      craftingSkills: { level: 1 },
      combatSkills: { level: 1 }
    },
    playerEquipment: [
      {
        equipmentId: 'test-weapon',
        name: 'Test Weapon',
        type: 'weapon',
        stats: { attack: 5 },
        requirements: [],
        durability: 100,
        maxDurability: 100
      },
      {
        equipmentId: 'test-armor',
        name: 'Test Armor',
        type: 'armor',
        stats: { defense: 5 },
        requirements: [],
        durability: 100,
        maxDurability: 100
      }
    ],
    onTaskQueued: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders combat task manager with zones and enemies', () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Check for main sections
    expect(screen.getByText('Combat Tasks')).toBeInTheDocument();
    expect(screen.getByText('Select Combat Zone')).toBeInTheDocument();
    expect(screen.getByText('Select Enemy')).toBeInTheDocument();
    expect(screen.getByText('Combat Strategy')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    
    // Check for zone and enemy dropdowns
    expect(screen.getByText(/Test Zone/)).toBeInTheDocument();
    expect(screen.getByText(/Test Enemy/)).toBeInTheDocument();
    
    // Check for action buttons
    expect(screen.getByText('Add to Queue')).toBeInTheDocument();
    expect(screen.getByText('Start Now')).toBeInTheDocument();
  });
  
  it('displays enemy details when enemy is selected', () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Enemy details should be shown
    expect(screen.getByText('Test enemy description')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('automaton')).toBeInTheDocument();
    expect(screen.getByText('Level:')).toBeInTheDocument();
    expect(screen.getByText('Health:')).toBeInTheDocument();
    expect(screen.getByText('Attack:')).toBeInTheDocument();
    expect(screen.getByText('Defense:')).toBeInTheDocument();
  });
  
  it('displays combat estimate', () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Combat estimate should be shown
    expect(screen.getByText('Combat Estimate')).toBeInTheDocument();
    expect(screen.getByText('Difficulty:')).toBeInTheDocument();
    expect(screen.getByText(/Moderate - A fair challenge/)).toBeInTheDocument();
    expect(screen.getByText('Estimated Duration:')).toBeInTheDocument();
  });
  
  it('shows equipment items and allows selection', () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Equipment items should be shown
    expect(screen.getByText('Test Weapon')).toBeInTheDocument();
    expect(screen.getByText('Test Armor')).toBeInTheDocument();
    
    // Click on equipment to toggle selection
    const weaponItem = screen.getByText('Test Weapon').closest('.equipment-item');
    if (weaponItem) {
      fireEvent.click(weaponItem);
      // Should be deselected (since it's selected by default)
      expect(weaponItem).not.toHaveClass('selected');
      
      // Click again to select
      fireEvent.click(weaponItem);
      expect(weaponItem).toHaveClass('selected');
    }
  });
  
  it('shows broken equipment as disabled', () => {
    const propsWithBrokenEquipment = {
      ...defaultProps,
      playerEquipment: [
        {
          ...defaultProps.playerEquipment[0],
          durability: 0
        },
        defaultProps.playerEquipment[1]
      ]
    };
    
    render(<CombatTaskManager {...propsWithBrokenEquipment} />);
    
    // Broken equipment should be marked
    const brokenItem = screen.getByText('Test Weapon').closest('.equipment-item');
    expect(brokenItem).toHaveClass('broken');
    expect(screen.getByText('Broken')).toBeInTheDocument();
  });
  
  it('allows changing combat strategy', () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Default strategy should be shown
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    
    // Change strategy
    const strategySelect = screen.getByText('Balanced').closest('select');
    if (strategySelect) {
      fireEvent.change(strategySelect, { target: { value: 'aggressive' } });
      expect(screen.getByText('Focus on dealing damage')).toBeInTheDocument();
    }
  });
  
  it('queues combat task when Add to Queue is clicked', async () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Click Add to Queue button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);
    
    // Should call serverTaskQueueService.queueCombatTask
    await waitFor(() => {
      expect(serverTaskQueueService.queueCombatTask).toHaveBeenCalled();
    });
    
    // Should call onTaskQueued callback
    await waitFor(() => {
      expect(defaultProps.onTaskQueued).toHaveBeenCalledWith('test-task-id');
    });
  });
  
  it('starts combat task when Start Now is clicked', async () => {
    render(<CombatTaskManager {...defaultProps} />);
    
    // Click Start Now button
    const startButton = screen.getByText('Start Now');
    fireEvent.click(startButton);
    
    // Should call serverTaskQueueService.startCombatTask
    await waitFor(() => {
      expect(serverTaskQueueService.startCombatTask).toHaveBeenCalled();
    });
    
    // Should call onTaskQueued callback
    await waitFor(() => {
      expect(defaultProps.onTaskQueued).toHaveBeenCalledWith('test-task-id');
    });
  });
  
  it('disables buttons when there are validation errors', () => {
    // Mock validation errors
    (CombatTaskIntegration.checkCombatRequirements as jest.Mock).mockReturnValueOnce({
      meetsRequirements: false,
      errors: ['Health too low for combat'],
      warnings: []
    });
    
    render(<CombatTaskManager {...defaultProps} />);
    
    // Error should be displayed
    expect(screen.getByText('Cannot start combat:')).toBeInTheDocument();
    expect(screen.getByText('Health too low for combat')).toBeInTheDocument();
    
    // Buttons should be disabled
    expect(screen.getByText('Add to Queue')).toBeDisabled();
    expect(screen.getByText('Start Now')).toBeDisabled();
  });
  
  it('shows warnings but allows combat', () => {
    // Mock validation warnings
    (CombatTaskIntegration.checkCombatRequirements as jest.Mock).mockReturnValueOnce({
      meetsRequirements: true,
      errors: [],
      warnings: ['Low chance of victory (40%)']
    });
    
    render(<CombatTaskManager {...defaultProps} />);
    
    // Warning should be displayed
    expect(screen.getByText('Warnings:')).toBeInTheDocument();
    expect(screen.getByText('Low chance of victory (40%)')).toBeInTheDocument();
    
    // Buttons should be enabled
    expect(screen.getByText('Add to Queue')).not.toBeDisabled();
    expect(screen.getByText('Start Now')).not.toBeDisabled();
  });
  
  it('handles error when queueing task fails', async () => {
    // Mock error
    (serverTaskQueueService.queueCombatTask as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );
    
    render(<CombatTaskManager {...defaultProps} />);
    
    // Click Add to Queue button
    const queueButton = screen.getByText('Add to Queue');
    fireEvent.click(queueButton);
    
    // Error message should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to queue combat task: Network error/)).toBeInTheDocument();
    });
  });
});