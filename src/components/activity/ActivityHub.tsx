/**
 * Activity Hub Component - Central hub for all activities (crafting, harvesting, combat)
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ActivityType } from '../../types/character';
import ActivitySelector from './ActivitySelector';
import ActivityProgress from './ActivityProgress';
import CraftingStation from '../crafting/CraftingStation';

import CombatInterface from './CombatInterface';
import './ActivityHub.css';

const ActivityHub: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'crafting' | 'harvesting' | 'combat'>('overview');

  if (!character) {
    return (
      <div className="activity-hub">
        <div className="activity-hub__loading">
          Loading character data...
        </div>
      </div>
    );
  }

  const currentActivity = character.currentActivity?.type;

  return (
    <div className="activity-hub">
      <div className="activity-hub__header">
        <h1 className="activity-hub__title">Activity Hub</h1>
        <p className="activity-hub__subtitle">
          Master the arts of crafting, harvesting, and combat in the age of steam
        </p>
      </div>

      <div className="activity-hub__tabs">
        <button
          className={`activity-hub__tab ${selectedTab === 'overview' ? 'activity-hub__tab--active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          <span className="activity-hub__tab-icon">📊</span>
          Overview
        </button>
        <button
          className={`activity-hub__tab ${selectedTab === 'crafting' ? 'activity-hub__tab--active' : ''}`}
          onClick={() => setSelectedTab('crafting')}
        >
          <span className="activity-hub__tab-icon">⚙️</span>
          Crafting
          {currentActivity === 'crafting' && <span className="activity-hub__tab-indicator">●</span>}
        </button>
        <button
          className={`activity-hub__tab ${selectedTab === 'harvesting' ? 'activity-hub__tab--active' : ''}`}
          onClick={() => setSelectedTab('harvesting')}
        >
          <span className="activity-hub__tab-icon">⛏️</span>
          Harvesting
          {currentActivity === 'harvesting' && <span className="activity-hub__tab-indicator">●</span>}
        </button>
        <button
          className={`activity-hub__tab ${selectedTab === 'combat' ? 'activity-hub__tab--active' : ''}`}
          onClick={() => setSelectedTab('combat')}
        >
          <span className="activity-hub__tab-icon">⚔️</span>
          Combat
          {currentActivity === 'combat' && <span className="activity-hub__tab-indicator">●</span>}
        </button>
      </div>

      <div className="activity-hub__content">
        {selectedTab === 'overview' && (
          <div className="activity-hub__overview">
            <div className="activity-hub__current-activity">
              <ActivityProgress />
            </div>
            <div className="activity-hub__activity-selector">
              <ActivitySelector />
            </div>
          </div>
        )}

        {selectedTab === 'crafting' && (
          <CraftingStation />
        )}

        {selectedTab === 'harvesting' && (
          <div className="activity-hub__harvesting-placeholder">
            <h3>🔧 Steampunk Harvesting</h3>
            <p>Visit the main Harvesting tab for the full resource gathering experience!</p>
            <p><em>Complete harvesting system available in the main navigation.</em></p>
          </div>
        )}

        {selectedTab === 'combat' && (
          <CombatInterface />
        )}
      </div>
    </div>
  );
};

export default ActivityHub;