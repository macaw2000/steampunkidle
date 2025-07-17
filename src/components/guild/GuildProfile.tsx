/**
 * Guild profile display and management component
 */

import React, { useState } from 'react';
import { Guild, GuildMember, UpdateGuildRequest } from '../../types/guild';
import { Character } from '../../types/character';
import './GuildProfile.css';

interface GuildProfileProps {
  guild: Guild;
  membership: GuildMember;
  character: Character;
  onGuildUpdated: (guild: Guild) => void;
  onGuildLeft: () => void;
}

export const GuildProfile: React.FC<GuildProfileProps> = ({
  guild,
  membership,
  character,
  onGuildUpdated,
  onGuildLeft,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: guild.name,
    description: guild.description,
    isPublic: guild.settings.isPublic,
    requireApproval: guild.settings.requireApproval,
    maxMembers: guild.settings.maxMembers,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const canEditSettings = membership.permissions.includes('edit_settings');
  const isLeader = membership.role === 'leader';

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditForm({
        name: guild.name,
        description: guild.description,
        isPublic: guild.settings.isPublic,
        requireApproval: guild.settings.requireApproval,
        maxMembers: guild.settings.maxMembers,
      });
    }
    setIsEditing(!isEditing);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  const handleSaveChanges = async () => {
    if (!editForm.name.trim()) {
      setError('Guild name is required');
      return;
    }

    if (editForm.name.length < 3 || editForm.name.length > 30) {
      setError('Guild name must be between 3 and 30 characters');
      return;
    }

    if (editForm.maxMembers < 5 || editForm.maxMembers > 100) {
      setError('Maximum members must be between 5 and 100');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: UpdateGuildRequest = {
        guildId: guild.guildId,
        name: editForm.name.trim() !== guild.name ? editForm.name.trim() : undefined,
        description: editForm.description.trim() !== guild.description ? editForm.description.trim() : undefined,
        settings: {
          isPublic: editForm.isPublic,
          requireApproval: editForm.requireApproval,
          maxMembers: editForm.maxMembers,
          description: editForm.description.trim(),
          allowedActivities: guild.settings.allowedActivities,
        },
      };

      const response = await fetch(`/api/guild/${guild.guildId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update guild');
      }

      const { guild: updatedGuild } = await response.json();
      onGuildUpdated(updatedGuild);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGuild = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guild/${guild.guildId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave guild');
      }

      onGuildLeft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'leader': return 'Guild Master';
      case 'officer': return 'Officer';
      case 'member': return 'Member';
      default: return role;
    }
  };

  return (
    <div className="guild-profile">
      <div className="guild-header">
        <div className="guild-basic-info">
          <div className="guild-name-section">
            {isEditing ? (
              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleInputChange}
                className="guild-name-input"
                maxLength={30}
              />
            ) : (
              <h1 className="guild-name">{guild.name}</h1>
            )}
            <div className="guild-level">Level {guild.level}</div>
          </div>
          <div className="guild-stats">
            <div className="stat-item">
              <span className="stat-label">Members</span>
              <span className="stat-value">{guild.memberCount}/{guild.settings.maxMembers}</span>
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
        </div>

        <div className="guild-actions">
          {canEditSettings && (
            <button
              onClick={isEditing ? handleSaveChanges : handleEditToggle}
              disabled={loading}
              className="edit-button"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Edit Guild'}
            </button>
          )}
          {isEditing && (
            <button
              onClick={handleEditToggle}
              className="cancel-button"
            >
              Cancel
            </button>
          )}
          {!isLeader && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="leave-button"
            >
              Leave Guild
            </button>
          )}
        </div>
      </div>

      <div className="guild-description-section">
        <h3>Description</h3>
        {isEditing ? (
          <textarea
            name="description"
            value={editForm.description}
            onChange={handleInputChange}
            className="guild-description-input"
            rows={4}
            maxLength={500}
            placeholder="Describe your guild's purpose and goals..."
          />
        ) : (
          <p className="guild-description">
            {guild.description || 'No description provided.'}
          </p>
        )}
      </div>

      <div className="guild-settings-section">
        <h3>Guild Settings</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <span className="setting-label">Visibility</span>
            {isEditing ? (
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={editForm.isPublic}
                  onChange={handleInputChange}
                />
                <span>Public Guild</span>
              </label>
            ) : (
              <span className="setting-value">
                {guild.settings.isPublic ? 'Public' : 'Private'}
              </span>
            )}
          </div>
          <div className="setting-item">
            <span className="setting-label">Join Requirements</span>
            {isEditing ? (
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  name="requireApproval"
                  checked={editForm.requireApproval}
                  onChange={handleInputChange}
                />
                <span>Require Approval</span>
              </label>
            ) : (
              <span className="setting-value">
                {guild.settings.requireApproval ? 'Approval Required' : 'Open Join'}
              </span>
            )}
          </div>
          <div className="setting-item">
            <span className="setting-label">Max Members</span>
            {isEditing ? (
              <input
                type="number"
                name="maxMembers"
                value={editForm.maxMembers}
                onChange={handleNumberChange}
                className="setting-number-input"
                min={5}
                max={100}
              />
            ) : (
              <span className="setting-value">{guild.settings.maxMembers}</span>
            )}
          </div>
        </div>
      </div>

      <div className="member-info-section">
        <h3>Your Membership</h3>
        <div className="membership-details">
          <div className="membership-item">
            <span className="membership-label">Role</span>
            <span className="membership-value role-badge role-{membership.role}">
              {getRoleDisplayName(membership.role)}
            </span>
          </div>
          <div className="membership-item">
            <span className="membership-label">Joined</span>
            <span className="membership-value">{formatDate(membership.joinedAt)}</span>
          </div>
          <div className="membership-item">
            <span className="membership-label">Permissions</span>
            <div className="permissions-list">
              {membership.permissions.length > 0 ? (
                membership.permissions.map(permission => (
                  <span key={permission} className="permission-badge">
                    {permission.replace('_', ' ')}
                  </span>
                ))
              ) : (
                <span className="no-permissions">No special permissions</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showLeaveConfirm && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Leave Guild</h3>
            <p>Are you sure you want to leave {guild.name}? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={handleLeaveGuild}
                disabled={loading}
                className="confirm-button"
              >
                {loading ? 'Leaving...' : 'Yes, Leave Guild'}
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuildProfile;