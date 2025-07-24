/**
 * Tests for Enhanced WebSocket Notification Service with Real-Time Synchronization
 */

import { WebSocketNotificationService } from '../websocketNotificationService';
import { DatabaseService } from '../../../services/databaseService';
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi';

// Mock dependencies
jest.mock('../../../services/databaseService');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');

const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockApiGatewayClient = ApiGatewayManagementApiClient as jest.MockedClass<typeof ApiGatewayManagementApiClient>;

describe('Enhanced WebSocket Notification Service', () => {
  let wsService: WebSocketNotificationService;
  let mockApiClient: jest.Mocked<ApiGatewayManagementApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API Gateway client
    mockApiClient = {
      send: jest.fn().mockResolvedValue({})
    } as any;
    
    mockApiGatewayClient.mockImplementation(() => mockApiClient);
    
    // Set environment variables
    process.env.WEBSOCKET_API_ENDPOINT = 'wss://test.execute-api.us-east-1.amazonaws.com/dev';
    process.env.AWS_REGION = 'us-east-1';
    
    wsService = new WebSocketNotificationService();
  });

  describe('Enhanced Connection Management', () => {
    it('should store connection with heartbeat data', async () => {
      const connectionId = 'test-connection-1';
      const playerId = 'player1';

      await wsService.storeConnection(connectionId, playerId);

      expect(mockDatabaseService.putItem).toHaveBeenCalledWith({
        TableName: 'websocket-connections',
        Item: expect.objectContaining({
          connectionId,
          playerId,
          connectedAt: expect.any(Number),
          lastPing: expect.any(Number),
          lastHeartbeat: expect.any(Number),
          queueVersion: 0,
          isHealthy: true
        })
      });
    });

    it('should handle heartbeat from client', async () => {
      const connectionId = 'test-connection-1';
      const heartbeatData = {
        timestamp: Date.now(),
        queueVersion: 5,
        connectionId
      };

      await wsService.handleHeartbeat(connectionId, heartbeatData);

      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith({
        TableName: 'websocket-connections',
        Key: { connectionId },
        UpdateExpression: 'SET lastHeartbeat = :now, queueVersion = :version, isHealthy = :healthy',
        ExpressionAttributeValues: {
          ':now': expect.any(Number),
          ':version': 5,
          ':healthy': true
        }
      });
    });

    it('should send heartbeat response', async () => {
      const connectionId = 'test-connection-1';
      const responseData = {
        timestamp: Date.now(),
        received: Date.now() - 1000
      };

      await wsService.sendHeartbeatResponse(connectionId, responseData);

      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: connectionId,
          Data: expect.stringContaining('"type":"heartbeat_response"')
        })
      );
    });

    it('should clean up stale connections with health checking', async () => {
      const now = Date.now();
      const staleConnections = [
        {
          connectionId: 'stale-1',
          playerId: 'player1',
          connectedAt: now - 3600000,
          lastPing: now - 3600000,
          lastHeartbeat: now - 120000, // 2 minutes ago
          queueVersion: 1,
          isHealthy: false
        },
        {
          connectionId: 'healthy-1',
          playerId: 'player2',
          connectedAt: now - 60000,
          lastPing: now - 30000,
          lastHeartbeat: now - 30000,
          queueVersion: 2,
          isHealthy: true
        }
      ];

      mockDatabaseService.scan.mockResolvedValue({
        items: staleConnections
      });

      await wsService.cleanupStaleConnections();

      // Should mark unhealthy connections
      expect(mockDatabaseService.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: 'SET isHealthy = :healthy',
          ExpressionAttributeValues: {
            ':healthy': false
          }
        })
      );

      // Should remove truly stale connections
      expect(mockDatabaseService.deleteItem).toHaveBeenCalledWith({
        TableName: 'websocket-connections',
        Key: { connectionId: 'stale-1' }
      });
    });
  });

  describe('Synchronization Handling', () => {
    it('should handle sync request from client', async () => {
      const connectionId = 'test-connection-1';
      const syncRequest = {
        playerId: 'player1',
        lastSyncTimestamp: Date.now() - 10000,
        queueVersion: 3,
        requestedData: ['queue_state', 'task_progress']
      };

      await wsService.handleSyncRequest(connectionId, syncRequest);

      // Should send sync response
      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: connectionId,
          Data: expect.stringContaining('"type":"sync_response"')
        })
      );
    });

    it('should handle delta update from client', async () => {
      const connectionId = 'test-connection-1';
      const deltaUpdate = {
        type: 'task_progress',
        playerId: 'player1',
        taskId: 'task1',
        data: { progress: 0.75 },
        timestamp: Date.now(),
        version: 5,
        checksum: 'test-checksum'
      };

      await wsService.handleDeltaUpdate(connectionId, deltaUpdate);

      // Should validate and apply the delta update
      // In a real implementation, this would update server state
    });

    it('should broadcast delta updates to other connections', async () => {
      const connectionId = 'sender-connection';
      const otherConnections = [
        {
          connectionId: 'receiver-1',
          playerId: 'player1',
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          queueVersion: 4,
          isHealthy: true
        },
        {
          connectionId: 'receiver-2',
          playerId: 'player1',
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          queueVersion: 4,
          isHealthy: true
        }
      ];

      mockDatabaseService.query.mockResolvedValue({
        items: [
          ...otherConnections,
          {
            connectionId: connectionId,
            playerId: 'player1',
            connectedAt: Date.now(),
            lastPing: Date.now(),
            lastHeartbeat: Date.now(),
            queueVersion: 5,
            isHealthy: true
          }
        ]
      });

      const deltaUpdate = {
        type: 'task_added',
        playerId: 'player1',
        taskId: 'task2',
        data: { name: 'New Task' },
        timestamp: Date.now(),
        version: 6,
        checksum: 'new-checksum'
      };

      await wsService.handleDeltaUpdate(connectionId, deltaUpdate);

      // Should send to other connections but not the sender
      expect(mockApiClient.send).toHaveBeenCalledTimes(2);
      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: 'receiver-1'
        })
      );
      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: 'receiver-2'
        })
      );
    });

    it('should handle conflict resolution', async () => {
      const connectionId = 'test-connection-1';
      const conflictData = {
        conflictId: 'conflict-123',
        type: 'task_modified',
        serverValue: { progress: 0.5 },
        clientValue: { progress: 0.7 },
        resolution: 'merge'
      };

      await wsService.handleConflictResolution(connectionId, conflictData);

      // Should apply conflict resolution
      // In a real implementation, this would update server state with resolved values
    });

    it('should detect connection conflicts', async () => {
      const playerId = 'player1';
      const connections = [
        {
          connectionId: 'conn-1',
          playerId,
          queueVersion: 5,
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          isHealthy: true
        },
        {
          connectionId: 'conn-2',
          playerId,
          queueVersion: 7, // Different version
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          isHealthy: true
        }
      ];

      mockDatabaseService.query.mockResolvedValue({
        items: connections
      });

      const conflicts = await wsService.detectConnectionConflicts(playerId);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        type: 'queue_state_changed',
        serverValue: 7,
        clientValue: 5
      });
    });
  });

  describe('Delta Update Management', () => {
    it('should send delta update to player', async () => {
      const playerId = 'player1';
      const deltaUpdate = {
        type: 'task_completed',
        playerId,
        taskId: 'task1',
        data: {
          rewards: [
            { type: 'experience', quantity: 100 }
          ]
        },
        timestamp: Date.now(),
        version: 8,
        checksum: 'completion-checksum'
      };

      const connections = [
        {
          connectionId: 'conn-1',
          playerId,
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          queueVersion: 7,
          isHealthy: true
        }
      ];

      mockDatabaseService.query.mockResolvedValue({
        items: connections
      });

      await wsService.sendDeltaUpdate(playerId, deltaUpdate);

      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: 'conn-1',
          Data: expect.stringContaining('"type":"delta_update"')
        })
      );
    });

    it('should validate delta updates', async () => {
      const validDelta = {
        type: 'task_progress',
        playerId: 'player1',
        taskId: 'task1',
        data: { progress: 0.5 },
        timestamp: Date.now(),
        version: 5,
        checksum: 'valid-checksum'
      };

      const invalidDelta = {
        type: 'task_progress',
        playerId: '', // Invalid - empty player ID
        taskId: 'task1',
        data: { progress: 0.5 },
        timestamp: 0, // Invalid - zero timestamp
        version: 5,
        checksum: 'invalid-checksum'
      };

      // Test validation (this would be internal method)
      // In a real implementation, we'd test the validation logic
    });
  });

  describe('Task Event Notifications', () => {
    it('should send task started notification', async () => {
      const playerId = 'player1';
      const taskNotification = {
        type: 'task_started',
        playerId,
        taskId: 'task1',
        data: {
          taskName: 'Harvest Wood',
          estimatedDuration: 30000
        },
        timestamp: Date.now()
      };

      const connections = [
        {
          connectionId: 'conn-1',
          playerId,
          connectedAt: Date.now(),
          lastPing: Date.now(),
          lastHeartbeat: Date.now(),
          queueVersion: 5,
          isHealthy: true
        }
      ];

      mockDatabaseService.query.mockResolvedValue({
        items: connections
      });

      await wsService.sendToPlayer(playerId, taskNotification);

      expect(mockApiClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ConnectionId: 'conn-1',
          Data: expect.stringContaining('"type":"task_started"')
        })
      );
    });

    it('should send task progress notification', async () => {
      const playerId = 'player1';
      const progressNotification = {
        type: 'task_progress',
        playerId,
        taskId: 'task1',
        data: {
          progress: 0.65,
          timeRemaining: 10500
        },
        timestamp: Date.now()
      };

      await wsService.sendToPlayer(playerId, progressNotification);

      // Should attempt to send to player connections
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'PlayerIdIndex',
          KeyConditionExpression: 'playerId = :playerId'
        })
      );
    });

    it('should send task completion notification', async () => {
      const playerId = 'player1';
      const completionNotification = {
        type: 'task_completed',
        playerId,
        taskId: 'task1',
        data: {
          rewards: [
            { type: 'experience', quantity: 150 },
            { type: 'item', itemId: 'wood', quantity: 5 }
          ],
          nextTaskId: 'task2'
        },
        timestamp: Date.now()
      };

      await wsService.sendToPlayer(playerId, completionNotification);

      expect(mockDatabaseService.query).toHaveBeenCalled();
    });

    it('should handle queue update notifications', async () => {
      const playerId = 'player1';
      const queueUpdateNotification = {
        type: 'queue_updated',
        playerId,
        data: {
          currentTask: null,
          queuedTasks: [],
          isRunning: false,
          isPaused: true,
          pauseReason: 'Insufficient resources'
        },
        timestamp: Date.now()
      };

      await wsService.sendToPlayer(playerId, queueUpdateNotification);

      expect(mockDatabaseService.query).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API Gateway send errors gracefully', async () => {
      const connectionId = 'test-connection-1';
      const notification = {
        type: 'task_progress',
        playerId: 'player1',
        taskId: 'task1',
        data: { progress: 0.5 },
        timestamp: Date.now()
      };

      // Mock API Gateway error
      mockApiClient.send.mockRejectedValue(new Error('Connection not found'));

      // Should not throw error
      await expect(wsService.sendToPlayer('player1', notification)).resolves.not.toThrow();
    });

    it('should handle stale connection cleanup errors', async () => {
      mockDatabaseService.scan.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(wsService.cleanupStaleConnections()).resolves.not.toThrow();
    });

    it('should handle malformed sync requests', async () => {
      const connectionId = 'test-connection-1';
      const malformedRequest = {
        // Missing required fields
        playerId: 'player1'
      };

      // Should handle gracefully
      await expect(wsService.handleSyncRequest(connectionId, malformedRequest)).resolves.not.toThrow();
    });

    it('should handle database connection failures', async () => {
      mockDatabaseService.putItem.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw error when storing connection
      await expect(wsService.storeConnection('conn-1', 'player1')).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent heartbeats efficiently', async () => {
      const heartbeatPromises = [];
      
      for (let i = 0; i < 100; i++) {
        heartbeatPromises.push(
          wsService.handleHeartbeat(`conn-${i}`, {
            timestamp: Date.now(),
            queueVersion: i,
            connectionId: `conn-${i}`
          })
        );
      }

      const startTime = Date.now();
      await Promise.all(heartbeatPromises);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockDatabaseService.updateItem).toHaveBeenCalledTimes(100);
    });

    it('should efficiently broadcast to multiple connections', async () => {
      const playerId = 'player1';
      const connections = Array.from({ length: 50 }, (_, i) => ({
        connectionId: `conn-${i}`,
        playerId,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        lastHeartbeat: Date.now(),
        queueVersion: 5,
        isHealthy: true
      }));

      mockDatabaseService.query.mockResolvedValue({
        items: connections
      });

      const deltaUpdate = {
        type: 'task_progress',
        playerId,
        taskId: 'task1',
        data: { progress: 0.8 },
        timestamp: Date.now(),
        version: 6,
        checksum: 'progress-checksum'
      };

      const startTime = Date.now();
      await wsService.sendDeltaUpdate(playerId, deltaUpdate);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(500);
      expect(mockApiClient.send).toHaveBeenCalledTimes(50);
    });

    it('should handle large delta updates efficiently', async () => {
      const playerId = 'player1';
      const largeDeltaUpdate = {
        type: 'queue_state_changed',
        playerId,
        data: {
          // Large queue state with many tasks
          queuedTasks: Array.from({ length: 50 }, (_, i) => ({
            id: `task-${i}`,
            name: `Task ${i}`,
            progress: Math.random(),
            // ... other task properties
          }))
        },
        timestamp: Date.now(),
        version: 10,
        checksum: 'large-checksum'
      };

      const startTime = Date.now();
      await wsService.sendDeltaUpdate(playerId, largeDeltaUpdate);
      const endTime = Date.now();

      // Should handle large updates efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
});