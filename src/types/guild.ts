/**
 * Guild-related type definitions for the Steampunk Idle Game
 */

export type GuildRole = 'leader' | 'officer' | 'member';
export type GuildPermission = 'invite' | 'kick' | 'promote' | 'demote' | 'edit_settings' | 'manage_events';

export interface GuildMember {
  guildId: string;
  userId: string;
  characterName: string;
  role: GuildRole;
  joinedAt: Date;
  permissions: GuildPermission[];
  lastActiveAt: Date;
}

export interface GuildSettings {
  isPublic: boolean;
  requireApproval: boolean;
  maxMembers: number;
  description: string;
  motd?: string; // Message of the day
  allowedActivities: string[];
}

export interface GuildInvitation {
  invitationId: string;
  guildId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface Guild {
  guildId: string;
  name: string;
  description: string;
  leaderId: string;
  members: GuildMember[];
  settings: GuildSettings;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  level: number;
  experience: number;
}

export interface CreateGuildRequest {
  name: string;
  description: string;
  leaderId: string;
  settings: Partial<GuildSettings>;
}

export interface UpdateGuildRequest {
  guildId: string;
  name?: string;
  description?: string;
  settings?: Partial<GuildSettings>;
}

export interface GuildMembershipRequest {
  guildId: string;
  userId: string;
  role?: GuildRole;
  permissions?: GuildPermission[];
}