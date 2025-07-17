/**
 * Modal for creating new parties
 */

import React, { useState } from 'react';
import { Party, ZoneType, PartyVisibility, CreatePartyRequest } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import './CreatePartyModal.css';

interface CreatePartyModalProps {
  character: Character;
  onClose: () => void;
  onPartyCreated: (party: Party) => void;
}

export const CreatePartyModal: React.FC<CreatePartyModalProps> = ({
  character,
  onClose,
  onPartyCreated
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'zone' as ZoneType,
    visibility: 'public' as PartyVisibility,
    maxMembers: 3,
    minLevel: Math.max(1, character.level - 5),
    maxLevel: character.level + 10,
    guildId: '' // TODO: Add guildId to Character interface when guild system is implemented
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTypeChange = (type: ZoneType) => {
    setFormData(prev => ({
      ...prev,
      type,
      maxMembers: type === 'zone' ? 3 : 8
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Party name is required');
      return;
    }

    if (formData.minLevel > formData.maxLevel) {
      setError('Minimum level cannot be higher than maximum level');
      return;
    }

    if (formData.visibility === 'guild' && !formData.guildId) {
      setError('You must be in a guild to create guild-only parties');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: CreatePartyRequest = {
        leaderId: character.userId,
        name: formData.name.trim(),
        type: formData.type,
        visibility: formData.visibility,
        maxMembers: formData.maxMembers,
        minLevel: formData.minLevel,
        maxLevel: formData.maxLevel > 99 ? undefined : formData.maxLevel,
        guildId: formData.visibility === 'guild' ? formData.guildId : undefined
      };

      const party = await PartyService.createParty(request);
      onPartyCreated(party);
    } catch (err) {
      console.error('Error creating party:', err);
      setError(err instanceof Error ? err.message : 'Failed to create party');
    } finally {
      setLoading(false);
    }
  };

  const getMaxMembersOptions = () => {
    if (formData.type === 'zone') {
      return [1, 2, 3];
    } else {
      return [5, 6, 7, 8];
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-party-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Party</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="party-form">
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <div className="form-section">
            <h4>Party Type</h4>
            <div className="type-selection">
              <label className={`type-option ${formData.type === 'zone' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  value="zone"
                  checked={formData.type === 'zone'}
                  onChange={() => handleTypeChange('zone')}
                />
                <div className="type-content">
                  <strong>Zone Party</strong>
                  <span>1-3 players, flexible content</span>
                </div>
              </label>
              
              <label className={`type-option ${formData.type === 'dungeon' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  value="dungeon"
                  checked={formData.type === 'dungeon'}
                  onChange={() => handleTypeChange('dungeon')}
                />
                <div className="type-content">
                  <strong>Dungeon Party</strong>
                  <span>5-8 players, challenging content</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4>Party Details</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Party Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter party name..."
                  maxLength={50}
                  required
                />
              </div>

              <div className="form-group">
                <label>Max Members</label>
                <select
                  value={formData.maxMembers}
                  onChange={(e) => handleInputChange('maxMembers', parseInt(e.target.value))}
                >
                  {getMaxMembersOptions().map(num => (
                    <option key={num} value={num}>{num} players</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Visibility</label>
                <select
                  value={formData.visibility}
                  onChange={(e) => handleInputChange('visibility', e.target.value)}
                >
                  <option value="public">Public - Anyone can join</option>
                  <option value="guild" disabled={true}>
                    Guild Only - Guild members only
                  </option>
                  <option value="private">Private - Invite only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Level Requirements</h4>
            <div className="level-range">
              <div className="form-group">
                <label>Minimum Level</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.minLevel}
                  onChange={(e) => handleInputChange('minLevel', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="range-separator">to</div>

              <div className="form-group">
                <label>Maximum Level</label>
                <input
                  type="number"
                  min={formData.minLevel}
                  max="100"
                  value={formData.maxLevel}
                  onChange={(e) => handleInputChange('maxLevel', parseInt(e.target.value) || 100)}
                />
              </div>
            </div>
            <div className="level-hint">
              Your character level: {character.level}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="create-button" disabled={loading}>
              {loading ? 'Creating...' : 'Create Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePartyModal;