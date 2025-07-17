/**
 * Chat and communication type definitions for the Steampunk Idle Game
 */

export type ChatChannelType = 'general' | 'guild' | 'party' | 'whisper' | 'zone';
export type MessageType = 'text' | 'system' | 'command' | 'emote';

export interface ChatChannel {
  channelId: string;
  type: ChatChannelType;
  name: string;
  participants: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface ChatMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  recipientId?: string; // for whispers
  isRead: boolean;
}

export interface SlashCommand {
  command: string;
  args: string[];
  senderId: string;
  channelId: string;
  timestamp: Date;
}

export interface SendMessageRequest {
  channelId: string;
  senderId: string;
  content: string;
  type?: MessageType;
  recipientId?: string;
}

export interface CreateChannelRequest {
  type: ChatChannelType;
  name: string;
  participants: string[];
}