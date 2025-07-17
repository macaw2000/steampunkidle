/**
 * Zone and dungeon type definitions for the Steampunk Idle Game
 */

export type ZoneType = 'zone' | 'dungeon';
export type PartyVisibility = 'public' | 'guild' | 'private';
export type PartyRole = 'tank' | 'healer' | 'dps';

export interface PartyMember {
  userId: string;
  characterName: string;
  level: number;
  role: PartyRole;
  isReady: boolean;
  joinedAt: Date;
}

export interface Party {
  partyId: string;
  leaderId: string;
  name: string;
  type: ZoneType;
  visibility: PartyVisibility;
  members: PartyMember[];
  maxMembers: number;
  minLevel: number;
  maxLevel?: number;
  guildId?: string; // for guild-only parties
  createdAt: Date;
  status: 'forming' | 'active' | 'completed' | 'disbanded';
}

export interface ZoneInstance {
  instanceId: string;
  partyId: string;
  zoneType: string;
  difficulty: number;
  monsters: ZoneMonster[];
  rewards: ZoneReward[];
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'failed';
}

export interface ZoneMonster {
  monsterId: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  stats: {
    attack: number;
    defense: number;
    speed: number;
  };
  lootTable: ZoneLoot[];
  steampunkTheme: {
    type: 'mechanical' | 'steam' | 'clockwork' | 'alchemical';
    description: string;
  };
}

export interface ZoneLoot {
  itemId: string;
  dropChance: number;
  quantity: number;
}

export interface ZoneReward {
  type: 'experience' | 'currency' | 'item';
  amount: number;
  itemId?: string;
  recipientId: string;
}

export interface CreatePartyRequest {
  leaderId: string;
  name: string;
  type: ZoneType;
  visibility: PartyVisibility;
  maxMembers: number;
  minLevel: number;
  maxLevel?: number;
  guildId?: string;
}

export interface JoinPartyRequest {
  partyId: string;
  userId: string;
  preferredRole: PartyRole;
}