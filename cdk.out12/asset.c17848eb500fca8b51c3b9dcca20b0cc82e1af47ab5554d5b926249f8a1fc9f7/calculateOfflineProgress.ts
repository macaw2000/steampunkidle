import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NotificationService, ProgressNotification } from '../../services/notificationService';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface Character {
  userId: string;
  characterId: string;
  name: string;
  level: number;
  experience: number;
  stats: CharacterStats;
  specialization: Specialization;
  currentActivity: Activity;
  lastActiveAt: string;
  currency: number;
}

interface CharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  craftingSkills: SkillSet;
  harvestingSkills: SkillSet;
  combatSkills: SkillSet;
}

interface SkillSet {
  clockmaking?: number;
  engineering?: number;
  alchemy?: number;
  mining?: number;
  herbalism?: number;
  scavenging?: number;
  melee?: number;
  ranged?: number;
  defense?: number;
}

interface Specialization {
  tankProgress: number;
  healerProgress: number;
  dpsProgress: number;
  primaryRole?: 'tank' | 'healer' | 'dps';
}

interface Activity {
  type: 'crafting' | 'harvesting' | 'combat';
  subType?: string;
  startedAt: string;
}

interface OfflineProgressResult {
  experienceGained: number;
  skillsGained: Record<string, number>;
  currencyGained: number;
  itemsFound: string[];
  specializationProgress: Partial<Specialization>;
  notifications: string[];
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    // Get character data
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

    // Calculate offline time in minutes
    const lastActiveTime = new Date(character.lastActiveAt);
    const currentTime = new Date();
    const offlineMinutes = Math.floor((currentTime.getTime() - lastActiveTime.getTime()) / (1000 * 60));

    // Don't calculate progress if offline for less than 1 minute
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

    // Cap offline progress at 24 hours (1440 minutes)
    const cappedOfflineMinutes = Math.min(offlineMinutes, 1440);

    // Calculate progress based on current activity
    const progress = calculateProgress(character, cappedOfflineMinutes);

    // Update character with new progress
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

  } catch (error) {
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

async function getCharacter(userId: string): Promise<Character | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.CHARACTERS_TABLE!,
      Key: { userId },
    }));

    return result.Item as Character || null;
  } catch (error) {
    console.error('Error getting character:', error);
    throw error;
  }
}

function calculateProgress(character: Character, offlineMinutes: number): OfflineProgressResult {
  const result: OfflineProgressResult = {
    experienceGained: 0,
    skillsGained: {},
    currencyGained: 0,
    itemsFound: [],
    specializationProgress: {},
    notifications: [],
  };

  // Base progress rate per minute (affected by character stats)
  const baseProgressRate = 1 + (character.level * 0.1);
  
  switch (character.currentActivity.type) {
    case 'crafting':
      result.experienceGained = Math.floor(offlineMinutes * baseProgressRate * 1.2);
      result.currencyGained = Math.floor(offlineMinutes * baseProgressRate * 0.8);
      
      // Crafting skill gains
      const craftingSkill = character.currentActivity.subType || 'clockmaking';
      result.skillsGained[craftingSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.5);
      
      // Intelligence-based specialization progress
      result.specializationProgress.dpsProgress = Math.floor(
        offlineMinutes * (character.stats.intelligence / 100) * 0.3
      );
      
      // Chance for crafted items
      const craftingChance = Math.min(0.8, offlineMinutes * 0.01);
      if (Math.random() < craftingChance) {
        result.itemsFound.push('Clockwork Trinket');
      }
      break;

    case 'harvesting':
      result.experienceGained = Math.floor(offlineMinutes * baseProgressRate * 1.0);
      result.currencyGained = Math.floor(offlineMinutes * baseProgressRate * 0.6);
      
      // Harvesting skill gains
      const harvestingSkill = character.currentActivity.subType || 'mining';
      result.skillsGained[harvestingSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.6);
      
      // Dexterity-based specialization progress
      result.specializationProgress.healerProgress = Math.floor(
        offlineMinutes * (character.stats.dexterity / 100) * 0.2
      );
      
      // Resource gathering
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
      
      // Combat skill gains
      const combatSkill = character.currentActivity.subType || 'melee';
      result.skillsGained[combatSkill] = Math.floor(offlineMinutes * baseProgressRate * 0.4);
      
      // Strength/Vitality-based specialization progress
      result.specializationProgress.tankProgress = Math.floor(
        offlineMinutes * (character.stats.strength + character.stats.vitality) / 200 * 0.4
      );
      result.specializationProgress.dpsProgress = Math.floor(
        offlineMinutes * (character.stats.strength + character.stats.dexterity) / 200 * 0.3
      );
      
      // Combat loot
      const lootChance = Math.min(0.7, offlineMinutes * 0.015);
      if (Math.random() < lootChance) {
        const loot = ['Mechanical Sword', 'Steam-Powered Shield', 'Brass Knuckles'];
        const foundLoot = loot[Math.floor(Math.random() * loot.length)];
        result.itemsFound.push(foundLoot);
      }
      break;
  }

  // Generate notifications using the notification service
  const progressNotification: ProgressNotification = {
    experienceGained: result.experienceGained,
    currencyGained: result.currencyGained,
    itemsFound: result.itemsFound,
    skillsGained: result.skillsGained,
    offlineMinutes
  };

  const gameNotifications = NotificationService.createProgressNotifications(progressNotification);
  result.notifications = gameNotifications.map(n => n.message);

  return result;
}

async function updateCharacterProgress(character: Character, progress: OfflineProgressResult): Promise<void> {
  // Create updated character object
  const updatedCharacter = { ...character };
  
  // Update experience and level
  updatedCharacter.experience += progress.experienceGained;
  updatedCharacter.level = Math.floor(updatedCharacter.experience / 1000) + 1;
  
  // Update currency
  updatedCharacter.currency = (updatedCharacter.currency || 0) + progress.currencyGained;
  
  // Update skills
  Object.entries(progress.skillsGained).forEach(([skill, gain]) => {
    const skillPath = getSkillPath(skill);
    if (skillPath) {
      const [skillCategory, skillName] = skillPath.split('.');
      if (!updatedCharacter.stats[skillCategory as keyof CharacterStats]) {
        (updatedCharacter.stats[skillCategory as keyof CharacterStats] as any) = {};
      }
      const currentValue = getNestedValue(updatedCharacter.stats, skillPath) || 0;
      (updatedCharacter.stats[skillCategory as keyof CharacterStats] as any)[skillName] = currentValue + gain;
    }
  });

  // Update specialization progress
  Object.entries(progress.specializationProgress).forEach(([spec, gain]) => {
    if (gain && typeof gain === 'number' && gain > 0) {
      const currentValue = (updatedCharacter.specialization as any)[spec] || 0;
      (updatedCharacter.specialization as any)[spec] = currentValue + gain;
    }
  });

  // Update last active time
  updatedCharacter.lastActiveAt = new Date().toISOString();

  try {
    await docClient.send(new UpdateCommand({
      TableName: process.env.CHARACTERS_TABLE!,
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
  } catch (error) {
    console.error('Error updating character progress:', error);
    throw error;
  }
}

function getSkillPath(skill: string): string | null {
  const skillMappings: Record<string, string> = {
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

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}