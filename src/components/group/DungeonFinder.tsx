/**
 * Dungeon finder component for 5-8 player content
 */

import React, { useState, useEffect } from 'react';
import { Party, ZoneType } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import { PartyCard } from './PartyCard';
import { PartyFilters } from './PartyFilters';
import './DungeonFinder.css';

interface DungeonFinderProps {
  character: Character;
  currentParty: Party | null;
  onCreateParty: () => void;
  onJoinParty: (party: Party) => void;
}

export const DungeonFinder: React.FC<DungeonFinderProps> = ({
  character,
  currentParty,
  onCreateParty,
  onJoinParty
}) => {
  const [availableParties, setAvailableParties] = useState<Party[]>([]);
  const [filteredParties, setFilteredParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    minLevel: 1,
    maxLevel: 100,
    visibility: 'all' as 'all' | 'public' | 'guild',
    hasSpace: true,
    needsRole: 'any' as 'any' | 'tank' | 'healer' | 'dps'
  });

  useEffect(() => {
    loadAvailableParties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [availableParties, filters]);

  const loadAvailableParties = async () => {
    try {
      setLoading(true);
      setError(null);
      const parties = await PartyService.getAvailableParties(
        character.userId,
        'dungeon'
      );
      setAvailableParties(parties);
    } catch (err) {
      console.error('Error loading available parties:', err);
      setError('Failed to load available parties');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...availableParties];

    // Filter by level range
    filtered = filtered.filter(party => {
      const partyMinLevel = party.minLevel;
      const partyMaxLevel = party.maxLevel || 999;
      return character.level >= partyMinLevel && character.level <= partyMaxLevel;
    });

    // Filter by visibility
    if (filters.visibility !== 'all') {
      filtered = filtered.filter(party => party.visibility === filters.visibility);
    }

    // Filter by available space
    if (filters.hasSpace) {
      filtered = filtered.filter(party => party.members.length < party.maxMembers);
    }

    // Filter by needed role
    if (filters.needsRole !== 'any') {
      filtered = filtered.filter(party => {
        const roleCount = { tank: 0, healer: 0, dps: 0 };
        party.members.forEach(member => {
          roleCount[member.role]++;
        });
        
        // Check if the party needs the specified role
        if (filters.needsRole === 'any') return true;
        const maxRecommended = { tank: 2, healer: 2, dps: 4 };
        return roleCount[filters.needsRole] < maxRecommended[filters.needsRole];
      });
    }

    setFilteredParties(filtered);
  };

  const handleJoinParty = async (party: Party) => {
    try {
      setError(null);
      const recommendedRole = PartyService.getRecommendedRole(character);
      
      const updatedParty = await PartyService.joinParty({
        partyId: party.partyId,
        userId: character.userId,
        preferredRole: recommendedRole
      });
      
      onJoinParty(updatedParty);
    } catch (err) {
      console.error('Error joining party:', err);
      setError(err instanceof Error ? err.message : 'Failed to join party');
    }
  };

  const handleRefresh = () => {
    loadAvailableParties();
  };

  const dungeonTypes = [
    {
      name: 'Gear Fortress',
      description: 'A massive mechanical fortress requiring coordinated assault',
      difficulty: 'Hard',
      recommendedLevel: '25-40',
      recommendedComposition: '1-2 Tanks, 1-2 Healers, 3-4 DPS'
    },
    {
      name: 'Steam Cathedral',
      description: 'Sacred halls filled with divine steam-powered mechanisms',
      difficulty: 'Very Hard',
      recommendedLevel: '35-50',
      recommendedComposition: '2 Tanks, 2 Healers, 4 DPS'
    },
    {
      name: 'Mechanized Depths',
      description: 'The deepest mechanical dungeons with ancient constructs',
      difficulty: 'Extreme',
      recommendedLevel: '45-60',
      recommendedComposition: '2 Tanks, 2 Healers, 4 DPS'
    }
  ];

  return (
    <div className="dungeon-finder">
      <div className="dungeon-finder-header">
        <div className="header-content">
          <h3>Dungeon Explorer</h3>
          <p>Challenge the most difficult content with 5-8 players. Coordination and balanced team composition are essential.</p>
        </div>
        <div className="header-actions">
          <button 
            className="create-party-btn"
            onClick={onCreateParty}
            disabled={!!currentParty}
          >
            Create Dungeon Party
          </button>
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {currentParty && (
        <div className="current-party-notice">
          <p>You are currently in a party. Leave your current party to join another.</p>
        </div>
      )}

      <div className="dungeon-types-section">
        <h4>Available Dungeon Types</h4>
        <div className="dungeon-types-grid">
          {dungeonTypes.map((dungeon, index) => (
            <div key={index} className="dungeon-type-card">
              <h5>{dungeon.name}</h5>
              <p className="dungeon-description">{dungeon.description}</p>
              <div className="dungeon-details">
                <div className="detail-row">
                  <span className={`difficulty ${dungeon.difficulty.toLowerCase().replace(' ', '-')}`}>
                    {dungeon.difficulty}
                  </span>
                  <span className="recommended-level">
                    Level {dungeon.recommendedLevel}
                  </span>
                </div>
                <div className="composition-info">
                  <strong>Recommended:</strong> {dungeon.recommendedComposition}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="party-browser">
        <div className="browser-header">
          <h4>Available Dungeon Parties</h4>
          <PartyFilters
            filters={filters}
            onFiltersChange={setFilters}
            maxLevel={character.level + 10}
            showRoleFilter={true}
          />
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading available parties...</p>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="no-parties-message">
            <h5>No Dungeon Parties Available</h5>
            <p>There are currently no dungeon parties matching your criteria.</p>
            <p>Dungeons require careful coordination - consider creating a party and recruiting specific roles!</p>
          </div>
        ) : (
          <div className="parties-grid">
            {filteredParties.map(party => (
              <PartyCard
                key={party.partyId}
                party={party}
                character={character}
                onJoin={() => handleJoinParty(party)}
                disabled={!!currentParty}
                showDetailedComposition={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DungeonFinder;