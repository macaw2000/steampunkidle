const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const createDefaultCharacter = (userId, name) => ({
  characterId: `char-${Date.now()}-${uuidv4().substring(0, 8)}`,
  userId,
  name,
  level: 1,
  experience: 0,
  currency: 50,
  stats: {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    craftingSkills: {
      clockmaking: 0,
      engineering: 0,
      alchemy: 0,
      steamcraft: 0,
      level: 1,
      experience: 0,
    },
    harvestingSkills: {
      mining: 0,
      foraging: 0,
      salvaging: 0,
      crystal_extraction: 0,
      level: 1,
      experience: 0,
    },
    combatSkills: {
      melee: 0,
      ranged: 0,
      defense: 0,
      tactics: 0,
      level: 1,
      experience: 0,
    },
  },
  specialization: {
    tankProgress: 0,
    healerProgress: 0,
    dpsProgress: 0,
    primaryRole: null,
    secondaryRole: null,
    bonuses: [],
  },
  currentActivity: {
    type: 'crafting',
    startedAt: new Date().toISOString(),
    progress: 0,
    rewards: [],
  },
  lastActiveAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

exports.handler = async (event, context) => {
  console.log('Character service called:', event.httpMethod, event.path);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { httpMethod, pathParameters, queryStringParameters, body } = event;
    
    switch (httpMethod) {
      case 'GET':
        // Get character by userId
        const userId = queryStringParameters?.userId;
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userId is required' }),
          };
        }

        try {
          const result = await docClient.send(new GetCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId },
          }));

          if (!result.Item) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Character not found' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ character: result.Item }),
          };
        } catch (error) {
          console.error('Error getting character:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to get character' }),
          };
        }

      case 'POST':
        // Handle different POST endpoints
        const path = event.path || '';
        
        if (path.includes('/validate-name')) {
          // Validate character name uniqueness
          const validateData = JSON.parse(body || '{}');
          if (!validateData.name) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'name is required' }),
            };
          }

          try {
            // Check if name already exists
            const result = await docClient.send(new ScanCommand({
              TableName: process.env.CHARACTERS_TABLE,
              FilterExpression: '#name = :name',
              ExpressionAttributeNames: {
                '#name': 'name'
              },
              ExpressionAttributeValues: {
                ':name': validateData.name
              },
              Select: 'COUNT'
            }));

            const isAvailable = result.Count === 0;
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ 
                available: isAvailable,
                message: isAvailable ? 'Name is available' : 'Name is already taken'
              }),
            };
          } catch (error) {
            console.error('Error validating character name:', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Failed to validate character name' }),
            };
          }
        } else {
          // Create character
          const createData = JSON.parse(body || '{}');
          if (!createData.userId || !createData.name) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'userId and name are required' }),
            };
          }

          // Check if character name is unique before creating
          try {
            const nameCheck = await docClient.send(new ScanCommand({
              TableName: process.env.CHARACTERS_TABLE,
              FilterExpression: '#name = :name',
              ExpressionAttributeNames: {
                '#name': 'name'
              },
              ExpressionAttributeValues: {
                ':name': createData.name
              },
              Select: 'COUNT'
            }));

            if (nameCheck.Count > 0) {
              return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ error: 'Character name is already taken' }),
              };
            }

            // Check if user already has a character
            const existingCharacter = await docClient.send(new GetCommand({
              TableName: process.env.CHARACTERS_TABLE,
              Key: { userId: createData.userId },
            }));

            if (existingCharacter.Item) {
              return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ error: 'User already has a character' }),
              };
            }

            const newCharacter = createDefaultCharacter(createData.userId, createData.name);

            await docClient.send(new PutCommand({
              TableName: process.env.CHARACTERS_TABLE,
              Item: newCharacter,
            }));

            console.log('Character created:', newCharacter.characterId);
            return {
              statusCode: 201,
              headers,
              body: JSON.stringify({ character: newCharacter }),
            };
          } catch (error) {
            console.error('Error creating character:', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Failed to create character' }),
            };
          }
        }

      case 'PUT':
        // Update character
        const updateUserId = pathParameters?.userId;
        const updateData = JSON.parse(body || '{}');
        
        if (!updateUserId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'userId is required' }),
          };
        }

        try {
          // Build update expression
          const updateExpression = [];
          const expressionAttributeValues = {};
          const expressionAttributeNames = {};

          if (updateData.experience !== undefined) {
            updateExpression.push('#exp = :exp');
            expressionAttributeNames['#exp'] = 'experience';
            expressionAttributeValues[':exp'] = updateData.experience;
          }

          if (updateData.level !== undefined) {
            updateExpression.push('#lvl = :lvl');
            expressionAttributeNames['#lvl'] = 'level';
            expressionAttributeValues[':lvl'] = updateData.level;
          }

          if (updateData.stats) {
            updateExpression.push('#stats = :stats');
            expressionAttributeNames['#stats'] = 'stats';
            expressionAttributeValues[':stats'] = updateData.stats;
          }

          updateExpression.push('#updatedAt = :updatedAt');
          expressionAttributeNames['#updatedAt'] = 'updatedAt';
          expressionAttributeValues[':updatedAt'] = new Date().toISOString();

          const result = await docClient.send(new UpdateCommand({
            TableName: process.env.CHARACTERS_TABLE,
            Key: { userId: updateUserId },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW',
          }));

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ character: result.Attributes }),
          };
        } catch (error) {
          console.error('Error updating character:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update character' }),
          };
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};