"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = exports.TABLE_NAMES = exports.ThrottlingError = exports.ValidationError = exports.ConditionalCheckError = exports.ItemNotFoundError = exports.DatabaseError = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
class DatabaseError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class ItemNotFoundError extends DatabaseError {
    constructor(tableName, key) {
        super(`Item not found in ${tableName} with key: ${key}`);
        this.name = 'ItemNotFoundError';
    }
}
exports.ItemNotFoundError = ItemNotFoundError;
class ConditionalCheckError extends DatabaseError {
    constructor(message = 'Conditional check failed') {
        super(message);
        this.name = 'ConditionalCheckError';
    }
}
exports.ConditionalCheckError = ConditionalCheckError;
class ValidationError extends DatabaseError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class ThrottlingError extends DatabaseError {
    constructor(message = 'Request was throttled') {
        super(message);
        this.name = 'ThrottlingError';
    }
}
exports.ThrottlingError = ThrottlingError;
const client = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.LOCALSTACK_ENDPOINT && {
        endpoint: process.env.LOCALSTACK_ENDPOINT,
        credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        },
    }),
});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});
exports.TABLE_NAMES = {
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
    TASK_QUEUES: process.env.TASK_QUEUES_TABLE || 'steampunk-idle-game-task-queues',
    WEBSOCKET_CONNECTIONS: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'steampunk-idle-game-websocket-connections',
    NOTIFICATIONS: process.env.NOTIFICATIONS_TABLE || 'steampunk-idle-game-notifications',
};
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 1000,
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const calculateBackoffDelay = (attempt) => {
    const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
    return delay + Math.random() * 100;
};
const handleDynamoDBError = (error, operation, tableName) => {
    console.error(`DynamoDB ${operation} error:`, error);
    if (error.name === 'ConditionalCheckFailedException') {
        throw new ConditionalCheckError('Conditional check failed - item may have been modified');
    }
    if (error.name === 'ResourceNotFoundException') {
        throw new ItemNotFoundError(tableName || 'unknown', 'unknown');
    }
    if (error.name === 'ProvisionedThroughputExceededException') {
        throw new ThrottlingError('Request rate exceeded - please retry');
    }
    if (error.name === 'ItemCollectionSizeLimitExceededException') {
        throw new DatabaseError('Item collection size limit exceeded');
    }
    throw new DatabaseError(`Database operation failed: ${error.message || 'Unknown error'}`, error);
};
const withRetry = async (operation, operationName, tableName) => {
    let lastError;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (error.name === 'ConditionalCheckFailedException' ||
                error.name === 'ResourceNotFoundException') {
                handleDynamoDBError(error, operationName, tableName);
            }
            if (attempt === RETRY_CONFIG.maxRetries) {
                break;
            }
            if (error.name === 'ProvisionedThroughputExceededException' ||
                error.name === 'ServiceException' ||
                error.name === 'InternalServerError') {
                const backoffDelay = calculateBackoffDelay(attempt);
                console.warn(`Retrying ${operationName} after ${backoffDelay}ms (attempt ${attempt + 1})`);
                await delay(backoffDelay);
                continue;
            }
            break;
        }
    }
    handleDynamoDBError(lastError, operationName, tableName);
    throw new DatabaseError(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries`);
};
class DatabaseService {
    static async getItem(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.GetCommand(params);
            const result = await docClient.send(command);
            return result.Item || null;
        }, 'getItem', params.TableName);
    }
    static async putItem(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.PutCommand(params);
            await docClient.send(command);
        }, 'putItem', params.TableName);
    }
    static async updateItem(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.UpdateCommand(params);
            const result = await docClient.send(command);
            return result.Attributes;
        }, 'updateItem', params.TableName);
    }
    static async deleteItem(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.DeleteCommand(params);
            const result = await docClient.send(command);
            return result.Attributes;
        }, 'deleteItem', params.TableName);
    }
    static async query(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.QueryCommand(params);
            const result = await docClient.send(command);
            return {
                items: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey,
                count: result.Count || 0,
            };
        }, 'query', params.TableName);
    }
    static async scan(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.ScanCommand(params);
            const result = await docClient.send(command);
            return {
                items: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey,
                count: result.Count || 0,
            };
        }, 'scan', params.TableName);
    }
    static async batchGetItems(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.BatchGetCommand(params);
            const result = await docClient.send(command);
            const responses = {};
            if (result.Responses) {
                for (const [tableName, items] of Object.entries(result.Responses)) {
                    responses[tableName] = items;
                }
            }
            return responses;
        }, 'batchGetItems');
    }
    static async batchWriteItems(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.BatchWriteCommand(params);
            await docClient.send(command);
        }, 'batchWriteItems');
    }
    static async transactWrite(params) {
        return withRetry(async () => {
            const command = new lib_dynamodb_1.TransactWriteCommand(params);
            await docClient.send(command);
        }, 'transactWrite');
    }
    static async queryAll(params) {
        const allItems = [];
        let lastEvaluatedKey = undefined;
        do {
            const queryParams = {
                ...params,
                ExclusiveStartKey: lastEvaluatedKey,
            };
            const result = await this.query(queryParams);
            allItems.push(...result.items);
            lastEvaluatedKey = result.lastEvaluatedKey;
        } while (lastEvaluatedKey);
        return allItems;
    }
    static async scanAll(params) {
        const allItems = [];
        let lastEvaluatedKey = undefined;
        do {
            const scanParams = {
                ...params,
                ExclusiveStartKey: lastEvaluatedKey,
            };
            const result = await this.scan(scanParams);
            allItems.push(...result.items);
            lastEvaluatedKey = result.lastEvaluatedKey;
        } while (lastEvaluatedKey);
        return allItems;
    }
    static async itemExists(tableName, key) {
        try {
            const result = await this.getItem({
                TableName: tableName,
                Key: key,
                ProjectionExpression: Object.keys(key)[0],
            });
            return result !== null;
        }
        catch (error) {
            if (error instanceof ItemNotFoundError) {
                return false;
            }
            throw error;
        }
    }
    static async getItemCount(tableName, filterExpression) {
        const params = {
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
exports.DatabaseService = DatabaseService;
exports.default = DatabaseService;
