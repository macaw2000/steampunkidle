/**
 * Private message modal for starting conversations
 */

import React, { useState, useEffect } from 'react';
import './PrivateMessageModal.css';

interface Player {
  userId: string;
  name: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface PrivateMessageModalProps {
  onClose: () => void;
  onCreateConversation: (recipientId: string, recipientName: string) => void;
}

const PrivateMessageModal: React.FC<PrivateMessageModalProps> = ({
  onClose,
  onCreateConversation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration - in real app this would come from API
  useEffect(() => {
    const mockPlayers: Player[] = [
      { userId: '1', name: 'SteamEngineer', isOnline: true },
      { userId: '2', name: 'CogMaster', isOnline: true },
      { userId: '3', name: 'BrassWorker', isOnline: false, lastSeen: new Date(Date.now() - 300000) },
      { userId: '4', name: 'GearTurner', isOnline: true },
      { userId: '5', name: 'PipeWelder', isOnline: false, lastSeen: new Date(Date.now() - 3600000) },
      { userId: '6', name: 'ClockMaker', isOnline: true },
      { userId: '7', name: 'SteamPunk', isOnline: false, lastSeen: new Date(Date.now() - 86400000) },
    ];
    
    setPlayers(mockPlayers);
    setFilteredPlayers(mockPlayers);
  }, []);

  // Filter players based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlayers(players);
    } else {
      const filtered = players.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered);
    }
  }, [searchTerm, players]);

  const handlePlayerSelect = (player: Player) => {
    onCreateConversation(player.userId, player.name);
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="private-message-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="private-message-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="title-icon">💬</span>
            Start Private Conversation
          </h3>
          <button
            className="close-button"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="search-section">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search for players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Player List */}
        <div className="player-list-section">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <span>Loading players...</span>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{error}</div>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-message">
                {searchTerm ? 'No players found matching your search.' : 'No players available.'}
              </div>
            </div>
          ) : (
            <div className="player-list">
              {filteredPlayers.map((player) => (
                <button
                  key={player.userId}
                  className={`player-item ${player.isOnline ? 'online' : 'offline'}`}
                  onClick={() => handlePlayerSelect(player)}
                >
                  <div className="player-info">
                    <div className="player-name">
                      <span className={`status-dot ${player.isOnline ? 'online' : 'offline'}`}></span>
                      {player.name}
                    </div>
                    <div className="player-status">
                      {player.isOnline ? (
                        <span className="online-text">Online</span>
                      ) : (
                        <span className="offline-text">
                          {player.lastSeen ? formatLastSeen(player.lastSeen) : 'Offline'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="message-icon">💬</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-text">
            Select a player to start a private conversation
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivateMessageModal;