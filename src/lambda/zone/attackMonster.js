"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const zoneService_1 = require("../../services/zoneService");
const handler = async (event) => {
    try {
        const instanceId = event.pathParameters?.instanceId;
        if (!instanceId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'instanceId is required',
                }),
            };
        }
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Request body is required',
                }),
            };
        }
        const { monsterId, userId } = JSON.parse(event.body);
        if (!monsterId || !userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'monsterId and userId are required',
                }),
            };
        }
        const instance = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            Key: { instanceId },
        });
        if (!instance) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone instance not found',
                }),
            };
        }
        if (instance.status !== 'active') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone instance is not active',
                }),
            };
        }
        const character = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId },
        });
        if (!character) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Character not found',
                }),
            };
        }
        const monsterIndex = instance.monsters.findIndex(m => m.monsterId === monsterId);
        if (monsterIndex === -1) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Monster not found in this instance',
                }),
            };
        }
        const monster = instance.monsters[monsterIndex];
        if (monster.health <= 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Monster is already defeated',
                }),
            };
        }
        const damage = zoneService_1.ZoneService.calculateDamage(character.level, character.stats, monster);
        const updatedMonster = {
            ...monster,
            health: Math.max(0, monster.health - damage)
        };
        const updatedMonsters = [...instance.monsters];
        updatedMonsters[monsterIndex] = updatedMonster;
        let rewards = [];
        if (updatedMonster.health <= 0) {
            monster.lootTable.forEach(loot => {
                if (Math.random() < loot.dropChance) {
                    rewards.push({
                        type: loot.itemId === 'steam-coins' ? 'currency' : 'item',
                        amount: loot.quantity,
                        itemId: loot.itemId !== 'steam-coins' ? loot.itemId : undefined,
                        recipientId: userId
                    });
                }
            });
            rewards.push({
                type: 'experience',
                amount: Math.floor(monster.level * 5 + instance.difficulty * 3),
                recipientId: userId
            });
        }
        const updatedRewards = [...instance.rewards, ...rewards];
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            Key: { instanceId },
            UpdateExpression: 'SET monsters = :monsters, rewards = :rewards',
            ExpressionAttributeValues: {
                ':monsters': updatedMonsters,
                ':rewards': updatedRewards,
            },
        });
        const allMonstersDefeated = updatedMonsters.every(m => m.health <= 0);
        let completionRewards = [];
        if (allMonstersDefeated) {
            const party = await databaseService_1.DatabaseService.getItem({
                TableName: databaseService_1.TABLE_NAMES.PARTIES,
                Key: { partyId: instance.partyId },
            });
            if (party) {
                const memberIds = party.members.map((m) => m.userId);
                completionRewards = zoneService_1.ZoneService.generateCompletionRewards(instance.zoneType, instance.difficulty, memberIds);
                await databaseService_1.DatabaseService.updateItem({
                    TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
                    Key: { instanceId },
                    UpdateExpression: 'SET #status = :status, completedAt = :completedAt, rewards = :allRewards',
                    ExpressionAttributeNames: {
                        '#status': 'status',
                    },
                    ExpressionAttributeValues: {
                        ':status': 'completed',
                        ':completedAt': new Date().toISOString(),
                        ':allRewards': [...updatedRewards, ...completionRewards],
                    },
                });
                await databaseService_1.DatabaseService.updateItem({
                    TableName: databaseService_1.TABLE_NAMES.PARTIES,
                    Key: { partyId: instance.partyId },
                    UpdateExpression: 'SET #status = :status',
                    ExpressionAttributeNames: {
                        '#status': 'status',
                    },
                    ExpressionAttributeValues: {
                        ':status': 'completed',
                    },
                });
            }
        }
        const updatedInstance = {
            ...instance,
            monsters: updatedMonsters,
            rewards: allMonstersDefeated ? [...updatedRewards, ...completionRewards] : updatedRewards,
            status: allMonstersDefeated ? 'completed' : 'active',
            completedAt: allMonstersDefeated ? new Date() : undefined,
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                instance: updatedInstance,
                damage,
                rewards: [...rewards, ...completionRewards],
                monsterDefeated: updatedMonster.health <= 0,
                allMonstersDefeated,
            }),
        };
    }
    catch (error) {
        console.error('Error attacking monster:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
            }),
        };
    }
};
exports.handler = handler;
