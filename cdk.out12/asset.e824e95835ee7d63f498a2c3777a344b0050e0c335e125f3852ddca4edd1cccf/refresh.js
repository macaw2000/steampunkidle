"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const handler = async (event) => {
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
        const { refreshToken, clientId } = JSON.parse(event.body);
        if (!refreshToken || !clientId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'refreshToken and clientId are required' }),
            };
        }
        const refreshCommand = new client_cognito_identity_provider_1.InitiateAuthCommand({
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
    }
    catch (error) {
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
exports.handler = handler;
