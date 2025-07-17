/**
 * Tests for leaderboard calculation Lambda function
 */

import { handler } from '../calculateLeaderboards';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// Mock the DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock environment variables
process.env.CHARACTERS_TABLE = 'test-characters';
process.env.LEADERBOARDS_TABLE = 'test-leaderboards';
process.env.GUILD_MEMBERS_TABLE = 'test-guild-members';
process.env.GUILDS_TABLE = 'test-guilds';

describe.skip('calculateLeaderboards Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    jest.clearAllMocks();
  });

  const mockCharacters = [
    {
      userId: 'user1',
      characterId: 'char1',
      name: 'TestChar1',
      level: 50,
      experience: 125000,
      currency: 10000,
      stats: {
        strength: 25,
        dexterity: 20,
        intelligence: 30,
        vitality: 25,
        craftingSkills: { level: 40, experience: 80000, clockmaking: 35, engineering: 30, alchemy: 25, steamcraft: 20 },
        harvestingSkills: { level: 35, experience: 60000, clockmaking: 30, engineering: 25, alchemy: 20, steamcraft: 15 },
        combatSkills: { level: 45, experience: 100000, clockmaking: 40, engineering: 35, alchemy: 30, steamcraft: 25 },
      },
      specialization: {
        tankProgress: 60,
        healerProgress: 30,
        dpsProgress: 80,
        primaryRole: 'dps' as const,
        bonuses: [],
      },
      currentActivity: {
        type: 'combat' as const,
        startedAt: new Date(),
        progress: 0.5,
        rewards: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
    },
    {
      userId: 'user2',
      characterId: 'char2',
      name: 'TestChar2',
      level: 60,
      experience: 180000,
      currency: 15000,
      stats: {
        strength: 30,
        dexterity: 25,
        intelligence: 35,
        vitality: 30,
        craftingSkills: { level: 50, experience: 125000, clockmaking: 45, engineering: 40, alchemy: 35, steamcraft: 30 },
        harvestingSkills: { level: 45, experience: 100000, clockmaking: 40, engineering: 35, alchemy: 30, steamcraft: 25 },
        combatSkills: { level: 55, experience: 150000, clockmaking: 50, engineering: 45, alchemy: 40, steamcraft: 35 },
      },
      specialization: {
        tankProgress: 80,
        healerProgress: 40,
        dpsProgress: 60,
        primaryRole: 'tank' as const,
        bonuses: [],
      },
      currentActivity: {
        type: 'crafting' as const,
        startedAt: new Date(),
        progress: 0.3,
        rewards: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
    },
    {
      userId: 'user3',
      characterId: 'char3',
      name: 'TestChar3',
      level: 40,
      experience: 80000,
      currency: 5000,
      stats: {
        strength: 20,
        dexterity: 15,
        intelligence: 25,
        vitality: 20,
        craftingSkills: { level: 30, experience: 45000, clockmaking: 25, engineering: 20, alchemy: 15, steamcraft: 10 },
        harvestingSkills: { level: 25, experience: 30000, clockmaking: 20, engineering: 15, alchemy: 10, steamcraft: 5 },
        combatSkills: { level: 35, experience: 60000, clockmaking: 30, engineering: 25, alchemy: 20, steamcraft: 15 },
      },
      specialization: {
        tankProgress: 40,
        healerProgress: 70,
        dpsProgress: 50,
        primaryRole: 'healer' as const,
        bonuses: [],
      },
      currentActivity: {
        type: 'harvesting' as const,
        startedAt: new Date(),
        progress: 0.8,
        rewards: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
    },
  ];

  it('should calculate leaderboards successfully', async () => {
    // Mock DynamoDB responses
    ddbMock
      .on(ScanCommand, { TableName: 'test-characters' })
      .resolves({ Items: mockCharacters });

    // Mock guild queries (no guilds for simplicity)
    ddbMock
      .on(QueryCommand, { TableName: 'test-guild-members' })
      .resolves({ Items: [] });

    // Mock existing leaderboard entries (empty)
    ddbMock
      .on(QueryCommand, { TableName: 'test-leaderboards' })
      .resolves({ Items: [] });

    // Mock batch write operations
    ddbMock.on(BatchWriteCommand).resolves({});

    const event = {
      httpMethod: 'POST',
      path: '/leaderboard/calculate',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
    };

    const result = await handler(event as any);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Leaderboards updated successfully');
    expect(body.results).toBeDefined();
    expect(typeof body.results).toBe('object');
    
    // Verify that all stat types were processed
    const expectedStatTypes = [
      'level',
      'totalExperience',
      'craftingLevel',
      'harvestingLevel',
      'combatLevel',
      'currency',
      'itemsCreated',
      'zonesCompleted',
      'dungeonsCompleted',
      'guildLevel',
    ];
    
    expectedStatTypes.forEach(statType => {
      expect(body.results[statType]).toBeDefined();
      expect(body.results[statType]).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle empty character list', async () => {
    // Mock empty character scan
    ddbMock
      .on(ScanCommand, { TableName: 'test-characters' })
      .resolves({ Items: [] });

    // Mock existing leaderboard entries (empty)
    ddbMock
      .on(QueryCommand, { TableName: 'test-leaderboards' })
      .resolves({ Items: [] });

    const event = {
      httpMethod: 'POST',
      path: '/leaderboard/calculate',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
    };

    const result = await handler(event as any);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Leaderboards updated successfully');
    expect(body.results).toBeDefined();
    
    // All stat types should have 0 entries
    Object.values(body.results).forEach(count => {
      expect(count).toBe(0);
    });
  });

  it('should handle DynamoDB errors gracefully', async () => {
    // Mock DynamoDB error
    ddbMock
      .on(ScanCommand, { TableName: 'test-characters' })
      .rejects(new Error('DynamoDB error'));

    const event = {
      httpMethod: 'POST',
      path: '/leaderboard/calculate',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
    };

    const result = await handler(event as any);

    expect(result.statusCode).toBe(500);
    
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Internal server error');
    expect(body.message).toBeDefined();
  });

  it('should correctly rank characters by level', async () => {
    // Mock DynamoDB responses
    ddbMock
      .on(ScanCommand, { TableName: 'test-characters' })
      .resolves({ Items: mockCharacters });

    // Mock guild queries (no guilds)
    ddbMock
      .on(QueryCommand, { TableName: 'test-guild-members' })
      .resolves({ Items: [] });

    // Mock existing leaderboard entries (empty)
    ddbMock
      .on(QueryCommand, { TableName: 'test-leaderboards' })
      .resolves({ Items: [] });

    // Capture batch write calls
    const batchWriteCalls: any[] = [];
    ddbMock.on(BatchWriteCommand).callsFake((input) => {
      batchWriteCalls.push(input);
      return Promise.resolve({});
    });

    const event = {
      httpMethod: 'POST',
      path: '/leaderboard/calculate',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
    };

    await handler(event as any);

    // Find the level leaderboard batch write
    const levelBatchWrite = batchWriteCalls.find(call => 
      call.RequestItems['test-leaderboards']?.some((req: any) => 
        req.PutRequest?.Item?.statType === 'level'
      )
    );

    expect(levelBatchWrite).toBeDefined();

    const levelEntries = levelBatchWrite.RequestItems['test-leaderboards']
      .filter((req: any) => req.PutRequest?.Item?.statType === 'level')
      .map((req: any) => req.PutRequest.Item)
      .sort((a: any, b: any) => a.rank - b.rank);

    // Verify correct ranking: user2 (level 60), user1 (level 50), user3 (level 40)
    expect(levelEntries).toHaveLength(3);
    expect(levelEntries[0].rank).toBe(1);
    expect(levelEntries[0].userId).toBe('user2');
    expect(levelEntries[0].statValue).toBe(60);
    
    expect(levelEntries[1].rank).toBe(2);
    expect(levelEntries[1].userId).toBe('user1');
    expect(levelEntries[1].statValue).toBe(50);
    
    expect(levelEntries[2].rank).toBe(3);
    expect(levelEntries[2].userId).toBe('user3');
    expect(levelEntries[2].statValue).toBe(40);
  });

  it('should include guild names when available', async () => {
    // Mock DynamoDB responses
    ddbMock
      .on(ScanCommand, { TableName: 'test-characters' })
      .resolves({ Items: [mockCharacters[0]] }); // Only test with one character

    // Mock guild membership
    ddbMock
      .on(QueryCommand, { 
        TableName: 'test-guild-members',
        IndexName: 'user-guild-index'
      })
      .resolves({ 
        Items: [{ userId: 'user1', guildId: 'guild1' }] 
      });

    // Mock guild details
    ddbMock
      .on(QueryCommand, { TableName: 'test-guilds' })
      .resolves({ 
        Items: [{ guildId: 'guild1', name: 'Test Guild' }] 
      });

    // Mock existing leaderboard entries (empty)
    ddbMock
      .on(QueryCommand, { TableName: 'test-leaderboards' })
      .resolves({ Items: [] });

    // Capture batch write calls
    const batchWriteCalls: any[] = [];
    ddbMock.on(BatchWriteCommand).callsFake((input) => {
      batchWriteCalls.push(input);
      return Promise.resolve({});
    });

    const event = {
      httpMethod: 'POST',
      path: '/leaderboard/calculate',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
    };

    await handler(event as any);

    // Find any leaderboard entry
    const anyBatchWrite = batchWriteCalls.find(call => 
      call.RequestItems['test-leaderboards']?.length > 0
    );

    expect(anyBatchWrite).toBeDefined();

    const entry = anyBatchWrite.RequestItems['test-leaderboards'][0].PutRequest.Item;
    expect(entry.guildName).toBe('Test Guild');
  });
});