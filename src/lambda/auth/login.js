const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Simple JWT-like token generation (for demo purposes)
const generateToken = (userId) => {
  const payload = {
    userId,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    iat: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

exports.handler = async (event, context) => {
  console.log('Login service called');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
    const { email, password, name } = JSON.parse(event.body || '{}');
    
    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    // For demo purposes, create a simple user if they don't exist
    const userId = `user-${Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 16)}`;
    
    try {
      // Check if user exists
      let user;
      try {
        const result = await docClient.send(new GetCommand({
          TableName: process.env.USERS_TABLE,
          Key: { userId },
        }));
        user = result.Item;
      } catch (error) {
        console.log('User not found, will create new user');
      }

      // Create user if doesn't exist
      if (!user) {
        user = {
          userId,
          email,
          name: name || email.split('@')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        await docClient.send(new PutCommand({
          TableName: process.env.USERS_TABLE,
          Item: user,
        }));

        console.log('New user created:', userId);
      }

      // Generate tokens
      const accessToken = generateToken(userId);
      const refreshToken = generateToken(userId + '-refresh');

      const response = {
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 86400, // 24 hours
        },
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
      };
    } catch (error) {
      console.error('Error during login:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Login failed' }),
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