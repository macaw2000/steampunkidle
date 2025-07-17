/**
 * Party card component for displaying party information
 */

import React from 'react';
import { Party, PartyRole } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import './PartyCard.css';

interface PartyCardProps {
  party: Party;
  character: Character;
  onJoin: () => void;
  disabled?: boolean;
  showDetailedComposition?: boolean;
}

export const PartyCard: React.FC<PartyCardProps> = ({
  party,
  character,
  onJoin,
  disabled = false,
  showDetailedComposition = false
}) => {
  const composition = PartyService.getPartyComposition(party);
  const validation = PartyService.validatePartyComposition(party);
  const canJoin = PartyService.canUserJoinParty(party, character.level, undefined); // TODO: Add guildId to Character interface

  const getRoleIcon = (role: PartyRole) => {
    switch (role) {
      case 'tank': return '🛡️';
      case 'healer': return '⚕️';
      case 'dps': return '⚔️';
      default: return '👤';
    }
  };

  const getVisibilityIcon = () => {
    switch (party.visibility) {
      case 'public': return '🌐';
      case 'guild': return '🏰';
      case 'private': return '🔒';
      default: return '👥';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className={`party-card ${party.type}`}>
      <div className="party-header">
        <div className="party-title">
          <h4>{party.name}</h4>
          <div className="party-meta">
            <span className="visibility">
              {getVisibilityIcon()} {party.visibility}
            </span>
            <span className="created-time">
              Created {formatTimeAgo(party.createdAt)}
            </span>
          </div>
        </div>
        <div className="party-type-badge">
          {party.type === 'zone' ? 'Zone' : 'Dungeon'}
        </div>
      </div>

      <div className="party-info">
        <div className="level-range">
          <strong>Level Range:</strong> {party.minLevel}
          {party.maxLevel ? ` - ${party.maxLevel}` : '+'}
        </div>
        
        <div className="member-count">
          <strong>Members:</strong> {composition.totalMembers}/{composition.maxMembers}
          {composition.readyMembers > 0 && (
            <span className="ready-count">
              ({composition.readyMembers} ready)
            </span>
          )}
        </div>

        {party.guildId && (
          <div className="guild-info">
            <strong>Guild Only</strong>
          </div>
        )}
      </div>

      <div className="party-composition">
        <div className="composition-header">
          <strong>Party Composition</strong>
        </div>
        
        {showDetailedComposition ? (
          <div className="detailed-composition">
            <div className="role-breakdown">
              <div className="role-count">
                <span className="role-icon">{getRoleIcon('tank')}</span>
                <span>Tanks: {composition.roleDistribution.tank}</span>
              </div>
              <div className="role-count">
                <span className="role-icon">{getRoleIcon('healer')}</span>
                <span>Healers: {composition.roleDistribution.healer}</span>
              </div>
              <div className="role-count">
                <span className="role-icon">{getRoleIcon('dps')}</span>
                <span>DPS: {composition.roleDistribution.dps}</span>
              </div>
            </div>
            
            {!validation.valid && (
              <div className="composition-warnings">
                {validation.issues.map((issue, index) => (
                  <div key={index} className="warning">
                    ⚠️ {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="simple-composition">
            <div className="role-icons">
              {party.members.map((member, index) => (
                <span key={index} className="member-role" title={`${member.characterName} (${member.role})`}>
                  {getRoleIcon(member.role)}
                </span>
              ))}
              {Array.from({ length: composition.maxMembers - composition.totalMembers }).map((_, index) => (
                <span key={`empty-${index}`} className="empty-slot">
                  ⭕
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="party-members">
        <div className="members-header">
          <strong>Members</strong>
        </div>
        <div className="members-list">
          {party.members.map((member, index) => (
            <div key={index} className={`member ${member.isReady ? 'ready' : 'not-ready'}`}>
              <span className="member-role-icon">{getRoleIcon(member.role)}</span>
              <span className="member-name">{member.characterName}</span>
              <span className="member-level">Lv.{member.level}</span>
              {member.userId === party.leaderId && (
                <span className="leader-badge">👑</span>
              )}
              {member.isReady && (
                <span className="ready-indicator">✅</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="party-actions">
        {canJoin.canJoin ? (
          <button
            className="join-button"
            onClick={onJoin}
            disabled={disabled}
          >
            Join Party
          </button>
        ) : (
          <div className="cannot-join">
            <button className="join-button disabled" disabled>
              Cannot Join
            </button>
            <div className="join-reason">
              {canJoin.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartyCard;