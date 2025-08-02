"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupHandler = exports.defaultHandler = exports.messageHandler = exports.disconnectHandler = exports.connectHandler = void 0;
const websocketNotificationService_1 = require("./websocketNotificationService");
const connectHandler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const playerId = event.queryStringParameters?.userId;
        if (!playerId) {
            console.error('Missing userId in WebSocket connection');
            return {
                statusCode: 400,
                body: 'Missing userId parameter'
            };
        }
        const wsService = new websocketNotificationService_1.WebSocketNotificationService();
        await wsService.storeConnection(connectionId, playerId);
        console.log(`WebSocket connected: ${connectionId} for player ${playerId}`);
        return {
            statusCode: 200,
            body: 'Connected'
        };
    }
    catch (error) {
        console.error('Error in WebSocket connect handler:', error);
        return {
            statusCode: 500,
            body: 'Internal server error'
        };
    }
};
exports.connectHandler = connectHandler;
const disconnectHandler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const wsService = new websocketNotificationService_1.WebSocketNotificationService();
        await wsService.removeConnection(connectionId);
        console.log(`WebSocket disconnected: ${connectionId}`);
        return {
            statusCode: 200,
            body: 'Disconnected'
        };
    }
    catch (error) {
        console.error('Error in WebSocket disconnect handler:', error);
        return {
            statusCode: 500,
            body: 'Internal server error'
        };
    }
};
exports.disconnectHandler = disconnectHandler;
const messageHandler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        const message = JSON.parse(event.body || '{}');
        console.log(`WebSocket message from ${connectionId}:`, message);
        const wsService = new websocketNotificationService_1.WebSocketNotificationService();
        switch (message.type) {
            case 'ping':
                await wsService.updateConnectionPing(connectionId);
                break;
            case 'heartbeat':
                await wsService.handleHeartbeat(connectionId, message.data);
                await wsService.sendHeartbeatResponse(connectionId, {
                    timestamp: Date.now(),
                    received: message.data.timestamp
                });
                break;
            case 'sync_request':
                await wsService.handleSyncRequest(connectionId, message.data);
                break;
            case 'delta_update':
                await wsService.handleDeltaUpdate(connectionId, message.data);
                break;
            case 'conflict_resolution':
                await wsService.handleConflictResolution(connectionId, message.data);
                break;
            case 'subscribe':
                console.log(`Connection ${connectionId} subscribed to ${message.topics}`);
                break;
            case 'unsubscribe':
                console.log(`Connection ${connectionId} unsubscribed from ${message.topics}`);
                break;
            default:
                console.warn(`Unknown message type: ${message.type}`);
        }
        return {
            statusCode: 200,
            body: 'Message processed'
        };
    }
    catch (error) {
        console.error('Error in WebSocket message handler:', error);
        return {
            statusCode: 500,
            body: 'Internal server error'
        };
    }
};
exports.messageHandler = messageHandler;
const defaultHandler = async (event) => {
    console.log('WebSocket default handler called:', event.requestContext.routeKey);
    return {
        statusCode: 200,
        body: 'Default handler'
    };
};
exports.defaultHandler = defaultHandler;
const cleanupHandler = async () => {
    try {
        const wsService = new websocketNotificationService_1.WebSocketNotificationService();
        await wsService.cleanupStaleConnections();
        console.log('WebSocket cleanup completed');
    }
    catch (error) {
        console.error('Error in WebSocket cleanup:', error);
    }
};
exports.cleanupHandler = cleanupHandler;
