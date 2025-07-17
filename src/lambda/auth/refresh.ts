import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

interface RefreshTokenEvent {
  refreshToken: string;
  clientId: string;
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

    const { refreshToken, clientId }: RefreshTokenEvent = JSON.parse(event.body);

    if (!refreshToken || !clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'refreshToken and clientId are required' }),
      };
    }

    // Refresh the access token using Cognito
    const refreshCommand = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const refreshResult = await cognitoClient.send(refreshCommand);

    if (!refreshResult.AuthenticationResult) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid refresh token' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accessToken: refreshResult.AuthenticationResult.AccessToken,
        idToken: refreshResult.AuthenticationResult.IdToken,
        expiresIn: refreshResult.AuthenticationResult.ExpiresIn,
      }),
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    
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