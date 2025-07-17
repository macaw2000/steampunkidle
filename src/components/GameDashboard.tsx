import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setOnlineStatus } from '../store/slices/gameSlice';
import LoginComponent from './auth/LoginComponent';
import UserProfile from './auth/UserProfile';
import CharacterCreation from './character/CharacterCreation';
import RealTimeProgressTracker from './progress/RealTimeProgressTracker';
import MarketplaceHub from './marketplace/MarketplaceHub';
import ActivitySelector from './activity/ActivitySelector';

const GameDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace'>('dashboard');
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { character, hasCharacter, characterLoading, isOnline } = useSelector((state: RootState) => state.game);

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
    return <LoginComponent />;
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
        <CharacterCreation 
          onCharacterCreated={() => {
            // Character creation will update the Redux state automatically
            // The component will re-render and show the main game interface
          }}
        />
      </div>
    );
  }

  // Show main game interface if user has a character
  return (
    <div className="game-dashboard">
      <UserProfile />
      
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
            <ActivitySelector />

            {/* Real-time Progress Display */}
            <RealTimeProgressTracker />

            <div className="game-info">
              <h3>Game Features</h3>
              <ul>
                <li>🔧 Crafting System</li>
                <li>⛏️ Resource Harvesting</li>
                <li>⚔️ Combat System</li>
                <li>🏰 Guild Management</li>
                <li>✅ Auction Marketplace</li>
                <li>💬 Chat System</li>
                <li>🏆 Leaderboards</li>
              </ul>
            </div>
          </>
        )}

        {activeTab === 'marketplace' && <MarketplaceHub />}
      </div>
    </div>
  );
};

export default GameDashboard;