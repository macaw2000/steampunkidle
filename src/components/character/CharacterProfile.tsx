/**
 * Character profile display component
 */

import React from 'react';
import { Character, CraftingSkillSet, HarvestingSkillSet, CombatSkillSet } from '../../types/character';
import './CharacterProfile.css';

interface CharacterProfileProps {
  character: Character;
  showDetailedStats?: boolean;
}

export const CharacterProfile: React.FC<CharacterProfileProps> = ({ 
  character, 
  showDetailedStats = true 
}) => {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  const calculateTotalPower = () => {
    const baseStats = character.stats.strength + character.stats.dexterity + 
                     character.stats.intelligence + character.stats.vitality;
    const skillLevels = character.stats.craftingSkills.level + 
                       character.stats.harvestingSkills.level + 
                       character.stats.combatSkills.level;
    return baseStats * 10 + skillLevels * 5;
  };

  const getSpecializationProgress = () => {
    const { tankProgress, healerProgress, dpsProgress } = character.specialization;
    const total = tankProgress + healerProgress + dpsProgress;
    
    if (total === 0) return null;
    
    return {
      tank: Math.round((tankProgress / total) * 100),
      healer: Math.round((healerProgress / total) * 100),
      dps: Math.round((dpsProgress / total) * 100),
      total,
      tankProgress,
      healerProgress,
      dpsProgress,
    };
  };

  const getSpecializationRoleNames = () => ({
    tank: 'Steam Guardian',
    healer: 'Gear Medic',
    dps: 'Clockwork Striker',
  });

  const getPrimaryRoleDisplay = () => {
    if (!character.specialization.primaryRole) return null;
    const roleNames = getSpecializationRoleNames();
    return roleNames[character.specialization.primaryRole];
  };

  const renderCraftingSkills = (skillSet: CraftingSkillSet) => (
    <div className="skill-set">
      <h4 className="skill-set-title">Crafting Skills</h4>
      <div className="skill-set-level">Level {skillSet.level}</div>
      <div className="skill-set-experience">
        {skillSet.experience} XP
      </div>
      <div className="individual-skills">
        <div className="skill-item">
          <span>Clockmaking</span>
          <span>{skillSet.clockmaking}</span>
        </div>
        <div className="skill-item">
          <span>Engineering</span>
          <span>{skillSet.engineering}</span>
        </div>
        <div className="skill-item">
          <span>Alchemy</span>
          <span>{skillSet.alchemy}</span>
        </div>
        <div className="skill-item">
          <span>Steamcraft</span>
          <span>{skillSet.steamcraft}</span>
        </div>
      </div>
    </div>
  );

  const renderHarvestingSkills = (skillSet: HarvestingSkillSet) => (
    <div className="skill-set">
      <h4 className="skill-set-title">Harvesting Skills</h4>
      <div className="skill-set-level">Level {skillSet.level}</div>
      <div className="skill-set-experience">
        {skillSet.experience} XP
      </div>
      <div className="individual-skills">
        <div className="skill-item">
          <span>Mining</span>
          <span>{skillSet.mining}</span>
        </div>
        <div className="skill-item">
          <span>Foraging</span>
          <span>{skillSet.foraging}</span>
        </div>
        <div className="skill-item">
          <span>Salvaging</span>
          <span>{skillSet.salvaging}</span>
        </div>
        <div className="skill-item">
          <span>Crystal Extraction</span>
          <span>{skillSet.crystal_extraction}</span>
        </div>
      </div>
    </div>
  );

  const renderCombatSkills = (skillSet: CombatSkillSet) => (
    <div className="skill-set">
      <h4 className="skill-set-title">Combat Skills</h4>
      <div className="skill-set-level">Level {skillSet.level}</div>
      <div className="skill-set-experience">
        {skillSet.experience} XP
      </div>
      <div className="individual-skills">
        <div className="skill-item">
          <span>Melee</span>
          <span>{skillSet.melee}</span>
        </div>
        <div className="skill-item">
          <span>Ranged</span>
          <span>{skillSet.ranged}</span>
        </div>
        <div className="skill-item">
          <span>Defense</span>
          <span>{skillSet.defense}</span>
        </div>
        <div className="skill-item">
          <span>Tactics</span>
          <span>{skillSet.tactics}</span>
        </div>
      </div>
    </div>
  );

  const specializationProgress = getSpecializationProgress();

  return (
    <div className="character-profile">
      <div className="character-header">
        <div className="character-avatar">
          {/* Placeholder for character avatar */}
          <div className="avatar-placeholder">
            {character.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="character-basic-info">
          <h2 className="character-name">{character.name}</h2>
          <div className="character-level">Level {character.level}</div>
          <div className="character-power">Power: {calculateTotalPower()}</div>
          <div className="character-currency">{character.currency} Gears</div>
        </div>
      </div>

      <div className="character-experience">
        <div className="experience-bar">
          <div className="experience-label">
            Experience: {character.experience} XP
          </div>
          <div className="experience-progress">
            <div 
              className="experience-fill"
              style={{ 
                width: `${Math.min(100, (character.experience % 1000) / 10)}%` 
              }}
            />
          </div>
        </div>
      </div>

      {character.currentActivity && (
        <div className="current-activity">
          <h3>Current Activity</h3>
          <div className="activity-info">
            <span className="activity-type">
              {character.currentActivity.type.charAt(0).toUpperCase() + 
               character.currentActivity.type.slice(1)}
            </span>
            <span className="activity-progress">
              Progress: {Math.round(character.currentActivity.progress)}%
            </span>
          </div>
          <div className="activity-started">
            Started: {formatTime(character.currentActivity.startedAt)}
          </div>
        </div>
      )}

      {showDetailedStats && (
        <>
          <div className="character-stats">
            <h3>Base Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-name">Strength</span>
                <span className="stat-value">{character.stats.strength}</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Dexterity</span>
                <span className="stat-value">{character.stats.dexterity}</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Intelligence</span>
                <span className="stat-value">{character.stats.intelligence}</span>
              </div>
              <div className="stat-item">
                <span className="stat-name">Vitality</span>
                <span className="stat-value">{character.stats.vitality}</span>
              </div>
            </div>
          </div>

          {specializationProgress && (
            <div className="specialization-section">
              <h3>Specialization Progress</h3>
              <div className="specialization-summary">
                <div className="total-progress">
                  Total Progress: {specializationProgress.total} points
                </div>
                {getPrimaryRoleDisplay() && (
                  <div className="primary-role">
                    Primary Role: {getPrimaryRoleDisplay()}
                  </div>
                )}
              </div>
              <div className="specialization-bars">
                <div className="specialization-bar">
                  <div className="specialization-label">
                    <span className="role-name">Steam Guardian</span>
                    <span className="role-progress">
                      {specializationProgress.tankProgress} pts ({specializationProgress.tank}%)
                    </span>
                  </div>
                  <div className="specialization-progress">
                    <div 
                      className="specialization-fill tank"
                      style={{ width: `${specializationProgress.tank}%` }}
                    />
                  </div>
                </div>
                <div className="specialization-bar">
                  <div className="specialization-label">
                    <span className="role-name">Gear Medic</span>
                    <span className="role-progress">
                      {specializationProgress.healerProgress} pts ({specializationProgress.healer}%)
                    </span>
                  </div>
                  <div className="specialization-progress">
                    <div 
                      className="specialization-fill healer"
                      style={{ width: `${specializationProgress.healer}%` }}
                    />
                  </div>
                </div>
                <div className="specialization-bar">
                  <div className="specialization-label">
                    <span className="role-name">Clockwork Striker</span>
                    <span className="role-progress">
                      {specializationProgress.dpsProgress} pts ({specializationProgress.dps}%)
                    </span>
                  </div>
                  <div className="specialization-progress">
                    <div 
                      className="specialization-fill dps"
                      style={{ width: `${specializationProgress.dps}%` }}
                    />
                  </div>
                </div>
              </div>
              {character.specialization.bonuses.length > 0 && (
                <div className="specialization-bonuses">
                  <h4>Specialization Bonuses</h4>
                  <div className="bonuses-list">
                    {character.specialization.bonuses.map((bonus, index) => (
                      <div key={index} className="bonus-item">
                        <div className="bonus-name">{bonus.name}</div>
                        <div className="bonus-description">{bonus.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="character-skills">
            <h3>Skills</h3>
            <div className="skills-container">
              {renderCraftingSkills(character.stats.craftingSkills)}
              {renderHarvestingSkills(character.stats.harvestingSkills)}
              {renderCombatSkills(character.stats.combatSkills)}
            </div>
          </div>
        </>
      )}

      <div className="character-meta">
        <div className="meta-item">
          <span>Created:</span>
          <span>{formatDate(character.createdAt)}</span>
        </div>
        <div className="meta-item">
          <span>Last Active:</span>
          <span>{formatTime(character.lastActiveAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default CharacterProfile;