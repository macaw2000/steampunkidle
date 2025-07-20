/**
 * WebSocket service for real-time game updates
 */

import { ActivityProgress } from './activityService';
import { GameNotification } from './notificationService';
import { NetworkUtils } from '../utils/networkUtils';
import { offlineService } from './offlineService';

export interface BaseWebSocketMessage {
  type: 'progress_update' | 'notification' | 'achievement' | 'level_up' | 'connection_status';
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
export type GameWebSocketMessage = 
  | ProgressUpdateMessage 
  | NotificationMessage 
  | AchievementMessage 
  | LevelUpMessage
  | ConnectionStatusMessage;

export class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private connectionStatusHandlers: Set<(connected: boolean) => void> = new Set();

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
          this.notifyConnectionStatus(true);
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
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
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
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
      console.warn('WebSocket not connected, cannot send message');
    }
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
}

export default WebSocketService;