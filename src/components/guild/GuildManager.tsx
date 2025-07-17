/**
 * Main guild management component
 */

import React, { useState, useEffect } from 'react';
import { Guild, GuildMember, GuildInvitation } from '../../types/guild';
import { Character } from '../../types/character';
import { GuildCreation } from './GuildCreation';
import { GuildProfile } from './GuildProfile';
import { GuildMemberList } from './GuildMemberList';
import { GuildInvitations } from './GuildInvitations';
import { GuildSearch } from './GuildSearch';
import './GuildManager.css';

interface GuildManagerProps {
  character: Character;
  onGuildUpdate?: (guild: Guild | null) => void;
}

interface UserGuildData {
  guild: Guild | null;
  membership: GuildMember | null;
}

export const GuildManager: React.FC<GuildManagerProps> = ({ 
  character, 
  onGuildUpdate 
}) => {
  const [userGuild, setUserGuild] = useState<UserGuildData>({ guild: null, membership: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'invitations' | 'search'>('overview');

  useEffect(() => {
    fetchUserGuild();
  }, [character.userId]);

  const fetchUserGuild = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/guild/my-guild', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserGuild(data);
        onGuildUpdate?.(data.guild);
      } else if (response.status === 404) {
        // User is not in a guild
        setUserGuild({ guild: null, membership: null });
        onGuildUpdate?.(null);
      } else {
        throw new Error('Failed to fetch guild information');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGuildCreated = (guild: Guild, membership: GuildMember) => {
    setUserGuild({ guild, membership });
    onGuildUpdate?.(guild);
    setActiveTab('overview');
  };

  const handleGuildLeft = () => {
    setUserGuild({ guild: null, membership: null });
    onGuildUpdate?.(null);
  };

  const handleGuildUpdated = (updatedGuild: Guild) => {
    setUserGuild(prev => ({ ...prev, guild: updatedGuild }));
    onGuildUpdate?.(updatedGuild);
  };

  const handleGuildJoined = (guild: Guild, membership: GuildMember) => {
    setUserGuild({ guild, membership });
    onGuildUpdate?.(guild);
    setActiveTab('overview');
  };

  if (loading) {
    return (
      <div className="guild-manager loading">
        <div className="loading-spinner">Loading guild information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guild-manager error">
        <div className="error-message">
          <h3>Error Loading Guild</h3>
          <p>{error}</p>
          <button onClick={fetchUserGuild} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // User is not in a guild
  if (!userGuild.guild) {
    return (
      <div className="guild-manager no-guild">
        <div className="guild-tabs">
          <button
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Find Guild
          </button>
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Create Guild
          </button>
        </div>

        <div className="guild-content">
          {activeTab === 'search' && (
            <GuildSearch
              character={character}
              onGuildJoined={handleGuildJoined}
            />
          )}
          {activeTab === 'overview' && (
            <GuildCreation
              character={character}
              onGuildCreated={handleGuildCreated}
            />
          )}
        </div>
      </div>
    );
  }

  // User is in a guild
  return (
    <div className="guild-manager has-guild">
      <div className="guild-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({userGuild.guild.memberCount})
        </button>
        <button
          className={`tab-button ${activeTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          Invitations
        </button>
      </div>

      <div className="guild-content">
        {activeTab === 'overview' && (
          <GuildProfile
            guild={userGuild.guild}
            membership={userGuild.membership!}
            character={character}
            onGuildUpdated={handleGuildUpdated}
            onGuildLeft={handleGuildLeft}
          />
        )}
        {activeTab === 'members' && (
          <GuildMemberList
            guild={userGuild.guild}
            membership={userGuild.membership!}
            onMemberUpdated={fetchUserGuild}
          />
        )}
        {activeTab === 'invitations' && (
          <GuildInvitations
            guild={userGuild.guild}
            membership={userGuild.membership!}
            character={character}
          />
        )}
      </div>
    </div>
  );
};

export default GuildManager;