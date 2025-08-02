/**
 * Lambda function for creating a new character
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { Character, CreateCharacterRequest, CraftingSkillSet, HarvestingSkillSet, CombatSkillSet, CharacterStats, Specialization, Activity } from '../../types/character';
import { v4 as uuidv4 } from 'uuid';

// Default skill sets for new characters
const createDefaultCraftingSkills = (): CraftingSkillSet => ({
  clockmaking: 1,
  engineering: 1,
  alchemy: 1,
  steamcraft: 1,
  level: 1,
  experience: 0,
});

const createDefaultHarvestingSkills = (): HarvestingSkillSet => ({
  mining: 1,
  foraging: 1,
  salvaging: 1,
  crystal_extraction: 1,
  level: 1,
  experience: 0,
});

const createDefaultCombatSkills = (): CombatSkillSet => ({
  melee: 1,
  ranged: 1,
  defense: 1,
  tactics: 1,
  level: 1,
  experience: 0,
});

// Default character stats for new characters
const createDefaultStats = (): CharacterStats => ({
  strength: 10,
  dexterity: 10,
  intelligence: 10,
  vitality: 10,
  craftingSkills: createDefaultCraftingSkills(),
  harvestingSkills: createDefaultHarvestingSkills(),
  combatSkills: createDefaultCombatSkills(),
});

// Default specialization for new characters
const createDefaultSpecialization = (): Specialization => ({
  tankProgress: 0,
  healerProgress: 0,
  dpsProgress: 0,
  primaryRole: null,
  secondaryRole: null,
  bonuses: [],
});

// Default activity for new characters
const createDefaultActivity = (): Activity => ({
  type: 'crafting',
  startedAt: new Date(),
  progress: 0,
  rewards: [],
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
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

    const request: CreateCharacterRequest = JSON.parse(event.body);

    // Validate required fields
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

    // Validate character name
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

    // Check if user already has a character
    const existingCharacter = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
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

    // Create new character
    const now = new Date();
    const character: Character = {
      userId: request.userId,
      characterId: uuidv4(),
      name: request.name,
      level: 1,
      experience: 0,
      currency: 100, // Starting currency
      stats: createDefaultStats(),
      specialization: createDefaultSpecialization(),
      currentActivity: createDefaultActivity(),
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Save character to database
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.CHARACTERS,
      Item: character,
      ConditionExpression: 'attribute_not_exists(userId)', // Ensure no duplicate
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
  } catch (error) {
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