/**
 * Guild member list and management component
 */

import React, { useState } from 'react';
import { Guild, GuildMember } from '../../types/guild';
import './GuildMemberList.css';

interface GuildMemberListProps {
  guild: Guild;
  membership: GuildMember;
  onMemberUpdated: () => void;
}

export const GuildMemberList: React.FC<GuildMemberListProps> = ({
  guild,
  membership,
  onMemberUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canKick = membership.permissions.includes('kick');
  const canPromote = membership.permissions.includes('promote');
  const canDemote = membership.permissions.includes('demote');

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'leader': return 'Guild Master';
      case 'officer': return 'Officer';
      case 'member': return 'Member';
      default: return role;
    }
  };

  const handleKickMember = async (member: GuildMember) => {
    if (!window.confirm(`Are you sure you want to kick ${member.characterName} from the guild?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guild/${guild.guildId}/members/${member.userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to kick member');
      }

      onMemberUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteMember = async (member: GuildMember) => {
    const newRole = member.role === 'member' ? 'officer' : 'leader';
    
    if (newRole === 'leader' && !window.confirm(`Are you sure you want to transfer leadership to ${member.characterName}? You will become an officer.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guild/${guild.guildId}/members/${member.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      onMemberUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteMember = async (member: GuildMember) => {
    if (!window.confirm(`Are you sure you want to demote ${member.characterName} to member?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guild/${guild.guildId}/members/${member.userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'member' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      onMemberUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guild-member-list">
      <div className="member-list-header">
        <h2>Guild Members ({guild.memberCount}/{guild.settings.maxMembers})</h2>
        <p>Manage your guild members and their roles</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="members-container">
        {guild.members.map((member) => (
          <div key={member.userId} className="member-card">
            <div className="member-info">
              <div className="member-avatar">
                {member.characterName.charAt(0).toUpperCase()}
              </div>
              <div className="member-details">
                <h3 className="member-name">{member.characterName}</h3>
                <div className="member-role">
                  <span className={`role-badge role-${member.role}`}>
                    {getRoleDisplayName(member.role)}
                  </span>
                </div>
                <div className="member-meta">
                  <span>Joined: {formatDate(member.joinedAt)}</span>
                  <span>Last Active: {formatDate(member.lastActiveAt)}</span>
                </div>
              </div>
            </div>

            <div className="member-actions">
              {member.userId !== membership.userId && (
                <>
                  {canKick && member.role !== 'leader' && (
                    <button
                      onClick={() => handleKickMember(member)}
                      disabled={loading}
                      className="action-button kick-button"
                    >
                      Kick
                    </button>
                  )}
                  {canPromote && member.role === 'member' && (
                    <button
                      onClick={() => handlePromoteMember(member)}
                      disabled={loading}
                      className="action-button promote-button"
                    >
                      Promote
                    </button>
                  )}
                  {canDemote && member.role === 'officer' && membership.role === 'leader' && (
                    <button
                      onClick={() => handleDemoteMember(member)}
                      disabled={loading}
                      className="action-button demote-button"
                    >
                      Demote
                    </button>
                  )}
                  {membership.role === 'leader' && member.role === 'officer' && (
                    <button
                      onClick={() => handlePromoteMember(member)}
                      disabled={loading}
                      className="action-button transfer-button"
                    >
                      Transfer Leadership
                    </button>
                  )}
                </>
              )}
              {member.userId === membership.userId && (
                <span className="you-indicator">You</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuildMemberList;