/**
 * Custom hook for chat functionality
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import {
  setChannels,
  addChannel,
  setMessages,
  addMessage,
  setActiveChannel,
  markChannelAsRead,
  setConnectionStatus,
  setLoading,
  setError,
  addTypingUser,
  removeTypingUser,
} from '../store/slices/chatSlice';
import WebSocketService from '../services/websocketService';
import ChatService from '../services/chatService';
import { ChatMessage, ChatChannel, SendMessageRequest } from '../types/chat';

export interface UseChatOptions {
  autoConnect?: boolean;
  loadHistoryOnChannelChange?: boolean;
  enableTypingIndicators?: boolean;
}

export const useChat = (options: UseChatOptions = {}) => {
  const {
    autoConnect = true,
    loadHistoryOnChannelChange = true,
    enableTypingIndicators = true,
  } = options;

  const dispatch = useDispatch();
  const { character } = useSelector((state: RootState) => state.game);
  const chatState = useSelector((state: RootState) => state.chat);
  
  const wsService = WebSocketService.getInstance();
  const chatService = ChatService.getInstance();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle WebSocket chat messages
  const handleChatMessage = useCallback((message: any) => {
    if (message.type === 'message' && message.data) {
      const chatMessage: ChatMessage = {
        ...message.data,
        timestamp: new Date(message.data.timestamp),
        isRead: false,
      };
      dispatch(addMessage(chatMessage));
    } else if (message.type === 'typing_start' && enableTypingIndicators) {
      dispatch(addTypingUser({
        channelId: message.data.channelId,
        userId: message.data.userId,
      }));
    } else if (message.type === 'typing_stop' && enableTypingIndicators) {
      dispatch(removeTypingUser({
        channelId: message.data.channelId,
        userId: message.data.userId,
      }));
    }
  }, [dispatch, enableTypingIndicators]);

  // Handle WebSocket connection status
  const handleConnectionStatus = useCallback((connected: boolean) => {
    dispatch(setConnectionStatus(connected));
  }, [dispatch]);

  // Initialize chat system
  const initializeChat = useCallback(async () => {
    if (!character) return;

    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      // Load available channels
      const channels = await chatService.getChannels();
      dispatch(setChannels(channels));

      // Set default active channel (general chat)
      const generalChannel = channels.find(c => c.type === 'general');
      if (generalChannel && !chatState.activeChannelId) {
        dispatch(setActiveChannel(generalChannel.channelId));
      }

      // Connect to WebSocket if auto-connect is enabled
      if (autoConnect) {
        await wsService.connect(character.userId);
        
        // Subscribe to chat messages
        wsService.subscribe('message', handleChatMessage);
        wsService.subscribe('typing_start', handleChatMessage);
        wsService.subscribe('typing_stop', handleChatMessage);
        wsService.onConnectionStatusChange(handleConnectionStatus);
      }

    } catch (error) {
      console.error('Failed to initialize chat:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to initialize chat'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [character, autoConnect, chatState.activeChannelId, dispatch, wsService, chatService, handleChatMessage, handleConnectionStatus]);

  // Load message history for a channel
  const loadChannelHistory = useCallback(async (channelId: string, messageType: 'general' | 'guild' | 'private') => {
    try {
      const { messages } = await chatService.getMessageHistory(channelId, messageType);
      dispatch(setMessages({ channelId, messages }));
    } catch (error) {
      console.error('Failed to load channel history:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to load message history'));
    }
  }, [chatService, dispatch]);

  // Send a message
  const sendMessage = useCallback(async (content: string, channelId?: string, recipientId?: string) => {
    if (!character || !content.trim()) return;

    const targetChannelId = channelId || chatState.activeChannelId;
    if (!targetChannelId) return;

    const channel = chatState.channels.find((c: ChatChannel) => c.channelId === targetChannelId);
    if (!channel) return;

    // Check if it's a slash command
    if (content.startsWith('/')) {
      const [command, ...args] = content.slice(1).split(' ');
      try {
        const messageType: 'general' | 'guild' | 'private' = 
          channel.type === 'guild' ? 'guild' :
          channel.type === 'whisper' ? 'private' :
          'general';
        
        await chatService.processSlashCommand(
          command, 
          args, 
          targetChannelId,
          character.userId,
          character.name,
          messageType
        );
        return;
      } catch (error) {
        console.error('Failed to process slash command:', error);
        dispatch(setError(error instanceof Error ? error.message : 'Failed to process command'));
        return;
      }
    }

    const messageRequest: SendMessageRequest = {
      channelId: targetChannelId,
      senderId: character.userId,
      content: content.trim(),
      type: 'text',
      recipientId,
    };

    try {
      // Try to send via WebSocket first
      if (wsService.isConnected()) {
        wsService.send({
          type: 'send_message',
          data: messageRequest,
        });
      } else {
        // Fallback to HTTP API
        await chatService.sendMessage(messageRequest);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch(setError(error instanceof Error ? error.message : 'Failed to send message'));
    }
  }, [character, chatState.activeChannelId, chatState.channels, wsService, chatService, dispatch]);

  // Switch to a different channel
  const switchChannel = useCallback(async (channelId: string) => {
    dispatch(setActiveChannel(channelId));
    dispatch(markChannelAsRead(channelId));

    // Load history if enabled and not already loaded
    if (loadHistoryOnChannelChange && !chatState.messages[channelId]) {
      const channel = chatState.channels.find((c: ChatChannel) => c.channelId === channelId);
      if (channel) {
        let messageType: 'general' | 'guild' | 'private' = 'general';
        if (channel.type === 'guild') messageType = 'guild';
        else if (channel.type === 'whisper') messageType = 'private';
        
        await loadChannelHistory(channelId, messageType);
      }
    }
  }, [dispatch, loadHistoryOnChannelChange, chatState.messages, chatState.channels, loadChannelHistory]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((channelId?: string) => {
    if (!character || !enableTypingIndicators) return;

    const targetChannelId = channelId || chatState.activeChannelId;
    if (!targetChannelId) return;

    if (wsService.isConnected()) {
      wsService.send({
        type: 'typing_start',
        data: {
          channelId: targetChannelId,
          userId: character.userId,
        },
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing indicator after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        wsService.send({
          type: 'typing_stop',
          data: {
            channelId: targetChannelId,
            userId: character.userId,
          },
        });
      }, 3000);
    }
  }, [character, enableTypingIndicators, chatState.activeChannelId, wsService]);

  // Create a private conversation
  const createPrivateConversation = useCallback(async (recipientId: string, recipientName: string) => {
    if (!character) return;

    const channelId = `private_${[character.userId, recipientId].sort().join('_')}`;
    
    // Check if channel already exists
    const existingChannel = chatState.channels.find((c: ChatChannel) => c.channelId === channelId);
    if (existingChannel) {
      dispatch(setActiveChannel(channelId));
      return;
    }

    // Create new private channel
    const newChannel: ChatChannel = {
      channelId,
      type: 'whisper',
      name: recipientName,
      participants: [character.userId, recipientId],
      isActive: true,
      createdAt: new Date(),
    };

    dispatch(addChannel(newChannel));
    dispatch(setActiveChannel(channelId));

    // Load private message history
    try {
      const { messages } = await chatService.getPrivateMessages();
      const relevantMessages = messages.filter(msg => 
        (msg.senderId === character.userId && msg.recipientId === recipientId) ||
        (msg.senderId === recipientId && msg.recipientId === character.userId)
      );
      dispatch(setMessages({ channelId, messages: relevantMessages }));
    } catch (error) {
      console.error('Failed to load private message history:', error);
    }
  }, [character, chatState.channels, dispatch, chatService]);

  // Initialize chat when character is available
  useEffect(() => {
    if (character && chatState.channels.length === 0) {
      initializeChat();
    }
  }, [character, chatState.channels.length, initializeChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    channels: chatState.channels,
    messages: chatState.messages,
    activeChannelId: chatState.activeChannelId,
    unreadCounts: chatState.unreadCounts,
    isConnected: chatState.isConnected,
    loading: chatState.loading,
    error: chatState.error,
    typingUsers: chatState.typingUsers,
    
    // Actions
    sendMessage,
    switchChannel,
    sendTypingIndicator,
    createPrivateConversation,
    loadChannelHistory,
    
    // Computed values
    activeChannel: chatState.channels.find((c: ChatChannel) => c.channelId === chatState.activeChannelId),
    activeMessages: chatState.activeChannelId ? chatState.messages[chatState.activeChannelId] || [] : [],
    totalUnreadCount: (Object.values(chatState.unreadCounts) as number[]).reduce((sum: number, count: number) => sum + count, 0),
    hasUnreadMessages: (Object.values(chatState.unreadCounts) as number[]).some((count: number) => count > 0),
  };
};

export default useChat;