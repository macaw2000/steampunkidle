"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameDataOptimized = exports.OptimizedDynamoDB = exports.docClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const cache_1 = require("./cache");
const client = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});
class OptimizedDynamoDB {
    static async getItem(tableName, key, cacheKey, cacheTtl = 300) {
        if (cacheKey) {
            return (0, cache_1.getOrSetCache)(cacheKey, async () => {
                const result = await exports.docClient.send(new lib_dynamodb_1.GetCommand({
                    TableName: tableName,
                    Key: key,
                }));
                return result.Item || null;
            }, cacheTtl);
        }
        const result = await exports.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: tableName,
            Key: key,
        }));
        return result.Item || null;
    }
    static async batchGetItems(tableName, keys, cacheKeyPrefix, cacheTtl = 300) {
        if (cacheKeyPrefix) {
            const cachedItems = [];
            const uncachedKeys = [];
            for (const key of keys) {
                const cacheKey = `${cacheKeyPrefix}:${JSON.stringify(key)}`;
                const cached = cache_1.cache.get(cacheKey);
                if (cached) {
                    cachedItems.push(cached);
                }
                else {
                    uncachedKeys.push(key);
                }
            }
            if (uncachedKeys.length > 0) {
                const result = await exports.docClient.send(new lib_dynamodb_1.BatchGetCommand({
                    RequestItems: {
                        [tableName]: {
                            Keys: uncachedKeys,
                        },
                    },
                }));
                const fetchedItems = result.Responses?.[tableName] || [];
                fetchedItems.forEach((item, index) => {
                    const cacheKey = `${cacheKeyPrefix}:${JSON.stringify(uncachedKeys[index])}`;
                    cache_1.cache.set(cacheKey, item, cacheTtl);
                });
                return [...cachedItems, ...fetchedItems];
            }
            return cachedItems;
        }
        const result = await exports.docClient.send(new lib_dynamodb_1.BatchGetCommand({
            RequestItems: {
                [tableName]: {
                    Keys: keys,
                },
            },
        }));
        return result.Responses?.[tableName] || [];
    }
    static async putItem(tableName, item, cacheKeysToInvalidate) {
        await exports.docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: tableName,
            Item: item,
        }));
        if (cacheKeysToInvalidate) {
            cacheKeysToInvalidate.forEach(key => cache_1.cache.delete(key));
        }
    }
    static async updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames, cacheKeysToInvalidate) {
        const result = await exports.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: 'ALL_NEW',
        }));
        if (cacheKeysToInvalidate) {
            cacheKeysToInvalidate.forEach(cacheKey => cache_1.cache.delete(cacheKey));
        }
        return result.Attributes;
    }
    static async query(params, cacheKey, cacheTtl = 300) {
        if (cacheKey && !params.ExclusiveStartKey) {
            return (0, cache_1.getOrSetCache)(cacheKey, async () => {
                const result = await exports.docClient.send(new lib_dynamodb_1.QueryCommand(params));
                return {
                    items: result.Items || [],
                    lastEvaluatedKey: result.LastEvaluatedKey,
                };
            }, cacheTtl);
        }
        const result = await exports.docClient.send(new lib_dynamodb_1.QueryCommand(params));
        return {
            items: result.Items || [],
            lastEvaluatedKey: result.LastEvaluatedKey,
        };
    }
    static async parallelScan(tableName, filterExpression, expressionAttributeValues, segments = 4) {
        const scanPromises = [];
        for (let segment = 0; segment < segments; segment++) {
            const params = {
                TableName: tableName,
                Segment: segment,
                TotalSegments: segments,
            };
            if (filterExpression) {
                params.FilterExpression = filterExpression;
                params.ExpressionAttributeValues = expressionAttributeValues;
            }
            scanPromises.push(exports.docClient.send(new lib_dynamodb_1.ScanCommand(params)));
        }
        const results = await Promise.all(scanPromises);
        const allItems = [];
        results.forEach(result => {
            if (result.Items) {
                allItems.push(...result.Items);
            }
        });
        return allItems;
    }
    static async batchWrite(tableName, items, cacheKeysToInvalidate) {
        const BATCH_SIZE = 25;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const requestItems = batch.map(({ action, item, key }) => {
                if (action === 'PUT' && item) {
                    return { PutRequest: { Item: item } };
                }
                else if (action === 'DELETE' && key) {
                    return { DeleteRequest: { Key: key } };
                }
                throw new Error('Invalid batch write item');
            });
            await exports.docClient.send(new lib_dynamodb_1.BatchWriteCommand({
                RequestItems: {
                    [tableName]: requestItems,
                },
            }));
        }
        if (cacheKeysToInvalidate) {
            cacheKeysToInvalidate.forEach(key => cache_1.cache.delete(key));
        }
    }
    static async transactWrite(operations) {
        console.log('Transaction write operations:', operations.length);
    }
}
exports.OptimizedDynamoDB = OptimizedDynamoDB;
class GameDataOptimized {
    static async getCharacter(userId) {
        return OptimizedDynamoDB.getItem(process.env.CHARACTERS_TABLE, { userId }, cache_1.CacheKeys.character(userId), 600);
    }
    static async getGuildWithMembers(guildId) {
        const [guild, members] = await Promise.all([
            OptimizedDynamoDB.getItem(process.env.GUILDS_TABLE, { guildId }, cache_1.CacheKeys.guild(guildId), 600),
            OptimizedDynamoDB.query({
                TableName: process.env.GUILD_MEMBERS_TABLE,
                KeyConditionExpression: 'guildId = :guildId',
                ExpressionAttributeValues: { ':guildId': guildId },
            }, cache_1.CacheKeys.guildMembers(guildId), 300),
        ]);
        return { guild, members: members.items };
    }
    static async getActiveAuctions(limit = 50) {
        return OptimizedDynamoDB.query({
            TableName: process.env.AUCTION_LISTINGS_TABLE,
            IndexName: 'status-expires-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': 'active' },
            Limit: limit,
            ScanIndexForward: true,
        }, cache_1.CacheKeys.activeAuctions(), 120);
    }
    static async getLeaderboard(statType, limit = 100) {
        return OptimizedDynamoDB.query({
            TableName: process.env.LEADERBOARDS_TABLE,
            KeyConditionExpression: 'statType = :statType',
            ExpressionAttributeValues: { ':statType': statType },
            Limit: limit,
            ScanIndexForward: true,
        }, cache_1.CacheKeys.leaderboard(statType), 300);
    }
}
exports.GameDataOptimized = GameDataOptimized;
