import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import './CharacterPanel.css';

type TabType = 'attributes' | 'inventory' | 'skills' | 'specialization';

const CharacterPanel: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [activeTab, setActiveTab] = useState<TabType>('attributes');

  if (!character) {
    return (
      <div className="character-panel">
        <div className="loading-state">
          <p>Loading character data...</p>
        </div>
      </div>
    );
  }

  // Calculate next level experience requirement
  const nextLevelExp = Math.pow(character.level, 2) * 100;
  const currentLevelExp = Math.pow(character.level - 1, 2) * 100;
  const expProgress = ((character.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

  // Mock inventory data for development
  const mockInventory = [
    { id: '1', name: 'Clockwork Gear', quantity: 15, type: 'material', rarity: 'common' },
    { id: '2', name: 'Steam Crystal', quantity: 3, type: 'material', rarity: 'rare' },
    { id: '3', name: 'Copper Ore', quantity: 28, type: 'material', rarity: 'common' },
    { id: '4', name: 'Iron Ingot', quantity: 12, type: 'material', rarity: 'uncommon' },
    { id: '5', name: 'Brass Wrench', quantity: 1, type: 'tool', rarity: 'uncommon' },
    { id: '6', name: 'Steam Engine Blueprint', quantity: 1, type: 'recipe', rarity: 'rare' },
    { id: '7', name: 'Healing Potion', quantity: 5, type: 'consumable', rarity: 'common' },
    { id: '8', name: 'Pocket Watch', quantity: 1, type: 'equipment', rarity: 'epic' },
  ];

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: '#9ca3af',
      uncommon: '#10b981',
      rare: '#3b82f6',
      epic: '#8b5cf6',
      legendary: '#f59e0b'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getItemIcon = (type: string) => {
    const icons = {
      material: '🔩',
      tool: '🔧',
      recipe: '📜',
      consumable: '🧪',
      equipment: '⚙️'
    };
    return icons[type as keyof typeof icons] || '📦';
  };

  const renderAttributes = () => (
    <div className="attributes-tab">
      {/* Character Overview */}
      <div className="character-overview">
        <div className="character-avatar">
          <div className="avatar-placeholder">👤</div>
          <div className="character-name">{character.name}</div>
        </div>
        
        <div className="character-basic-info">
          <div className="info-item">
            <span className="label">Level:</span>
            <span className="value">{character.level}</span>
          </div>
          <div className="info-item">
            <span className="label">Currency:</span>
            <span className="value">{character.currency.toLocaleString()} Steam Coins</span>
          </div>
          <div className="info-item">
            <span className="label">Current Activity:</span>
            <span className="value">{character.currentActivity?.type || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Experience Bar */}
      <div className="experience-section">
        <div className="exp-header">
          <span>Experience: {character.experience.toLocaleString()}</span>
          <span>Next Level: {nextLevelExp.toLocaleString()}</span>
        </div>
        <div className="exp-bar">
          <div 
            className="exp-fill" 
            style={{ width: `${Math.min(expProgress, 100)}%` }}
          />
        </div>
        <div className="exp-percentage">{Math.floor(expProgress)}%</div>
      </div>

      {/* Primary Attributes */}
      <div className="attributes-grid">
        <div className="attribute-card">
          <div className="attribute-icon">💪</div>
          <div className="attribute-info">
            <div className="attribute-name">Strength</div>
            <div className="attribute-value">{character.stats.strength}</div>
          </div>
        </div>
        
        <div className="attribute-card">
          <div className="attribute-icon">🎯</div>
          <div className="attribute-info">
            <div className="attribute-name">Dexterity</div>
            <div className="attribute-value">{character.stats.dexterity}</div>
          </div>
        </div>
        
        <div className="attribute-card">
          <div className="attribute-icon">🧠</div>
          <div className="attribute-info">
            <div className="attribute-name">Intelligence</div>
            <div className="attribute-value">{character.stats.intelligence}</div>
          </div>
        </div>
        
        <div className="attribute-card">
          <div className="attribute-icon">❤️</div>
          <div className="attribute-info">
            <div className="attribute-name">Vitality</div>
            <div className="attribute-value">{character.stats.vitality}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="inventory-tab">
      <div className="inventory-header">
        <h4>Inventory ({mockInventory.length}/50)</h4>
        <div className="inventory-filters">
          <button className="filter-btn active">All</button>
          <button className="filter-btn">Materials</button>
          <button className="filter-btn">Tools</button>
          <button className="filter-btn">Equipment</button>
        </div>
      </div>
      
      <div className="inventory-grid">
        {mockInventory.map(item => (
          <div key={item.id} className="inventory-item">
            <div className="item-icon" style={{ color: getRarityColor(item.rarity) }}>
              {getItemIcon(item.type)}
            </div>
            <div className="item-info">
              <div className="item-name" style={{ color: getRarityColor(item.rarity) }}>
                {item.name}
              </div>
              <div className="item-quantity">x{item.quantity}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSkills = () => (
    <div className="skills-tab">
      <div className="skill-category">
        <h4>🔧 Crafting Skills (Level {character.stats.craftingSkills.level})</h4>
        <div className="skills-grid">
          <div className="skill-item">
            <span className="skill-name">Clockmaking</span>
            <span className="skill-value">{character.stats.craftingSkills.clockmaking}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Engineering</span>
            <span className="skill-value">{character.stats.craftingSkills.engineering}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Alchemy</span>
            <span className="skill-value">{character.stats.craftingSkills.alchemy}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Steamcraft</span>
            <span className="skill-value">{character.stats.craftingSkills.steamcraft}</span>
          </div>
        </div>
      </div>

      <div className="skill-category">
        <h4>⛏️ Harvesting Skills (Level {character.stats.harvestingSkills.level})</h4>
        <div className="skills-grid">
          <div className="skill-item">
            <span className="skill-name">Mining</span>
            <span className="skill-value">{character.stats.harvestingSkills.mining}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Foraging</span>
            <span className="skill-value">{character.stats.harvestingSkills.foraging}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Salvaging</span>
            <span className="skill-value">{character.stats.harvestingSkills.salvaging}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Crystal Extraction</span>
            <span className="skill-value">{character.stats.harvestingSkills.crystal_extraction}</span>
          </div>
        </div>
      </div>

      <div className="skill-category">
        <h4>⚔️ Combat Skills (Level {character.stats.combatSkills.level})</h4>
        <div className="skills-grid">
          <div className="skill-item">
            <span className="skill-name">Melee</span>
            <span className="skill-value">{character.stats.combatSkills.melee}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Ranged</span>
            <span className="skill-value">{character.stats.combatSkills.ranged}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Defense</span>
            <span className="skill-value">{character.stats.combatSkills.defense}</span>
          </div>
          <div className="skill-item">
            <span className="skill-name">Tactics</span>
            <span className="skill-value">{character.stats.combatSkills.tactics}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpecialization = () => (
    <div className="specialization-tab">
      <div className="specialization-overview">
        <h4>Character Specialization</h4>
        <p>Your character's role progression and bonuses</p>
      </div>

      <div className="specialization-progress">
        <div className="spec-role">
          <div className="role-header">
            <span className="role-icon">🛡️</span>
            <span className="role-name">Tank</span>
            <span className="role-progress">{character.specialization.tankProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill tank" 
              style={{ width: `${character.specialization.tankProgress}%` }}
            />
          </div>
        </div>

        <div className="spec-role">
          <div className="role-header">
            <span className="role-icon">💚</span>
            <span className="role-name">Healer</span>
            <span className="role-progress">{character.specialization.healerProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill healer" 
              style={{ width: `${character.specialization.healerProgress}%` }}
            />
          </div>
        </div>

        <div className="spec-role">
          <div className="role-header">
            <span className="role-icon">⚔️</span>
            <span className="role-name">DPS</span>
            <span className="role-progress">{character.specialization.dpsProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill dps" 
              style={{ width: `${character.specialization.dpsProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="current-roles">
        <div className="role-assignment">
          <span className="label">Primary Role:</span>
          <span className="value">{character.specialization.primaryRole || 'None'}</span>
        </div>
        <div className="role-assignment">
          <span className="label">Secondary Role:</span>
          <span className="value">{character.specialization.secondaryRole || 'None'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="character-panel">
      {/* Tab Navigation */}
      <div className="character-tabs">
        <button
          className={`tab-button ${activeTab === 'attributes' ? 'active' : ''}`}
          onClick={() => setActiveTab('attributes')}
        >
          📊 Attributes
        </button>
        <button
          className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          🎒 Inventory
        </button>
        <button
          className={`tab-button ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          ⚡ Skills
        </button>
        <button
          className={`tab-button ${activeTab === 'specialization' ? 'active' : ''}`}
          onClick={() => setActiveTab('specialization')}
        >
          🎯 Specialization
        </button>
      </div>

      {/* Tab Content */}
      <div className="character-content">
        {activeTab === 'attributes' && renderAttributes()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'skills' && renderSkills()}
        {activeTab === 'specialization' && renderSpecialization()}
      </div>
    </div>
  );
};

export default CharacterPanel;