"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const notificationService_1 = require("../../services/notificationService");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    try {
        const { userId } = JSON.parse(event.body || '{}');
        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'userId is required' }),
            };
        }
        const character = await getCharacter(userId);
        if (!character) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Character not found' }),
            };
        }
        const lastActiveTime = new Date(character.lastActiveAt);
        const currentTime = new Date();
        const offlineMinutes = Math.floor((currentTime.getTime() - lastActiveTime.getTime()) / (1000 * 60));
        if (offlineMinutes < 1) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    message: 'No offline progress to calculate',
                    offlineMinutes: 0,
                    progress: null
                }),
            };
        }
        const cappedOfflineMinutes = Math.min(offlineMinutes, 1440);
        const progress = calculateProgress(character, cappedOfflineMinutes);
        await updateCharacterProgress(character, progress);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Offline progress calculated successfully',
                offlineMinutes: cappedOfflineMinutes,
                progress,
            }),
        };
    }
    catch (error) {
        console.error('Error calculating offline progress:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
exports.handler = handler;
async function getCharacter(userId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId },
        }));
        return result.Item || null;
    }
    catch (error) {
        console.error('Error getting character:', error);
        throw error;
    }
}
function calculateProgress(character, offlineMinutes) {
    const result = {
        experienceGained: 0,
        skillsGained: {},
        currencyGained: 0,
        itemsFound: [],
        specializationProgress: {},
        notifications: [],
    };
    const baseProgressRate = 1 + (character.level * 0.1);
    switch (character.currentActivity.type) {
        case 'crafting':
            result.experienceGained = Math.floor(offlineMinutes * baseProgressRate * 1.2);
            result.currencyGained = Math.floor(offlineMinutes * baseProgressRate * 0.8);
            const craftingSkill = character.currentActivity.subType || 'clockmaking';
            result.skillsGained[craftingSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.5);
            result.specializationProgress.dpsProgress = Math.floor(offlineMinutes * (character.stats.intelligence / 100) * 0.3);
            const craftingChance = Math.min(0.8, offlineMinutes * 0.01);
            if (Math.random() < craftingChance) {
                result.itemsFound.push('Clockwork Trinket');
            }
            break;
        case 'harvesting':
            result.experienceGained = Math.floor(offlineMinutes * baseProgressRate * 1.0);
            result.currencyGained = Math.floor(offlineMinutes * baseProgressRate * 0.6);
            const harvestingSkill = character.currentActivity.subType || 'mining';
            result.skillsGained[harvestingSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.6);
            result.specializationProgress.healerProgress = Math.floor(offlineMinutes * (character.stats.dexterity / 100) * 0.2);
            const resourceChance = Math.min(0.9, offlineMinutes * 0.02);
            if (Math.random() < resourceChance) {
                const resources = ['Steam Crystals', 'Copper Gears', 'Iron Pipes'];
                const foundResource = resources[Math.floor(Math.random() * resources.length)];
                result.itemsFound.push(foundResource);
            }
            break;
        case 'combat':
            result.experienceGained = Math.floor(offlineMinutes * baseProgressRate * 1.5);
            result.currencyGained = Math.floor(offlineMinutes * baseProgressRate * 1.0);
            const combatSkill = character.currentActivity.subType || 'melee';
            result.skillsGained[combatSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.4);
            result.specializationProgress.tankProgress = Math.floor(offlineMinutes * (character.stats.strength + character.stats.vitality) / 200 * 0.4);
            result.specializationProgress.dpsProgress = Math.floor(offlineMinutes * (character.stats.strength + character.stats.dexterity) / 200 * 0.3);
            const lootChance = Math.min(0.7, offlineMinutes * 0.015);
            if (Math.random() < lootChance) {
                const loot = ['Mechanical Sword', 'Steam-Powered Shield', 'Brass Knuckles'];
                const foundLoot = loot[Math.floor(Math.random() * loot.length)];
                result.itemsFound.push(foundLoot);
            }
            break;
    }
    const progressNotification = {
        experienceGained: result.experienceGained,
        currencyGained: result.currencyGained,
        itemsFound: result.itemsFound,
        skillsGained: result.skillsGained,
        offlineMinutes
    };
    const gameNotifications = notificationService_1.NotificationService.createProgressNotifications(progressNotification);
    result.notifications = gameNotifications.map(n => n.message);
    return result;
}
async function updateCharacterProgress(character, progress) {
    const updatedCharacter = { ...character };
    updatedCharacter.experience += progress.experienceGained;
    updatedCharacter.level = Math.floor(updatedCharacter.experience / 1000) + 1;
    updatedCharacter.currency = (updatedCharacter.currency || 0) + progress.currencyGained;
    Object.entries(progress.skillsGained).forEach(([skill, gain]) => {
        const skillPath = getSkillPath(skill);
        if (skillPath) {
            const [skillCategory, skillName] = skillPath.split('.');
            if (!updatedCharacter.stats[skillCategory]) {
                updatedCharacter.stats[skillCategory] = {};
            }
            const currentValue = getNestedValue(updatedCharacter.stats, skillPath) || 0;
            updatedCharacter.stats[skillCategory][skillName] = currentValue + gain;
        }
    });
    Object.entries(progress.specializationProgress).forEach(([spec, gain]) => {
        if (gain && typeof gain === 'number' && gain > 0) {
            const currentValue = updatedCharacter.specialization[spec] || 0;
            updatedCharacter.specialization[spec] = currentValue + gain;
        }
    });
    updatedCharacter.lastActiveAt = new Date().toISOString();
    try {
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId: character.userId },
            UpdateExpression: 'SET #exp = :exp, #lvl = :lvl, #currency = :currency, #stats = :stats, #specialization = :specialization, #lastActiveAt = :lastActiveAt',
            ExpressionAttributeNames: {
                '#exp': 'experience',
                '#lvl': 'level',
                '#currency': 'currency',
                '#stats': 'stats',
                '#specialization': 'specialization',
                '#lastActiveAt': 'lastActiveAt',
            },
            ExpressionAttributeValues: {
                ':exp': updatedCharacter.experience,
                ':lvl': updatedCharacter.level,
                ':currency': updatedCharacter.currency,
                ':stats': updatedCharacter.stats,
                ':specialization': updatedCharacter.specialization,
                ':lastActiveAt': updatedCharacter.lastActiveAt,
            },
        }));
    }
    catch (error) {
        console.error('Error updating character progress:', error);
        throw error;
    }
}
function getSkillPath(skill) {
    const skillMappings = {
        'clockmaking': 'craftingSkills.clockmaking',
        'engineering': 'craftingSkills.engineering',
        'alchemy': 'craftingSkills.alchemy',
        'mining': 'harvestingSkills.mining',
        'herbalism': 'harvestingSkills.herbalism',
        'scavenging': 'harvestingSkills.scavenging',
        'melee': 'combatSkills.melee',
        'ranged': 'combatSkills.ranged',
        'defense': 'combatSkills.defense',
    };
    return skillMappings[skill] || null;
}
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}
