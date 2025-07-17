/**
 * Unit tests for validation schemas
 */

import {
  UserSchema,
  CreateUserRequestSchema,
  CharacterSchema,
  CreateCharacterRequestSchema,
  GuildSchema,
  CreateGuildRequestSchema,
  ItemSchema,
  AuctionListingSchema,
  CreateAuctionRequestSchema,
  PlaceBidRequestSchema,
  SendMessageRequestSchema,
  CreatePartyRequestSchema,
  LeaderboardQuerySchema,
} from '../validation';

describe('User Validation', () => {
  test('should validate valid user object', () => {
    const validUser = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      socialProviders: [{
        provider: 'google' as const,
        providerId: 'google123',
        email: 'test@example.com',
      }],
      createdAt: new Date(),
      lastLogin: new Date(),
    };

    expect(() => UserSchema.parse(validUser)).not.toThrow();
  });

  test('should reject invalid email', () => {
    const invalidUser = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'invalid-email',
      socialProviders: [],
      createdAt: new Date(),
      lastLogin: new Date(),
    };

    expect(() => UserSchema.parse(invalidUser)).toThrow();
  });

  test('should validate create user request', () => {
    const validRequest = {
      email: 'test@example.com',
      socialProvider: {
        provider: 'facebook' as const,
        providerId: 'fb123',
      },
    };

    expect(() => CreateUserRequestSchema.parse(validRequest)).not.toThrow();
  });
});

describe('Character Validation', () => {
  test('should validate valid character object', () => {
    const validCharacter = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      characterId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'TestCharacter',
      level: 5,
      experience: 1000,
      currency: 500,
      stats: {
        strength: 10,
        dexterity: 8,
        intelligence: 12,
        vitality: 15,
        craftingSkills: {
          clockmaking: 5,
          engineering: 3,
          alchemy: 2,
          steamcraft: 4,
          level: 3,
          experience: 150,
        },
        harvestingSkills: {
          mining: 2,
          foraging: 1,
          salvaging: 3,
          crystal_extraction: 2,
          level: 2,
          experience: 80,
        },
        combatSkills: {
          melee: 1,
          ranged: 2,
          defense: 1,
          tactics: 3,
          level: 2,
          experience: 90,
        },
      },
      specialization: {
        tankProgress: 25,
        healerProgress: 15,
        dpsProgress: 35,
        bonuses: [],
      },
      currentActivity: {
        type: 'crafting' as const,
        startedAt: new Date(),
        progress: 50,
        rewards: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };

    expect(() => CharacterSchema.parse(validCharacter)).not.toThrow();
  });

  test('should reject invalid character name', () => {
    const invalidRequest = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Invalid Name!@#',
    };

    expect(() => CreateCharacterRequestSchema.parse(invalidRequest)).toThrow();
  });

  test('should accept valid character name', () => {
    const validRequest = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Valid_Character-Name123',
    };

    expect(() => CreateCharacterRequestSchema.parse(validRequest)).not.toThrow();
  });
});

describe('Guild Validation', () => {
  test('should validate valid guild object', () => {
    const validGuild = {
      guildId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Guild',
      description: 'A test guild for validation',
      leaderId: '123e4567-e89b-12d3-a456-426614174001',
      members: [{
        userId: '123e4567-e89b-12d3-a456-426614174001',
        characterName: 'Leader',
        role: 'leader' as const,
        joinedAt: new Date(),
        permissions: ['invite' as const, 'kick' as const],
        lastActiveAt: new Date(),
      }],
      settings: {
        isPublic: true,
        requireApproval: false,
        maxMembers: 50,
        description: 'Guild settings description',
        allowedActivities: ['crafting', 'combat'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      memberCount: 1,
      level: 1,
      experience: 0,
    };

    expect(() => GuildSchema.parse(validGuild)).not.toThrow();
  });

  test('should reject guild with too few max members', () => {
    const invalidRequest = {
      name: 'Test Guild',
      description: 'Test description',
      leaderId: '123e4567-e89b-12d3-a456-426614174000',
      settings: {
        maxMembers: 3, // Too few
        isPublic: true,
        requireApproval: false,
        description: 'Test',
        allowedActivities: [],
      },
    };

    expect(() => CreateGuildRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('Item Validation', () => {
  test('should validate valid item object', () => {
    const validItem = {
      itemId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Brass Clockwork Sword',
      description: 'A finely crafted sword with intricate clockwork mechanisms',
      type: 'weapon' as const,
      rarity: 'rare' as const,
      slot: 'mainhand' as const,
      stats: {
        strength: 15,
        dexterity: 5,
        durability: 100,
        maxDurability: 100,
      },
      value: 250,
      stackable: false,
      steampunkTheme: {
        visualStyle: 'brass' as const,
        description: 'Brass and copper construction with visible gears',
        flavorText: 'The gears turn with each swing, building momentum.',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(() => ItemSchema.parse(validItem)).not.toThrow();
  });
});

describe('Auction Validation', () => {
  test('should validate create auction request', () => {
    const validRequest = {
      sellerId: '123e4567-e89b-12d3-a456-426614174000',
      itemId: '123e4567-e89b-12d3-a456-426614174001',
      quantity: 1,
      startingPrice: 100,
      buyoutPrice: 200,
      duration: 24,
      auctionType: 'both' as const,
    };

    expect(() => CreateAuctionRequestSchema.parse(validRequest)).not.toThrow();
  });

  test('should require buyout price for buyout auctions', () => {
    const invalidRequest = {
      sellerId: '123e4567-e89b-12d3-a456-426614174000',
      itemId: '123e4567-e89b-12d3-a456-426614174001',
      quantity: 1,
      startingPrice: 100,
      duration: 24,
      auctionType: 'buyout' as const,
      // Missing buyoutPrice
    };

    expect(() => CreateAuctionRequestSchema.parse(invalidRequest)).toThrow();
  });

  test('should validate place bid request', () => {
    const validRequest = {
      listingId: '123e4567-e89b-12d3-a456-426614174000',
      bidderId: '123e4567-e89b-12d3-a456-426614174001',
      bidAmount: 150,
    };

    expect(() => PlaceBidRequestSchema.parse(validRequest)).not.toThrow();
  });
});

describe('Chat Validation', () => {
  test('should validate send message request', () => {
    const validRequest = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      senderId: '123e4567-e89b-12d3-a456-426614174001',
      content: 'Hello, world!',
      type: 'text' as const,
    };

    expect(() => SendMessageRequestSchema.parse(validRequest)).not.toThrow();
  });

  test('should reject empty message content', () => {
    const invalidRequest = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      senderId: '123e4567-e89b-12d3-a456-426614174001',
      content: '',
    };

    expect(() => SendMessageRequestSchema.parse(invalidRequest)).toThrow();
  });

  test('should reject message content that is too long', () => {
    const invalidRequest = {
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      senderId: '123e4567-e89b-12d3-a456-426614174001',
      content: 'a'.repeat(1001), // Too long
    };

    expect(() => SendMessageRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('Party Validation', () => {
  test('should validate zone party creation', () => {
    const validRequest = {
      leaderId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Zone Exploration',
      type: 'zone' as const,
      visibility: 'public' as const,
      maxMembers: 3,
      minLevel: 5,
    };

    expect(() => CreatePartyRequestSchema.parse(validRequest)).not.toThrow();
  });

  test('should validate dungeon party creation', () => {
    const validRequest = {
      leaderId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Dungeon Run',
      type: 'dungeon' as const,
      visibility: 'guild' as const,
      maxMembers: 5,
      minLevel: 10,
      guildId: '123e4567-e89b-12d3-a456-426614174001',
    };

    expect(() => CreatePartyRequestSchema.parse(validRequest)).not.toThrow();
  });

  test('should reject zone party with too many members', () => {
    const invalidRequest = {
      leaderId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Invalid Zone',
      type: 'zone' as const,
      visibility: 'public' as const,
      maxMembers: 5, // Too many for zone
      minLevel: 5,
    };

    expect(() => CreatePartyRequestSchema.parse(invalidRequest)).toThrow();
  });

  test('should reject dungeon party with too few members', () => {
    const invalidRequest = {
      leaderId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Invalid Dungeon',
      type: 'dungeon' as const,
      visibility: 'public' as const,
      maxMembers: 3, // Too few for dungeon
      minLevel: 10,
    };

    expect(() => CreatePartyRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('Leaderboard Validation', () => {
  test('should validate leaderboard query', () => {
    const validQuery = {
      statType: 'level' as const,
      limit: 50,
      offset: 0,
    };

    expect(() => LeaderboardQuerySchema.parse(validQuery)).not.toThrow();
  });

  test('should reject invalid stat type', () => {
    const invalidQuery = {
      statType: 'invalidStat',
      limit: 50,
    };

    expect(() => LeaderboardQuerySchema.parse(invalidQuery)).toThrow();
  });

  test('should reject limit that is too high', () => {
    const invalidQuery = {
      statType: 'level' as const,
      limit: 150, // Too high
    };

    expect(() => LeaderboardQuerySchema.parse(invalidQuery)).toThrow();
  });
});