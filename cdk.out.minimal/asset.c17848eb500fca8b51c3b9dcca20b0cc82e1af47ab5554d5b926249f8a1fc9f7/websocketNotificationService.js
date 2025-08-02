"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketNotificationService = void 0;
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const databaseService_1 = require("../../services/databaseService");
class WebSocketNotificationService {
    constructor() {
        const endpoint = process.env.WEBSOCKET_API_ENDPOINT;
        if (endpoint) {
            this.apiGatewayClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
                endpoint,
                region: process.env.AWS_REGION || 'us-east-1'
            });
        }
    }
    async sendToPlayer(playerId, notification) {
        try {
            const connections = await this.getPlayerConnections(playerId);
            if (connections.length === 0) {
                console.log(`No active WebSocket connections for player ${playerId}`);
                await this.storeNotification(notification);
                return;
            }
            const sendPromises = connections.map(connection => this.sendToConnection(connection.connectionId, notification));
            await Promise.allSettled(sendPromises);
        }
        catch (error) {
            console.error(`Error sending notification to player ${playerId}:`, error);
            await this.storeNotification(notification);
        }
    }
    async sendToConnection(connectionId, notification) {
        if (!this.apiGatewayClient) {
            console.warn('WebSocket API Gateway client not configured');
            return;
        }
        try {
            const command = new client_apigatewaymanagementapi_1.PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: JSON.stringify(notification)
            });
            await this.apiGatewayClient.send(command);
            console.log(`Notification sent to connection ${connectionId}`);
        }
        catch (error) {
            console.error(`Error sending to connection ${connectionId}:`, error);
            if (error.statusCode === 410) {
                await this.removeConnection(connectionId);
            }
        }
    }
    async getPlayerConnections(playerId) {
        try {
            const result = await databaseService_1.DatabaseService.query({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                IndexName: 'PlayerIdIndex',
                KeyConditionExpression: 'playerId = :playerId',
                ExpressionAttributeValues: {
                    ':playerId': playerId
                }
            });
            return result.items;
        }
        catch (error) {
            console.error(`Error getting connections for player ${playerId}:`, error);
            return [];
        }
    }
    async storeConnection(connectionId, playerId) {
        try {
            const connection = {
                connectionId,
                playerId,
                connectedAt: Date.now(),
                lastPing: Date.now(),
                lastHeartbeat: Date.now(),
                queueVersion: 0,
                isHealthy: true
            };
            await databaseService_1.DatabaseService.putItem({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                Item: connection
            });
            console.log(`Stored WebSocket connection ${connectionId} for player ${playerId}`);
        }
        catch (error) {
            console.error(`Error storing connection ${connectionId}:`, error);
        }
    }
    async removeConnection(connectionId) {
        try {
            await databaseService_1.DatabaseService.deleteItem({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                Key: { connectionId }
            });
            console.log(`Removed WebSocket connection ${connectionId}`);
        }
        catch (error) {
            console.error(`Error removing connection ${connectionId}:`, error);
        }
    }
    async storeNotification(notification) {
        try {
            await databaseService_1.DatabaseService.putItem({
                TableName: databaseService_1.TABLE_NAMES.NOTIFICATIONS || 'game-notifications',
                Item: {
                    id: `${notification.type}-${notification.playerId}-${Date.now()}`,
                    playerId: notification.playerId,
                    type: notification.type,
                    taskId: notification.taskId,
                    data: notification.data,
                    timestamp: notification.timestamp,
                    read: false,
                    ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
                }
            });
            console.log(`Stored notification for player ${notification.playerId}`);
        }
        catch (error) {
            console.error(`Error storing notification:`, error);
        }
    }
    async broadcast(notification) {
        try {
            const result = await databaseService_1.DatabaseService.scan({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections'
            });
            const connections = result.items;
            if (connections.length === 0) {
                console.log('No active WebSocket connections for broadcast');
                return;
            }
            const sendPromises = connections.map(connection => this.sendToConnection(connection.connectionId, {
                ...notification,
                playerId: connection.playerId
            }));
            await Promise.allSettled(sendPromises);
            console.log(`Broadcast sent to ${connections.length} connections`);
        }
        catch (error) {
            console.error('Error broadcasting notification:', error);
        }
    }
    async updateConnectionPing(connectionId) {
        try {
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                Key: { connectionId },
                UpdateExpression: 'SET lastPing = :now',
                ExpressionAttributeValues: {
                    ':now': Date.now()
                }
            });
        }
        catch (error) {
            console.error(`Error updating ping for connection ${connectionId}:`, error);
        }
    }
    async handleHeartbeat(connectionId, heartbeatData) {
        try {
            await databaseService_1.DatabaseService.updateItem({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                Key: { connectionId },
                UpdateExpression: 'SET lastHeartbeat = :now, queueVersion = :version, isHealthy = :healthy',
                ExpressionAttributeValues: {
                    ':now': Date.now(),
                    ':version': heartbeatData.queueVersion || 0,
                    ':healthy': true
                }
            });
            console.log(`Heartbeat received from connection ${connectionId}`);
        }
        catch (error) {
            console.error(`Error handling heartbeat for connection ${connectionId}:`, error);
        }
    }
    async sendHeartbeatResponse(connectionId, responseData) {
        const response = {
            type: 'heartbeat_response',
            playerId: '',
            data: responseData,
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };
        await this.sendToConnection(connectionId, response);
    }
    async handleSyncRequest(connectionId, syncRequest) {
        try {
            console.log(`Sync request from connection ${connectionId}:`, syncRequest);
            const serverQueueState = await this.getServerQueueState(syncRequest.playerId);
            const deltaUpdates = await this.calculateDeltaUpdates(syncRequest.playerId, syncRequest.lastSyncTimestamp);
            const syncResponse = {
                type: 'sync_response',
                playerId: syncRequest.playerId,
                data: {
                    serverQueueState,
                    deltaUpdates,
                    timestamp: Date.now()
                },
                timestamp: Date.now(),
                messageId: this.generateMessageId()
            };
            await this.sendToConnection(connectionId, syncResponse);
        }
        catch (error) {
            console.error(`Error handling sync request from connection ${connectionId}:`, error);
        }
    }
    async handleDeltaUpdate(connectionId, deltaUpdate) {
        try {
            console.log(`Delta update from connection ${connectionId}:`, deltaUpdate);
            const isValid = await this.validateDeltaUpdate(deltaUpdate);
            if (!isValid) {
                console.warn(`Invalid delta update from connection ${connectionId}`);
                return;
            }
            await this.applyDeltaUpdate(deltaUpdate);
            await this.broadcastDeltaUpdate(deltaUpdate, connectionId);
        }
        catch (error) {
            console.error(`Error handling delta update from connection ${connectionId}:`, error);
        }
    }
    async handleConflictResolution(connectionId, conflictData) {
        try {
            console.log(`Conflict resolution from connection ${connectionId}:`, conflictData);
            await this.applyConflictResolution(conflictData);
            await this.notifyConflictResolution(conflictData, connectionId);
        }
        catch (error) {
            console.error(`Error handling conflict resolution from connection ${connectionId}:`, error);
        }
    }
    async sendDeltaUpdate(playerId, deltaUpdate) {
        const notification = {
            type: 'delta_update',
            playerId,
            data: deltaUpdate,
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };
        await this.sendToPlayer(playerId, notification);
    }
    async detectConnectionConflicts(playerId) {
        try {
            const connections = await this.getPlayerConnections(playerId);
            const conflicts = [];
            const versions = connections.map(conn => conn.queueVersion);
            const uniqueVersions = versions.filter((value, index, self) => self.indexOf(value) === index);
            if (uniqueVersions.length > 1) {
                conflicts.push({
                    conflictId: this.generateConflictId(),
                    type: 'queue_state_changed',
                    serverValue: Math.max(...versions),
                    clientValue: Math.min(...versions)
                });
            }
            return conflicts;
        }
        catch (error) {
            console.error(`Error detecting conflicts for player ${playerId}:`, error);
            return [];
        }
    }
    async cleanupStaleConnections() {
        try {
            const cutoffTime = Date.now() - (30 * 60 * 1000);
            const heartbeatCutoff = Date.now() - (90 * 1000);
            const result = await databaseService_1.DatabaseService.scan({
                TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                FilterExpression: 'lastPing < :cutoff OR lastHeartbeat < :heartbeatCutoff',
                ExpressionAttributeValues: {
                    ':cutoff': cutoffTime,
                    ':heartbeatCutoff': heartbeatCutoff
                }
            });
            const staleConnections = result.items;
            const unhealthyConnections = staleConnections.filter(conn => Date.now() - conn.lastHeartbeat > heartbeatCutoff);
            for (const conn of unhealthyConnections) {
                await databaseService_1.DatabaseService.updateItem({
                    TableName: databaseService_1.TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
                    Key: { connectionId: conn.connectionId },
                    UpdateExpression: 'SET isHealthy = :healthy',
                    ExpressionAttributeValues: {
                        ':healthy': false
                    }
                });
            }
            const deletePromises = staleConnections
                .filter(conn => Date.now() - conn.lastPing > cutoffTime)
                .map(connection => this.removeConnection(connection.connectionId));
            await Promise.allSettled(deletePromises);
            if (staleConnections.length > 0) {
                console.log(`Cleaned up ${staleConnections.length} stale WebSocket connections`);
            }
        }
        catch (error) {
            console.error('Error cleaning up stale connections:', error);
        }
    }
    async getServerQueueState(playerId) {
        return {
            playerId,
            version: 1,
            lastUpdated: Date.now()
        };
    }
    async calculateDeltaUpdates(playerId, lastSyncTimestamp) {
        return [];
    }
    async validateDeltaUpdate(deltaUpdate) {
        return !!deltaUpdate.playerId && !!deltaUpdate.type && deltaUpdate.timestamp > 0;
    }
    async applyDeltaUpdate(deltaUpdate) {
        console.log('Applying delta update:', deltaUpdate);
    }
    async broadcastDeltaUpdate(deltaUpdate, excludeConnectionId) {
        const connections = await this.getPlayerConnections(deltaUpdate.playerId);
        const otherConnections = connections.filter(conn => conn.connectionId !== excludeConnectionId);
        const notification = {
            type: 'delta_update',
            playerId: deltaUpdate.playerId,
            data: deltaUpdate,
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };
        const sendPromises = otherConnections.map(conn => this.sendToConnection(conn.connectionId, notification));
        await Promise.allSettled(sendPromises);
    }
    async applyConflictResolution(conflictData) {
        console.log('Applying conflict resolution:', conflictData);
    }
    async notifyConflictResolution(conflictData, excludeConnectionId) {
        console.log('Notifying conflict resolution:', conflictData);
    }
    generateMessageId() {
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    generateConflictId() {
        return 'conflict-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}
exports.WebSocketNotificationService = WebSocketNotificationService;
exports.default = WebSocketNotificationService;
