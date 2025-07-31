import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setOnlineStatus } from '../store/slices/gameSlice';
import ErrorBoundary from './common/ErrorBoundary';
import FeatureModal from './common/FeatureModal';
import ResponsiveLayout from './layout/ResponsiveLayout';

import ResponsiveChatInterface from './chat/ResponsiveChatInterface';
import LoginComponent from './auth/LoginComponent';
import UserProfile from './auth/UserProfile';
import CharacterCreation from './character/CharacterCreation';
import MarketplaceHub from './marketplace/MarketplaceHub';
import LeaderboardHub from './leaderboard/LeaderboardHub';
import CharacterPanel from './character/CharacterPanel';
import HarvestingRewards from './harvesting/HarvestingRewards';
import HarvestingHub from './harvesting/HarvestingHub';
import TaskQueueContainer from './taskQueue/TaskQueueContainer';
import FargateTaskQueueManager from './taskQueue/FargateTaskQueueManager';


import GuildManager from './guild/GuildManager';
import { serverTaskQueueService } from '../services/serverTaskQueueService';
// harvestingService import removed - exotic items now handled by UnifiedProgressBar


const GameDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace'>('dashboard');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [harvestingRewards, setHarvestingRewards] = useState<any[]>([]);
  const [showRewards, setShowRewards] = useState(false);
  // Exotic items are now displayed in the unified progress bar - no popups needed
  // Removed currentTaskProgress - now handled by UnifiedProgressBar
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [onlinePlayerCount, setOnlinePlayerCount] = useState<number>(0);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter, characterLoading, isOnline } = useSelector((state: RootState) => state.game);

  // Handle feature actions
  const handleFeatureAction = (featureName: string) => {
    if (featureName === 'Auction Marketplace') {
      // Switch to marketplace tab
      setActiveTab('marketplace');
    } else {
      // Open modal for all other features including Resource Harvesting
      setActiveFeature(featureName);
    }
  };







  const closeRewards = () => {
    setShowRewards(false);
    setHarvestingRewards([]);
  };

  // Handle feature modal closing
  const closeFeature = () => {
    setActiveFeature(null);
  };

  // Render feature content based on active feature
  const renderFeatureContent = () => {
    switch (activeFeature) {
      case 'Character Panel':
        return <CharacterPanel />;
      case 'Crafting System':
        return (
          <div className="feature-content">
            <p>🔧 <strong>Clockwork Crafting Workshop</strong></p>
            <p>Create intricate mechanical devices and steam-powered contraptions!</p>
            <div className="feature-placeholder">
              <h4>Available Recipes:</h4>
              <ul>
                <li>⚙️ Basic Clockwork Gear - <em>Materials: 2 Copper, 1 Steam Crystal</em></li>
                <li>🔩 Steam Valve - <em>Materials: 3 Iron, 2 Rubber</em></li>
                <li>⏰ Pocket Watch - <em>Materials: 5 Gears, 1 Crystal, 3 Gold</em></li>
              </ul>
              <p><em>Full crafting system coming soon!</em></p>
            </div>
          </div>
        );
      case 'Resource Harvesting':
        return character ? (
          <HarvestingHub
            playerId={character.characterId}
            playerLevel={character.level}
            playerStats={{
              intelligence: character.stats?.intelligence || 10,
              dexterity: character.stats?.dexterity || 10,
              strength: character.stats?.strength || 10,
              perception: character.stats?.vitality || 10
            }}
            onRewardsReceived={(rewards) => {
              setHarvestingRewards(rewards);
              setShowRewards(true);
            }}
            onClose={closeFeature}
          />
        ) : (
          <div>Loading character data...</div>
        );
      case 'Combat System':
        return (
          <div className="feature-content">
            <p>⚔️ <strong>Automaton Battle Arena</strong></p>
            <p>Face off against rogue mechanical creatures and steam-powered beasts!</p>
            <div className="feature-placeholder">
              <h4>Enemy Types:</h4>
              <ul>
                <li>🤖 Clockwork Sentinel - <em>Level 1-5 mechanical guardian</em></li>
                <li>🐉 Steam Dragon - <em>Level 10+ fire-breathing automaton</em></li>
                <li>⚡ Lightning Golem - <em>Level 15+ electrical construct</em></li>
              </ul>
              <p><em>Combat mechanics coming soon!</em></p>
            </div>
          </div>
        );
      case 'Guild Management':
        return character ? (
          <ErrorBoundary fallback={<div>Guild Management failed to load</div>}>
            <GuildManager 
              character={character}
              onGuildUpdate={(guild) => {
                // Handle guild updates if needed
                console.log('Guild updated:', guild);
              }}
            />
          </ErrorBoundary>
        ) : (
          <div>Loading character data...</div>
        );
      case 'Chat System':
        return (
          <div className="feature-content">
            <p>💬 <strong>Steam Telegraph Network</strong></p>
            <p>Communicate with fellow inventors across the realm!</p>
            <div className="feature-placeholder">
              <h4>Chat Channels:</h4>
              <ul>
                <li>🌍 Global - <em>Talk with all players</em></li>
                <li>🏰 Guild - <em>Private guild communications</em></li>
                <li>💼 Trade - <em>Buy and sell items</em></li>
                <li>❓ Help - <em>Get assistance from other players</em></li>
              </ul>
              <p><em>Real-time chat coming soon!</em></p>
            </div>
          </div>
        );
      case 'Leaderboards':
        return <LeaderboardHub />;
      case 'User Profile':
        return (
          <ErrorBoundary fallback={<div>User profile failed to load</div>}>
            <UserProfile />
          </ErrorBoundary>
        );
      case 'Fargate Game Engine':
        return character ? (
          <ErrorBoundary fallback={<div>Fargate Game Engine failed to load</div>}>
            <FargateTaskQueueManager
              playerId={character.characterId}
              onTaskComplete={(result) => {
                console.log('Fargate task completed:', result);
                // Handle task completion if needed
              }}
              onStatusChange={(status) => {
                console.log('Fargate queue status changed:', status);
                // Handle status changes if needed
              }}
            />
          </ErrorBoundary>
        ) : (
          <div>Loading character data...</div>
        );
      default:
        return <div>Feature not found</div>;
    }
  };

  // Fetch online player count
  const fetchOnlinePlayerCount = async () => {
    try {
      const response = await fetch('/api/players/online');
      if (response.ok) {
        const players = await response.json();
        console.log('Online players response:', players);
        // Ensure at least 1 if the current player is authenticated and has a character
        const count = Math.max(players.length, (isAuthenticated && character) ? 1 : 0);
        setOnlinePlayerCount(count);
      } else {
        console.warn('Failed to fetch online players, status:', response.status);
        // Fallback: show at least 1 if current player is online
        setOnlinePlayerCount((isAuthenticated && character) ? 1 : 0);
      }
    } catch (error) {
      console.error('Failed to fetch online player count:', error);
      // Fallback: show at least 1 if current player is online
      setOnlinePlayerCount((isAuthenticated && character) ? 1 : 0);
    }
  };

  useEffect(() => {
    // Set online status when component mounts
    dispatch(setOnlineStatus(true));

    // Load and restore task queue state when character is available
    if (character) {
      // Progress tracking is now handled by UnifiedProgressBar
      // No need to track progress in GameDashboard anymore

      // Set up task completion listener FIRST before syncing with server
      serverTaskQueueService.onTaskComplete(character.characterId, (result) => {
        // Update queue status after task completion
        const status = serverTaskQueueService.getQueueStatus(character.characterId);
        setQueueStatus(status);

        // Exotic items are now displayed in the unified progress bar - no popups needed
      });

      // Sync with server-side task queue to restore idle game state
      console.log('GameDashboard: Syncing with server task queue for character:', character.characterId);
      serverTaskQueueService.syncWithServer(character.characterId).then(() => {
        // Update initial queue status after syncing
        const status = serverTaskQueueService.getQueueStatus(character.characterId);
        setQueueStatus(status);
      }).catch(error => {
        console.error('Failed to sync with server task queue:', error);
      });
    }

    // Fetch initial online player count
    fetchOnlinePlayerCount();

    // Set up interval to update online player count every 30 seconds
    const playerCountInterval = setInterval(fetchOnlinePlayerCount, 30000);

    // Cleanup when component unmounts
    return () => {
      dispatch(setOnlineStatus(false));
      clearInterval(playerCountInterval);
      if (character) {
        // Clean up server sync before component unmount
        serverTaskQueueService.removeCallbacks(character.characterId);
      }
    };
  }, [dispatch, character]);

  // Update online player count when auth/character status changes
  useEffect(() => {
    fetchOnlinePlayerCount();
  }, [isAuthenticated, character]);

  // Update queue status periodically
  useEffect(() => {
    if (!character) return;

    const interval = setInterval(() => {
      const status = serverTaskQueueService.getQueueStatus(character.characterId);
      setQueueStatus(status);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [character]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <ErrorBoundary fallback={<div>Login component failed to load</div>}>
        <LoginComponent />
      </ErrorBoundary>
    );
  }

  // Show loading screen while checking for character
  if (characterLoading) {
    return (
      <div className="game-dashboard">
        <div className="loading-screen">
          <h2>Loading your character...</h2>
          <div className="loading-spinner">⚙️</div>
        </div>
      </div>
    );
  }

  // Show character creation screen if user doesn't have a character
  if (hasCharacter === false) {
    return (
      <div className="game-dashboard">
        <ErrorBoundary fallback={<div>Character creation failed to load</div>}>
          <CharacterCreation 
            onCharacterCreated={() => {
              // Character creation will update the Redux state automatically
              // The component will re-render and show the main game interface
            }}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Create navigation items for responsive navigation
  const navigationItems = [
    { id: 'character', label: 'Character', icon: '👤', onClick: () => handleFeatureAction('Character Panel') },
    { id: 'resources', label: 'Resources', icon: '⛏️', onClick: () => handleFeatureAction('Resource Harvesting') },
    { id: 'crafting', label: 'Crafting', icon: '🔧', onClick: () => handleFeatureAction('Crafting System') },
    { id: 'combat', label: 'Combat', icon: '⚔️', onClick: () => handleFeatureAction('Combat System') },
    { id: 'guild', label: 'Guild', icon: '🏰', onClick: () => handleFeatureAction('Guild Management') },
    { id: 'auction', label: 'Auction', icon: '💰', onClick: () => handleFeatureAction('Auction Marketplace') },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', onClick: () => handleFeatureAction('Leaderboards') },
    { id: 'fargate', label: 'Game Engine', icon: '🎮', onClick: () => handleFeatureAction('Fargate Game Engine') },
    { id: 'profile', label: 'Profile', icon: '⚙️', onClick: () => handleFeatureAction('User Profile') },
  ];

  // Show main game interface if user has a character
  return (
    <>
      <ResponsiveLayout
      sidebar={
        <div className="game-features-sidebar-content">
          {/* Player Information Section */}
          {character && (
            <div className="player-info-section">
              <div className="player-name-display">
                <span className="player-icon">👤</span>
                <span className="player-name">{character.name}</span>
              </div>
              <div className="player-level-display">
                <span className="level-icon">⭐</span>
                <span className="level-text">Level {character.level}</span>
              </div>
              <div className="online-players-display">
                <span className="online-icon">🌍</span>
                <span className="online-text">{onlinePlayerCount} Players Online</span>
              </div>
            </div>
          )}
          
          {/* Navigation Section */}
          <div className="sidebar-navigation">
            {navigationItems.slice(0, 8).map((item) => (
              <button
                key={item.id}
                className="sidebar-nav-button"
                onClick={item.onClick}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      }
      className="game-dashboard"
    >
      {/* Main Content - Task Queue Display */}
      {activeTab === 'dashboard' && character && (
        <div className="main-content-area">
          <TaskQueueContainer 
            playerId={character.characterId}
            className="main-task-queue"
            defaultMode="management"
          />
        </div>
      )}

      {activeTab === 'marketplace' && (
        <ErrorBoundary fallback={<div>Marketplace failed to load</div>}>
          <MarketplaceHub />
        </ErrorBoundary>
      )}

      {/* Responsive Chat Interface */}
      <ErrorBoundary fallback={<div>Chat failed to load</div>}>
        <ResponsiveChatInterface />
      </ErrorBoundary>

      {/* Feature Modal */}
      <FeatureModal
        isOpen={activeFeature !== null}
        onClose={closeFeature}
        title={activeFeature || ''}
        size="large"
      >
        {renderFeatureContent()}
      </FeatureModal>

      {/* Harvesting Rewards Modal */}
      <HarvestingRewards
        rewards={harvestingRewards}
        visible={showRewards}
        onClose={closeRewards}
      />
    </ResponsiveLayout>
    </>
  );
};

export default GameDashboard;