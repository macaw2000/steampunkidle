import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import './LeaderboardHub.css';

interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;
  experience: number;
  currency: number;
  guildName?: string;
  rank: number;
}

type LeaderboardType = 'level' | 'experience' | 'currency';

const LeaderboardHub: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [activeTab, setActiveTab] = useState<LeaderboardType>('level');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  // Mock leaderboard data for development
  const generateMockLeaderboard = (type: LeaderboardType): LeaderboardEntry[] => {
    const mockPlayers = [
      { username: 'GearMaster', level: 25, experience: 62500, currency: 1250, guildName: 'Steam Engineers' },
      { username: 'ClockworkQueen', level: 23, experience: 52900, currency: 980, guildName: 'Brass Inventors' },
      { username: 'SteamPunk87', level: 22, experience: 48400, currency: 1100 },
      { username: 'CogWheeler', level: 21, experience: 44100, currency: 850, guildName: 'Steam Engineers' },
      { username: 'BrassBuilder', level: 20, experience: 40000, currency: 750 },
      { username: 'MechMaster', level: 19, experience: 36100, currency: 920, guildName: 'Iron Works' },
      { username: 'SteamSmith', level: 18, experience: 32400, currency: 680 },
      { username: 'GearGrinder', level: 17, experience: 28900, currency: 590 },
      { username: 'ClockTinkerer', level: 16, experience: 25600, currency: 520, guildName: 'Brass Inventors' },
      { username: 'SteamSage', level: 15, experience: 22500, currency: 450 },
    ];

    // Add current player if they have a character
    if (character) {
      mockPlayers.push({
        username: character.name,
        level: character.level,
        experience: character.experience,
        currency: character.currency,
        guildName: undefined, // Player's guild would come from guild system
      });
    }

    // Sort based on the selected type
    const sorted = mockPlayers.sort((a, b) => {
      switch (type) {
        case 'level':
          return b.level - a.level || b.experience - a.experience;
        case 'experience':
          return b.experience - a.experience;
        case 'currency':
          return b.currency - a.currency;
        default:
          return 0;
      }
    });

    // Add ranks and user IDs
    return sorted.map((player, index) => ({
      ...player,
      userId: `user-${index}`,
      rank: index + 1,
    }));
  };

  // Load leaderboard data
  useEffect(() => {
    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const data = generateMockLeaderboard(activeTab);
      setLeaderboardData(data);
      
      // Find player's rank if they have a character
      if (character) {
        const playerEntry = data.find(entry => entry.username === character.name);
        setPlayerRank(playerEntry?.rank || null);
      }
      
      setLoading(false);
    }, 500);
  }, [activeTab, character]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getStatValue = (entry: LeaderboardEntry, type: LeaderboardType): string => {
    switch (type) {
      case 'level':
        return `Level ${entry.level}`;
      case 'experience':
        return `${formatNumber(entry.experience)} XP`;
      case 'currency':
        return `${formatNumber(entry.currency)} Coins`;
      default:
        return '';
    }
  };

  return (
    <div className="leaderboard-hub">
      <div className="leaderboard-header">
        <h2>🏆 Hall of Renowned Inventors</h2>
        <p>See how you rank among the greatest engineers in the realm!</p>
      </div>

      {/* Tab Navigation */}
      <div className="leaderboard-tabs">
        <button
          className={`tab-button ${activeTab === 'level' ? 'active' : ''}`}
          onClick={() => setActiveTab('level')}
        >
          📊 Level Rankings
        </button>
        <button
          className={`tab-button ${activeTab === 'experience' ? 'active' : ''}`}
          onClick={() => setActiveTab('experience')}
        >
          ⭐ Experience Points
        </button>
        <button
          className={`tab-button ${activeTab === 'currency' ? 'active' : ''}`}
          onClick={() => setActiveTab('currency')}
        >
          💰 Wealth Rankings
        </button>
      </div>

      {/* Player's Current Rank */}
      {character && playerRank && (
        <div className="player-rank-card">
          <div className="rank-info">
            <span className="rank-position">{getRankIcon(playerRank)}</span>
            <div className="rank-details">
              <strong>{character.name}</strong>
              <span className="rank-stat">{getStatValue({
                userId: character.userId,
                username: character.name,
                level: character.level,
                experience: character.experience,
                currency: character.currency,
                rank: playerRank
              }, activeTab)}</span>
            </div>
          </div>
          <div className="rank-badge">Your Rank</div>
        </div>
      )}

      {/* Leaderboard Content */}
      <div className="leaderboard-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">⚙️</div>
            <p>Loading rankings...</p>
          </div>
        ) : (
          <div className="leaderboard-list">
            {leaderboardData.map((entry) => (
              <div
                key={entry.userId}
                className={`leaderboard-entry ${
                  character && entry.username === character.name ? 'player-entry' : ''
                }`}
              >
                <div className="entry-rank">
                  {getRankIcon(entry.rank)}
                </div>
                
                <div className="entry-info">
                  <div className="entry-name">
                    <strong>{entry.username}</strong>
                    {entry.guildName && (
                      <span className="guild-tag">[{entry.guildName}]</span>
                    )}
                  </div>
                  <div className="entry-stats">
                    <span className="primary-stat">
                      {getStatValue(entry, activeTab)}
                    </span>
                    <span className="secondary-stats">
                      Level {entry.level} • {formatNumber(entry.experience)} XP • {formatNumber(entry.currency)} Coins
                    </span>
                  </div>
                </div>

                <div className="entry-actions">
                  {character && entry.username !== character.name && (
                    <button className="view-profile-btn">
                      👤 View Profile
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="leaderboard-footer">
        <p>
          <em>Rankings update every hour. Compete with fellow inventors to claim the top spots!</em>
        </p>
      </div>
    </div>
  );
};

export default LeaderboardHub;