import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ItemRarity, ItemType } from '../../types/item';
import './CharacterPanel.css';

type TabType = 'attributes' | 'inventory' | 'skills' | 'specialization';
type InventoryFilter = 'all' | 'materials' | 'tools' | 'equipment' | 'consumables';

interface MockInventoryItem {
  id: string;
  name: string;
  quantity: number;
  type: ItemType;
  rarity: ItemRarity;
  description?: string;
  stats?: {
    strength?: number;
    dexterity?: number;
    intelligence?: number;
    vitality?: number;
  };
}

const CharacterPanel: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [activeTab, setActiveTab] = useState<TabType>('attributes');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');

  // Enhanced mock inventory data with more variety and proper typing
  const mockInventory = useMemo<MockInventoryItem[]>(() => [
    { 
      id: '1', 
      name: 'Clockwork Gear', 
      quantity: 15, 
      type: 'material', 
      rarity: 'common',
      description: 'Essential component for mechanical devices'
    },
    { 
      id: '2', 
      name: 'Steam Crystal', 
      quantity: 3, 
      type: 'material', 
      rarity: 'rare',
      description: 'Crystallized steam energy, highly valuable'
    },
    { 
      id: '3', 
      name: 'Copper Ore', 
      quantity: 28, 
      type: 'material', 
      rarity: 'common',
      description: 'Raw copper extracted from mines'
    },
    { 
      id: '4', 
      name: 'Iron Ingot', 
      quantity: 12, 
      type: 'material', 
      rarity: 'uncommon',
      description: 'Refined iron ready for crafting'
    },
    { 
      id: '5', 
      name: 'Brass Wrench', 
      quantity: 1, 
      type: 'tool', 
      rarity: 'uncommon',
      description: 'Precision tool for mechanical work',
      stats: { dexterity: 2, intelligence: 1 }
    },
    { 
      id: '6', 
      name: 'Steam Engine Blueprint', 
      quantity: 1, 
      type: 'material', 
      rarity: 'rare',
      description: 'Detailed plans for constructing steam engines'
    },
    { 
      id: '7', 
      name: 'Healing Potion', 
      quantity: 5, 
      type: 'consumable', 
      rarity: 'common',
      description: 'Restores health when consumed'
    },
    { 
      id: '8', 
      name: 'Pocket Watch', 
      quantity: 1, 
      type: 'trinket', 
      rarity: 'epic',
      description: 'Masterwork timepiece with mystical properties',
      stats: { intelligence: 5, vitality: 3 }
    },
    { 
      id: '9', 
      name: 'Steam-Powered Gauntlets', 
      quantity: 1, 
      type: 'armor', 
      rarity: 'legendary',
      description: 'Legendary gauntlets powered by compressed steam',
      stats: { strength: 8, dexterity: 4 }
    },
    { 
      id: '10', 
      name: 'Cogwheel Blade', 
      quantity: 1, 
      type: 'weapon', 
      rarity: 'epic',
      description: 'A sword with rotating cogwheel edges',
      stats: { strength: 6, dexterity: 2 }
    },
    { 
      id: '11', 
      name: 'Aether Essence', 
      quantity: 2, 
      type: 'material', 
      rarity: 'legendary',
      description: 'Pure essence of the ethereal plane'
    },
    { 
      id: '12', 
      name: 'Mechanical Spider', 
      quantity: 1, 
      type: 'trinket', 
      rarity: 'rare',
      description: 'A clockwork companion that assists in crafting',
      stats: { intelligence: 3, dexterity: 2 }
    }
  ], []);

  // Filter inventory based on selected filter
  const filteredInventory = useMemo(() => {
    if (inventoryFilter === 'all') return mockInventory;
    
    const filterMap: Record<InventoryFilter, ItemType[]> = {
      all: [],
      materials: ['material'],
      tools: ['tool'],
      equipment: ['weapon', 'armor', 'trinket'],
      consumables: ['consumable']
    };
    
    const allowedTypes = filterMap[inventoryFilter];
    return mockInventory.filter(item => allowedTypes.includes(item.type));
  }, [mockInventory, inventoryFilter]);

  // Early return for loading state
  if (!character) {
    return (
      <div className="character-panel">
        <div className="loading-state">
          <div className="loading-spinner" data-testid="loading-spinner">⚙️</div>
          <p>Loading character data...</p>
        </div>
      </div>
    );
  }

  // Calculate next level experience requirement
  const nextLevelExp = Math.pow(character.level, 2) * 100;
  const currentLevelExp = Math.pow(character.level - 1, 2) * 100;
  const expProgress = ((character.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

  // Steampunk-themed specialization names
  const specializationThemes = {
    tank: 'Steam-Powered Guardian',
    healer: 'Clockwork Medic',
    dps: 'Gear-Strike Specialist'
  };

  const getRarityColor = (rarity: ItemRarity): string => {
    const colors: Record<ItemRarity, string> = {
      common: '#9ca3af',
      uncommon: '#10b981',
      rare: '#3b82f6',
      epic: '#8b5cf6',
      legendary: '#f59e0b'
    };
    return colors[rarity];
  };

  const getRarityGlow = (rarity: ItemRarity): string => {
    const glows: Record<ItemRarity, string> = {
      common: 'none',
      uncommon: '0 0 5px #10b981',
      rare: '0 0 8px #3b82f6',
      epic: '0 0 12px #8b5cf6',
      legendary: '0 0 15px #f59e0b'
    };
    return glows[rarity];
  };

  const getItemIcon = (type: ItemType): string => {
    const icons: Record<ItemType, string> = {
      material: '🔩',
      tool: '🔧',
      consumable: '🧪',
      weapon: '⚔️',
      armor: '🛡️',
      trinket: '💎'
    };
    return icons[type];
  };

  const getSpecializationIcon = (role: 'tank' | 'healer' | 'dps'): string => {
    const icons = {
      tank: '🛡️',
      healer: '⚕️',
      dps: '⚔️'
    };
    return icons[role];
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
        <div className="inventory-title">
          <h4>Inventory ({filteredInventory.length}/{mockInventory.length})</h4>
          <div className="inventory-capacity">
            <span className="capacity-text">Capacity: {mockInventory.length}/50</span>
            <div className="capacity-bar">
              <div 
                className="capacity-fill" 
                style={{ width: `${(mockInventory.length / 50) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="inventory-filters">
          <button 
            className={`filter-btn ${inventoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setInventoryFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${inventoryFilter === 'materials' ? 'active' : ''}`}
            onClick={() => setInventoryFilter('materials')}
          >
            Materials
          </button>
          <button 
            className={`filter-btn ${inventoryFilter === 'tools' ? 'active' : ''}`}
            onClick={() => setInventoryFilter('tools')}
          >
            Tools
          </button>
          <button 
            className={`filter-btn ${inventoryFilter === 'equipment' ? 'active' : ''}`}
            onClick={() => setInventoryFilter('equipment')}
          >
            Equipment
          </button>
          <button 
            className={`filter-btn ${inventoryFilter === 'consumables' ? 'active' : ''}`}
            onClick={() => setInventoryFilter('consumables')}
          >
            Consumables
          </button>
        </div>
      </div>
      
      <div className="inventory-grid">
        {filteredInventory.map(item => (
          <div 
            key={item.id} 
            className={`inventory-item rarity-${item.rarity}`}
            title={item.description}
          >
            <div className="item-header">
              <div 
                className="item-icon" 
                style={{ 
                  color: getRarityColor(item.rarity),
                  textShadow: getRarityGlow(item.rarity)
                }}
              >
                {getItemIcon(item.type)}
              </div>
              <div className="item-quantity">x{item.quantity}</div>
            </div>
            <div className="item-info">
              <div 
                className="item-name" 
                style={{ color: getRarityColor(item.rarity) }}
              >
                {item.name}
              </div>
              <div className="item-type">{item.type}</div>
              {item.stats && (
                <div className="item-stats">
                  {Object.entries(item.stats).map(([stat, value]) => (
                    <span key={stat} className="stat-bonus">
                      +{value} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {filteredInventory.length === 0 && (
        <div className="empty-inventory">
          <div className="empty-icon">📦</div>
          <p>No items found in this category</p>
        </div>
      )}
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
        <h4>⚙️ Steampunk Specialization</h4>
        <p>Your character's mechanical mastery and role progression</p>
      </div>

      <div className="specialization-progress">
        <div className="spec-role tank-role">
          <div className="role-header">
            <div className="role-icon-container">
              <span className="role-icon">{getSpecializationIcon('tank')}</span>
              <div className="steam-effect"></div>
            </div>
            <div className="role-info">
              <span className="role-name">{specializationThemes.tank}</span>
              <span className="role-subtitle">Defensive Specialist</span>
            </div>
            <span className="role-progress">{character.specialization.tankProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill tank" 
              style={{ width: `${character.specialization.tankProgress}%` }}
            />
            <div className="progress-gears">
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
            </div>
          </div>
          <div className="role-description">
            Master of steam-powered shields and mechanical fortifications
          </div>
        </div>

        <div className="spec-role healer-role">
          <div className="role-header">
            <div className="role-icon-container">
              <span className="role-icon">{getSpecializationIcon('healer')}</span>
              <div className="steam-effect"></div>
            </div>
            <div className="role-info">
              <span className="role-name">{specializationThemes.healer}</span>
              <span className="role-subtitle">Support Specialist</span>
            </div>
            <span className="role-progress">{character.specialization.healerProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill healer" 
              style={{ width: `${character.specialization.healerProgress}%` }}
            />
            <div className="progress-gears">
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
            </div>
          </div>
          <div className="role-description">
            Expert in clockwork medical devices and steam-powered restoration
          </div>
        </div>

        <div className="spec-role dps-role">
          <div className="role-header">
            <div className="role-icon-container">
              <span className="role-icon">{getSpecializationIcon('dps')}</span>
              <div className="steam-effect"></div>
            </div>
            <div className="role-info">
              <span className="role-name">{specializationThemes.dps}</span>
              <span className="role-subtitle">Offensive Specialist</span>
            </div>
            <span className="role-progress">{character.specialization.dpsProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill dps" 
              style={{ width: `${character.specialization.dpsProgress}%` }}
            />
            <div className="progress-gears">
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
              <span className="gear">⚙️</span>
            </div>
          </div>
          <div className="role-description">
            Wielder of precision clockwork weapons and steam-powered artillery
          </div>
        </div>
      </div>

      <div className="current-roles">
        <div className="role-assignment primary">
          <span className="label">🎯 Primary Specialization:</span>
          <span className="value">
            {character.specialization.primaryRole 
              ? specializationThemes[character.specialization.primaryRole]
              : 'Developing...'
            }
          </span>
        </div>
        <div className="role-assignment secondary">
          <span className="label">⚡ Secondary Focus:</span>
          <span className="value">
            {character.specialization.secondaryRole 
              ? specializationThemes[character.specialization.secondaryRole]
              : 'None'
            }
          </span>
        </div>
      </div>

      <div className="specialization-bonuses">
        <h5>🔧 Active Bonuses</h5>
        <div className="bonus-grid">
          {character.specialization.primaryRole && (
            <div className="bonus-item">
              <span className="bonus-icon">⚙️</span>
              <span className="bonus-text">
                {character.specialization.primaryRole === 'tank' && '+15% Defense from Steam Armor'}
                {character.specialization.primaryRole === 'healer' && '+20% Healing from Clockwork Precision'}
                {character.specialization.primaryRole === 'dps' && '+10% Damage from Gear Optimization'}
              </span>
            </div>
          )}
          <div className="bonus-item">
            <span className="bonus-icon">🔩</span>
            <span className="bonus-text">+5% Crafting Speed from Mechanical Expertise</span>
          </div>
          <div className="bonus-item">
            <span className="bonus-icon">💨</span>
            <span className="bonus-text">Steam-Powered Efficiency: +3% All Activities</span>
          </div>
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