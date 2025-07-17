/**
 * Party service for managing party operations and zone/dungeon coordination
 */

import { 
  Party, 
  PartyMember, 
  CreatePartyRequest, 
  JoinPartyRequest, 
  ZoneType, 
  PartyVisibility, 
  PartyRole 
} from '../types/zone';
import { Character } from '../types/character';
import { DatabaseService, TABLE_NAMES } from './databaseService';

export class PartyService {
  /**
   * Create a new party
   */
  static async createParty(request: CreatePartyRequest): Promise<Party> {
    const response = await fetch('/api/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create party');
    }

    const result = await response.json();
    return result.party;
  }

  /**
   * Join an existing party
   */
  static async joinParty(request: JoinPartyRequest): Promise<Party> {
    const response = await fetch(`/api/party/${request.partyId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join party');
    }

    const result = await response.json();
    return result.party;
  }

  /**
   * Leave a party
   */
  static async leaveParty(partyId: string, userId: string): Promise<void> {
    const response = await fetch(`/api/party/${partyId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave party');
    }
  }

  /**
   * Get party by ID
   */
  static async getParty(partyId: string): Promise<Party | null> {
    try {
      const response = await fetch(`/api/party/${partyId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get party');
      }

      const result = await response.json();
      return result.party;
    } catch (error) {
      console.error('Error getting party:', error);
      throw error;
    }
  }

  /**
   * Get parties available for joining
   */
  static async getAvailableParties(
    userId: string,
    type?: ZoneType,
    visibility?: PartyVisibility
  ): Promise<Party[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (visibility) params.append('visibility', visibility);
    
    const response = await fetch(`/api/party/available?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get available parties');
    }

    const result = await response.json();
    return result.parties;
  }

  /**
   * Get user's current party
   */
  static async getUserParty(userId: string): Promise<Party | null> {
    try {
      const response = await fetch(`/api/party/user/${userId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user party');
      }

      const result = await response.json();
      return result.party;
    } catch (error) {
      console.error('Error getting user party:', error);
      throw error;
    }
  }

  /**
   * Update party member readiness
   */
  static async updateMemberReadiness(
    partyId: string, 
    userId: string, 
    isReady: boolean
  ): Promise<Party> {
    const response = await fetch(`/api/party/${partyId}/ready`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, isReady }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update readiness');
    }

    const result = await response.json();
    return result.party;
  }

  /**
   * Update party member role
   */
  static async updateMemberRole(
    partyId: string, 
    userId: string, 
    role: PartyRole
  ): Promise<Party> {
    const response = await fetch(`/api/party/${partyId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update role');
    }

    const result = await response.json();
    return result.party;
  }

  /**
   * Kick a member from party (leader only)
   */
  static async kickMember(
    partyId: string, 
    leaderId: string, 
    memberUserId: string
  ): Promise<Party> {
    const response = await fetch(`/api/party/${partyId}/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leaderId, memberUserId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to kick member');
    }

    const result = await response.json();
    return result.party;
  }

  /**
   * Disband party (leader only)
   */
  static async disbandParty(partyId: string, leaderId: string): Promise<void> {
    const response = await fetch(`/api/party/${partyId}/disband`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leaderId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disband party');
    }
  }

  /**
   * Check if party composition is valid for the content type
   */
  static validatePartyComposition(party: Party): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const roleCount = { tank: 0, healer: 0, dps: 0 };
    
    // Count roles
    party.members.forEach(member => {
      roleCount[member.role]++;
    });

    if (party.type === 'zone') {
      // Zones support 1-3 players, flexible composition
      if (party.members.length < 1 || party.members.length > 3) {
        issues.push('Zone parties must have 1-3 members');
      }
    } else if (party.type === 'dungeon') {
      // Dungeons require 5-8 players with balanced composition
      if (party.members.length < 5 || party.members.length > 8) {
        issues.push('Dungeon parties must have 5-8 members');
      }
      
      // Recommend at least 1 tank and 1 healer for dungeons
      if (party.members.length >= 5) {
        if (roleCount.tank === 0) {
          issues.push('Dungeon parties should have at least 1 tank');
        }
        if (roleCount.healer === 0) {
          issues.push('Dungeon parties should have at least 1 healer');
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get party composition summary
   */
  static getPartyComposition(party: Party) {
    const roleCount = { tank: 0, healer: 0, dps: 0 };
    const readyCount = party.members.filter(m => m.isReady).length;
    
    party.members.forEach(member => {
      roleCount[member.role]++;
    });

    return {
      totalMembers: party.members.length,
      maxMembers: party.maxMembers,
      readyMembers: readyCount,
      roleDistribution: roleCount,
      allReady: readyCount === party.members.length && party.members.length > 0
    };
  }

  /**
   * Check if user can join party
   */
  static canUserJoinParty(party: Party, userLevel: number, userGuildId?: string): { canJoin: boolean; reason?: string } {
    // Check if party is full
    if (party.members.length >= party.maxMembers) {
      return { canJoin: false, reason: 'Party is full' };
    }

    // Check level requirements
    if (userLevel < party.minLevel) {
      return { canJoin: false, reason: `Minimum level required: ${party.minLevel}` };
    }

    if (party.maxLevel && userLevel > party.maxLevel) {
      return { canJoin: false, reason: `Maximum level allowed: ${party.maxLevel}` };
    }

    // Check visibility restrictions
    if (party.visibility === 'guild' && (!userGuildId || userGuildId !== party.guildId)) {
      return { canJoin: false, reason: 'This party is restricted to guild members' };
    }

    if (party.visibility === 'private') {
      return { canJoin: false, reason: 'This party is private' };
    }

    // Check if party is still forming
    if (party.status !== 'forming') {
      return { canJoin: false, reason: 'Party is no longer accepting members' };
    }

    return { canJoin: true };
  }

  /**
   * Get recommended role for user based on their specialization
   */
  static getRecommendedRole(character: Character): PartyRole {
    const spec = character.specialization;
    
    // Find the highest specialization progress
    const maxProgress = Math.max(spec.tankProgress, spec.healerProgress, spec.dpsProgress);
    
    if (spec.tankProgress === maxProgress) return 'tank';
    if (spec.healerProgress === maxProgress) return 'healer';
    return 'dps';
  }
}

export default PartyService;