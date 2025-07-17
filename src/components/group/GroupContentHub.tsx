/**
 * Main hub for group content - zones and dungeons
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Party, ZoneType } from '../../types/zone';
import { PartyService } from '../../services/partyService';
import { ZoneFinder } from './ZoneFinder';
import { DungeonFinder } from './DungeonFinder';
import { PartyManager } from './PartyManager';
import { CreatePartyModal } from './CreatePartyModal';
import './GroupContentHub.css';

export const GroupContentHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'zones' | 'dungeons' | 'party'>('zones');
  const [currentParty, setCurrentParty] = useState<Party | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { character } = useSelector((state: RootState) => state.game);
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (user?.userId) {
      loadUserParty();
    }
  }, [user?.userId]);

  const loadUserParty = async () => {
    if (!user?.userId) return;
    
    try {
      setLoading(true);
      const party = await PartyService.getUserParty(user.userId);
      setCurrentParty(party);
      
      // If user has a party, switch to party tab
      if (party) {
        setActiveTab('party');
      }
    } catch (err) {
      console.error('Error loading user party:', err);
      setError('Failed to load party information');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = (type: ZoneType) => {
    setShowCreateModal(true);
  };

  const handlePartyCreated = (party: Party) => {
    setCurrentParty(party);
    setActiveTab('party');
    setShowCreateModal(false);
  };

  const handlePartyLeft = () => {
    setCurrentParty(null);
    setActiveTab('zones');
  };

  const handlePartyJoined = (party: Party) => {
    setCurrentParty(party);
    setActiveTab('party');
  };

  if (!character) {
    return (
      <div className="group-content-hub">
        <div className="no-character-message">
          <h3>Character Required</h3>
          <p>You need to create a character before accessing group content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group-content-hub">
      <div className="group-content-header">
        <h2>Group Content</h2>
        <div className="content-tabs">
          <button
            className={`tab-button ${activeTab === 'zones' ? 'active' : ''}`}
            onClick={() => setActiveTab('zones')}
          >
            Zones (1-3 Players)
          </button>
          <button
            className={`tab-button ${activeTab === 'dungeons' ? 'active' : ''}`}
            onClick={() => setActiveTab('dungeons')}
          >
            Dungeons (5-8 Players)
          </button>
          {currentParty && (
            <button
              className={`tab-button ${activeTab === 'party' ? 'active' : ''}`}
              onClick={() => setActiveTab('party')}
            >
              My Party
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="content-area">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'zones' && (
              <ZoneFinder
                character={character}
                currentParty={currentParty}
                onCreateParty={() => handleCreateParty('zone')}
                onJoinParty={handlePartyJoined}
              />
            )}

            {activeTab === 'dungeons' && (
              <DungeonFinder
                character={character}
                currentParty={currentParty}
                onCreateParty={() => handleCreateParty('dungeon')}
                onJoinParty={handlePartyJoined}
              />
            )}

            {activeTab === 'party' && currentParty && (
              <PartyManager
                party={currentParty}
                character={character}
                onPartyUpdate={setCurrentParty}
                onPartyLeft={handlePartyLeft}
              />
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <CreatePartyModal
          character={character}
          onClose={() => setShowCreateModal(false)}
          onPartyCreated={handlePartyCreated}
        />
      )}
    </div>
  );
};

export default GroupContentHub;