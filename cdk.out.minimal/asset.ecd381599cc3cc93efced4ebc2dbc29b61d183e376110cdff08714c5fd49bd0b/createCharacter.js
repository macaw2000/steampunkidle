"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const uuid_1 = require("uuid");
const createDefaultCraftingSkills = () => ({
    clockmaking: 1,
    engineering: 1,
    alchemy: 1,
    steamcraft: 1,
    level: 1,
    experience: 0,
});
const createDefaultHarvestingSkills = () => ({
    mining: 1,
    foraging: 1,
    salvaging: 1,
    crystal_extraction: 1,
    level: 1,
    experience: 0,
});
const createDefaultCombatSkills = () => ({
    melee: 1,
    ranged: 1,
    defense: 1,
    tactics: 1,
    level: 1,
    experience: 0,
});
const createDefaultStats = () => ({
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    craftingSkills: createDefaultCraftingSkills(),
    harvestingSkills: createDefaultHarvestingSkills(),
    combatSkills: createDefaultCombatSkills(),
});
const createDefaultSpecialization = () => ({
    tankProgress: 0,
    healerProgress: 0,
    dpsProgress: 0,
    primaryRole: null,
    secondaryRole: null,
    bonuses: [],
});
const createDefaultActivity = () => ({
    type: 'crafting',
    startedAt: new Date(),
    progress: 0,
    rewards: [],
});
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
        const request = JSON.parse(event.body);
        if (!request.userId || !request.name) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'userId and name are required',
                }),
            };
        }
        if (request.name.length < 3 || request.name.length > 20) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Character name must be between 3 and 20 characters',
                }),
            };
        }
        const existingCharacter = await databaseService_1.DatabaseService.getItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Key: { userId: request.userId },
        });
        if (existingCharacter) {
            return {
                statusCode: 409,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'User already has a character',
                }),
            };
        }
        const now = new Date();
        const character = {
            userId: request.userId,
            characterId: (0, uuid_1.v4)(),
            name: request.name,
            level: 1,
            experience: 0,
            currency: 100,
            stats: createDefaultStats(),
            specialization: createDefaultSpecialization(),
            currentActivity: createDefaultActivity(),
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
        };
        await databaseService_1.DatabaseService.putItem({
            TableName: databaseService_1.TABLE_NAMES.CHARACTERS,
            Item: character,
            ConditionExpression: 'attribute_not_exists(userId)',
        });
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                character,
            }),
        };
    }
    catch (error) {
        console.error('Error creating character:', error);
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
