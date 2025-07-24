/**
 * Combat Task Manager Component
 * Allows players to select enemies and queue combat tasks
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Enemy, CombatZone, PlayerCombatStats } from '../../types/combat';
import { Equipment, CombatStrategy } from '../../types/taskQueue';
import { Character, CharacterStats, Specialization, Activity, SpecializationRole, ActivityType } from '../../types/character';
import { CombatTaskIntegration } from '../../services/combatTaskIntegration';
import { serverTaskQueueService } from '../../services/serverTaskQueueService.enhanced';
import { CombatService } from '../../services/combatService';
import { ENEMIES, COMBAT_ZONES } from '../../data/combatData';
import './CombatTaskManager.css';

interface CombatTaskManagerProps {
  playerId: string;
  playerLevel: number;
  playerStats: any;
  playerEquipment: Equipment[];
  onTaskQueued?: (taskId: string) => void;
}

const CombatTaskManager: React.FC<CombatTaskManagerProps> = ({
  playerId,
  playerLevel,
  playerStats,
  playerEquipment,
  onTaskQueued
}) => {
  // State
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>('');
  const [availableZones, setAvailableZones] = useState<CombatZone[]>([]);
  const [availableEnemies, setAvailableEnemies] = useState<Enemy[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<CombatStrategy>({
    strategyId: 'balanced',
    name: 'Balanced',
    description: 'Balanced attack and defense',
    modifiers: []
  });
  const [combatEstimate, setCombatEstimate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Combat stats
  const [playerCombatStats, setPlayerCombatStats] = useState<PlayerCombatStats>({
    health: 100,
    maxHealth: 100,
    attack: 10,
    defense: 5,
    speed: 5,
    abilities: []
  });
  
  // Available strategies
  const combatStrategies: CombatStrategy[] = [
    {
      strategyId: 'balanced',
      name: 'Balanced',
      description: 'Balanced attack and defense',
      modifiers: []
    },
    {
      strategyId: 'aggressive',
      name: 'Aggressive',
      description: 'Focus on dealing damage',
      modifiers: [
        { type: 'damage', value: 0.2, description: 'Increased damage' },
        { type: 'defense', value: -0.1, description: 'Reduced defense' }
      ]
    },
    {
      strategyId: 'defensive',
      name: 'Defensive',
      description: 'Focus on survival',
      modifiers: [
        { type: 'defense', value: 0.2, description: 'Increased defense' },
        { type: 'damage', value: -0.1, description: 'Reduced damage' }
      ]
    },
    {
      strategyId: 'tactical',
      name: 'Tactical',
      description: 'Focus on precision and critical hits',
      modifiers: [
        { type: 'accuracy', value: 0.2, description: 'Increased accuracy' },
        { type: 'speed', value: 0.1, description: 'Increased speed' }
      ]
    }
  ];
  
  // Load available zones and enemies on component mount
  useEffect(() => {
    // Calculate player combat stats
    const character: Character = {
      userId: 'current-user', // This would come from auth context
      characterId: 'current-character',
      name: 'Player',
      level: playerLevel,
      experience: 0,
      currency: 0,
      stats: playerStats,
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
        primaryRole: 'dps',
        secondaryRole: null,
        bonuses: []
      },
      currentActivity: {
        type: 'combat',
        startedAt: new Date(),
        progress: 0,
        rewards: []
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const combatStats = CombatService.calculatePlayerCombatStats(character);
    setPlayerCombatStats(combatStats);
    
    // Get available zones and enemies
    const zones = CombatTaskIntegration.getAvailableCombatZones(playerLevel);
    setAvailableZones(zones);
    
    const enemies = CombatTaskIntegration.getAvailableEnemies(playerLevel);
    setAvailableEnemies(enemies);
    
    // Select first zone and enemy if available
    if (zones.length > 0) {
      setSelectedZoneId(zones[0].zoneId);
    }
    
    // Select recommended enemy
    const recommendedEnemy = CombatTaskIntegration.getRecommendedEnemy(playerLevel);
    if (recommendedEnemy) {
      setSelectedEnemyId(recommendedEnemy.enemyId);
    }
    
    // Set default equipment
    setSelectedEquipment(playerEquipment.filter(item => 
      item.type === 'weapon' || item.type === 'armor'
    ));
  }, [playerLevel, playerStats, playerEquipment]);
  
  // Update available enemies when zone changes
  useEffect(() => {
    if (selectedZoneId) {
      const zone = CombatTaskIntegration.getCombatZoneById(selectedZoneId);
      if (zone) {
        setAvailableEnemies(zone.enemies);
        
        // Select first enemy in zone if current selection is not in this zone
        const enemyInZone = zone.enemies.find(e => e.enemyId === selectedEnemyId);
        if (!enemyInZone && zone.enemies.length > 0) {
          setSelectedEnemyId(zone.enemies[0].enemyId);
        }
      }
    }
  }, [selectedZoneId, selectedEnemyId]);
  
  // Update combat estimate when selection changes
  useEffect(() => {
    if (selectedEnemyId) {
      const enemy = CombatTaskIntegration.getEnemyById(selectedEnemyId);
      if (enemy) {
        const estimate = CombatTaskIntegration.checkCombatRequirements(
          enemy,
          playerLevel,
          playerCombatStats,
          selectedEquipment
        );
        
        setCombatEstimate({
          ...estimate,
          difficulty: CombatTaskIntegration.getCombatDifficultyDescription(playerLevel, enemy),
          duration: CombatTaskIntegration.calculateCombatDuration(
            enemy,
            playerCombatStats,
            selectedEquipment,
            selectedStrategy
          ) / 1000 // Convert to seconds
        });
      }
    }
  }, [selectedEnemyId, playerLevel, playerCombatStats, selectedEquipment, selectedStrategy]);
  
  // Handle zone selection
  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedZoneId(e.target.value);
  };
  
  // Handle enemy selection
  const handleEnemyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEnemyId(e.target.value);
  };
  
  // Handle strategy selection
  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const strategyId = e.target.value;
    const strategy = combatStrategies.find(s => s.strategyId === strategyId);
    if (strategy) {
      setSelectedStrategy(strategy);
    }
  };
  
  // Handle equipment toggle
  const handleEquipmentToggle = (equipment: Equipment) => {
    const isSelected = selectedEquipment.some(e => e.equipmentId === equipment.equipmentId);
    
    if (isSelected) {
      setSelectedEquipment(selectedEquipment.filter(e => e.equipmentId !== equipment.equipmentId));
    } else {
      setSelectedEquipment([...selectedEquipment, equipment]);
    }
  };
  
  // Queue combat task
  const handleQueueCombat = async () => {
    if (!selectedEnemyId) {
      setError('Please select an enemy to fight');
      return;
    }
    
    const enemy = CombatTaskIntegration.getEnemyById(selectedEnemyId);
    if (!enemy) {
      setError('Selected enemy not found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const task = await serverTaskQueueService.queueCombatTask(
        playerId,
        enemy,
        playerStats,
        playerLevel,
        playerCombatStats,
        {
          equipment: selectedEquipment,
          strategy: selectedStrategy
        }
      );
      
      if (onTaskQueued) {
        onTaskQueued(task.id);
      }
      
      // Reset selection
      setSelectedEnemyId('');
    } catch (err: any) {
      setError(`Failed to queue combat task: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start combat task immediately
  const handleStartCombat = async () => {
    if (!selectedEnemyId) {
      setError('Please select an enemy to fight');
      return;
    }
    
    const enemy = CombatTaskIntegration.getEnemyById(selectedEnemyId);
    if (!enemy) {
      setError('Selected enemy not found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const task = await serverTaskQueueService.startCombatTask(
        playerId,
        enemy,
        playerStats,
        playerLevel,
        playerCombatStats,
        {
          equipment: selectedEquipment,
          strategy: selectedStrategy
        }
      );
      
      if (onTaskQueued) {
        onTaskQueued(task.id);
      }
      
      // Reset selection
      setSelectedEnemyId('');
    } catch (err: any) {
      setError(`Failed to start combat task: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
  };
  
  return (
    <div className="combat-task-manager">
      <h2>Combat Tasks</h2>
      
      {/* Zone Selection */}
      <div className="combat-section">
        <h3>Select Combat Zone</h3>
        <select 
          value={selectedZoneId} 
          onChange={handleZoneChange}
          disabled={isLoading || availableZones.length === 0}
        >
          {availableZones.length === 0 && (
            <option value="">No zones available for your level</option>
          )}
          {availableZones.map(zone => (
            <option key={zone.zoneId} value={zone.zoneId}>
              {zone.name} (Level {zone.requiredLevel}+)
            </option>
          ))}
        </select>
        
        {selectedZoneId && (
          <div className="zone-description">
            {CombatTaskIntegration.getCombatZoneById(selectedZoneId)?.description}
          </div>
        )}
      </div>
      
      {/* Enemy Selection */}
      <div className="combat-section">
        <h3>Select Enemy</h3>
        <select 
          value={selectedEnemyId} 
          onChange={handleEnemyChange}
          disabled={isLoading || availableEnemies.length === 0}
        >
          {availableEnemies.length === 0 && (
            <option value="">No enemies available</option>
          )}
          {availableEnemies.map(enemy => (
            <option key={enemy.enemyId} value={enemy.enemyId}>
              {enemy.name} (Level {enemy.level})
            </option>
          ))}
        </select>
        
        {selectedEnemyId && (
          <div className="enemy-details">
            <div className="enemy-description">
              {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.description}
            </div>
            <div className="enemy-stats">
              <div><strong>Type:</strong> {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.type}</div>
              <div><strong>Level:</strong> {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.level}</div>
              <div><strong>Health:</strong> {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.stats.health}</div>
              <div><strong>Attack:</strong> {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.stats.attack}</div>
              <div><strong>Defense:</strong> {CombatTaskIntegration.getEnemyById(selectedEnemyId)?.stats.defense}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Combat Strategy */}
      <div className="combat-section">
        <h3>Combat Strategy</h3>
        <select 
          value={selectedStrategy.strategyId} 
          onChange={handleStrategyChange}
          disabled={isLoading}
        >
          {combatStrategies.map(strategy => (
            <option key={strategy.strategyId} value={strategy.strategyId}>
              {strategy.name}
            </option>
          ))}
        </select>
        
        <div className="strategy-description">
          {selectedStrategy.description}
        </div>
        
        {selectedStrategy.modifiers.length > 0 && (
          <div className="strategy-modifiers">
            <strong>Modifiers:</strong>
            <ul>
              {selectedStrategy.modifiers.map((mod, index) => (
                <li key={index}>
                  {mod.description} ({mod.value > 0 ? '+' : ''}{mod.value * 100}%)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Equipment Selection */}
      <div className="combat-section">
        <h3>Equipment</h3>
        <div className="equipment-list">
          {playerEquipment.length === 0 ? (
            <div className="no-equipment">No equipment available</div>
          ) : (
            playerEquipment
              .filter(item => item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory')
              .map(item => {
                const isSelected = selectedEquipment.some(e => e.equipmentId === item.equipmentId);
                const isUsable = item.durability > 0;
                
                return (
                  <div 
                    key={item.equipmentId} 
                    className={`equipment-item ${isSelected ? 'selected' : ''} ${!isUsable ? 'broken' : ''}`}
                    onClick={() => isUsable && handleEquipmentToggle(item)}
                  >
                    <div className="equipment-name">{item.name}</div>
                    <div className="equipment-type">{item.type}</div>
                    <div className="equipment-durability">
                      Durability: {item.durability}/{item.maxDurability}
                    </div>
                    {!isUsable && <div className="broken-label">Broken</div>}
                  </div>
                );
              })
          )}
        </div>
      </div>
      
      {/* Combat Estimate */}
      {combatEstimate && (
        <div className="combat-section">
          <h3>Combat Estimate</h3>
          <div className="combat-estimate">
            <div className="estimate-difficulty">
              <strong>Difficulty:</strong> {combatEstimate.difficulty}
            </div>
            <div className="estimate-duration">
              <strong>Estimated Duration:</strong> {formatDuration(combatEstimate.duration)}
            </div>
            
            {combatEstimate.warnings.length > 0 && (
              <div className="estimate-warnings">
                <strong>Warnings:</strong>
                <ul>
                  {combatEstimate.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {combatEstimate.errors.length > 0 && (
              <div className="estimate-errors">
                <strong>Cannot start combat:</strong>
                <ul>
                  {combatEstimate.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="combat-actions">
        <button 
          className="queue-combat-btn"
          onClick={handleQueueCombat}
          disabled={isLoading || !selectedEnemyId || (combatEstimate && combatEstimate.errors.length > 0)}
        >
          {isLoading ? 'Adding to Queue...' : 'Add to Queue'}
        </button>
        
        <button 
          className="start-combat-btn"
          onClick={handleStartCombat}
          disabled={isLoading || !selectedEnemyId || (combatEstimate && combatEstimate.errors.length > 0)}
        >
          {isLoading ? 'Starting Combat...' : 'Start Now'}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="combat-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default CombatTaskManager;