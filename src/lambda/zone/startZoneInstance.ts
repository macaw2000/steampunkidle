/**
 * Lambda function for starting a zone instance
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';
import { ZoneInstance, Party } from '../../types/zone';
import { ZoneService } from '../../services/zoneService';
import { v4 as uuidv4 } from 'uuid';

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

    // Get party
    const party = await DatabaseService.getItem<Party>({
      TableName: TABLE_NAMES.PARTIES,
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

    // Validate party is ready to start
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

    // Check if all members are ready
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

    // Validate party composition
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

    // Check if party already has an active instance
    const existingInstance = await DatabaseService.scan({
      TableName: TABLE_NAMES.ZONE_INSTANCES,
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

    // Generate zone content
    const availableZoneTypes = ZoneService.getAvailableZoneTypes(party);
    const zoneType = availableZoneTypes[Math.floor(Math.random() * availableZoneTypes.length)];
    const difficulty = ZoneService.calculateDifficulty(party);
    const monsters = ZoneService.generateMonsters(zoneType, difficulty, party.members.length);

    // Create zone instance
    const now = new Date();
    const instanceId = uuidv4();

    const instance: ZoneInstance = {
      instanceId,
      partyId,
      zoneType,
      difficulty,
      monsters,
      rewards: [],
      startedAt: now,
      status: 'active',
    };

    // Save instance to database
    await DatabaseService.putItem({
      TableName: TABLE_NAMES.ZONE_INSTANCES,
      Item: instance,
      ConditionExpression: 'attribute_not_exists(instanceId)',
    });

    // Update party status to active
    await DatabaseService.updateItem({
      TableName: TABLE_NAMES.PARTIES,
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
  } catch (error) {
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