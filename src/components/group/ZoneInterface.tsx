/**
 * Zone interface component for active zone instances
 */

import React, { useState, useEffect } from 'react';
import { ZoneInstance, Party, ZoneMonster, ZoneReward } from '../../types/zone';
import { Character } from '../../types/character';
import { ZoneService } from '../../services/zoneService';
import './ZoneInterface.css';

interface ZoneInterfaceProps {
  zoneInstance: ZoneInstance;
  party: Party;
  character: Character;
  onComplete: () => void;
  onLeave: () => void;
}

export const ZoneInterface: React.FC<ZoneInterfaceProps> = ({
  zoneInstance: initialInstance,
  party,
  character,
  onComplete,
  onLeave
}) => {
  const [zoneInstance, setZoneInstance] = useState(initialInstance);
  const [selectedMonster, setSelectedMonster] = useState<ZoneMonster | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-select first alive monster
    const aliveMonster = zoneInstance.monsters.find(m => m.health > 0);
    if (aliveMonster && !selectedMonster) {
      setSelectedMonster(aliveMonster);
    }
  }, [zoneInstance.monsters, selectedMonster]);

  const handleAttackMonster = async () => {
    if (!selectedMonster || selectedMonster.health <= 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await ZoneService.attackMonster(
        zoneInstance.instanceId,
        selectedMonster.monsterId,
        character.userId
      );
      
      setZoneInstance(result.instance);
      
      // Add to combat log
      const logEntry = `${character.name} attacks ${selectedMonster.name} for ${result.damage} damage!`;
      setCombatLog(prev => [...prev.slice(-9), logEntry]);
      
      // Check if monster died
      const updatedMonster = result.instance.monsters.find(m => m.monsterId === selectedMonster.monsterId);
      if (updatedMonster && updatedMonster.health <= 0) {
        const deathEntry = `${selectedMonster.name} has been defeated!`;
        setCombatLog(prev => [...prev.slice(-9), deathEntry]);
        
        // Auto-select next alive monster
        const nextMonster = result.instance.monsters.find(m => m.health > 0);
        setSelectedMonster(nextMonster || null);
        
        // Show loot if any
        if (result.rewards && result.rewards.length > 0) {
          const lootEntry = `Loot obtained: ${result.rewards.map(r => `${r.amount} ${r.type}`).join(', ')}`;
          setCombatLog(prev => [...prev.slice(-9), lootEntry]);
        }
      }
      
      // Check if zone is complete
      const allMonstersDefeated = result.instance.monsters.every(m => m.health <= 0);
      if (allMonstersDefeated) {
        handleCompleteZone();
      }
      
    } catch (err) {
      console.error('Error attacking monster:', err);
      setError(err instanceof Error ? err.message : 'Failed to attack monster');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteZone = async () => {
    try {
      setLoading(true);
      const rewards = await ZoneService.completeZoneInstance(zoneInstance.instanceId);
      
      // Show completion rewards
      const rewardEntry = `Zone completed! Rewards: ${rewards.map(r => `${r.amount} ${r.type}`).join(', ')}`;
      setCombatLog(prev => [...prev.slice(-9), rewardEntry]);
      
      setTimeout(() => {
        onComplete();
      }, 3000); // Show rewards for 3 seconds
      
    } catch (err) {
      console.error('Error completing zone:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete zone');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveZone = async () => {
    if (!confirm('Are you sure you want to leave the zone? Progress will be lost.')) {
      return;
    }
    
    try {
      await ZoneService.leaveZoneInstance(zoneInstance.instanceId, character.userId);
      onLeave();
    } catch (err) {
      console.error('Error leaving zone:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave zone');
    }
  };

  const getMonsterHealthPercentage = (monster: ZoneMonster) => {
    return (monster.health / monster.maxHealth) * 100;
  };

  const getHealthBarColor = (percentage: number) => {
    if (percentage > 60) return '#32cd32';
    if (percentage > 30) return '#ffa500';
    return '#dc143c';
  };

  const formatZoneType = (zoneType: string) => {
    return zoneType.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const aliveMonsters = zoneInstance.monsters.filter(m => m.health > 0);
  const deadMonsters = zoneInstance.monsters.filter(m => m.health <= 0);
  const allMonstersDefeated = aliveMonsters.length === 0;

  return (
    <div className="zone-interface">
      <div className="zone-header">
        <div className="zone-info">
          <h3>{formatZoneType(zoneInstance.zoneType)}</h3>
          <div className="zone-meta">
            <span className="difficulty">Difficulty: {zoneInstance.difficulty}</span>
            <span className="party-name">Party: {party.name}</span>
          </div>
        </div>
        
        <div className="zone-actions">
          <button className="leave-zone-btn" onClick={handleLeaveZone}>
            Leave Zone
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="zone-content">
        <div className="monsters-section">
          <h4>Monsters</h4>
          
          {aliveMonsters.length > 0 && (
            <div className="alive-monsters">
              <h5>Active Threats</h5>
              <div className="monsters-grid">
                {aliveMonsters.map(monster => (
                  <div
                    key={monster.monsterId}
                    className={`monster-card ${selectedMonster?.monsterId === monster.monsterId ? 'selected' : ''}`}
                    onClick={() => setSelectedMonster(monster)}
                  >
                    <div className="monster-header">
                      <h6>{monster.name}</h6>
                      <span className="monster-level">Lv.{monster.level}</span>
                    </div>
                    
                    <div className="monster-health">
                      <div className="health-bar">
                        <div
                          className="health-fill"
                          style={{
                            width: `${getMonsterHealthPercentage(monster)}%`,
                            backgroundColor: getHealthBarColor(getMonsterHealthPercentage(monster))
                          }}
                        />
                      </div>
                      <span className="health-text">
                        {monster.health}/{monster.maxHealth}
                      </span>
                    </div>
                    
                    <div className="monster-stats">
                      <span>⚔️ {monster.stats.attack}</span>
                      <span>🛡️ {monster.stats.defense}</span>
                      <span>⚡ {monster.stats.speed}</span>
                    </div>
                    
                    <div className="monster-description">
                      {monster.steampunkTheme.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deadMonsters.length > 0 && (
            <div className="defeated-monsters">
              <h5>Defeated ({deadMonsters.length})</h5>
              <div className="defeated-list">
                {deadMonsters.map(monster => (
                  <div key={monster.monsterId} className="defeated-monster">
                    <span className="monster-name">💀 {monster.name}</span>
                    <span className="monster-level">Lv.{monster.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allMonstersDefeated && (
            <div className="zone-complete">
              <h5>🎉 Zone Complete!</h5>
              <p>All monsters have been defeated. Collecting rewards...</p>
            </div>
          )}
        </div>

        <div className="combat-section">
          <div className="combat-controls">
            <h4>Combat</h4>
            
            {selectedMonster && selectedMonster.health > 0 ? (
              <div className="selected-target">
                <h5>Target: {selectedMonster.name}</h5>
                <button
                  className="attack-btn"
                  onClick={handleAttackMonster}
                  disabled={loading || allMonstersDefeated}
                >
                  {loading ? 'Attacking...' : 'Attack'}
                </button>
              </div>
            ) : (
              <div className="no-target">
                <p>Select a monster to attack</p>
              </div>
            )}
          </div>

          <div className="combat-log">
            <h5>Combat Log</h5>
            <div className="log-entries">
              {combatLog.length === 0 ? (
                <div className="no-log">Combat log will appear here...</div>
              ) : (
                combatLog.map((entry, index) => (
                  <div key={index} className="log-entry">
                    {entry}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="party-status">
          <h4>Party Status</h4>
          <div className="party-members">
            {party.members.map(member => (
              <div key={member.userId} className="party-member">
                <span className="member-name">
                  {member.characterName}
                  {member.userId === character.userId && ' (You)'}
                </span>
                <span className="member-role">{member.role}</span>
                <span className="member-level">Lv.{member.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneInterface;