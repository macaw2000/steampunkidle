"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const databaseService_1 = require("../../services/databaseService");
const handler = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const type = queryParams.type;
        const visibility = queryParams.visibility;
        let filterExpression = '#status = :status';
        const expressionAttributeNames = {
            '#status': 'status',
        };
        const expressionAttributeValues = {
            ':status': 'forming',
        };
        if (type) {
            filterExpression += ' AND #type = :type';
            expressionAttributeNames['#type'] = 'type';
            expressionAttributeValues[':type'] = type;
        }
        if (visibility) {
            filterExpression += ' AND visibility = :visibility';
            expressionAttributeValues[':visibility'] = visibility;
        }
        else {
            filterExpression += ' AND visibility = :publicVisibility';
            expressionAttributeValues[':publicVisibility'] = 'public';
        }
        const result = await databaseService_1.DatabaseService.scan({
            TableName: databaseService_1.TABLE_NAMES.PARTIES,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        });
        const parties = result.items;
        const availableParties = parties
            .filter(party => party.members.length < party.maxMembers)
            .map(party => {
            const roleCount = { tank: 0, healer: 0, dps: 0 };
            party.members.forEach(member => {
                roleCount[member.role]++;
            });
            return {
                ...party,
                composition: {
                    totalMembers: party.members.length,
                    maxMembers: party.maxMembers,
                    roleDistribution: roleCount,
                    spotsRemaining: party.maxMembers - party.members.length,
                },
            };
        })
            .sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                parties: availableParties,
                total: availableParties.length,
            }),
        };
    }
    catch (error) {
        console.error('Error getting available parties:', error);
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
exports.handler = handler;
