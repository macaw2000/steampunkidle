/**
 * Tests for GuildManager component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GuildManager } from '../GuildManager';
import { Character } from '../../../types/character';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('GuildManager', () => {
  const mockCharacter: Character = {
    userId: 'user-123',
    characterId: 'char-123',
    name: 'TestCharacter',
    level: 10,
    experience: 1000,
    currency: 500,
    stats: {} as any,
    specialization: {} as any,
    currentActivity: {} as any,
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<GuildManager character={mockCharacter} />);

    expect(screen.getByText('Loading guild information...')).toBeInTheDocument();
  });

  it('renders guild creation form when user has no guild', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 404,
      json: async () => ({ guild: null, membership: null }),
    });

    render(<GuildManager character={mockCharacter} />);

    await waitFor(() => {
      expect(screen.getAllByText('Create Guild')).toHaveLength(2); // Tab and button
      expect(screen.getByText('Find Guild')).toBeInTheDocument();
    });
  });

  it('renders guild overview when user has a guild', async () => {
    const mockGuild = {
      guildId: 'guild-123',
      name: 'Test Guild',
      description: 'A test guild',
      leaderId: 'user-123',
      members: [],
      settings: {
        isPublic: true,
        requireApproval: false,
        maxMembers: 50,
        description: '',
        allowedActivities: ['crafting', 'harvesting', 'combat'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      memberCount: 1,
      level: 1,
      experience: 0,
    };

    const mockMembership = {
      userId: 'user-123',
      characterName: 'TestCharacter',
      role: 'leader' as const,
      joinedAt: new Date(),
      permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'] as any[],
      lastActiveAt: new Date(),
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ guild: mockGuild, membership: mockMembership }),
    });

    render(<GuildManager character={mockCharacter} />);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Members (1)')).toBeInTheDocument();
      expect(screen.getByText('Invitations')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<GuildManager character={mockCharacter} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Guild')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('calls onGuildUpdate when guild data changes', async () => {
    const mockOnGuildUpdate = jest.fn();
    const mockGuild = {
      guildId: 'guild-123',
      name: 'Test Guild',
      description: 'A test guild',
      leaderId: 'user-123',
      members: [],
      settings: {
        isPublic: true,
        requireApproval: false,
        maxMembers: 50,
        description: '',
        allowedActivities: ['crafting', 'harvesting', 'combat'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      memberCount: 1,
      level: 1,
      experience: 0,
    };

    const mockMembership = {
      userId: 'user-123',
      characterName: 'TestCharacter',
      role: 'leader' as const,
      joinedAt: new Date(),
      permissions: ['invite', 'kick', 'promote', 'demote', 'edit_settings', 'manage_events'] as any[],
      lastActiveAt: new Date(),
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ guild: mockGuild, membership: mockMembership }),
    });

    render(<GuildManager character={mockCharacter} onGuildUpdate={mockOnGuildUpdate} />);

    await waitFor(() => {
      expect(mockOnGuildUpdate).toHaveBeenCalledWith(mockGuild);
    });
  });
});