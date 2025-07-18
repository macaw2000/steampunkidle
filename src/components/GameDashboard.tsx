import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setOnlineStatus } from '../store/slices/gameSlice';
import ErrorBoundary from './common/ErrorBoundary';
import FeatureModal from './common/FeatureModal';
import LoginComponent from './auth/LoginComponent';
import UserProfile from './auth/UserProfile';
import CharacterCreation from './character/CharacterCreation';
import MarketplaceHub from './marketplace/MarketplaceHub';
import LeaderboardHub from './leaderboard/LeaderboardHub';
import ChatInterface from './chat/ChatInterface';
import CharacterPanel from './character/CharacterPanel';
import HarvestingRewards from './harvesting/HarvestingRewards';
import HarvestingHub from './harvesting/HarvestingHub';
import ExoticDiscoveryNotification from './harvesting/ExoticDiscoveryNotification';
import GuildManager from './guild/GuildManager';
import { taskQueueService } from '../services/taskQueueService';
import { harvestingService } from '../services/harvestingService';


const GameDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace'>('dashboard');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [harvestingRewards, setHarvestingRewards] = useState<any[]>([]);
  const [showRewards, setShowRewards] = useState(false);
  const [exoticDiscovery, setExoticDiscovery] = useState<any>(null);
  const [showExoticNotification, setShowExoticNotification] = useState(false);
  const [currentTaskProgress, setCurrentTaskProgress] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
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
      default:
        return <div>Feature not found</div>;
    }
  };

  useEffect(() => {
    // Set online status when component mounts
    dispatch(setOnlineStatus(true));

    // Load and restore task queue state when character is available
    if (character) {
      // Set up progress tracking callback
      taskQueueService.onProgress(character.characterId, (progress) => {
        setCurrentTaskProgress(progress);
      });

      // Set up task completion listener FIRST before loading queue
      taskQueueService.onTaskComplete(character.characterId, (result) => {
        // Update queue status after task completion
        const status = taskQueueService.getQueueStatus(character.characterId);
        setQueueStatus(status);

        // Check if any rewards are exotic items
        const exoticReward = result.rewards.find(reward => 
          reward.type === 'resource' && reward.isRare && 
          (reward.rarity === 'rare' || reward.rarity === 'epic' || reward.rarity === 'legendary')
        );

        if (exoticReward) {
          // Get the exotic item details
          const exoticItems = harvestingService.getExoticItemsForCategory(
            result.task.activityData?.activity?.category
          );
          const exoticItem = exoticItems.find(item => item.id === exoticReward.itemId);
          
          if (exoticItem) {
            setExoticDiscovery(exoticItem);
            setShowExoticNotification(true);
          }
        }
      });

      // Now load the player's task queue to restore idle game state
      console.log('GameDashboard: Loading task queue for character:', character.characterId);
      taskQueueService.loadPlayerQueue(character.characterId).then(() => {
        // Update initial queue status after loading
        const status = taskQueueService.getQueueStatus(character.characterId);
        setQueueStatus(status);
      }).catch(error => {
        console.error('Failed to load task queue:', error);
      });
    }

    // Cleanup when component unmounts
    return () => {
      dispatch(setOnlineStatus(false));
      if (character) {
        // Save task queue state before cleanup
        taskQueueService.savePlayerQueue(character.characterId).catch(error => {
          console.error('Failed to save task queue:', error);
        });
        taskQueueService.removeCallbacks(character.characterId);
      }
    };
  }, [dispatch, character]);

  // Update queue status periodically
  useEffect(() => {
    if (!character) return;

    const interval = setInterval(() => {
      const status = taskQueueService.getQueueStatus(character.characterId);
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

  // Show main game interface if user has a character
  return (
    <div className="game-dashboard">
      {/* Header with gear icon */}
      <div className="dashboard-header">
        <div className="status-bar">
          <span className={`online-indicator ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div className="header-actions">
          <button 
            className="gear-icon-button"
            onClick={() => handleFeatureAction('User Profile')}
            title="User Profile & Settings"
          >
            ⚙️
          </button>
        </div>
      </div>



      {/* Main Layout with Sidebar */}
      <div className="dashboard-layout">
        {/* Left Sidebar - Game Features */}
        <div className="game-features-sidebar">
          <ul className="game-features-list-sidebar">
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Character Panel')}>
              👤 Character
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Resource Harvesting')}>
              ⛏️ Resources
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Crafting System')}>
              🔧 Crafting
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Combat System')}>
              ⚔️ Combat
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Guild Management')}>
              🏰 Guild
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Auction Marketplace')}>
              ✅ Auction
            </li>
            <li className="game-feature-item-sidebar" onClick={() => handleFeatureAction('Leaderboards')}>
              🏆 Leaderboard
            </li>
          </ul>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {activeTab === 'dashboard' && (
            <>
              <div className="character-section">
                {character ? (
                  <div className="character-info">
                    <h3>{character.name}</h3>
                    <p>Level: {character.level}</p>
                    <p>Experience: {character.experience}</p>
                    <p>Current Activity: {character.currentActivity?.type || 'None'}</p>
                  </div>
                ) : (
                  <div className="no-character">
                    <p>Loading character data...</p>
                  </div>
                )}
              </div>

              {/* Live Activity Display */}
              <div className="live-activity-section">
                <h3>🔧 Current Operations</h3>
                {queueStatus && queueStatus.currentTask ? (
                  <div className="current-task">
                    <div className="task-info">
                      <h4>{queueStatus.currentTask.icon} {queueStatus.currentTask.name}</h4>
                      <p>{queueStatus.currentTask.description}</p>
                    </div>
                    
                    {currentTaskProgress && (
                      <div className="task-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${currentTaskProgress.progress * 100}%` }}
                          ></div>
                        </div>
                        <div className="progress-info">
                          <span>{Math.round(currentTaskProgress.progress * 100)}% Complete</span>
                          <span>{Math.ceil(currentTaskProgress.timeRemaining / 1000)}s remaining</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-active-task">
                    <p>No active tasks</p>
                    <p><em>Start an activity from the sidebar to see live progress</em></p>
                  </div>
                )}
                
                {queueStatus && (
                  <div className="queue-summary">
                    <div className="queue-stats">
                      <span>📋 Queued: {queueStatus.queueLength}</span>
                      <span>✅ Completed: {queueStatus.totalCompleted}</span>
                      <span className={`status ${queueStatus.isRunning ? 'running' : 'idle'}`}>
                        {queueStatus.isRunning ? '🟢 Active' : '⏸️ Idle'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'marketplace' && (
            <ErrorBoundary fallback={<div>Marketplace failed to load</div>}>
              <MarketplaceHub />
            </ErrorBoundary>
          )}


        </div>
      </div>

      {/* Persistent Chat Interface */}
      <ErrorBoundary fallback={<div>Chat failed to load</div>}>
        <ChatInterface />
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

      {/* Exotic Discovery Notification */}
      <ExoticDiscoveryNotification
        exoticItem={exoticDiscovery}
        visible={showExoticNotification}
        onClose={() => {
          setShowExoticNotification(false);
          setExoticDiscovery(null);
        }}
      />
    </div>
  );
};

export default GameDashboard;