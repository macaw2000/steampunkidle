"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const CHARACTERS_TABLE = process.env.CHARACTERS_TABLE;
const LEADERBOARDS_TABLE = process.env.LEADERBOARDS_TABLE;
const GUILD_MEMBERS_TABLE = process.env.GUILD_MEMBERS_TABLE;
const GUILDS_TABLE = process.env.GUILDS_TABLE;
function extractStatValue(character, statType) {
    switch (statType) {
        case 'level':
            return character.level;
        case 'totalExperience':
            return character.experience;
        case 'craftingLevel':
            return character.stats.craftingSkills.level;
        case 'harvestingLevel':
            return character.stats.harvestingSkills.level;
        case 'combatLevel':
            return character.stats.combatSkills.level;
        case 'currency':
            return character.currency;
        case 'itemsCreated':
            return character.stats.craftingSkills.experience;
        case 'zonesCompleted':
            return Math.floor(character.stats.combatSkills.experience / 1000);
        case 'dungeonsCompleted':
            return Math.floor(character.stats.combatSkills.level / 5);
        case 'guildLevel':
            return character.level;
        default:
            return 0;
    }
}
async function getGuildName(userId) {
    try {
        const membershipResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: GUILD_MEMBERS_TABLE,
            IndexName: 'user-guild-index',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
            Limit: 1,
        }));
        if (!membershipResult.Items || membershipResult.Items.length === 0) {
            return undefined;
        }
        const guildId = membershipResult.Items[0].guildId;
        const guildResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: GUILDS_TABLE,
            KeyConditionExpression: 'guildId = :guildId',
            ExpressionAttributeValues: {
                ':guildId': guildId,
            },
            ProjectionExpression: '#name',
            ExpressionAttributeNames: {
                '#name': 'name',
            },
        }));
        return guildResult.Items?.[0]?.name;
    }
    catch (error) {
        console.error(`Error getting guild name for user ${userId}:`, error);
        return undefined;
    }
}
async function calculateLeaderboard(statType) {
    console.log(`Calculating leaderboard for ${statType}`);
    const scanResult = await docClient.send(new lib_dynamodb_1.ScanCommand({
        TableName: CHARACTERS_TABLE,
    }));
    if (!scanResult.Items || scanResult.Items.length === 0) {
        console.log('No characters found');
        return [];
    }
    const characters = scanResult.Items;
    console.log(`Found ${characters.length} characters`);
    const entries = [];
    for (const character of characters) {
        const statValue = extractStatValue(character, statType);
        if (statValue > 0) {
            entries.push({
                userId: character.userId,
                characterName: character.name,
                statValue,
            });
        }
    }
    entries.sort((a, b) => b.statValue - a.statValue);
    const top100 = entries.slice(0, 100);
    const leaderboardEntries = [];
    for (let i = 0; i < top100.length; i++) {
        const entry = top100[i];
        const guildName = await getGuildName(entry.userId);
        leaderboardEntries.push({
            rank: i + 1,
            userId: entry.userId,
            characterName: entry.characterName,
            guildName,
            statValue: entry.statValue,
            lastUpdated: new Date(),
        });
    }
    console.log(`Created ${leaderboardEntries.length} leaderboard entries for ${statType}`);
    return leaderboardEntries;
}
async function updateLeaderboard(statType, entries) {
    console.log(`Updating leaderboard for ${statType} with ${entries.length} entries`);
    const existingEntries = await docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: LEADERBOARDS_TABLE,
        KeyConditionExpression: 'statType = :statType',
        ExpressionAttributeValues: {
            ':statType': statType,
        },
        ProjectionExpression: 'statType, #rank',
        ExpressionAttributeNames: {
            '#rank': 'rank',
        },
    }));
    if (existingEntries.Items && existingEntries.Items.length > 0) {
        const deleteRequests = existingEntries.Items.map(item => ({
            DeleteRequest: {
                Key: {
                    statType: item.statType,
                    rank: item.rank,
                },
            },
        }));
        for (let i = 0; i < deleteRequests.length; i += 25) {
            const batch = deleteRequests.slice(i, i + 25);
            await docClient.send(new lib_dynamodb_1.BatchWriteCommand({
                RequestItems: {
                    [LEADERBOARDS_TABLE]: batch,
                },
            }));
        }
    }
    if (entries.length > 0) {
        const putRequests = entries.map(entry => ({
            PutRequest: {
                Item: {
                    statType,
                    rank: entry.rank,
                    userId: entry.userId,
                    characterName: entry.characterName,
                    guildName: entry.guildName,
                    statValue: entry.statValue,
                    lastUpdated: entry.lastUpdated.toISOString(),
                },
            },
        }));
        for (let i = 0; i < putRequests.length; i += 25) {
            const batch = putRequests.slice(i, i + 25);
            await docClient.send(new lib_dynamodb_1.BatchWriteCommand({
                RequestItems: {
                    [LEADERBOARDS_TABLE]: batch,
                },
            }));
        }
    }
    console.log(`Successfully updated leaderboard for ${statType}`);
}
const handler = async (event) => {
    console.log('Starting leaderboard calculation', JSON.stringify(event, null, 2));
    try {
        const statTypes = [
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
        const results = {};
        for (const statType of statTypes) {
            try {
                const entries = await calculateLeaderboard(statType);
                await updateLeaderboard(statType, entries);
                results[statType] = entries.length;
            }
            catch (error) {
                console.error(`Error calculating leaderboard for ${statType}:`, error);
                results[statType] = -1;
            }
        }
        console.log('Leaderboard calculation completed', results);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Leaderboards updated successfully',
                results,
                timestamp: new Date().toISOString(),
            }),
        };
    }
    catch (error) {
        console.error('Error in leaderboard calculation:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
