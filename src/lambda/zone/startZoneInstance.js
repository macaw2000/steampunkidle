"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const zoneService_1 = require("../../services/zoneService");
const uuid_1 = require("uuid");
const handler = async (event) => {
    try {
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
        const { partyId } = JSON.parse(event.body);
        if (!partyId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'partyId is required',
                }),
            };
        }
        const party = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
        });
        if (!party) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party not found',
                }),
            };
        }
        if (party.status !== 'forming') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party is not in forming state',
                }),
            };
        }
        const allReady = party.members.every(member => member.isReady);
        if (!allReady) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Not all party members are ready',
                }),
            };
        }
        if (party.type === 'zone' && (party.members.length < 1 || party.members.length > 3)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Zone parties must have 1-3 members',
                }),
            };
        }
        if (party.type === 'dungeon' && (party.members.length < 5 || party.members.length > 8)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Dungeon parties must have 5-8 members',
                }),
            };
        }
        const existingInstance = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            FilterExpression: 'partyId = :partyId AND #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':partyId': partyId,
                ':status': 'active',
            },
        });
        if (existingInstance.items.length > 0) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Party already has an active zone instance',
                }),
            };
        }
        const availableZoneTypes = zoneService_1.ZoneService.getAvailableZoneTypes(party);
        const zoneType = availableZoneTypes[Math.floor(Math.random() * availableZoneTypes.length)];
        const difficulty = zoneService_1.ZoneService.calculateDifficulty(party);
        const monsters = zoneService_1.ZoneService.generateMonsters(zoneType, difficulty, party.members.length);
        const now = new Date();
        const instanceId = (0, uuid_1.v4)();
        const instance = {
            instanceId,
            partyId,
            zoneType,
            difficulty,
            monsters,
            rewards: [],
            startedAt: now,
            status: 'active',
        };
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.ZONE_INSTANCES,
            Item: instance,
            ConditionExpression: 'attribute_not_exists(instanceId)',
        });
        await databaseService_1.DatabaseService.updateItem({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            Key: { partyId },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':status': 'active',
            },
        });
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                instance,
            }),
        };
    }
    catch (error) {
        console.error('Error starting zone instance:', error);
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
