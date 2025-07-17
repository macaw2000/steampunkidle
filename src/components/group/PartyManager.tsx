/**
 * Party manager component for managing current party
 */

import React, { useState, useEffect } from 'react';
import { Party, PartyRole, ZoneInstance } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import { ZoneService } from '../../services/zoneService';
import PartyComposition from './PartyComposition';
import ZoneInterface from './ZoneInterface';
import './PartyManager.css';

interface PartyManagerProps {
  party: Party;
  character: Character;
  onPartyUpdate: (party: Party) => void;
  onPartyLeft: () => void;
}

export const PartyManager: React.FC<PartyManagerProps> = ({
  party,
  character,
  onPartyUpdate,
  onPartyLeft
}) => {
  const [currentZone, setCurrentZone] = useState<ZoneInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PartyRole>('dps');

  const isLeader = party.leaderId === character.userId;
  const currentMember = party.members.find(m => m.userId === character.userId);
  const composition = PartyService.getPartyComposition(party);
  const validation = PartyService.validatePartyComposition(party);

  useEffect(() => {
    if (currentMember) {
      setSelectedRole(currentMember.role);
    }
  }, [currentMember]);

  const handleRoleChange = async (newRole: PartyRole) => {
    try {
      setError(null);
      const updatedParty = await PartyService.updateMemberRole(
        party.partyId,
        character.userId,
        newRole
      );
      onPartyUpdate(updatedParty);
      setSelectedRole(newRole);
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleReadinessToggle = async () => {
    if (!currentMember) return;
    
    try {
      setError(null);
      const updatedParty = await PartyService.updateMemberReadiness(
        party.partyId,
        character.userId,
        !currentMember.isReady
      );
      onPartyUpdate(updatedParty);
    } catch (err) {
      console.error('Error updating readiness:', err);
      setError(err instanceof Error ? err.message : 'Failed to update readiness');
    }
  };

  const handleKickMember = async (memberUserId: string) => {
    if (!isLeader) return;
    
    try {
      setError(null);
      const updatedParty = await PartyService.kickMember(
        party.partyId,
        character.userId,
        memberUserId
      );
      onPartyUpdate(updatedParty);
    } catch (err) {
      console.error('Error kicking member:', err);
      setError(err instanceof Error ? err.message : 'Failed to kick member');
    }
  };

  const handleLeaveParty = async () => {
    try {
      setError(null);
      await PartyService.leaveParty(party.partyId, character.userId);
      onPartyLeft();
    } catch (err) {
      console.error('Error leaving party:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave party');
    }
  };

  const handleDisbandParty = async () => {
    if (!isLeader) return;
    
    if (!confirm('Are you sure you want to disband this party? This action cannot be undone.')) {
      return;
    }
    
    try {
      setError(null);
      await PartyService.disbandParty(party.partyId, character.userId);
      onPartyLeft();
    } catch (err) {
      console.error('Error disbanding party:', err);
      setError(err instanceof Error ? err.message : 'Failed to disband party');
    }
  };

  const handleStartZone = async () => {
    if (!isLeader || !composition.allReady) return;
    
    try {
      setLoading(true);
      setError(null);
      const zoneInstance = await ZoneService.startZoneInstance(party.partyId);
      setCurrentZone(zoneInstance);
    } catch (err) {
      console.error('Error starting zone:', err);
      setError(err instanceof Error ? err.message : 'Failed to start zone');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneComplete = () => {
    setCurrentZone(null);
  };

  const getRoleIcon = (role: PartyRole) => {
    switch (role) {
      case 'tank': return '🛡️';
      case 'healer': return '⚕️';
      case 'dps': return '⚔️';
      default: return '👤';
    }
  };

  if (currentZone) {
    return (
      <ZoneInterface
        zoneInstance={currentZone}
        party={party}
        character={character}
        onComplete={handleZoneComplete}
        onLeave={() => setCurrentZone(null)}
      />
    );
  }

  return (
    <div className="party-manager">
      <div className="party-header">
        <div className="party-info">
          <h3>{party.name}</h3>
          <div className="party-meta">
            <span className="party-type">{party.type === 'zone' ? 'Zone Party' : 'Dungeon Party'}</span>
            <span className="party-status">{party.status}</span>
            {isLeader && <span className="leader-badge">👑 Leader</span>}
          </div>
        </div>
        
        <div className="party-actions">
          {isLeader && composition.allReady && validation.valid && (
            <button
              className="start-zone-btn"
              onClick={handleStartZone}
              disabled={loading}
            >
              {loading ? 'Starting...' : `Start ${party.type === 'zone' ? 'Zone' : 'Dungeon'}`}
            </button>
          )}
          
          <button className="leave-party-btn" onClick={handleLeaveParty}>
            Leave Party
          </button>
          
          {isLeader && (
            <button className="disband-party-btn" onClick={handleDisbandParty}>
              Disband Party
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

      <div className="party-content">
        <div className="party-composition-section">
          <PartyComposition
            party={party}
            character={character}
            isLeader={isLeader}
            onKickMember={handleKickMember}
          />
        </div>

        <div className="party-controls">
          <div className="role-selection">
            <h4>Your Role</h4>
            <div className="role-options">
              {(['tank', 'healer', 'dps'] as PartyRole[]).map(role => (
                <label key={role} className={`role-option ${selectedRole === role ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={() => handleRoleChange(role)}
                  />
                  <span className="role-icon">{getRoleIcon(role)}</span>
                  <span className="role-name">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="readiness-control">
            <h4>Ready Status</h4>
            <label className="readiness-toggle">
              <input
                type="checkbox"
                checked={currentMember?.isReady || false}
                onChange={handleReadinessToggle}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                {currentMember?.isReady ? 'Ready' : 'Not Ready'}
              </span>
            </label>
          </div>

          {!validation.valid && (
            <div className="composition-warnings">
              <h4>Party Composition Issues</h4>
              {validation.issues.map((issue, index) => (
                <div key={index} className="warning">
                  ⚠️ {issue}
                </div>
              ))}
            </div>
          )}

          {isLeader && !composition.allReady && (
            <div className="leader-notice">
              <h4>Waiting for Members</h4>
              <p>All party members must be ready before you can start the {party.type}.</p>
            </div>
          )}

          {isLeader && composition.allReady && validation.valid && (
            <div className="ready-notice">
              <h4>Party Ready!</h4>
              <p>All members are ready. You can now start the {party.type}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartyManager;