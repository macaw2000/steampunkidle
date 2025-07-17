/**
 * Zone finder component for 1-3 player content
 */

import React, { useState, useEffect } from 'react';
import { Party, ZoneType } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import { PartyCard } from './PartyCard';
import { PartyFilters } from './PartyFilters';
import './ZoneFinder.css';

interface ZoneFinderProps {
  character: Character;
  currentParty: Party | null;
  onCreateParty: () => void;
  onJoinParty: (party: Party) => void;
}

export const ZoneFinder: React.FC<ZoneFinderProps> = ({
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
    hasSpace: true
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
        'zone'
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

  const zoneTypes = [
    {
      name: 'Steam Caverns',
      description: 'Misty caverns filled with steam vents and mechanical creatures',
      difficulty: 'Easy',
      recommendedLevel: '1-15'
    },
    {
      name: 'Clockwork Ruins',
      description: 'Ancient mechanical ruins with clockwork guardians',
      difficulty: 'Medium',
      recommendedLevel: '10-25'
    },
    {
      name: 'Alchemical Gardens',
      description: 'Twisted gardens where alchemy has run wild',
      difficulty: 'Hard',
      recommendedLevel: '20-35'
    }
  ];

  return (
    <div className="zone-finder">
      <div className="zone-finder-header">
        <div className="header-content">
          <h3>Zone Explorer</h3>
          <p>Explore zones with 1-3 players. Perfect for smaller groups and solo adventurers.</p>
        </div>
        <div className="header-actions">
          <button 
            className="create-party-btn"
            onClick={onCreateParty}
            disabled={!!currentParty}
          >
            Create Zone Party
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

      <div className="zone-types-section">
        <h4>Available Zone Types</h4>
        <div className="zone-types-grid">
          {zoneTypes.map((zone, index) => (
            <div key={index} className="zone-type-card">
              <h5>{zone.name}</h5>
              <p className="zone-description">{zone.description}</p>
              <div className="zone-details">
                <span className={`difficulty ${zone.difficulty.toLowerCase()}`}>
                  {zone.difficulty}
                </span>
                <span className="recommended-level">
                  Level {zone.recommendedLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="party-browser">
        <div className="browser-header">
          <h4>Available Zone Parties</h4>
          <PartyFilters
            filters={filters}
            onFiltersChange={setFilters}
            maxLevel={character.level + 10}
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
            <h5>No Zone Parties Available</h5>
            <p>There are currently no zone parties matching your criteria.</p>
            <p>Why not create your own party to get started?</p>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneFinder;