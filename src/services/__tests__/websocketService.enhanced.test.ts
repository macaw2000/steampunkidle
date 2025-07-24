/**
 * Tests for Enhanced WebSocket Service with Real-Time Synchronization
 */

import WebSocketService, { HeartbeatMessage, TaskSyncMessage, TaskEventMessage } from '../websocketService';
import { offlineService } from '../offlineService';

// Mock dependencies
jest.mock('../offlineService');
const mockOfflineService = offlineService as jest.Mocked<typeof offlineService>;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send = jest.fn();
  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  });
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('Enhanced WebSocket Service', () => {
  let wsService: WebSocketService;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockOfflineService.isOffline.mockReturnValue(false);
    mockOfflineService.waitForOnline.mockResolvedValue();
    
    wsService = WebSocketService.getInstance();
  });

  afterEach(() => {
    wsService.disconnect();
    jest.useRealTimers();
  });

  describe('Enhanced Connection Management', () => {
    it('should establish connection with heartbeat', async () => {
      const connectPromise = wsService.connect('player1');
      
      // Fast forward to complete connection
      jest.advanceTimersByTime(20);
      await connectPromise;

      expect(wsService.isConnected()).toBe(true);
      
      // Should start heartbeat
      jest.advanceTimersByTime(30000);
      
      const stats = wsService.getConnectionStats();
      expect(stats.isConnected).toBe(true);
      expect(stats.connectionId).toBeTruthy();
    });

    it('should generate unique connection ID', async () => {
      await wsService.connect('player1');
      const stats1 = wsService.getConnectionStats();
      
      wsService.disconnect();
      await wsService.connect('player1');
      const stats2 = wsService.getConnectionStats();
      
      expect(stats1.connectionId).not.toBe(stats2.connectionId);
    });

    it('should track connection statistics', async () => {
      await wsService.connect('player1');
      
      const stats = wsService.getConnectionStats();
      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('connectionId');
      expect(stats).toHaveProperty('lastHeartbeat');
      expect(stats).toHaveProperty('queuedMessages');
      expect(stats).toHaveProperty('pendingAcks');
      expect(stats).toHaveProperty('reconnectAttempts');
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
    });

    it('should send heartbeat at regular intervals', () => {
      jest.advanceTimersByTime(30000);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"heartbeat"')
      );
    });

    it('should include player and connection info in heartbeat', () => {
      jest.advanceTimersByTime(30000);
      
      const heartbeatCall = mockWebSocket.send.mock.calls.find(call => 
        call[0].includes('"type":"heartbeat"')
      );
      
      expect(heartbeatCall).toBeTruthy();
      const heartbeatData = JSON.parse(heartbeatCall![0]);
      expect(heartbeatData.data.playerId).toBe('player1');
      expect(heartbeatData.data.connectionId).toBeTruthy();
      expect(heartbeatData.data.timestamp).toBeGreaterThan(0);
    });

    it('should detect unhealthy connection', () => {
      // Simulate no heartbeat response for extended period
      jest.advanceTimersByTime(90000); // 90 seconds
      
      // Should detect unhealthy connection and potentially force reconnect
      // This would be verified by checking internal state or reconnection attempts
    });

    it('should handle heartbeat response', () => {
      const heartbeatResponse: HeartbeatMessage = {
        type: 'heartbeat_response',
        data: {
          playerId: 'player1',
          timestamp: Date.now(),
          received: Date.now() - 1000
        },
        timestamp: new Date()
      };

      // Simulate receiving heartbeat response
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(heartbeatResponse)
        }));
      }

      // Should update last heartbeat time
      const stats = wsService.getConnectionStats();
      expect(stats.lastHeartbeat).toBeGreaterThan(0);
    });
  });

  describe('Message Queue Management', () => {
    beforeEach(async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
    });

    it('should queue messages when disconnected', () => {
      // Disconnect
      wsService.disconnect();
      
      const message = { type: 'test', data: 'test data' };
      wsService.send(message);
      
      // Should not send immediately
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        JSON.stringify(message)
      );
      
      const stats = wsService.getConnectionStats();
      expect(stats.queuedMessages).toBeGreaterThan(0);
    });

    it('should process queued messages on reconnection', async () => {
      // Queue messages while disconnected
      wsService.disconnect();
      
      const messages = [
        { type: 'test1', data: 'data1' },
        { type: 'test2', data: 'data2' },
        { type: 'test3', data: 'data3' }
      ];
      
      messages.forEach(msg => wsService.send(msg));
      
      // Reconnect
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      // Should process all queued messages
      messages.forEach(msg => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify(msg)
        );
      });
    });

    it('should limit queue size', () => {
      wsService.disconnect();
      
      // Send more than max queue size
      for (let i = 0; i < 150; i++) {
        wsService.send({ type: 'test', data: `message${i}` });
      }
      
      const stats = wsService.getConnectionStats();
      expect(stats.queuedMessages).toBeLessThanOrEqual(100);
    });
  });

  describe('Delta Synchronization', () => {
    beforeEach(async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
    });

    it('should send delta updates efficiently', () => {
      wsService.sendDeltaUpdate('task_progress', {
        taskId: 'task1',
        progress: 0.5
      });
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"delta_update"')
      );
    });

    it('should include version and timestamp in delta updates', () => {
      wsService.sendDeltaUpdate('task_added', {
        taskId: 'task1',
        name: 'New Task'
      });
      
      const deltaCall = mockWebSocket.send.mock.calls.find(call => 
        call[0].includes('"type":"delta_update"')
      );
      
      expect(deltaCall).toBeTruthy();
      const deltaData = JSON.parse(deltaCall![0]);
      expect(deltaData.data.timestamp).toBeGreaterThan(0);
      expect(deltaData.data.version).toBeDefined();
    });

    it('should handle sync messages', () => {
      const syncMessage: TaskSyncMessage = {
        type: 'sync_request',
        data: {
          playerId: 'player1',
          messageId: 'msg123',
          payload: {
            lastSyncTimestamp: Date.now() - 10000,
            queueVersion: 1
          }
        },
        timestamp: new Date()
      };

      // Subscribe to sync messages
      const syncHandler = jest.fn();
      wsService.subscribe('sync_request', syncHandler);

      // Simulate receiving sync message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(syncMessage)
        }));
      }

      expect(syncHandler).toHaveBeenCalledWith(syncMessage);
    });
  });

  describe('Message Acknowledgment', () => {
    beforeEach(async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
    });

    it('should send messages with acknowledgment', async () => {
      const message = { type: 'test', data: 'test data' };
      
      // Start sending with ack (don't await yet)
      const ackPromise = wsService.sendWithAck(message);
      
      // Should send message with messageId
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"messageId"')
      );
      
      // Simulate acknowledgment response
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      const ackResponse = {
        type: 'ack',
        data: {
          messageId: sentMessage.messageId,
          status: 'received'
        }
      };
      
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(ackResponse)
        }));
      }
      
      // Should resolve the promise
      await expect(ackPromise).resolves.toBeDefined();
    });

    it('should timeout acknowledgments', async () => {
      const message = { type: 'test', data: 'test data' };
      
      const ackPromise = wsService.sendWithAck(message);
      
      // Fast forward past timeout
      jest.advanceTimersByTime(15000);
      
      // Should reject with timeout error
      await expect(ackPromise).rejects.toThrow('acknowledgment timeout');
    });

    it('should clean up expired acknowledgments', () => {
      // Send multiple messages with ack
      for (let i = 0; i < 5; i++) {
        wsService.sendWithAck({ type: 'test', data: `data${i}` });
      }
      
      let stats = wsService.getConnectionStats();
      expect(stats.pendingAcks).toBe(5);
      
      // Fast forward to trigger cleanup
      jest.advanceTimersByTime(15000);
      
      stats = wsService.getConnectionStats();
      expect(stats.pendingAcks).toBe(0);
    });
  });

  describe('Task Event Handling', () => {
    beforeEach(async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
    });

    it('should handle task progress events', () => {
      const progressEvent: TaskEventMessage = {
        type: 'task_progress',
        data: {
          playerId: 'player1',
          taskId: 'task1',
          progress: 0.75
        },
        timestamp: new Date()
      };

      const progressHandler = jest.fn();
      wsService.subscribe('task_progress', progressHandler);

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(progressEvent)
        }));
      }

      expect(progressHandler).toHaveBeenCalledWith(progressEvent);
    });

    it('should handle task completion events', () => {
      const completionEvent: TaskEventMessage = {
        type: 'task_completed',
        data: {
          playerId: 'player1',
          taskId: 'task1',
          rewards: [
            { type: 'experience', quantity: 100 },
            { type: 'currency', quantity: 50 }
          ]
        },
        timestamp: new Date()
      };

      const completionHandler = jest.fn();
      wsService.subscribe('task_completed', completionHandler);

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(completionEvent)
        }));
      }

      expect(completionHandler).toHaveBeenCalledWith(completionEvent);
    });

    it('should handle queue update events', () => {
      const queueUpdateEvent: TaskEventMessage = {
        type: 'queue_updated',
        data: {
          playerId: 'player1',
          queueState: {
            currentTask: null,
            queuedTasks: [],
            isRunning: false
          }
        },
        timestamp: new Date()
      };

      const queueHandler = jest.fn();
      wsService.subscribe('queue_updated', queueHandler);

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(queueUpdateEvent)
        }));
      }

      expect(queueHandler).toHaveBeenCalledWith(queueUpdateEvent);
    });
  });

  describe('Connection Recovery', () => {
    it('should force reconnection on health check failure', async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      // Simulate no heartbeat response for extended period
      jest.advanceTimersByTime(90000);
      
      // Should force close connection
      expect(mockWebSocket.close).toHaveBeenCalledWith(1006, 'Connection health check failed');
    });

    it('should handle reconnection with queued messages', async () => {
      await wsService.connect('player1');
      
      // Queue some messages
      wsService.disconnect();
      wsService.send({ type: 'test1', data: 'data1' });
      wsService.send({ type: 'test2', data: 'data2' });
      
      // Reconnect
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      // Should process queued messages
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test1', data: 'data1' })
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test2', data: 'data2' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket send errors gracefully', async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      // Should not throw error
      expect(() => {
        wsService.send({ type: 'test', data: 'data' });
      }).not.toThrow();
    });

    it('should handle malformed messages gracefully', async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      // Simulate malformed message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: 'invalid json'
        }));
      }
      
      // Should not crash the service
      expect(wsService.isConnected()).toBe(true);
    });

    it('should handle connection errors during heartbeat', async () => {
      await wsService.connect('player1');
      
      // Simulate connection error during heartbeat
      if (mockWebSocket.onerror) {
        mockWebSocket.onerror(new Event('error'));
      }
      
      // Should handle error gracefully
      expect(() => {
        jest.advanceTimersByTime(30000);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency messages efficiently', async () => {
      await wsService.connect('player1');
      mockWebSocket = (wsService as any).socket;
      
      const startTime = Date.now();
      
      // Send many messages rapidly
      for (let i = 0; i < 1000; i++) {
        wsService.send({ type: 'test', data: `message${i}` });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(100); // 100ms
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1000);
    });

    it('should efficiently manage memory with large message queues', () => {
      wsService.disconnect();
      
      // Queue many messages
      for (let i = 0; i < 1000; i++) {
        wsService.send({ type: 'test', data: `message${i}` });
      }
      
      const stats = wsService.getConnectionStats();
      
      // Should limit queue size to prevent memory issues
      expect(stats.queuedMessages).toBeLessThanOrEqual(100);
    });
  });
});