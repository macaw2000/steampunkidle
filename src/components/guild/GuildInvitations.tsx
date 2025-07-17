/**
 * Guild invitations management component
 */

import React, { useState } from 'react';
import { Guild, GuildMember } from '../../types/guild';
import { Character } from '../../types/character';
import './GuildInvitations.css';

interface GuildInvitationsProps {
  guild: Guild;
  membership: GuildMember;
  character: Character;
}

export const GuildInvitations: React.FC<GuildInvitationsProps> = ({
  guild,
  membership,
  character,
}) => {
  const [inviteeName, setInviteeName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canInvite = membership.permissions.includes('invite');

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteeName.trim()) {
      setError('Character name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // For this implementation, we'll assume the inviteeId is the character name
      // In a real implementation, you'd need to look up the user ID by character name
      const response = await fetch(`/api/guild/${guild.guildId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteeId: inviteeName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const data = await response.json();
      setSuccess(`Invitation sent to ${data.inviteeCharacterName}!`);
      setInviteeName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guild-invitations">
      <div className="invitations-header">
        <h2>Guild Invitations</h2>
        <p>Manage guild invitations and recruit new members</p>
      </div>

      {canInvite ? (
        <div className="invite-section">
          <h3>Send Invitation</h3>
          <form onSubmit={handleSendInvitation} className="invite-form">
            <div className="form-group">
              <label htmlFor="inviteeName" className="form-label">
                Character Name
              </label>
              <input
                type="text"
                id="inviteeName"
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
                className="form-input"
                placeholder="Enter character name to invite"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !inviteeName.trim()}
              className="invite-button"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      ) : (
        <div className="no-permission">
          <p>You don't have permission to send guild invitations.</p>
          <p>Contact a guild officer or the guild master for assistance.</p>
        </div>
      )}

      <div className="invitation-info">
        <h3>Invitation Guidelines</h3>
        <ul>
          <li>Invitations expire after 7 days</li>
          <li>Players can only be in one guild at a time</li>
          <li>Guild must have available slots ({guild.memberCount}/{guild.settings.maxMembers})</li>
          <li>Invited players will receive a notification</li>
          <li>Players can accept or decline invitations</li>
        </ul>
      </div>

      <div className="guild-settings-info">
        <h3>Current Guild Settings</h3>
        <div className="settings-summary">
          <div className="setting-item">
            <span className="setting-label">Visibility:</span>
            <span className="setting-value">
              {guild.settings.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Join Requirements:</span>
            <span className="setting-value">
              {guild.settings.requireApproval ? 'Approval Required' : 'Open Join'}
            </span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Available Slots:</span>
            <span className="setting-value">
              {guild.settings.maxMembers - guild.memberCount} remaining
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuildInvitations;