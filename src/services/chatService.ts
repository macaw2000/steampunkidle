/**
 * Chat service for handling chat-related API calls
 */

import { ChatMessage, ChatChannel, SendMessageRequest, CreateChannelRequest } from '../types/chat';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ks7h6drcjd.execute-api.us-west-2.amazonaws.com/prod';

export class ChatService {
  private static instance: ChatService;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Get message history for a channel
   */
  async getMessageHistory(
    channelId: string,
    messageType: 'general' | 'guild' | 'private',
    limit: number = 50,
    lastEvaluatedKey?: string
  ): Promise<{ messages: ChatMessage[]; lastEvaluatedKey?: string }> {
    const params = new URLSearchParams({
      channelId,
      messageType,
      limit: limit.toString(),
    });

    if (lastEvaluatedKey) {
      params.append('lastEvaluatedKey', lastEvaluatedKey);
    }

    const response = await fetch(`${API_BASE_URL}/chat/history?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get message history: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
      lastEvaluatedKey: data.lastEvaluatedKey,
    };
  }

  /**
   * Get private messages for the current user
   */
  async getPrivateMessages(
    limit: number = 50,
    lastEvaluatedKey?: string
  ): Promise<{ messages: ChatMessage[]; lastEvaluatedKey?: string }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (lastEvaluatedKey) {
      params.append('lastEvaluatedKey', lastEvaluatedKey);
    }

    const response = await fetch(`${API_BASE_URL}/chat/private?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get private messages: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
      lastEvaluatedKey: data.lastEvaluatedKey,
    };
  }

  /**
   * Send a message via HTTP (fallback when WebSocket is not available)
   */
  async sendMessage(request: SendMessageRequest): Promise<{ messageId: string }> {
    const response = await fetch(`${API_BASE_URL}/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new chat channel
   */
  async createChannel(request: CreateChannelRequest): Promise<ChatChannel> {
    const response = await fetch(`${API_BASE_URL}/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create channel: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  }

  /**
   * Get available channels for the user
   */
  async getChannels(): Promise<ChatChannel[]> {
    const response = await fetch(`${API_BASE_URL}/chat/channels`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get channels: ${response.statusText}`);
    }

    const data = await response.json();
    return data.channels.map((channel: any) => ({
      ...channel,
      createdAt: new Date(channel.createdAt),
    }));
  }

  /**
   * Process slash commands
   */
  async processSlashCommand(
    command: string, 
    args: string[], 
    channelId: string,
    senderId: string,
    senderName: string,
    messageType: 'general' | 'guild' | 'private' = 'general'
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/chat/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({
        command,
        args,
        channelId,
        senderId,
        senderName,
        messageType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to process command: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get authentication token from localStorage or auth service
   */
  private getAuthToken(): string {
    // This would typically come from your auth service or Redux store
    return localStorage.getItem('authToken') || '';
  }
}

export default ChatService;