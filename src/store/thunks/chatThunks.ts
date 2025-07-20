import { createAsyncThunkWithErrorHandling, AsyncErrorHandler } from '../utils/asyncThunkUtils';
import { 
  setChannels,
  addChannel,
  setMessages,
  addMessage,
  setConnectionStatus,
  setError,
  setLoading
} from '../slices/chatSlice';
import type { RootState } from '../store';
import type { ChatChannel, ChatMessage } from '../../types/chat';

// Mock chat service interfaces - replace with actual service imports
interface ChatService {
  getChannels: (userId: string) => Promise<ChatChannel[]>;
  getMessages: (channelId: string, limit?: number) => Promise<ChatMessage[]>;
  sendMessage: (channelId: string, content: string, userId: string) => Promise<ChatMessage>;
  joinChannel: (channelId: string, userId: string) => Promise<ChatChannel>;
  leaveChannel: (channelId: string, userId: string) => Promise<void>;
  connectWebSocket: (userId: string) => Promise<WebSocket>;
}

// This would normally be imported from your chat service
declare const chatService: ChatService;

/**
 * Load user's chat channels with error handling
 */
export const loadChannelsAsync = createAsyncThunkWithErrorHandling(
  'chat/loadChannelsAsync',
  async (userId: string, { dispatch }) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    
    try {
      const channels = await AsyncErrorHandler.withErrorHandling(
        () => chatService.getChannels(userId),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
            retryCondition: (error) => error.retryable,
          },
          onError: (error) => {
            dispatch(setError(`Failed to load channels: ${error.message}`));
          },
        }
      );
      
      // Validate channels data
      const validChannels = Array.isArray(channels) ? channels.filter(
        channel => channel && channel.channelId && channel.name
      ) : [];
      
      dispatch(setChannels(validChannels));
      return validChannels;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load channels';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  },
  {
    maxRetries: 3,
    retryDelay: 1000,
  }
);

/**
 * Load messages for a specific channel
 */
export const loadMessagesAsync = createAsyncThunkWithErrorHandling(
  'chat/loadMessagesAsync',
  async ({ channelId, limit = 50 }: { channelId: string; limit?: number }, { dispatch }) => {
    try {
      const messages = await AsyncErrorHandler.withErrorHandling(
        () => chatService.getMessages(channelId, limit),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
          fallback: [],
        }
      );
      
      // Validate and sort messages
      const validMessages = Array.isArray(messages) ? messages
        .filter(msg => msg && msg.messageId && msg.content)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        : [];
      
      dispatch(setMessages({ channelId, messages: validMessages }));
      return validMessages;
    } catch (error) {
      console.error(`Failed to load messages for channel ${channelId}:`, error);
      // Don't throw - return empty array as fallback
      dispatch(setMessages({ channelId, messages: [] }));
      return [];
    }
  }
);

/**
 * Send a message with optimistic updates and rollback on failure
 */
export const sendMessageAsync = createAsyncThunkWithErrorHandling(
  'chat/sendMessageAsync',
  async (
    { channelId, content, userId }: { channelId: string; content: string; userId: string },
    { dispatch, getState }
  ) => {
    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      messageId: `temp-${Date.now()}`,
      channelId,
      senderId: userId,
      senderName: 'You', // This would come from user state
      content,
      type: 'text',
      timestamp: new Date(),
      isRead: true,
    };
    
    // Add optimistic message immediately
    dispatch(addMessage(optimisticMessage));
    
    try {
      const sentMessage = await AsyncErrorHandler.withErrorHandling(
        () => chatService.sendMessage(channelId, content, userId),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
            retryCondition: (error) => error.retryable && !error.message.includes('rate limit'),
          },
        }
      );
      
      // Replace optimistic message with real message
      const state = getState() as RootState;
      const channelMessages = state.chat.messages[channelId] || [];
      const updatedMessages = channelMessages.map(msg => 
        msg.messageId === optimisticMessage.messageId ? sentMessage : msg
      );
      
      dispatch(setMessages({ channelId, messages: updatedMessages }));
      return sentMessage;
    } catch (error) {
      // Remove optimistic message on failure
      const state = getState() as RootState;
      const channelMessages = state.chat.messages[channelId] || [];
      const filteredMessages = channelMessages.filter(msg => msg.messageId !== optimisticMessage.messageId);
      
      dispatch(setMessages({ channelId, messages: filteredMessages }));
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      dispatch(setError(errorMessage));
      throw error;
    }
  }
);

/**
 * Join a chat channel
 */
export const joinChannelAsync = createAsyncThunkWithErrorHandling(
  'chat/joinChannelAsync',
  async ({ channelId, userId }: { channelId: string; userId: string }, { dispatch }) => {
    try {
      const channel = await AsyncErrorHandler.withErrorHandling(
        () => chatService.joinChannel(channelId, userId),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
        }
      );
      
      dispatch(addChannel(channel));
      
      // Load initial messages for the channel
      await dispatch(loadMessagesAsync({ channelId })).unwrap();
      
      return channel;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join channel';
      dispatch(setError(errorMessage));
      throw error;
    }
  }
);

/**
 * Leave a chat channel
 */
export const leaveChannelAsync = createAsyncThunkWithErrorHandling(
  'chat/leaveChannelAsync',
  async ({ channelId, userId }: { channelId: string; userId: string }, { dispatch }) => {
    try {
      await AsyncErrorHandler.withErrorHandling(
        () => chatService.leaveChannel(channelId, userId),
        {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 1000,
          },
        }
      );
      
      // Remove channel from local state
      dispatch({ type: 'chat/removeChannel', payload: channelId });
      
      return channelId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave channel';
      dispatch(setError(errorMessage));
      throw error;
    }
  }
);

/**
 * Initialize chat connection with WebSocket
 */
export const initializeChatAsync = createAsyncThunkWithErrorHandling(
  'chat/initializeAsync',
  async (userId: string, { dispatch }) => {
    try {
      // Load channels first
      await dispatch(loadChannelsAsync(userId)).unwrap();
      
      // Establish WebSocket connection
      const websocket = await AsyncErrorHandler.withErrorHandling(
        () => chatService.connectWebSocket(userId),
        {
          retryConfig: {
            maxRetries: 3,
            retryDelay: 2000,
          },
          onError: (error) => {
            console.warn('WebSocket connection failed:', error);
            dispatch(setConnectionStatus(false));
          },
        }
      );
      
      if (websocket) {
        dispatch(setConnectionStatus(true));
        
        // Set up WebSocket event handlers
        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ChatMessage;
            dispatch(addMessage(message));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        websocket.onclose = () => {
          dispatch(setConnectionStatus(false));
          // Attempt to reconnect after a delay
          setTimeout(() => {
            dispatch(initializeChatAsync(userId));
          }, 5000);
        };
        
        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          dispatch(setConnectionStatus(false));
        };
        
        return websocket;
      }
      
      return null;
    } catch (error) {
      dispatch(setConnectionStatus(false));
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize chat';
      dispatch(setError(errorMessage));
      
      // Don't throw - chat should be optional
      console.warn('Chat initialization failed:', errorMessage);
      return null;
    }
  },
  {
    maxRetries: 2,
    retryDelay: 3000,
  }
);

/**
 * Reconnect chat with exponential backoff
 */
export const reconnectChatAsync = createAsyncThunkWithErrorHandling(
  'chat/reconnectAsync',
  async (userId: string, { dispatch, getState }) => {
    const state = getState() as RootState;
    
    if (state.chat.isConnected) {
      return; // Already connected
    }
    
    let retryCount = 0;
    const maxRetries = 5;
    
    const attemptReconnect = async (): Promise<void> => {
      try {
        await dispatch(initializeChatAsync(userId)).unwrap();
      } catch (error) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
          console.log(`Chat reconnection failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          
          setTimeout(() => {
            attemptReconnect();
          }, delay);
        } else {
          console.error('Chat reconnection failed after maximum retries');
          dispatch(setError('Unable to connect to chat. Please refresh the page.'));
        }
      }
    };
    
    await attemptReconnect();
  }
);