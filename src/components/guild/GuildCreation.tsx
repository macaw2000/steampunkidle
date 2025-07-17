/**
 * Guild creation component
 */

import React, { useState } from 'react';
import { Guild, GuildMember, CreateGuildRequest } from '../../types/guild';
import { Character } from '../../types/character';
import './GuildCreation.css';

interface GuildCreationProps {
  character: Character;
  onGuildCreated: (guild: Guild, membership: GuildMember) => void;
}

export const GuildCreation: React.FC<GuildCreationProps> = ({ 
  character, 
  onGuildCreated 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    requireApproval: false,
    maxMembers: 50,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Guild name is required');
      return;
    }

    if (formData.name.length < 3 || formData.name.length > 30) {
      setError('Guild name must be between 3 and 30 characters');
      return;
    }

    if (formData.maxMembers < 5 || formData.maxMembers > 100) {
      setError('Maximum members must be between 5 and 100');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: CreateGuildRequest = {
        leaderId: character.userId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        settings: {
          isPublic: formData.isPublic,
          requireApproval: formData.requireApproval,
          maxMembers: formData.maxMembers,
          description: formData.description.trim(),
          allowedActivities: ['crafting', 'harvesting', 'combat'],
        },
      };

      const response = await fetch('/api/guild', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create guild');
      }

      const { guild, membership } = await response.json();
      onGuildCreated(guild, membership);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guild-creation">
      <div className="guild-creation-header">
        <h2>Create Your Guild</h2>
        <p>Establish a new guild and become its leader. Recruit members and build your steampunk empire!</p>
      </div>

      <form onSubmit={handleSubmit} className="guild-creation-form">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Guild Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-input"
            placeholder="Enter guild name (3-30 characters)"
            maxLength={30}
            required
          />
          <div className="character-count">
            {formData.name.length}/30 characters
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Guild Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="form-textarea"
            placeholder="Describe your guild's purpose and goals..."
            rows={4}
            maxLength={500}
          />
          <div className="character-count">
            {formData.description.length}/500 characters
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="maxMembers" className="form-label">
            Maximum Members
          </label>
          <input
            type="number"
            id="maxMembers"
            name="maxMembers"
            value={formData.maxMembers}
            onChange={handleNumberChange}
            className="form-input"
            min={5}
            max={100}
          />
          <div className="form-help">
            Set the maximum number of members (5-100)
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleInputChange}
              className="form-checkbox"
            />
            <span className="checkbox-text">Public Guild</span>
          </label>
          <div className="form-help">
            Public guilds appear in search results and can be joined by anyone
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="requireApproval"
              checked={formData.requireApproval}
              onChange={handleInputChange}
              className="form-checkbox"
            />
            <span className="checkbox-text">Require Approval</span>
          </label>
          <div className="form-help">
            New members must be approved by officers or the leader
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="create-button"
          >
            {loading ? 'Creating Guild...' : 'Create Guild'}
          </button>
        </div>
      </form>

      <div className="guild-creation-info">
        <h3>Guild Leadership</h3>
        <p>As the guild leader, you will have the following responsibilities and powers:</p>
        <ul>
          <li>Invite and remove members</li>
          <li>Promote members to officers</li>
          <li>Modify guild settings and description</li>
          <li>Manage guild events and activities</li>
          <li>Transfer leadership to another member</li>
        </ul>
      </div>
    </div>
  );
};

export default GuildCreation;