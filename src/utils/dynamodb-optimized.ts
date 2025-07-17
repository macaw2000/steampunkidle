import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand, 
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  GetCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { cache, CacheKeys, getOrSetCache } from './cache';

// Optimized DynamoDB client with connection reuse
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  maxAttempts: 3,
  retryMode: 'adaptive',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Optimized query operations with caching
export class OptimizedDynamoDB {
  
  // Get item with caching
  static async getItem<T>(
    tableName: string,
    key: Record<string, any>,
    cacheKey?: string,
    cacheTtl: number = 300
  ): Promise<T | null> {
    if (cacheKey) {
      return getOrSetCache(
        cacheKey,
        async () => {
          const result = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: key,
          }));
          return result.Item as T || null;
        },
        cacheTtl
      );
    }
    
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: key,
    }));
    
    return result.Item as T || null;
  }
  
  // Batch get items with caching
  static async batchGetItems<T>(
    tableName: string,
    keys: Record<string, any>[],
    cacheKeyPrefix?: string,
    cacheTtl: number = 300
  ): Promise<T[]> {
    if (cacheKeyPrefix) {
      // Check cache for each item first
      const cachedItems: T[] = [];
      const uncachedKeys: Record<string, any>[] = [];
      
      for (const key of keys) {
        const cacheKey = `${cacheKeyPrefix}:${JSON.stringify(key)}`;
        const cached = cache.get<T>(cacheKey);
        if (cached) {
          cachedItems.push(cached);
        } else {
          uncachedKeys.push(key);
        }
      }
      
      // Fetch uncached items
      if (uncachedKeys.length > 0) {
        const result = await docClient.send(new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: uncachedKeys,
            },
          },
        }));
        
        const fetchedItems = result.Responses?.[tableName] as T[] || [];
        
        // Cache the fetched items
        fetchedItems.forEach((item, index) => {
          const cacheKey = `${cacheKeyPrefix}:${JSON.stringify(uncachedKeys[index])}`;
          cache.set(cacheKey, item, cacheTtl);
        });
        
        return [...cachedItems, ...fetchedItems];
      }
      
      return cachedItems;
    }
    
    // No caching, direct batch get
    const result = await docClient.send(new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: keys,
        },
      },
    }));
    
    return result.Responses?.[tableName] as T[] || [];
  }
  
  // Put item with cache invalidation
  static async putItem(
    tableName: string,
    item: Record<string, any>,
    cacheKeysToInvalidate?: string[]
  ): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item,
    }));
    
    // Invalidate related cache entries
    if (cacheKeysToInvalidate) {
      cacheKeysToInvalidate.forEach(key => cache.delete(key));
    }
  }
  
  // Update item with cache invalidation
  static async updateItem(
    tableName: string,
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    cacheKeysToInvalidate?: string[]
  ): Promise<any> {
    const result = await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    }));
    
    // Invalidate related cache entries
    if (cacheKeysToInvalidate) {
      cacheKeysToInvalidate.forEach(cacheKey => cache.delete(cacheKey));
    }
    
    return result.Attributes;
  }
  
  // Query with caching and pagination optimization
  static async query<T>(
    params: QueryCommandInput,
    cacheKey?: string,
    cacheTtl: number = 300
  ): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
    if (cacheKey && !params.ExclusiveStartKey) {
      // Only cache first page of results
      return getOrSetCache(
        cacheKey,
        async () => {
          const result = await docClient.send(new QueryCommand(params));
          return {
            items: result.Items as T[] || [],
            lastEvaluatedKey: result.LastEvaluatedKey,
          };
        },
        cacheTtl
      );
    }
    
    const result = await docClient.send(new QueryCommand(params));
    return {
      items: result.Items as T[] || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
  
  // Optimized scan with parallel processing for large tables
  static async parallelScan<T>(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    segments: number = 4
  ): Promise<T[]> {
    const scanPromises = [];
    
    for (let segment = 0; segment < segments; segment++) {
      const params: ScanCommandInput = {
        TableName: tableName,
        Segment: segment,
        TotalSegments: segments,
      };
      
      if (filterExpression) {
        params.FilterExpression = filterExpression;
        params.ExpressionAttributeValues = expressionAttributeValues;
      }
      
      scanPromises.push(docClient.send(new ScanCommand(params)));
    }
    
    const results = await Promise.all(scanPromises);
    const allItems: T[] = [];
    
    results.forEach(result => {
      if (result.Items) {
        allItems.push(...(result.Items as T[]));
      }
    });
    
    return allItems;
  }
  
  // Batch write with automatic chunking
  static async batchWrite(
    tableName: string,
    items: Array<{ action: 'PUT' | 'DELETE'; item?: Record<string, any>; key?: Record<string, any> }>,
    cacheKeysToInvalidate?: string[]
  ): Promise<void> {
    const BATCH_SIZE = 25; // DynamoDB limit
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const requestItems = batch.map(({ action, item, key }) => {
        if (action === 'PUT' && item) {
          return { PutRequest: { Item: item } };
        } else if (action === 'DELETE' && key) {
          return { DeleteRequest: { Key: key } };
        }
        throw new Error('Invalid batch write item');
      });
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: requestItems,
        },
      }));
    }
    
    // Invalidate cache entries
    if (cacheKeysToInvalidate) {
      cacheKeysToInvalidate.forEach(key => cache.delete(key));
    }
  }
  
  // Transaction helper (for operations that need ACID properties)
  static async transactWrite(operations: any[]): Promise<void> {
    // This would use TransactWriteCommand for ACID transactions
    // Implementation depends on specific transaction requirements
    console.log('Transaction write operations:', operations.length);
  }
}

// Specific optimized operations for common patterns
export class GameDataOptimized {
  
  // Get character with caching
  static async getCharacter(userId: string) {
    return OptimizedDynamoDB.getItem(
      process.env.CHARACTERS_TABLE!,
      { userId },
      CacheKeys.character(userId),
      600 // 10 minutes cache
    );
  }
  
  // Get guild with member count caching
  static async getGuildWithMembers(guildId: string) {
    const [guild, members] = await Promise.all([
      OptimizedDynamoDB.getItem(
        process.env.GUILDS_TABLE!,
        { guildId },
        CacheKeys.guild(guildId),
        600
      ),
      OptimizedDynamoDB.query(
        {
          TableName: process.env.GUILD_MEMBERS_TABLE!,
          KeyConditionExpression: 'guildId = :guildId',
          ExpressionAttributeValues: { ':guildId': guildId },
        },
        CacheKeys.guildMembers(guildId),
        300
      ),
    ]);
    
    return { guild, members: members.items };
  }
  
  // Get active auctions with caching
  static async getActiveAuctions(limit: number = 50) {
    return OptimizedDynamoDB.query(
      {
        TableName: process.env.AUCTION_LISTINGS_TABLE!,
        IndexName: 'status-expires-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'active' },
        Limit: limit,
        ScanIndexForward: true, // Sort by expiration time
      },
      CacheKeys.activeAuctions(),
      120 // 2 minutes cache for active auctions
    );
  }
  
  // Get leaderboard with caching
  static async getLeaderboard(statType: string, limit: number = 100) {
    return OptimizedDynamoDB.query(
      {
        TableName: process.env.LEADERBOARDS_TABLE!,
        KeyConditionExpression: 'statType = :statType',
        ExpressionAttributeValues: { ':statType': statType },
        Limit: limit,
        ScanIndexForward: true, // Sort by rank
      },
      CacheKeys.leaderboard(statType),
      300 // 5 minutes cache
    );
  }
}