/**
 * WebSocket service for real-time game updates
 */

import { ActivityProgress } from './activityService';
import { GameNotification } from './notificationService';
import { NetworkUtils } from '../utils/networkUtils';
import { offlineService } from './offlineService';

export interface BaseWebSocketMessage {
  type: 'progress_update' | 'notification' | 'achievement' | 'level_up' | 'connection_status' | 
        'sync_request' | 'sync_response' | 'delta_update' | 'conflict_resolution' | 
        'heartbeat' | 'heartbeat_response' | 'task_started' | 'task_progress' | 
        'task_completed' | 'task_failed' | 'queue_updated';
  data: any;
  timestamp: Date;
}

export interface ProgressUpdateMessage extends BaseWebSocketMessage {
  type: 'progress_update';
  data: {
    activityProgress: ActivityProgress;
    experienceGained?: number;
    currencyGained?: number;
    skillsGained?: Record<string, number>;
  };
}

export interface NotificationMessage extends BaseWebSocketMessage {
  type: 'notification';
  data: GameNotification;
}

export interface AchievementMessage extends BaseWebSocketMessage {
  type: 'achievement';
  data: {
    id: string;
    title: string;
    description: string;
    icon: string;
    rewards: Array<{
      type: string;
      amount: number;
    }>;
  };
}

export interface LevelUpMessage extends BaseWebSocketMessage {
  type: 'level_up';
  data: {
    newLevel: number;
    experienceGained: number;
    statsIncreased: Record<string, number>;
  };
}

export interface ConnectionStatusMessage extends BaseWebSocketMessage {
  type: 'connection_status';
  data: {
    connected: boolean;
    reason?: string;
  };
}

export type WebSocketMessage = BaseWebSocketMessage;
export interface TaskSyncMessage extends BaseWebSocketMessage {
  type: 'sync_request' | 'sync_response' | 'delta_update' | 'conflict_resolution';
  data: {
    playerId: string;
    messageId: string;
    payload: any;
  };
}

export interface HeartbeatMessage extends BaseWebSocketMessage {
  type: 'heartbeat' | 'heartbeat_response';
  data: {
    playerId: string;
    timestamp: number;
    queueVersion?: number;
    connectionId?: string;
  };
}

export interface TaskEventMessage extends BaseWebSocketMessage {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'queue_updated';
  data: {
    playerId: string;
    taskId?: string;
    progress?: number;
    rewards?: any[];
    error?: string;
    queueState?: any;
  };
}

export type GameWebSocketMessage = 
  | ProgressUpdateMessage 
  | NotificationMessage 
  | AchievementMessage 
  | LevelUpMessage
  | ConnectionStatusMessage
  | TaskSyncMessage
  | HeartbeatMessage
  | TaskEventMessage;

export class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private connectionStatusHandlers: Set<(connected: boolean) => void> = new Set();
  
  // Enhanced connection management
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatFrequency = 30000; // 30 seconds
  private lastHeartbeat = 0;
  private connectionId: string | null = null;
  private playerId: string | null = null;
  private messageQueue: any[] = [];
  private maxQueueSize = 100;
  
  // Delta synchronization
  private lastSyncTimestamp = 0;
  private pendingAcks: Map<string, { timestamp: number; resolve: Function; reject: Function }> = new Map();
  private ackTimeout = 10000; // 10 seconds

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already connected
      if (this.socket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Check if offline
      if (offlineService.isOffline()) {
        reject(NetworkUtils.createNetworkError('Cannot connect to WebSocket while offline', { isOffline: true }));
        return;
      }

      if (this.isConnecting) {
        // Wait for current connection attempt
        const checkConnection = () => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;

      // For development, use a mock WebSocket URL
      // In production, this would be the actual WebSocket API Gateway URL
      const wsUrl = process.env.REACT_APP_WS_URL || `ws://localhost:3001/ws?userId=${userId}`;
      
      try {
        this.socket = new WebSocket(wsUrl);

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            if (this.socket) {
              this.socket.close();
            }
            reject(NetworkUtils.createNetworkError('WebSocket connection timeout', { isTimeout: true }));
          }
        }, 10000); // 10 second timeout

        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.playerId = userId;
          this.connectionId = this.generateConnectionId();
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Process queued messages
          this.processMessageQueue();
          
          this.notifyConnectionStatus(true);
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            // Update last heartbeat time for any message
            this.lastHeartbeat = Date.now();
            
            // Handle acknowledgments
            if (message.data?.messageId && this.pendingAcks.has(message.data.messageId)) {
              const ack = this.pendingAcks.get(message.data.messageId)!;
              ack.resolve(message);
              this.pendingAcks.delete(message.data.messageId);
            }
            
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          
          // Stop heartbeat
          this.stopHeartbeat();
          
          // Clear connection info
          this.connectionId = null;
          this.playerId = null;
          
          this.notifyConnectionStatus(false);
          
          // Attempt to reconnect if not a clean close and not offline
          if (event.code !== 1000 && 
              this.reconnectAttempts < this.maxReconnectAttempts && 
              !offlineService.isOffline()) {
            this.scheduleReconnect(userId);
          }
        };

        this.socket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.notifyConnectionStatus(false);
          
          // Create appropriate network error
          const networkError = NetworkUtils.createNetworkError(
            'WebSocket connection failed',
            { isOffline: offlineService.isOffline() }
          );
          reject(networkError);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    this.connectionId = null;
    this.playerId = null;
    this.messageQueue = [];
    this.pendingAcks.clear();
    
    this.notifyConnectionStatus(false);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, queueing message');
      this.queueMessage(message);
    }
  }

  /**
   * Send message with acknowledgment
   */
  sendWithAck(message: any): Promise<WebSocketMessage> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const messageWithId = { ...message, messageId };
      
      // Store acknowledgment handler
      this.pendingAcks.set(messageId, { 
        timestamp: Date.now(), 
        resolve, 
        reject 
      });
      
      // Set timeout for acknowledgment
      setTimeout(() => {
        if (this.pendingAcks.has(messageId)) {
          this.pendingAcks.delete(messageId);
          reject(new Error('Message acknowledgment timeout'));
        }
      }, this.ackTimeout);
      
      this.send(messageWithId);
    });
  }

  /**
   * Send delta update efficiently
   */
  sendDeltaUpdate(type: string, data: any): void {
    const deltaMessage = {
      type: 'delta_update',
      data: {
        type,
        playerId: this.playerId,
        data,
        timestamp: Date.now(),
        version: this.getNextVersion()
      },
      timestamp: new Date()
    };
    
    this.send(deltaMessage);
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.set(messageType, handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(messageType);
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(handler: (connected: boolean) => void): () => void {
    this.connectionStatusHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.connectionStatusHandlers.delete(handler);
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    // Also call any generic message handlers
    const genericHandler = this.messageHandlers.get('*');
    if (genericHandler) {
      genericHandler(message);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(userId: string): void {
    this.reconnectAttempts++;
    const delay = NetworkUtils.calculateRetryDelay(this.reconnectAttempts, this.reconnectDelay, true);
    
    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        // Check if we're still offline before attempting reconnection
        if (offlineService.isOffline()) {
          console.log('Still offline, waiting for network before reconnecting WebSocket');
          try {
            await offlineService.waitForOnline(30000); // Wait up to 30 seconds
            console.log('Network is back, attempting WebSocket reconnection');
          } catch (error) {
            console.warn('Timeout waiting for network, will try reconnecting anyway');
          }
        }
        
        this.connect(userId).catch(error => {
          console.error('WebSocket reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Notify connection status handlers
   */
  private notifyConnectionStatus(connected: boolean): void {
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection status handler:', error);
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkConnectionHealth();
      this.cleanupPendingAcks();
    }, this.heartbeatFrequency);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to server
   */
  private sendHeartbeat(): void {
    if (!this.isConnected() || !this.playerId) {
      return;
    }

    const heartbeatMessage: HeartbeatMessage = {
      type: 'heartbeat',
      data: {
        playerId: this.playerId,
        timestamp: Date.now(),
        queueVersion: this.getQueueVersion(),
        connectionId: this.connectionId || ''
      },
      timestamp: new Date()
    };

    this.send(heartbeatMessage);
  }

  /**
   * Check connection health based on heartbeat
   */
  private checkConnectionHealth(): void {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    
    // If no heartbeat response in 2x frequency, consider connection unhealthy
    if (timeSinceLastHeartbeat > this.heartbeatFrequency * 2) {
      console.warn('Connection appears unhealthy, no heartbeat response');
      
      // If no response in 3x frequency, force reconnection
      if (timeSinceLastHeartbeat > this.heartbeatFrequency * 3) {
        console.error('Connection lost, forcing reconnection');
        this.forceReconnect();
      }
    }
  }

  /**
   * Force reconnection
   */
  private forceReconnect(): void {
    if (this.socket) {
      this.socket.close(1006, 'Connection health check failed');
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: any): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message
      this.messageQueue.shift();
    }
    
    this.messageQueue.push({
      ...message,
      queuedAt: Date.now()
    });
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      // Remove queued timestamp before sending
      const { queuedAt, ...cleanMessage } = message;
      this.send(cleanMessage);
    });
  }

  /**
   * Clean up expired pending acknowledgments
   */
  private cleanupPendingAcks(): void {
    const now = Date.now();
    
    for (const [messageId, ack] of this.pendingAcks.entries()) {
      if (now - ack.timestamp > this.ackTimeout) {
        ack.reject(new Error('Acknowledgment timeout'));
        this.pendingAcks.delete(messageId);
      }
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return 'conn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get current queue version (placeholder)
   */
  private getQueueVersion(): number {
    // This would integrate with your queue state management
    return 1;
  }

  /**
   * Get next version number for delta updates
   */
  private getNextVersion(): number {
    return Date.now(); // Simple versioning based on timestamp
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    isConnected: boolean;
    connectionId: string | null;
    lastHeartbeat: number;
    queuedMessages: number;
    pendingAcks: number;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected(),
      connectionId: this.connectionId,
      lastHeartbeat: this.lastHeartbeat,
      queuedMessages: this.messageQueue.length,
      pendingAcks: this.pendingAcks.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Cleanup resources when service is destroyed
   */
  destroy(): void {
    this.stopHeartbeat();
    this.disconnect();
    this.messageQueue = [];
    this.pendingAcks.clear();
    this.connectionStatusHandlers.clear();
    this.messageHandlers.clear();
  }
}

export default WebSocketService;