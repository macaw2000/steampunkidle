/**
 * Lambda function for attacking a monster in a zone instance
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { ZoneInstance, ZoneReward } from '../../types/zone';
import { Character } from '../../types/character';
import { ZoneService } from '../../services/zoneService';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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

    // Get zone instance
    const instance = await DatabaseService.getItem<ZoneInstance>({
      TableName: TABLE_NAMES.ZONE_INSTANCES,
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

    // Get user character
    const character = await DatabaseService.getItem<Character>({
      TableName: TABLE_NAMES.CHARACTERS,
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

    // Find the monster
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

    // Calculate damage
    const damage = ZoneService.calculateDamage(character.level, character.stats, monster);
    
    // Apply damage to monster
    const updatedMonster = {
      ...monster,
      health: Math.max(0, monster.health - damage)
    };

    const updatedMonsters = [...instance.monsters];
    updatedMonsters[monsterIndex] = updatedMonster;

    let rewards: ZoneReward[] = [];
    
    // If monster is defeated, generate loot rewards
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
      
      // Add experience reward for defeating monster
      rewards.push({
        type: 'experience',
        amount: Math.floor(monster.level * 5 + instance.difficulty * 3),
        recipientId: userId
      });
    }

    // Update instance with new monster state and rewards
    const updatedRewards = [...instance.rewards, ...rewards];
    
    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.ZONE_INSTANCES,
      Key: { instanceId },
      UpdateExpression: 'SET monsters = :monsters, rewards = :rewards',
      ExpressionAttributeValues: {
        ':monsters': updatedMonsters,
        ':rewards': updatedRewards,
      },
    });

    // Check if all monsters are defeated
    const allMonstersDefeated = updatedMonsters.every(m => m.health <= 0);
    let completionRewards: ZoneReward[] = [];
    
    if (allMonstersDefeated) {
      // Generate completion rewards
      const party = await DatabaseService.getItem({
        TableName: TABLE_NAMES.PARTIES,
        Key: { partyId: instance.partyId },
      });
      
      if (party) {
        const memberIds = party.members.map((m: any) => m.userId);
        completionRewards = ZoneService.generateCompletionRewards(
          instance.zoneType,
          instance.difficulty,
          memberIds
        );
        
        // Update instance as completed
        await DatabaseService.updateItem({
          TableName: TABLE_NAMES.ZONE_INSTANCES,
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

        // Update party status back to forming
        await DatabaseService.updateItem({
          TableName: TABLE_NAMES.PARTIES,
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

    const updatedInstance: ZoneInstance = {
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
  } catch (error) {
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