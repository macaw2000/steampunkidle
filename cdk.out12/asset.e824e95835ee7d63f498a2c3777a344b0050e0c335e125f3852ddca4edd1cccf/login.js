"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
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
        const { accessToken, userPoolId } = JSON.parse(event.body);
        if (!accessToken || !userPoolId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'accessToken and userPoolId are required' }),
            };
        }
        const getUserCommand = new client_cognito_identity_provider_1.GetUserCommand({
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
        let socialProviders = [];
        if (identities) {
            try {
                const identitiesArray = JSON.parse(identities);
                socialProviders = identitiesArray.map((identity) => identity.providerName);
            }
            catch (e) {
                socialProviders = ['cognito'];
            }
        }
        else {
            socialProviders = ['cognito'];
        }
        const getUserResult = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.USERS_TABLE,
            Key: { userId },
        }));
        const now = new Date().toISOString();
        let user;
        if (getUserResult.Item) {
            user = {
                ...getUserResult.Item,
                lastLogin: now,
                socialProviders: Array.from(new Set([...getUserResult.Item.socialProviders, ...socialProviders])),
            };
        }
        else {
            user = {
                userId,
                email,
                socialProviders,
                createdAt: now,
                lastLogin: now,
            };
        }
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.USERS_TABLE,
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
    }
    catch (error) {
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
exports.handler = handler;
