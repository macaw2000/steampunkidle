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
        const { accessToken } = JSON.parse(event.body);
        if (!accessToken) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'accessToken is required' }),
            };
        }
        const signOutCommand = new client_cognito_identity_provider_1.GlobalSignOutCommand({
            AccessToken: accessToken,
        });
        await cognitoClient.send(signOutCommand);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Logout successful',
            }),
        };
    }
    catch (error) {
        console.error('Logout error:', error);
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
