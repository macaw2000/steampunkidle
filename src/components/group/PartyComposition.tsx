/**
 * Party composition display component
 */

import React from 'react';
import { Party, PartyRole } from '../../types/zone';
import { Character } from '../../types/character';
import { PartyService } from '../../services/partyService';
import './PartyComposition.css';

interface PartyCompositionProps {
  party: Party;
  character: Character;
  isLeader: boolean;
  onKickMember: (memberUserId: string) => void;
}

export const PartyComposition: React.FC<PartyCompositionProps> = ({
  party,
  character,
  isLeader,
  onKickMember
}) => {
  const composition = PartyService.getPartyComposition(party);
  const validation = PartyService.validatePartyComposition(party);

  const getRoleIcon = (role: PartyRole) => {
    switch (role) {
      case 'tank': return '🛡️';
      case 'healer': return '⚕️';
      case 'dps': return '⚔️';
      default: return '👤';
    }
  };

  const getRoleColor = (role: PartyRole) => {
    switch (role) {
      case 'tank': return '#4169e1';
      case 'healer': return '#32cd32';
      case 'dps': return '#dc143c';
      default: return '#d4af37';
    }
  };

  const formatJoinTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just joined';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleKickClick = (memberUserId: string, memberName: string) => {
    if (confirm(`Are you sure you want to kick ${memberName} from the party?`)) {
      onKickMember(memberUserId);
    }
  };

  return (
    <div className="party-composition">
      <div className="composition-header">
        <h4>Party Composition</h4>
        <div className="composition-summary">
          <span className="member-count">
            {composition.totalMembers}/{composition.maxMembers} Members
          </span>
          <span className="ready-count">
            {composition.readyMembers} Ready
          </span>
        </div>
      </div>

      <div className="role-distribution">
        <div className="role-stat">
          <span className="role-icon" style={{ color: getRoleColor('tank') }}>
            {getRoleIcon('tank')}
          </span>
          <span className="role-label">Tanks</span>
          <span className="role-count">{composition.roleDistribution.tank}</span>
        </div>
        
        <div className="role-stat">
          <span className="role-icon" style={{ color: getRoleColor('healer') }}>
            {getRoleIcon('healer')}
          </span>
          <span className="role-label">Healers</span>
          <span className="role-count">{composition.roleDistribution.healer}</span>
        </div>
        
        <div className="role-stat">
          <span className="role-icon" style={{ color: getRoleColor('dps') }}>
            {getRoleIcon('dps')}
          </span>
          <span className="role-label">DPS</span>
          <span className="role-count">{composition.roleDistribution.dps}</span>
        </div>
      </div>

      {!validation.valid && (
        <div className="composition-issues">
          <h5>Composition Issues</h5>
          {validation.issues.map((issue, index) => (
            <div key={index} className="issue">
              ⚠️ {issue}
            </div>
          ))}
        </div>
      )}

      <div className="members-list">
        <h5>Party Members</h5>
        <div className="members-grid">
          {party.members.map((member, index) => (
            <div
              key={index}
              className={`member-card ${member.isReady ? 'ready' : 'not-ready'} ${
                member.userId === character.userId ? 'current-user' : ''
              }`}
            >
              <div className="member-header">
                <div className="member-info">
                  <span
                    className="member-role-icon"
                    style={{ color: getRoleColor(member.role) }}
                  >
                    {getRoleIcon(member.role)}
                  </span>
                  <div className="member-details">
                    <span className="member-name">
                      {member.characterName}
                      {member.userId === party.leaderId && (
                        <span className="leader-crown">👑</span>
                      )}
                      {member.userId === character.userId && (
                        <span className="you-indicator">(You)</span>
                      )}
                    </span>
                    <span className="member-level">Level {member.level}</span>
                  </div>
                </div>
                
                <div className="member-status">
                  {member.isReady ? (
                    <span className="ready-indicator">✅ Ready</span>
                  ) : (
                    <span className="not-ready-indicator">⏳ Not Ready</span>
                  )}
                </div>
              </div>

              <div className="member-footer">
                <span className="join-time">
                  Joined {formatJoinTime(member.joinedAt)}
                </span>
                
                {isLeader && member.userId !== character.userId && (
                  <button
                    className="kick-button"
                    onClick={() => handleKickClick(member.userId, member.characterName)}
                    title="Kick member"
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: composition.maxMembers - composition.totalMembers }).map((_, index) => (
            <div key={`empty-${index}`} className="member-card empty-slot">
              <div className="empty-content">
                <span className="empty-icon">👤</span>
                <span className="empty-text">Open Slot</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {party.type === 'dungeon' && (
        <div className="dungeon-recommendations">
          <h5>Recommended Composition</h5>
          <div className="recommendations">
            <div className="recommendation">
              <span className="rec-role" style={{ color: getRoleColor('tank') }}>
                {getRoleIcon('tank')} 1-2 Tanks
              </span>
            </div>
            <div className="recommendation">
              <span className="rec-role" style={{ color: getRoleColor('healer') }}>
                {getRoleIcon('healer')} 1-2 Healers
              </span>
            </div>
            <div className="recommendation">
              <span className="rec-role" style={{ color: getRoleColor('dps') }}>
                {getRoleIcon('dps')} 3-4 DPS
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyComposition;