import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setOnlineStatus } from '../store/slices/gameSlice';
import ErrorBoundary from './common/ErrorBoundary';
import FeatureModal from './common/FeatureModal';
import LoginComponent from './auth/LoginComponent';
import UserProfile from './auth/UserProfile';
import CharacterCreation from './character/CharacterCreation';
import RealTimeProgressTracker from './progress/RealTimeProgressTracker';
import MarketplaceHub from './marketplace/MarketplaceHub';
import ActivitySelector from './activity/ActivitySelector';
import LeaderboardHub from './leaderboard/LeaderboardHub';
import ChatInterface from './chat/ChatInterface';
import CharacterPanel from './character/CharacterPanel';

const GameDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace'>('dashboard');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter, characterLoading, isOnline } = useSelector((state: RootState) => state.game);

  // Handle feature modal opening
  const openFeature = (featureName: string) => {
    if (featureName === 'Auction Marketplace') {
      // Switch to marketplace tab instead of opening modal
      setActiveTab('marketplace');
    } else {
      setActiveFeature(featureName);
    }
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
        return (
          <div className="feature-content">
            <p>⛏️ <strong>Steam-Powered Mining Operation</strong></p>
            <p>Extract valuable resources from the industrial landscape!</p>
            <div className="feature-placeholder">
              <h4>Available Resources:</h4>
              <ul>
                <li>🟤 Copper Ore - <em>Common metal for basic crafting</em></li>
                <li>⚡ Steam Crystals - <em>Rare energy source for advanced items</em></li>
                <li>⚫ Coal - <em>Fuel for steam engines</em></li>
                <li>🟫 Iron Ore - <em>Strong metal for durable equipment</em></li>
              </ul>
              <p><em>Enhanced harvesting interface coming soon!</em></p>
            </div>
          </div>
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
        return (
          <div className="feature-content">
            <p>🏰 <strong>Steampunk Guild Hall</strong></p>
            <p>Join forces with other inventors and engineers!</p>
            <div className="feature-placeholder">
              <h4>Guild Features:</h4>
              <ul>
                <li>👥 Create or join engineering guilds</li>
                <li>🏗️ Collaborative workshop projects</li>
                <li>💬 Guild-specific chat channels</li>
                <li>🏆 Guild competitions and rankings</li>
              </ul>
              <p><em>Guild system coming soon!</em></p>
            </div>
          </div>
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
      default:
        return <div>Feature not found</div>;
    }
  };

  useEffect(() => {
    // Set online status when component mounts
    dispatch(setOnlineStatus(true));

    // Cleanup when component unmounts
    return () => {
      dispatch(setOnlineStatus(false));
    };
  }, [dispatch]);

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
      <ErrorBoundary fallback={<div>User profile failed to load</div>}>
        <UserProfile />
      </ErrorBoundary>
      
      <div className="status-bar">
        <span className={`online-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>

      <div className="main-navigation">
        <button
          className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          🏠 Dashboard
        </button>
        <button
          className={`nav-button ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          🏪 Marketplace
        </button>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="dashboard-layout">
        {/* Left Sidebar - Game Features */}
        <div className="game-features-sidebar">
          <ul className="game-features-list-sidebar">
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Character Panel')}>
              👤 Character
            </li>
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Crafting System')}>
              🔧 Crafting System
            </li>
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Resource Harvesting')}>
              ⛏️ Resource Harvesting
            </li>
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Combat System')}>
              ⚔️ Combat System
            </li>
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Guild Management')}>
              🏰 Guild Management
            </li>
            <li className="game-feature-item-sidebar" onClick={() => openFeature('Auction Marketplace')}>
              ✅ Auction Marketplace
            </li>

            <li className="game-feature-item-sidebar" onClick={() => openFeature('Leaderboards')}>
              🏆 Leaderboards
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

              {/* Activity Selection */}
              <ErrorBoundary fallback={<div>Activity selector failed to load</div>}>
                <ActivitySelector />
              </ErrorBoundary>

              {/* Real-time Progress Display */}
              <ErrorBoundary fallback={<div>Progress tracker failed to load</div>}>
                <RealTimeProgressTracker />
              </ErrorBoundary>
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
    </div>
  );
};

export default GameDashboard;