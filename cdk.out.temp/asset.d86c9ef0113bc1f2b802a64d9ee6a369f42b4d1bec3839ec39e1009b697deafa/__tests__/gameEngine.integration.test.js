/**
 * Integration tests for the Game Engine server
 * Tests the full server startup, API endpoints, and WebSocket functionality
 */

const request = require('supertest');
const WebSocket = require('ws');
const { app, server, wss } = require('../gameEngine');

// Mock AWS SDK for integration tests
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

// Mock DynamoDB operations
const mockSend = jest.fn();
DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
  send: mockSend
});

// Setup default mock responses
mockSend.mockImplementation((command) => {
  if (command.constructor.name === 'GetCommand') {
    return Promise.resolve({ Item: null });
  }
  if (command.constructor.name === 'PutCommand') {
    return Promise.resolve({});
  }
  if (command.constructor.name === 'ScanCommand') {
    return Promise.resolve({ Items: [] });
  }
  return Promise.resolve({});
});

describe('Game Engine Integration Tests', () => {
  let testServer;
  let testPort;

  beforeAll((done) => {
    // Start server on a random port for testing
    testPort = 3002;
    testServer = server.listen(testPort, () => {
      console.log(`Test server running on port ${testPort}`);
      done();
    });
  });

  afterAll((done) => {
    if (testServer) {
      testServer.close(done);
    } else {
      done();
    }
  });

  describe('HTTP API Endpoints', () => {
    test('GET /health should return server health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('activeQueues');
      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('gameEngine');
    });

    test('GET /metrics should return comprehensive metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('activeQueues');
      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body).toHaveProperty('totalTasksCompleted');
      expect(response.body).toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('gameEngineStatus');
    });

    test('POST /task-queue/sync should handle player synchronization', async () => {
      const response = await request(app)
        .post('/task-queue/sync')
        .send({ playerId: 'test-player-123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queue');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('synced successfully');
    });

    test('POST /task-queue/add-task should add tasks to player queue', async () => {
      const task = {
        id: 'test-task-123',
        name: 'Test Harvesting Task',
        type: 'HARVESTING',
        duration: 30000,
        activityData: {
          activity: {
            primaryResource: 'test_ore',
            baseYield: 2
          }
        }
      };

      const response = await request(app)
        .post('/task-queue/add-task')
        .send({ 
          playerId: 'test-player-123',
          task: task
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('taskId', task.id);
    });

    test('GET /task-queue/:playerId should return player queue status', async () => {
      const response = await request(app).get('/task-queue/test-player-123');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queue');
      expect(response.body.queue).toHaveProperty('currentTask');
      expect(response.body.queue).toHaveProperty('queueLength');
      expect(response.body.queue).toHaveProperty('isRunning');
    });

    test('POST /task-queue/stop-tasks should stop all player tasks', async () => {
      const response = await request(app)
        .post('/task-queue/stop-tasks')
        .send({ playerId: 'test-player-123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('stopped successfully');
    });
  });

  describe('WebSocket Integration', () => {
    test('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle authentication messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      ws.on('open', () => {
        const authMessage = {
          type: 'authenticate',
          playerId: 'test-ws-player'
        };
        
        ws.send(JSON.stringify(authMessage));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        expect(message.type).toBe('authenticated');
        expect(message.playerId).toBe('test-ws-player');
        expect(message.timestamp).toBeDefined();
        
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid API requests gracefully', async () => {
      const response = await request(app)
        .post('/task-queue/sync')
        .send({}); // Missing playerId
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle non-existent player queue requests', async () => {
      const response = await request(app).get('/task-queue/non-existent-player');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed WebSocket messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      ws.on('open', () => {
        // Send invalid JSON
        ws.send('invalid json message');
        
        // Should not crash the server
        setTimeout(() => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});