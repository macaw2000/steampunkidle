/**
 * WebSocket connection handlers for API Gateway WebSocket API
 * Handles connect, disconnect, and message routing for task queue notifications
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { WebSocketNotificationService } from './websocketNotificationService';

/**
 * Handle WebSocket connection
 */
export const connectHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId!;
    const playerId = event.queryStringParameters?.userId;

    if (!playerId) {
      console.error('Missing userId in WebSocket connection');
      return {
        statusCode: 400,
        body: 'Missing userId parameter'
      };
    }

    const wsService = new WebSocketNotificationService();
    await wsService.storeConnection(connectionId, playerId);

    console.log(`WebSocket connected: ${connectionId} for player ${playerId}`);

    return {
      statusCode: 200,
      body: 'Connected'
    };

  } catch (error) {
    console.error('Error in WebSocket connect handler:', error);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};

/**
 * Handle WebSocket disconnection
 */
export const disconnectHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId!;

    const wsService = new WebSocketNotificationService();
    await wsService.removeConnection(connectionId);

    console.log(`WebSocket disconnected: ${connectionId}`);

    return {
      statusCode: 200,
      body: 'Disconnected'
    };

  } catch (error) {
    console.error('Error in WebSocket disconnect handler:', error);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};

/**
 * Handle WebSocket messages
 */
export const messageHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId!;
    const message = JSON.parse(event.body || '{}');

    console.log(`WebSocket message from ${connectionId}:`, message);

    const wsService = new WebSocketNotificationService();

    // Handle different message types
    switch (message.type) {
      case 'ping':
        // Update connection ping time
        await wsService.updateConnectionPing(connectionId);
        break;

      case 'heartbeat':
        // Handle heartbeat from client
        await wsService.handleHeartbeat(connectionId, message.data);
        
        // Send heartbeat response
        await wsService.sendHeartbeatResponse(connectionId, {
          timestamp: Date.now(),
          received: message.data.timestamp
        });
        break;

      case 'sync_request':
        // Handle synchronization request
        await wsService.handleSyncRequest(connectionId, message.data);
        break;

      case 'delta_update':
        // Handle delta update from client
        await wsService.handleDeltaUpdate(connectionId, message.data);
        break;

      case 'conflict_resolution':
        // Handle conflict resolution response
        await wsService.handleConflictResolution(connectionId, message.data);
        break;

      case 'subscribe':
        // Handle subscription to specific notification types
        console.log(`Connection ${connectionId} subscribed to ${message.topics}`);
        break;

      case 'unsubscribe':
        // Handle unsubscription
        console.log(`Connection ${connectionId} unsubscribed from ${message.topics}`);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }

    return {
      statusCode: 200,
      body: 'Message processed'
    };

  } catch (error) {
    console.error('Error in WebSocket message handler:', error);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};

/**
 * Default handler for WebSocket routes
 */
export const defaultHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('WebSocket default handler called:', event.requestContext.routeKey);
  
  return {
    statusCode: 200,
    body: 'Default handler'
  };
};

/**
 * Scheduled function to clean up stale WebSocket connections
 */
export const cleanupHandler = async (): Promise<void> => {
  try {
    const wsService = new WebSocketNotificationService();
    await wsService.cleanupStaleConnections();
    console.log('WebSocket cleanup completed');
  } catch (error) {
    console.error('Error in WebSocket cleanup:', error);
  }
};