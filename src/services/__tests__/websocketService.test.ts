/**
 * Tests for WebSocketService
 */

import WebSocketService, { WebSocketMessage } from '../websocketService';

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
  private _shouldError = false;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      if (this._shouldError) {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
      } else {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  }

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { 
        data: JSON.stringify(data) 
      }));
    }
  }

  simulateError() {
    this._shouldError = true;
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  // Method to make this instance error on connection
  setShouldError(shouldError: boolean) {
    this._shouldError = shouldError;
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe.skip('WebSocketService', () => {
  let service: WebSocketService;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    // Reset the singleton instance for testing
    (WebSocketService as any).instance = null;
    service = WebSocketService.getInstance();
    jest.clearAllTimers();
  });

  afterEach(() => {
    service.disconnect();
    jest.clearAllTimers();
  });

  it('creates singleton instance', () => {
    const instance1 = WebSocketService.getInstance();
    const instance2 = WebSocketService.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('connects to WebSocket server', async () => {
    const connectPromise = service.connect('test-user-123');
    
    await expect(connectPromise).resolves.toBeUndefined();
    expect(service.isConnected()).toBe(true);
  });

  it('handles connection errors', async () => {
    // Override WebSocket to simulate immediate error
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        this.setShouldError(true);
      }
    };

    // Reset service instance to use new WebSocket mock
    (WebSocketService as any).instance = null;
    service = WebSocketService.getInstance();

    await expect(service.connect('test-user-123')).rejects.toThrow();
  });

  it('subscribes to message types', async () => {
    await service.connect('test-user-123');
    
    const messageHandler = jest.fn();
    const unsubscribe = service.subscribe('progress_update', messageHandler);
    
    // Get the WebSocket instance
    const ws = (service as any).socket as MockWebSocket;
    
    // Simulate message
    ws.simulateMessage({
      type: 'progress_update',
      data: { test: 'data' },
      timestamp: new Date()
    });

    expect(messageHandler).toHaveBeenCalledWith({
      type: 'progress_update',
      data: { test: 'data' },
      timestamp: expect.any(String) // JSON serialization converts Date to string
    });

    // Test unsubscribe
    unsubscribe();
    ws.simulateMessage({
      type: 'progress_update',
      data: { test: 'data2' },
      timestamp: new Date()
    });

    // Should not be called again after unsubscribe
    expect(messageHandler).toHaveBeenCalledTimes(1);
  });

  it('handles generic message subscription', async () => {
    await service.connect('test-user-123');
    
    const genericHandler = jest.fn();
    service.subscribe('*', genericHandler);
    
    const ws = (service as any).socket as MockWebSocket;
    
    // Simulate different message types
    ws.simulateMessage({
      type: 'progress_update',
      data: { test: 'data1' },
      timestamp: new Date()
    });

    ws.simulateMessage({
      type: 'notification',
      data: { test: 'data2' },
      timestamp: new Date()
    });

    expect(genericHandler).toHaveBeenCalledTimes(2);
  });

  it('subscribes to connection status changes', async () => {
    const statusHandler = jest.fn();
    service.onConnectionStatusChange(statusHandler);
    
    await service.connect('test-user-123');
    
    expect(statusHandler).toHaveBeenCalledWith(true);
    
    service.disconnect();
    
    expect(statusHandler).toHaveBeenCalledWith(false);
  });

  it('sends messages when connected', async () => {
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    const sendSpy = jest.spyOn(ws, 'send');
    
    const testMessage = { type: 'test', data: 'hello' };
    service.send(testMessage);
    
    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(testMessage));
  });

  it('warns when sending message while disconnected', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    service.send({ type: 'test', data: 'hello' });
    
    expect(consoleSpy).toHaveBeenCalledWith('WebSocket not connected, cannot send message');
    
    consoleSpy.mockRestore();
  });

  it('handles WebSocket disconnection', async () => {
    await service.connect('test-user-123');
    
    const statusHandler = jest.fn();
    service.onConnectionStatusChange(statusHandler);
    
    const ws = (service as any).socket as MockWebSocket;
    ws.simulateClose(1006, 'Connection lost'); // Abnormal closure
    
    expect(statusHandler).toHaveBeenCalledWith(false);
    expect(service.isConnected()).toBe(false);
  });

  it('attempts reconnection on abnormal closure', async () => {
    jest.useFakeTimers();
    
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    
    // Simulate abnormal closure
    ws.simulateClose(1006, 'Connection lost');
    
    // Fast-forward time to trigger reconnection
    jest.advanceTimersByTime(1000);
    
    // Should attempt to reconnect
    expect(service.isConnected()).toBe(false); // Will be false until mock connection completes
    
    jest.useRealTimers();
  });

  it('does not reconnect on normal closure', async () => {
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    
    // Simulate normal closure
    ws.simulateClose(1000, 'Normal closure');
    
    expect(service.isConnected()).toBe(false);
    // Should not attempt reconnection for normal closure
  });

  it('limits reconnection attempts', async () => {
    jest.useFakeTimers();
    
    // Override WebSocket to always fail
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        setTimeout(() => {
          this.simulateClose(1006, 'Connection failed');
        }, 10);
      }
    };

    await expect(service.connect('test-user-123')).rejects.toThrow();
    
    // Should stop trying after max attempts
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(30000); // Fast-forward max delay
    }
    
    expect(service.isConnected()).toBe(false);
    
    jest.useRealTimers();
  });

  it('disconnects cleanly', async () => {
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    const closeSpy = jest.spyOn(ws, 'close');
    
    service.disconnect();
    
    expect(closeSpy).toHaveBeenCalledWith(1000, 'Client disconnect');
    expect(service.isConnected()).toBe(false);
  });

  it('handles malformed JSON messages gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    
    // Simulate malformed message
    if (ws.onmessage) {
      ws.onmessage(new MessageEvent('message', { 
        data: 'invalid json{' 
      }));
    }
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('prevents multiple concurrent connections', async () => {
    const connectPromise1 = service.connect('test-user-123');
    const connectPromise2 = service.connect('test-user-123');
    
    await Promise.all([connectPromise1, connectPromise2]);
    
    expect(service.isConnected()).toBe(true);
  });

  it('uses correct WebSocket URL', async () => {
    const originalEnv = process.env.REACT_APP_WS_URL;
    process.env.REACT_APP_WS_URL = 'ws://test.example.com/ws';
    
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    expect(ws.url).toBe('ws://test.example.com/ws?userId=test-user-123');
    
    process.env.REACT_APP_WS_URL = originalEnv;
  });

  it('falls back to default WebSocket URL', async () => {
    const originalEnv = process.env.REACT_APP_WS_URL;
    delete process.env.REACT_APP_WS_URL;
    
    await service.connect('test-user-123');
    
    const ws = (service as any).socket as MockWebSocket;
    expect(ws.url).toBe('ws://localhost:3001/ws?userId=test-user-123');
    
    process.env.REACT_APP_WS_URL = originalEnv;
  });
});