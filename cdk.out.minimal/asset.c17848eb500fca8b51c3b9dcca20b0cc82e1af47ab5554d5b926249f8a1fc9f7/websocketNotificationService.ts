/**
 * WebSocket notification service for Lambda functions
 * Handles real-time notifications for task queue events
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DatabaseService, TABLE_NAMES } from '../../services/databaseService';

interface WebSocketConnection {
  connectionId: string;
  playerId: string;
  connectedAt: number;
  lastPing: number;
  lastHeartbeat: number;
  queueVersion: number;
  isHealthy: boolean;
}

interface TaskNotification {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'queue_updated' |
        'sync_request' | 'sync_response' | 'delta_update' | 'conflict_resolution' |
        'heartbeat' | 'heartbeat_response';
  playerId: string;
  taskId?: string;
  data: any;
  timestamp: number;
  messageId?: string;
}

interface DeltaUpdate {
  type: 'task_added' | 'task_removed' | 'task_updated' | 'queue_state_changed' | 'task_progress';
  playerId: string;
  taskId?: string;
  data: any;
  timestamp: number;
  version: number;
  checksum: string;
}

interface SyncRequest {
  playerId: string;
  lastSyncTimestamp: number;
  queueVersion: number;
  requestedData: string[];
}

interface ConflictData {
  conflictId: string;
  type: 'task_modified' | 'task_added' | 'task_removed' | 'queue_state_changed';
  serverValue: any;
  clientValue: any;
  resolution?: 'server_wins' | 'client_wins' | 'merge';
}

export class WebSocketNotificationService {
  private apiGatewayClient: ApiGatewayManagementApiClient | undefined;
  
  constructor() {
    // Initialize API Gateway Management API client
    const endpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (endpoint) {
      this.apiGatewayClient = new ApiGatewayManagementApiClient({
        endpoint,
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }
  }

  /**
   * Send notification to a specific player
   */
  async sendToPlayer(playerId: string, notification: TaskNotification): Promise<void> {
    try {
      // Get active connections for the player
      const connections = await this.getPlayerConnections(playerId);
      
      if (connections.length === 0) {
        console.log(`No active WebSocket connections for player ${playerId}`);
        // Store notification for later retrieval
        await this.storeNotification(notification);
        return;
      }

      // Send to all active connections
      const sendPromises = connections.map(connection => 
        this.sendToConnection(connection.connectionId, notification)
      );

      await Promise.allSettled(sendPromises);
      
    } catch (error) {
      console.error(`Error sending notification to player ${playerId}:`, error);
      // Fallback: store notification for polling
      await this.storeNotification(notification);
    }
  }

  /**
   * Send notification to a specific connection
   */
  private async sendToConnection(connectionId: string, notification: TaskNotification): Promise<void> {
    if (!this.apiGatewayClient) {
      console.warn('WebSocket API Gateway client not configured');
      return;
    }

    try {
      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(notification)
      });

      await this.apiGatewayClient.send(command);
      console.log(`Notification sent to connection ${connectionId}`);
      
    } catch (error: any) {
      console.error(`Error sending to connection ${connectionId}:`, error);
      
      // If connection is stale, remove it
      if (error.statusCode === 410) {
        await this.removeConnection(connectionId);
      }
    }
  }

  /**
   * Get active WebSocket connections for a player
   */
  private async getPlayerConnections(playerId: string): Promise<WebSocketConnection[]> {
    try {
      const result = await DatabaseService.query({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        IndexName: 'PlayerIdIndex',
        KeyConditionExpression: 'playerId = :playerId',
        ExpressionAttributeValues: {
          ':playerId': playerId
        }
      });

      return result.items as WebSocketConnection[];
      
    } catch (error) {
      console.error(`Error getting connections for player ${playerId}:`, error);
      return [];
    }
  }

  /**
   * Store connection when player connects
   */
  async storeConnection(connectionId: string, playerId: string): Promise<void> {
    try {
      const connection: WebSocketConnection = {
        connectionId,
        playerId,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        lastHeartbeat: Date.now(),
        queueVersion: 0,
        isHealthy: true
      };

      await DatabaseService.putItem({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        Item: connection
      });

      console.log(`Stored WebSocket connection ${connectionId} for player ${playerId}`);
      
    } catch (error) {
      console.error(`Error storing connection ${connectionId}:`, error);
    }
  }

  /**
   * Remove connection when player disconnects
   */
  async removeConnection(connectionId: string): Promise<void> {
    try {
      await DatabaseService.deleteItem({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        Key: { connectionId }
      });

      console.log(`Removed WebSocket connection ${connectionId}`);
      
    } catch (error) {
      console.error(`Error removing connection ${connectionId}:`, error);
    }
  }

  /**
   * Store notification for offline players or fallback
   */
  private async storeNotification(notification: TaskNotification): Promise<void> {
    try {
      await DatabaseService.putItem({
        TableName: TABLE_NAMES.NOTIFICATIONS || 'game-notifications',
        Item: {
          id: `${notification.type}-${notification.playerId}-${Date.now()}`,
          playerId: notification.playerId,
          type: notification.type,
          taskId: notification.taskId,
          data: notification.data,
          timestamp: notification.timestamp,
          read: false,
          ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hour TTL
        }
      });

      console.log(`Stored notification for player ${notification.playerId}`);
      
    } catch (error) {
      console.error(`Error storing notification:`, error);
    }
  }

  /**
   * Broadcast notification to all connected players
   */
  async broadcast(notification: Omit<TaskNotification, 'playerId'>): Promise<void> {
    try {
      // Get all active connections
      const result = await DatabaseService.scan({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections'
      });

      const connections = result.items as WebSocketConnection[];
      
      if (connections.length === 0) {
        console.log('No active WebSocket connections for broadcast');
        return;
      }

      // Send to all connections
      const sendPromises = connections.map(connection => 
        this.sendToConnection(connection.connectionId, {
          ...notification,
          playerId: connection.playerId
        })
      );

      await Promise.allSettled(sendPromises);
      console.log(`Broadcast sent to ${connections.length} connections`);
      
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }

  // First implementation of cleanupStaleConnections removed to avoid duplication
  // The enhanced version below is used instead

  /**
   * Update connection ping time
   */
  async updateConnectionPing(connectionId: string): Promise<void> {
    try {
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        Key: { connectionId },
        UpdateExpression: 'SET lastPing = :now',
        ExpressionAttributeValues: {
          ':now': Date.now()
        }
      });
      
    } catch (error) {
      console.error(`Error updating ping for connection ${connectionId}:`, error);
    }
  }

  /**
   * Handle heartbeat from client
   */
  async handleHeartbeat(connectionId: string, heartbeatData: any): Promise<void> {
    try {
      await DatabaseService.updateItem({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        Key: { connectionId },
        UpdateExpression: 'SET lastHeartbeat = :now, queueVersion = :version, isHealthy = :healthy',
        ExpressionAttributeValues: {
          ':now': Date.now(),
          ':version': heartbeatData.queueVersion || 0,
          ':healthy': true
        }
      });

      console.log(`Heartbeat received from connection ${connectionId}`);
      
    } catch (error) {
      console.error(`Error handling heartbeat for connection ${connectionId}:`, error);
    }
  }

  /**
   * Send heartbeat response to client
   */
  async sendHeartbeatResponse(connectionId: string, responseData: any): Promise<void> {
    const response: TaskNotification = {
      type: 'heartbeat_response',
      playerId: '', // Will be filled by connection lookup
      data: responseData,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    await this.sendToConnection(connectionId, response);
  }

  /**
   * Handle synchronization request from client
   */
  async handleSyncRequest(connectionId: string, syncRequest: SyncRequest): Promise<void> {
    try {
      console.log(`Sync request from connection ${connectionId}:`, syncRequest);

      // Get current server state for the player
      const serverQueueState = await this.getServerQueueState(syncRequest.playerId);
      
      // Calculate delta updates since last sync
      const deltaUpdates = await this.calculateDeltaUpdates(
        syncRequest.playerId,
        syncRequest.lastSyncTimestamp
      );

      // Send sync response
      const syncResponse: TaskNotification = {
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
      
    } catch (error) {
      console.error(`Error handling sync request from connection ${connectionId}:`, error);
    }
  }

  /**
   * Handle delta update from client
   */
  async handleDeltaUpdate(connectionId: string, deltaUpdate: DeltaUpdate): Promise<void> {
    try {
      console.log(`Delta update from connection ${connectionId}:`, deltaUpdate);

      // Validate delta update
      const isValid = await this.validateDeltaUpdate(deltaUpdate);
      if (!isValid) {
        console.warn(`Invalid delta update from connection ${connectionId}`);
        return;
      }

      // Apply delta update to server state
      await this.applyDeltaUpdate(deltaUpdate);

      // Broadcast delta update to other connections for the same player
      await this.broadcastDeltaUpdate(deltaUpdate, connectionId);
      
    } catch (error) {
      console.error(`Error handling delta update from connection ${connectionId}:`, error);
    }
  }

  /**
   * Handle conflict resolution from client
   */
  async handleConflictResolution(connectionId: string, conflictData: ConflictData): Promise<void> {
    try {
      console.log(`Conflict resolution from connection ${connectionId}:`, conflictData);

      // Apply conflict resolution
      await this.applyConflictResolution(conflictData);

      // Notify other connections about resolution
      await this.notifyConflictResolution(conflictData, connectionId);
      
    } catch (error) {
      console.error(`Error handling conflict resolution from connection ${connectionId}:`, error);
    }
  }

  /**
   * Send delta update to specific player connections
   */
  async sendDeltaUpdate(playerId: string, deltaUpdate: DeltaUpdate): Promise<void> {
    const notification: TaskNotification = {
      type: 'delta_update',
      playerId,
      data: deltaUpdate,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    await this.sendToPlayer(playerId, notification);
  }

  /**
   * Detect and handle connection conflicts
   */
  async detectConnectionConflicts(playerId: string): Promise<ConflictData[]> {
    try {
      const connections = await this.getPlayerConnections(playerId);
      const conflicts: ConflictData[] = [];

      // Check for version conflicts between connections
      const versions = connections.map(conn => conn.queueVersion);
      // Use Array.filter for uniqueness instead of Set
      const uniqueVersions = versions.filter((value, index, self) => self.indexOf(value) === index);

      if (uniqueVersions.length > 1) {
        // Multiple versions detected - conflict!
        conflicts.push({
          conflictId: this.generateConflictId(),
          type: 'queue_state_changed',
          serverValue: Math.max(...versions),
          clientValue: Math.min(...versions)
        });
      }

      return conflicts;
      
    } catch (error) {
      console.error(`Error detecting conflicts for player ${playerId}:`, error);
      return [];
    }
  }

  /**
   * Clean up stale connections with enhanced health checking
   */
  async cleanupStaleConnections(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      const heartbeatCutoff = Date.now() - (90 * 1000); // 90 seconds ago
      
      const result = await DatabaseService.scan({
        TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
        FilterExpression: 'lastPing < :cutoff OR lastHeartbeat < :heartbeatCutoff',
        ExpressionAttributeValues: {
          ':cutoff': cutoffTime,
          ':heartbeatCutoff': heartbeatCutoff
        }
      });

      const staleConnections = result.items as WebSocketConnection[];
      
      // Mark unhealthy connections
      const unhealthyConnections = staleConnections.filter(conn => 
        Date.now() - conn.lastHeartbeat > heartbeatCutoff
      );

      for (const conn of unhealthyConnections) {
        await DatabaseService.updateItem({
          TableName: TABLE_NAMES.WEBSOCKET_CONNECTIONS || 'websocket-connections',
          Key: { connectionId: conn.connectionId },
          UpdateExpression: 'SET isHealthy = :healthy',
          ExpressionAttributeValues: {
            ':healthy': false
          }
        });
      }

      // Remove truly stale connections
      const deletePromises = staleConnections
        .filter(conn => Date.now() - conn.lastPing > cutoffTime)
        .map(connection => this.removeConnection(connection.connectionId));

      await Promise.allSettled(deletePromises);
      
      if (staleConnections.length > 0) {
        console.log(`Cleaned up ${staleConnections.length} stale WebSocket connections`);
      }
      
    } catch (error) {
      console.error('Error cleaning up stale connections:', error);
    }
  }

  // Helper methods for synchronization
  private async getServerQueueState(playerId: string): Promise<any> {
    // This would fetch the current queue state from the database
    // For now, return a placeholder
    return {
      playerId,
      version: 1,
      lastUpdated: Date.now()
    };
  }

  private async calculateDeltaUpdates(playerId: string, lastSyncTimestamp: number): Promise<DeltaUpdate[]> {
    // This would calculate what has changed since the last sync
    // For now, return empty array
    return [];
  }

  private async validateDeltaUpdate(deltaUpdate: DeltaUpdate): Promise<boolean> {
    // Validate the delta update
    return !!deltaUpdate.playerId && !!deltaUpdate.type && deltaUpdate.timestamp > 0;
  }

  private async applyDeltaUpdate(deltaUpdate: DeltaUpdate): Promise<void> {
    // Apply the delta update to server state
    console.log('Applying delta update:', deltaUpdate);
  }

  private async broadcastDeltaUpdate(deltaUpdate: DeltaUpdate, excludeConnectionId: string): Promise<void> {
    // Broadcast to other connections for the same player
    const connections = await this.getPlayerConnections(deltaUpdate.playerId);
    const otherConnections = connections.filter(conn => conn.connectionId !== excludeConnectionId);

    const notification: TaskNotification = {
      type: 'delta_update',
      playerId: deltaUpdate.playerId,
      data: deltaUpdate,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    const sendPromises = otherConnections.map(conn => 
      this.sendToConnection(conn.connectionId, notification)
    );

    await Promise.allSettled(sendPromises);
  }

  private async applyConflictResolution(conflictData: ConflictData): Promise<void> {
    // Apply the conflict resolution to server state
    console.log('Applying conflict resolution:', conflictData);
  }

  private async notifyConflictResolution(conflictData: ConflictData, excludeConnectionId: string): Promise<void> {
    // Notify other connections about the conflict resolution
    console.log('Notifying conflict resolution:', conflictData);
  }

  private generateMessageId(): string {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private generateConflictId(): string {
    return 'conflict-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
}

export default WebSocketNotificationService;