import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

interface LoginEvent {
  accessToken: string;
  userPoolId: string;
}

interface User {
  userId: string;
  email: string;
  socialProviders: string[];
  createdAt: string;
  lastLogin: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const { accessToken, userPoolId }: LoginEvent = JSON.parse(event.body);

    if (!accessToken || !userPoolId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'accessToken and userPoolId are required' }),
      };
    }

    // Get user info from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken,
    });

    const cognitoUser = await cognitoClient.send(getUserCommand);
    
    if (!cognitoUser.Username) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid access token' }),
      };
    }

    const userId = cognitoUser.Username;
    const email = cognitoUser.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '';
    const identities = cognitoUser.UserAttributes?.find(attr => attr.Name === 'identities')?.Value;
    
    // Parse social providers from identities
    let socialProviders: string[] = [];
    if (identities) {
      try {
        const identitiesArray = JSON.parse(identities);
        socialProviders = identitiesArray.map((identity: any) => identity.providerName);
      } catch (e) {
        // If parsing fails, assume direct Cognito login
        socialProviders = ['cognito'];
      }
    } else {
      socialProviders = ['cognito'];
    }

    // Check if user exists in our database
    const getUserResult = await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { userId },
    }));

    const now = new Date().toISOString();
    let user: User;

    if (getUserResult.Item) {
      // Update existing user's last login
      user = {
        ...getUserResult.Item as User,
        lastLogin: now,
        socialProviders: Array.from(new Set([...getUserResult.Item.socialProviders, ...socialProviders])),
      };
    } else {
      // Create new user
      user = {
        userId,
        email,
        socialProviders,
        createdAt: now,
        lastLogin: now,
      };
    }

    // Save/update user in database
    await docClient.send(new PutCommand({
      TableName: process.env.USERS_TABLE!,
      Item: user,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Login successful',
        user: {
          userId: user.userId,
          email: user.email,
          socialProviders: user.socialProviders,
          lastLogin: user.lastLogin,
        },
      }),
    };

  } catch (error) {
    console.error('Login error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};