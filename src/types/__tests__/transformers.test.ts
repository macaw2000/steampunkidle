/**
 * Unit tests for data transformers
 */

import { DataTransformers } from '../transformers';
import { User, Character, Guild, Item, AuctionListing, ChatMessage } from '../index';

describe('DataTransformers', () => {
  describe('User transformations', () => {
    test('should transform DynamoDB item to User object', () => {
      const dynamoItem = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        socialProviders: [{
          provider: 'google',
          providerId: 'google123',
        }],
        createdAt: '2023-01-01T00:00:00.000Z',
        lastLogin: '2023-01-02T00:00:00.000Z',
      };

      const user = DataTransformers.dynamoToUser(dynamoItem);

      expect(user.userId).toBe(dynamoItem.userId);
      expect(user.email).toBe(dynamoItem.email);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastLogin).toBeInstanceOf(Date);
    });

    test('should transform User object to DynamoDB item', () => {
      const user: User = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        socialProviders: [{
          provider: 'google',
          providerId: 'google123',
        }],
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        lastLogin: new Date('2023-01-02T00:00:00.000Z'),
      };

      const dynamoItem = DataTransformers.userToDynamo(user);

      expect(dynamoItem.userId).toBe(user.userId);
      expect(dynamoItem.email).toBe(user.email);
      expect(typeof dynamoItem.createdAt).toBe('string');
      expect(typeof dynamoItem.lastLogin).toBe('string');
    });
  });

  describe('Character transformations', () => {
    test('should transform DynamoDB item to Character object', () => {
      const dynamoItem = {
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
          craftingSkills: { clockmaking: 5, engineering: 3, alchemy: 2, steamcraft: 4, level: 3, experience: 150 },
          harvestingSkills: { clockmaking: 2, engineering: 1, alchemy: 3, steamcraft: 2, level: 2, experience: 80 },
          combatSkills: { clockmaking: 1, engineering: 2, alchemy: 1, steamcraft: 3, level: 2, experience: 90 },
        },
        specialization: {
          tankProgress: 25,
          healerProgress: 15,
          dpsProgress: 35,
          bonuses: [],
        },
        currentActivity: {
          type: 'crafting',
          startedAt: '2023-01-01T00:00:00.000Z',
          progress: 50,
          rewards: [],
        },
        lastActiveAt: '2023-01-01T12:00:00.000Z',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      const character = DataTransformers.dynamoToCharacter(dynamoItem);

      expect(character.characterId).toBe(dynamoItem.characterId);
      expect(character.name).toBe(dynamoItem.name);
      expect(character.currentActivity.startedAt).toBeInstanceOf(Date);
      expect(character.lastActiveAt).toBeInstanceOf(Date);
      expect(character.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Utility functions', () => {
    test('should sanitize string input', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello<b>World</b>';
      const sanitized = DataTransformers.sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).toBe('alert("xss")HelloWorld');
    });

    test('should format currency correctly', () => {
      expect(DataTransformers.formatCurrency(500)).toBe('500');
      expect(DataTransformers.formatCurrency(1500)).toBe('1.5K');
      expect(DataTransformers.formatCurrency(1500000)).toBe('1.5M');
    });

    test('should calculate experience for level', () => {
      expect(DataTransformers.experienceForLevel(1)).toBe(100);
      expect(DataTransformers.experienceForLevel(2)).toBe(110);
      expect(DataTransformers.experienceForLevel(10)).toBeGreaterThan(200);
    });

    test('should calculate level from experience', () => {
      expect(DataTransformers.levelFromExperience(0)).toBe(1);
      expect(DataTransformers.levelFromExperience(99)).toBe(1); // Just under level 2
      expect(DataTransformers.levelFromExperience(100)).toBe(2); // Exactly enough for level 2
      expect(DataTransformers.levelFromExperience(210)).toBe(3); // Level 3
    });

    test('should calculate specialization progress', () => {
      const character: Character = {
        userId: '123',
        characterId: '456',
        name: 'Test',
        level: 10,
        experience: 1000,
        currency: 0,
        stats: {
          strength: 20,
          dexterity: 15,
          intelligence: 10,
          vitality: 25,
          craftingSkills: { clockmaking: 5, engineering: 3, alchemy: 2, steamcraft: 4, level: 3, experience: 150 },
          harvestingSkills: { mining: 2, foraging: 1, salvaging: 3, crystal_extraction: 2, level: 2, experience: 80 },
          combatSkills: { melee: 1, ranged: 2, defense: 1, tactics: 3, level: 2, experience: 90 },
        },
        specialization: {
          tankProgress: 0,
          healerProgress: 0,
          dpsProgress: 0,
          primaryRole: null,
          secondaryRole: null,
          bonuses: [],
        },
        currentActivity: {
          type: 'crafting',
          startedAt: new Date(),
          progress: 0,
          rewards: [],
        },
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const progress = DataTransformers.calculateSpecializationProgress(character);
      
      expect(progress.tankProgress).toBeGreaterThan(0);
      expect(progress.healerProgress).toBeGreaterThan(0);
      expect(progress.dpsProgress).toBeGreaterThan(0);
      expect(progress.tankProgress).toBeLessThanOrEqual(100);
    });

    test('should get rarity colors', () => {
      expect(DataTransformers.getRarityColor('common')).toBe('#9d9d9d');
      expect(DataTransformers.getRarityColor('legendary')).toBe('#ff8000');
      expect(DataTransformers.getRarityColor('unknown')).toBe('#9d9d9d');
    });

    test('should format duration correctly', () => {
      expect(DataTransformers.formatDuration(30)).toBe('30s');
      expect(DataTransformers.formatDuration(90)).toBe('1m 30s');
      expect(DataTransformers.formatDuration(3661)).toBe('1h 1m');
    });
  });

  describe('AuctionListing transformations', () => {
    test('should add TTL when transforming to DynamoDB', () => {
      const listing: AuctionListing = {
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        sellerId: '123e4567-e89b-12d3-a456-426614174001',
        sellerName: 'TestSeller',
        itemId: '123e4567-e89b-12d3-a456-426614174002',
        itemName: 'Test Item',
        itemRarity: 'common',
        quantity: 1,
        startingPrice: 100,
        bidHistory: [],
        auctionType: 'auction',
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        fees: {
          listingFee: 5,
          successFee: 10,
          totalFees: 15,
        },
      };

      const dynamoItem = DataTransformers.auctionListingToDynamo(listing);
      
      expect(dynamoItem.ttl).toBeDefined();
      expect(typeof dynamoItem.ttl).toBe('number');
      expect(dynamoItem.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('ChatMessage transformations', () => {
    test('should add TTL when transforming to DynamoDB', () => {
      const message: ChatMessage = {
        messageId: '123e4567-e89b-12d3-a456-426614174000',
        channelId: '123e4567-e89b-12d3-a456-426614174001',
        senderId: '123e4567-e89b-12d3-a456-426614174002',
        senderName: 'TestUser',
        content: 'Hello, world!',
        type: 'text',
        timestamp: new Date(),
        isRead: false,
      };

      const dynamoItem = DataTransformers.chatMessageToDynamo(message);
      
      expect(dynamoItem.ttl).toBeDefined();
      expect(typeof dynamoItem.ttl).toBe('number');
      expect(dynamoItem.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});