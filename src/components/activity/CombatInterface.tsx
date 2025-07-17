/**
 * Combat Interface Component - Simple interface for combat activities
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Enemy, CombatZone, PlayerCombatStats, CombatSkillType } from '../../types/combat';
import { CombatService } from '../../services/combatService';
import { COMBAT_ZONES } from '../../data/combatData';

const CombatInterface: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [availableZones, setAvailableZones] = useState<CombatZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<CombatZone | null>(null);
  const [availableEnemies, setAvailableEnemies] = useState<Enemy[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerCombatStats | null>(null);

  useEffect(() => {
    if (character) {
      const zones = CombatService.getAvailableCombatZones(character);
      setAvailableZones(zones);
      
      const enemies = CombatService.getAvailableEnemies(character);
      setAvailableEnemies(enemies);
      
      const stats = CombatService.calculatePlayerCombatStats(character);
      setPlayerStats(stats);
      
      if (zones.length > 0 && !selectedZone) {
        setSelectedZone(zones[0]);
      }
    }
  }, [character, selectedZone]);

  const getSkillLevel = (skillType: CombatSkillType): number => {
    if (!character) return 0;
    // For now, map combat skills to general skill levels
    // This is a temporary solution until we have proper combat skill tracking
    switch (skillType) {
      case 'melee':
        return character.stats.combatSkills.level || 1;
      case 'ranged':
        return character.stats.combatSkills.level || 1;
      case 'defense':
        return character.stats.combatSkills.level || 1;
      case 'tactics':
        return character.stats.combatSkills.level || 1;
      default:
        return 1;
    }
  };

  const handleCombat = (enemy: Enemy) => {
    if (!playerStats) return;
    
    const result = CombatService.simulateCombat(playerStats, enemy);
    const resultText = result.result === 'victory' ? 'Victory!' : 'Defeat!';
    const lootText = result.lootGained.length > 0 
      ? `\nLoot: ${result.lootGained.map(l => `${l.name} x${l.quantity}`).join(', ')}`
      : '';
    
    alert(`${resultText}\nDuration: ${CombatService.formatCombatDuration(result.combatDuration)}\nExperience: +${result.experienceGained}${lootText}`);
  };

  if (!character || !playerStats) {
    return (
      <div className="combat-interface">
        <div className="combat-interface__loading">
          Loading character data...
        </div>
      </div>
    );
  }

  return (
    <div className="combat-interface">
      <div className="combat-interface__header">
        <h2>Steam-Powered Combat</h2>
        <p>Battle rogue machines and mechanical beasts</p>
      </div>

      <div className="combat-interface__player-stats">
        <h3>Your Combat Stats</h3>
        <div className="player-stats-grid">
          <div className="player-stat">
            <span className="player-stat__label">Health:</span>
            <span className="player-stat__value">{playerStats.health}</span>
          </div>
          <div className="player-stat">
            <span className="player-stat__label">Attack:</span>
            <span className="player-stat__value">{playerStats.attack}</span>
          </div>
          <div className="player-stat">
            <span className="player-stat__label">Defense:</span>
            <span className="player-stat__value">{playerStats.defense}</span>
          </div>
          <div className="player-stat">
            <span className="player-stat__label">Speed:</span>
            <span className="player-stat__value">{Math.floor(playerStats.speed)}</span>
          </div>
        </div>
      </div>

      <div className="combat-interface__skills">
        <h3>Combat Skills</h3>
        <div className="combat-skills-grid">
          {(['melee', 'ranged', 'defense', 'tactics'] as const).map(skillType => {
            const skillInfo = CombatService.getSkillDisplay(skillType);
            const skillLevel = getSkillLevel(skillType);
            const skillExp = character.stats.combatSkills.experience || 0;

            return (
              <div key={skillType} className="combat-skill">
                <div className="combat-skill__header">
                  <span className="combat-skill__icon">{skillInfo.icon}</span>
                  <div className="combat-skill__info">
                    <h4>{skillInfo.name}</h4>
                    <span>Level {skillLevel}</span>
                  </div>
                </div>
                <p className="combat-skill__description">{skillInfo.description}</p>
                <div className="combat-skill__experience">
                  Experience: {skillExp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="combat-interface__zones">
        <h3>Combat Zones</h3>
        <div className="combat-zones-list">
          {availableZones.map(zone => (
            <div 
              key={zone.zoneId} 
              className={`combat-zone ${selectedZone?.zoneId === zone.zoneId ? 'combat-zone--selected' : ''}`}
              onClick={() => setSelectedZone(zone)}
            >
              <h4>{zone.name}</h4>
              <p>{zone.description}</p>
              <div className="combat-zone__info">
                <span>Required Level: {zone.requiredLevel}</span>
                <span>Enemies: {zone.enemies.length}</span>
              </div>
              <div className="combat-zone__atmosphere">
                <p><strong>Environment:</strong> {zone.steampunkTheme.environment}</p>
                <p><strong>Hazards:</strong> {zone.steampunkTheme.hazards.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedZone && (
        <div className="combat-interface__enemies">
          <h3>Enemies in {selectedZone.name}</h3>
          <div className="combat-enemies-grid">
            {selectedZone.enemies.map(enemy => {
              const effectiveness = CombatService.calculateCombatEffectiveness(playerStats, enemy);
              const difficulty = CombatService.getCombatDifficulty(character.level, enemy);
              const difficultyColors = {
                trivial: '#90EE90',
                easy: '#32CD32',
                moderate: '#FFD700',
                hard: '#FF6347',
                extreme: '#DC143C'
              };

              return (
                <div key={enemy.enemyId} className="combat-enemy">
                  <div className="combat-enemy__header">
                    <h4>{enemy.name}</h4>
                    <div className="combat-enemy__level">
                      Level {enemy.level}
                    </div>
                    <div 
                      className="combat-enemy__difficulty"
                      style={{ color: difficultyColors[difficulty] }}
                    >
                      {difficulty.toUpperCase()}
                    </div>
                  </div>
                  
                  <p className="combat-enemy__description">{enemy.description}</p>
                  <p className="combat-enemy__backstory">{enemy.steampunkTheme.backstory}</p>
                  
                  <div className="combat-enemy__stats">
                    <div className="enemy-stat">
                      <span>Health:</span>
                      <span>{enemy.stats.health}</span>
                    </div>
                    <div className="enemy-stat">
                      <span>Attack:</span>
                      <span>{enemy.stats.attack}</span>
                    </div>
                    <div className="enemy-stat">
                      <span>Defense:</span>
                      <span>{enemy.stats.defense}</span>
                    </div>
                    <div className="enemy-stat">
                      <span>Speed:</span>
                      <span>{enemy.stats.speed}</span>
                    </div>
                  </div>

                  <div className="combat-enemy__effectiveness">
                    <div className="effectiveness-stat">
                      <span>Win Chance:</span>
                      <span style={{ color: effectiveness.winChance > 0.7 ? '#32CD32' : effectiveness.winChance > 0.4 ? '#FFD700' : '#FF6347' }}>
                        {Math.floor(effectiveness.winChance * 100)}%
                      </span>
                    </div>
                    <div className="effectiveness-stat">
                      <span>Est. Duration:</span>
                      <span>{CombatService.formatCombatDuration(effectiveness.estimatedDuration)}</span>
                    </div>
                  </div>

                  <div className="combat-enemy__loot">
                    <h5>Potential Loot:</h5>
                    <ul>
                      {enemy.lootTable.map((loot, index) => (
                        <li key={index}>
                          <span>{loot.name}</span>
                          <span>x{loot.quantity}</span>
                          <span>({Math.floor(loot.dropChance * 100)}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="combat-enemy__actions">
                    <button 
                      className="combat-enemy__fight-button"
                      onClick={() => handleCombat(enemy)}
                      style={{ 
                        backgroundColor: effectiveness.winChance > 0.5 ? '#32CD32' : '#FF6347',
                        opacity: effectiveness.winChance < 0.1 ? 0.5 : 1
                      }}
                    >
                      Fight {enemy.name}
                    </button>
                    <div className="combat-enemy__reward">
                      Experience: +{enemy.experienceReward}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CombatInterface;