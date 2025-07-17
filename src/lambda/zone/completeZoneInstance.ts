/**
 * Lambda function for completing a zone instance
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { ZoneInstance, ZoneReward } from '../../types/zone';

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

    if (instance.status !== 'completed') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Zone instance is not completed',
        }),
      };
    }

    // Apply rewards to characters
    const rewardsByUser = new Map<string, ZoneReward[]>();
    
    instance.rewards.forEach(reward => {
      if (!rewardsByUser.has(reward.recipientId)) {
        rewardsByUser.set(reward.recipientId, []);
      }
      rewardsByUser.get(reward.recipientId)!.push(reward);
    });

    // Process rewards for each user
    for (const [userId, userRewards] of Array.from(rewardsByUser.entries())) {
      // Get character
      const character = await DatabaseService.getItem({
        TableName: TABLE_NAMES.CHARACTERS,
        Key: { userId },
      });

      if (character) {
        let updateExpression = '';
        const expressionAttributeValues: any = {};
        const expressionAttributeNames: any = {};

        // Process experience rewards
        const expRewards = userRewards.filter(r => r.type === 'experience');
        if (expRewards.length > 0) {
          const totalExp = expRewards.reduce((sum, r) => sum + r.amount, 0);
          updateExpression += 'ADD experience :exp';
          expressionAttributeValues[':exp'] = totalExp;
        }

        // Process currency rewards
        const currencyRewards = userRewards.filter(r => r.type === 'currency');
        if (currencyRewards.length > 0) {
          const totalCurrency = currencyRewards.reduce((sum, r) => sum + r.amount, 0);
          if (updateExpression) updateExpression += ', ';
          updateExpression += 'ADD currency :currency';
          expressionAttributeValues[':currency'] = totalCurrency;
        }

        // Update character if there are rewards to apply
        if (updateExpression) {
          await DatabaseService.updateItem({
            TableName: TABLE_NAMES.CHARACTERS,
            Key: { userId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          });
        }

        // Process item rewards (add to inventory)
        const itemRewards = userRewards.filter(r => r.type === 'item');
        for (const itemReward of itemRewards) {
          if (itemReward.itemId) {
            try {
              await DatabaseService.updateItem({
                TableName: TABLE_NAMES.INVENTORY,
                Key: { userId, itemId: itemReward.itemId },
                UpdateExpression: 'ADD quantity :quantity',
                ExpressionAttributeValues: {
                  ':quantity': itemReward.amount,
                },
              });
            } catch (error) {
              // If item doesn't exist in inventory, create it
              await DatabaseService.putItem({
                TableName: TABLE_NAMES.INVENTORY,
                Item: {
                  userId,
                  itemId: itemReward.itemId,
                  quantity: itemReward.amount,
                  acquiredAt: new Date().toISOString(),
                },
                ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(itemId)',
              });
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        rewards: instance.rewards,
        message: 'Zone instance completed and rewards distributed',
      }),
    };
  } catch (error) {
    console.error('Error completing zone instance:', error);

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