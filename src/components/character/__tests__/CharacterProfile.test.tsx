/**
 * Tests for CharacterProfile component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import CharacterProfile from '../CharacterProfile';
import { Character } from '../../../types/character';

// Mock CSS imports
jest.mock('../CharacterProfile.css', () => ({}));

describe('CharacterProfile', () => {
  const mockCharacter: Character = {
    userId: 'test-user-id',
    characterId: 'test-character-id',
    name: 'TestCharacter',
    level: 5,
    experience: 2500,
    currency: 500,
    stats: {
      strength: 15,
      dexterity: 12,
      intelligence: 18,
      vitality: 14,
      craftingSkills: {
        clockmaking: 10,
        engineering: 8,
        alchemy: 12,
        steamcraft: 6,
        level: 5,
        experience: 1200,
      },
      harvestingSkills: {
        clockmaking: 5,
        engineering: 7,
        alchemy: 4,
        steamcraft: 8,
        level: 3,
        experience: 450,
      },
      combatSkills: {
        clockmaking: 8,
        engineering: 6,
        alchemy: 9,
        steamcraft: 11,
        level: 4,
        experience: 850,
      },
    },
    specialization: {
      tankProgress: 30,
      healerProgress: 50,
      dpsProgress: 20,
      primaryRole: 'healer',
      bonuses: [],
    },
    currentActivity: {
      type: 'crafting',
      startedAt: new Date('2023-01-01T10:00:00Z'),
      progress: 75,
      rewards: [],
    },
    lastActiveAt: new Date('2023-01-01T12:00:00Z'),
    createdAt: new Date('2023-01-01T08:00:00Z'),
  };

  it('should render character basic information', () => {
    render(<CharacterProfile character={mockCharacter} />);

    expect(screen.getByText('TestCharacter')).toBeInTheDocument();
    expect(screen.getAllByText('Level 5')).toHaveLength(2); // Character level + Crafting skills level
    expect(screen.getByText('500 Gears')).toBeInTheDocument();
    expect(screen.getByText(/Power: \d+/)).toBeInTheDocument();
  });

  it('should render character avatar placeholder', () => {
    render(<CharacterProfile character={mockCharacter} />);

    // Should show first letter of character name
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should render experience information', () => {
    render(<CharacterProfile character={mockCharacter} />);

    expect(screen.getByText('Experience: 2500 XP')).toBeInTheDocument();
  });

  it('should render current activity', () => {
    render(<CharacterProfile character={mockCharacter} />);

    expect(screen.getByText('Current Activity')).toBeInTheDocument();
    expect(screen.getByText('Crafting')).toBeInTheDocument();
    expect(screen.getByText('Progress: 75%')).toBeInTheDocument();
    expect(screen.getByText(/Started:/)).toBeInTheDocument();
  });

  it('should render base stats when showDetailedStats is true', () => {
    render(<CharacterProfile character={mockCharacter} showDetailedStats={true} />);

    expect(screen.getByText('Base Stats')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
    expect(screen.getAllByText('12')).toHaveLength(2); // Dexterity stat + Crafting alchemy
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Vitality')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('should not render detailed stats when showDetailedStats is false', () => {
    render(<CharacterProfile character={mockCharacter} showDetailedStats={false} />);

    expect(screen.queryByText('Base Stats')).not.toBeInTheDocument();
    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
    expect(screen.queryByText('Specialization Progress')).not.toBeInTheDocument();
  });

  it('should render specialization progress', () => {
    render(<CharacterProfile character={mockCharacter} showDetailedStats={true} />);

    expect(screen.getByText('Specialization Progress')).toBeInTheDocument();
    expect(screen.getByText('Primary Role: Gear Medic')).toBeInTheDocument();
    expect(screen.getByText('Steam Guardian')).toBeInTheDocument();
    expect(screen.getByText('Gear Medic')).toBeInTheDocument();
    expect(screen.getByText('Clockwork Striker')).toBeInTheDocument();
    expect(screen.getByText('Total Progress: 100 points')).toBeInTheDocument();
  });

  it('should not render specialization if no progress', () => {
    const characterWithoutSpecialization = {
      ...mockCharacter,
      specialization: {
        tankProgress: 0,
        healerProgress: 0,
        dpsProgress: 0,
        bonuses: [],
      },
    };

    render(<CharacterProfile character={characterWithoutSpecialization} showDetailedStats={true} />);

    expect(screen.queryByText('Specialization Progress')).not.toBeInTheDocument();
  });

  it('should render skill sets', () => {
    render(<CharacterProfile character={mockCharacter} showDetailedStats={true} />);

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Crafting Skills')).toBeInTheDocument();
    expect(screen.getByText('Harvesting Skills')).toBeInTheDocument();
    expect(screen.getByText('Combat Skills')).toBeInTheDocument();

    // Check crafting skills details - Level 5 appears twice (character level + crafting skills level)
    expect(screen.getAllByText('Level 5')).toHaveLength(2);
    expect(screen.getByText('1200 XP')).toBeInTheDocument(); // Crafting skills experience
  });

  it.skip('should render individual skills within skill sets', () => {
    render(<CharacterProfile character={mockCharacter} showDetailedStats={true} />);

    // Should show individual skill values - use getAllByText since numbers can appear multiple times
    expect(screen.getAllByText('10')).toHaveLength(1); // Crafting clockmaking
    expect(screen.getAllByText('8')).toHaveLength(3); // Crafting engineering + Harvesting steamcraft + Combat clockmaking
    expect(screen.getAllByText('12')).toHaveLength(2); // Crafting alchemy + Dexterity stat
    expect(screen.getAllByText('6')).toHaveLength(2); // Crafting steamcraft + Combat engineering
  });

  it('should render character metadata', () => {
    render(<CharacterProfile character={mockCharacter} />);

    expect(screen.getByText('Created:')).toBeInTheDocument();
    expect(screen.getByText('Last Active:')).toBeInTheDocument();
  });

  it('should handle character without current activity', () => {
    const characterWithoutActivity = {
      ...mockCharacter,
      currentActivity: null,
    };

    render(<CharacterProfile character={characterWithoutActivity as any} />);

    expect(screen.queryByText('Current Activity')).not.toBeInTheDocument();
  });

  it('should calculate and display character power', () => {
    render(<CharacterProfile character={mockCharacter} />);

    // Power = (15+12+18+14)*10 + (5+3+4)*5 = 590 + 60 = 650
    expect(screen.getByText('Power: 650')).toBeInTheDocument();
  });

  it('should format dates correctly', () => {
    render(<CharacterProfile character={mockCharacter} />);

    // Should format dates in locale format - check for specific date elements
    expect(screen.getAllByText(/1\/1\/2023/)).toHaveLength(3); // Created date, last active, and activity started
  });

  it('should show character name initial in avatar', () => {
    const characterWithLowercaseName = {
      ...mockCharacter,
      name: 'testcharacter',
    };

    render(<CharacterProfile character={characterWithLowercaseName} />);

    // Should show uppercase first letter
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should handle specialization without primary role', () => {
    const characterWithoutPrimaryRole = {
      ...mockCharacter,
      specialization: {
        tankProgress: 30,
        healerProgress: 50,
        dpsProgress: 20,
        bonuses: [],
      },
    };

    render(<CharacterProfile character={characterWithoutPrimaryRole} showDetailedStats={true} />);

    expect(screen.getByText('Specialization Progress')).toBeInTheDocument();
    expect(screen.queryByText(/Primary Role:/)).not.toBeInTheDocument();
  });
});