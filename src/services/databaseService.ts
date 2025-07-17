/**
 * Database access layer for DynamoDB operations with error handling
 */

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
  TransactWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  ResourceNotFoundException,
  ProvisionedThroughputExceededException,
  ItemCollectionSizeLimitExceededException,
} from '@aws-sdk/client-dynamodb';

// Custom error types
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ItemNotFoundError extends DatabaseError {
  constructor(tableName: string, key: string) {
    super(`Item not found in ${tableName} with key: ${key}`);
    this.name = 'ItemNotFoundError';
  }
}

export class ConditionalCheckError extends DatabaseError {
  constructor(message: string = 'Conditional check failed') {
    super(message);
    this.name = 'ConditionalCheckError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ThrottlingError extends DatabaseError {
  constructor(message: string = 'Request was throttled') {
    super(message);
    this.name = 'ThrottlingError';
  }
}

// Database configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.LOCALSTACK_ENDPOINT && {
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Table names from environment variables
export const TABLE_NAMES = {
  USERS: process.env.USERS_TABLE || 'steampunk-idle-game-users',
  CHARACTERS: process.env.CHARACTERS_TABLE || 'steampunk-idle-game-characters',
  GUILDS: process.env.GUILDS_TABLE || 'steampunk-idle-game-guilds',
  GUILD_MEMBERS: process.env.GUILD_MEMBERS_TABLE || 'steampunk-idle-game-guild-members',
  GUILD_INVITATIONS: process.env.GUILD_INVITATIONS_TABLE || 'steampunk-idle-game-guild-invitations',
  ITEMS: process.env.ITEMS_TABLE || 'steampunk-idle-game-items',
  INVENTORY: process.env.INVENTORY_TABLE || 'steampunk-idle-game-inventory',
  AUCTION_LISTINGS: process.env.AUCTION_LISTINGS_TABLE || 'steampunk-idle-game-auction-listings',
  CHAT_MESSAGES: process.env.CHAT_MESSAGES_TABLE || 'steampunk-idle-game-chat-messages',
  LEADERBOARDS: process.env.LEADERBOARDS_TABLE || 'steampunk-idle-game-leaderboards',
  PARTIES: process.env.PARTIES_TABLE || 'steampunk-idle-game-parties',
  ZONE_INSTANCES: process.env.ZONE_INSTANCES_TABLE || 'steampunk-idle-game-zone-instances',
  CURRENCY_TRANSACTIONS: process.env.CURRENCY_TRANSACTIONS_TABLE || 'steampunk-idle-game-currency-transactions',
  CRAFTING_SESSIONS: process.env.CRAFTING_SESSIONS_TABLE || 'steampunk-idle-game-crafting-sessions',
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 100, // milliseconds
  maxDelay: 1000, // milliseconds
};

// Utility function for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const calculateBackoffDelay = (attempt: number): number => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  return delay + Math.random() * 100; // Add jitter
};

// Error handling wrapper
const handleDynamoDBError = (error: any, operation: string, tableName?: string): never => {
  console.error(`DynamoDB ${operation} error:`, error);

  // Use error name instead of instanceof for better compatibility with mocks
  if (error.name === 'ConditionalCheckFailedException') {
    throw new ConditionalCheckError('Conditional check failed - item may have been modified');
  }

  if (error.name === 'ResourceNotFoundException') {
    throw new ItemNotFoundError(tableName || 'unknown', 'unknown');
  }

  // ValidationException handling removed as it's not available in the current AWS SDK version

  if (error.name === 'ProvisionedThroughputExceededException') {
    throw new ThrottlingError('Request rate exceeded - please retry');
  }

  if (error.name === 'ItemCollectionSizeLimitExceededException') {
    throw new DatabaseError('Item collection size limit exceeded');
  }

  // Generic database error
  throw new DatabaseError(
    `Database operation failed: ${error.message || 'Unknown error'}`,
    error
  );
};

// Retry wrapper for operations
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  tableName?: string
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry certain errors
      if (
        error.name === 'ConditionalCheckFailedException' ||
        error.name === 'ResourceNotFoundException'
      ) {
        handleDynamoDBError(error, operationName, tableName);
      }

      // Don't retry on the last attempt
      if (attempt === RETRY_CONFIG.maxRetries) {
        break;
      }

      // Only retry on throttling or service errors
      if (
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'ServiceException' ||
        error.name === 'InternalServerError'
      ) {
        const backoffDelay = calculateBackoffDelay(attempt);
        console.warn(`Retrying ${operationName} after ${backoffDelay}ms (attempt ${attempt + 1})`);
        await delay(backoffDelay);
        continue;
      }

      // Don't retry other errors
      break;
    }
  }

  handleDynamoDBError(lastError, operationName, tableName);
  throw new DatabaseError(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries`); // This line should never be reached
};

/**
 * Database service class with error handling and retry logic
 */
export class DatabaseService {
  /**
   * Get a single item from DynamoDB
   */
  static async getItem<T = any>(params: GetCommandInput): Promise<T | null> {
    return withRetry(async () => {
      const command = new GetCommand(params);
      const result = await docClient.send(command);
      return result.Item as T || null;
    }, 'getItem', params.TableName);
  }

  /**
   * Put an item into DynamoDB
   */
  static async putItem(params: PutCommandInput): Promise<void> {
    return withRetry(async () => {
      const command = new PutCommand(params);
      await docClient.send(command);
    }, 'putItem', params.TableName);
  }

  /**
   * Update an item in DynamoDB
   */
  static async updateItem(params: UpdateCommandInput): Promise<any> {
    return withRetry(async () => {
      const command = new UpdateCommand(params);
      const result = await docClient.send(command);
      return result.Attributes;
    }, 'updateItem', params.TableName);
  }

  /**
   * Delete an item from DynamoDB
   */
  static async deleteItem(params: DeleteCommandInput): Promise<any> {
    return withRetry(async () => {
      const command = new DeleteCommand(params);
      const result = await docClient.send(command);
      return result.Attributes;
    }, 'deleteItem', params.TableName);
  }

  /**
   * Query items from DynamoDB
   */
  static async query<T = any>(params: QueryCommandInput): Promise<{
    items: T[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    return withRetry(async () => {
      const command = new QueryCommand(params);
      const result = await docClient.send(command);
      return {
        items: (result.Items as T[]) || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    }, 'query', params.TableName);
  }

  /**
   * Scan items from DynamoDB
   */
  static async scan<T = any>(params: ScanCommandInput): Promise<{
    items: T[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    return withRetry(async () => {
      const command = new ScanCommand(params);
      const result = await docClient.send(command);
      return {
        items: (result.Items as T[]) || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    }, 'scan', params.TableName);
  }

  /**
   * Batch get items from DynamoDB
   */
  static async batchGetItems<T = any>(params: {
    RequestItems: any;
  }): Promise<{ [tableName: string]: T[] }> {
    return withRetry(async () => {
      const command = new BatchGetCommand(params);
      const result = await docClient.send(command);

      const responses: { [tableName: string]: T[] } = {};
      if (result.Responses) {
        for (const [tableName, items] of Object.entries(result.Responses)) {
          responses[tableName] = items as T[];
        }
      }

      return responses;
    }, 'batchGetItems');
  }

  /**
   * Batch write items to DynamoDB
   */
  static async batchWriteItems(params: {
    RequestItems: any;
  }): Promise<void> {
    return withRetry(async () => {
      const command = new BatchWriteCommand(params);
      await docClient.send(command);
    }, 'batchWriteItems');
  }

  /**
   * Transaction write to DynamoDB
   */
  static async transactWrite(params: {
    TransactItems: any[];
  }): Promise<void> {
    return withRetry(async () => {
      const command = new TransactWriteCommand(params);
      await docClient.send(command);
    }, 'transactWrite');
  }

  /**
   * Get all items from a query with pagination
   */
  static async queryAll<T = any>(params: QueryCommandInput): Promise<T[]> {
    const allItems: T[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const queryParams = {
        ...params,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await this.query<T>(queryParams);
      allItems.push(...result.items);
      lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }

  /**
   * Get all items from a scan with pagination
   */
  static async scanAll<T = any>(params: ScanCommandInput): Promise<T[]> {
    const allItems: T[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const scanParams = {
        ...params,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await this.scan<T>(scanParams);
      allItems.push(...result.items);
      lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }

  /**
   * Check if an item exists
   */
  static async itemExists(tableName: string, key: any): Promise<boolean> {
    try {
      const result = await this.getItem({
        TableName: tableName,
        Key: key,
        ProjectionExpression: Object.keys(key)[0], // Just get the key attribute
      });
      return result !== null;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get item count from a table
   */
  static async getItemCount(tableName: string, filterExpression?: string): Promise<number> {
    const params: ScanCommandInput = {
      TableName: tableName,
      Select: 'COUNT',
    };

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    const result = await this.scan(params);
    return result.count;
  }
}

export default DatabaseService;