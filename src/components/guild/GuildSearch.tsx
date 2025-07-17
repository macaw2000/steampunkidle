/**
 * Guild search and discovery component
 */

import React, { useState, useEffect } from 'react';
import { Guild, GuildMember } from '../../types/guild';
import { Character } from '../../types/character';
import './GuildSearch.css';

interface GuildSearchProps {
  character: Character;
  onGuildJoined: (guild: Guild, membership: GuildMember) => void;
}

interface SearchFilters {
  search: string;
  minLevel: string;
  maxLevel: string;
  hasOpenSlots: boolean;
}

export const GuildSearch: React.FC<GuildSearchProps> = ({
  character,
  onGuildJoined,
}) => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    search: '',
    minLevel: '',
    maxLevel: '',
    hasOpenSlots: true,
  });

  useEffect(() => {
    searchGuilds();
  }, []);

  const searchGuilds = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('isPublic', 'true');
      
      if (filters.search.trim()) {
        params.append('search', filters.search.trim());
      }
      if (filters.minLevel) {
        params.append('minLevel', filters.minLevel);
      }
      if (filters.maxLevel) {
        params.append('maxLevel', filters.maxLevel);
      }
      if (filters.hasOpenSlots) {
        params.append('hasOpenSlots', 'true');
      }

      const response = await fetch(`/api/guild/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to search guilds');
      }

      const data = await response.json();
      setGuilds(data.guilds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchGuilds();
  };

  const handleJoinGuild = async (guild: Guild) => {
    if (!guild.settings.requireApproval) {
      // Direct join for open guilds
      try {
        setLoading(true);
        setError(null);

        // For this simplified implementation, we'll assume direct join
        // In a real implementation, you'd need a separate join endpoint
        const mockMembership: GuildMember = {
          guildId: guild.guildId,
          userId: character.userId,
          characterName: character.name,
          role: 'member',
          joinedAt: new Date(),
          permissions: [],
          lastActiveAt: character.lastActiveAt,
        };

        onGuildJoined(guild, mockMembership);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join guild');
      } finally {
        setLoading(false);
      }
    } else {
      // Request to join (would need invitation system)
      alert('This guild requires approval. Contact a guild officer to request an invitation.');
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  return (
    <div className="guild-search">
      <div className="search-header">
        <h2>Find a Guild</h2>
        <p>Discover and join guilds that match your playstyle</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-filters">
          <div className="filter-group">
            <label htmlFor="search" className="filter-label">
              Guild Name
            </label>
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              className="filter-input"
              placeholder="Search by guild name..."
            />
          </div>

          <div className="filter-group">
            <label htmlFor="minLevel" className="filter-label">
              Min Level
            </label>
            <input
              type="number"
              id="minLevel"
              name="minLevel"
              value={filters.minLevel}
              onChange={handleFilterChange}
              className="filter-input"
              min="1"
              max="100"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="maxLevel" className="filter-label">
              Max Level
            </label>
            <input
              type="number"
              id="maxLevel"
              name="maxLevel"
              value={filters.maxLevel}
              onChange={handleFilterChange}
              className="filter-input"
              min="1"
              max="100"
            />
          </div>

          <div className="filter-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="hasOpenSlots"
                checked={filters.hasOpenSlots}
                onChange={handleFilterChange}
                className="filter-checkbox"
              />
              <span>Has Open Slots</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Searching...' : 'Search Guilds'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="search-results">
        {guilds.length === 0 && !loading && (
          <div className="no-results">
            <p>No guilds found matching your criteria.</p>
            <p>Try adjusting your search filters or create your own guild!</p>
          </div>
        )}

        {guilds.map((guild) => (
          <div key={guild.guildId} className="guild-card">
            <div className="guild-info">
              <div className="guild-header">
                <h3 className="guild-name">{guild.name}</h3>
                <div className="guild-level">Level {guild.level}</div>
              </div>
              
              <p className="guild-description">
                {guild.description || 'No description provided.'}
              </p>

              <div className="guild-stats">
                <div className="stat-item">
                  <span className="stat-label">Members</span>
                  <span className="stat-value">
                    {guild.memberCount}/{guild.settings.maxMembers}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Experience</span>
                  <span className="stat-value">{guild.experience}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Created</span>
                  <span className="stat-value">{formatDate(guild.createdAt)}</span>
                </div>
              </div>

              <div className="guild-settings">
                <div className="setting-badge">
                  {guild.settings.isPublic ? 'Public' : 'Private'}
                </div>
                <div className="setting-badge">
                  {guild.settings.requireApproval ? 'Approval Required' : 'Open Join'}
                </div>
                {guild.memberCount < guild.settings.maxMembers && (
                  <div className="setting-badge available">
                    Slots Available
                  </div>
                )}
              </div>
            </div>

            <div className="guild-actions">
              <button
                onClick={() => handleJoinGuild(guild)}
                disabled={loading || guild.memberCount >= guild.settings.maxMembers}
                className="join-button"
              >
                {guild.settings.requireApproval ? 'Request Invite' : 'Join Guild'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuildSearch;