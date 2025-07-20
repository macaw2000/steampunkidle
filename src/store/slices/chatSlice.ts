import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessage, ChatChannel } from '../../types/chat';

interface ChatState {
  channels: ChatChannel[];
  messages: Record<string, ChatMessage[]>;
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  typingUsers: Record<string, string[]>; // channelId -> userIds
}

const initialState: ChatState = {
  channels: [],
  messages: {},
  activeChannelId: null,
  unreadCounts: {},
  isConnected: false,
  loading: false,
  error: null,
  typingUsers: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChannels: (state, action: PayloadAction<ChatChannel[]>) => {
      try {
        const channels = action.payload;
        
        if (!Array.isArray(channels)) {
          throw new Error('Invalid channels: must be an array');
        }
        
        // Validate and filter channels
        const validChannels = channels.filter(channel => 
          channel && 
          channel.channelId && 
          typeof channel.channelId === 'string' &&
          channel.name && 
          typeof channel.name === 'string'
        );
        
        state.channels = validChannels;
        
        // Initialize unread counts for new channels
        validChannels.forEach(channel => {
          if (!(channel.channelId in state.unreadCounts)) {
            state.unreadCounts[channel.channelId] = 0;
          }
        });
        
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Channel validation failed';
        state.channels = [];
      }
    },
    addChannel: (state, action: PayloadAction<ChatChannel>) => {
      try {
        const channel = action.payload;
        
        if (!channel || !channel.channelId || !channel.name) {
          throw new Error('Invalid channel: missing required fields');
        }
        
        const existingIndex = state.channels.findIndex(c => c.channelId === channel.channelId);
        if (existingIndex >= 0) {
          state.channels[existingIndex] = channel;
        } else {
          state.channels.push(channel);
          state.unreadCounts[channel.channelId] = 0;
        }
        
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Channel addition failed';
      }
    },
    removeChannel: (state, action: PayloadAction<string>) => {
      state.channels = state.channels.filter(c => c.channelId !== action.payload);
      delete state.messages[action.payload];
      delete state.unreadCounts[action.payload];
      if (state.activeChannelId === action.payload) {
        state.activeChannelId = state.channels.length > 0 ? state.channels[0].channelId : null;
      }
    },
    setMessages: (state, action: PayloadAction<{ channelId: string; messages: ChatMessage[] }>) => {
      try {
        const { channelId, messages } = action.payload;
        
        if (!channelId || typeof channelId !== 'string') {
          throw new Error('Invalid channelId for messages');
        }
        
        if (!Array.isArray(messages)) {
          throw new Error('Invalid messages: must be an array');
        }
        
        // Validate and filter messages
        const validMessages = messages.filter(message => 
          message && 
          message.messageId && 
          message.content && 
          message.senderId &&
          message.timestamp
        );
        
        state.messages[channelId] = validMessages;
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Message validation failed';
      }
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      try {
        const message = action.payload;
        
        if (!message || !message.messageId || !message.channelId || !message.content) {
          throw new Error('Invalid message: missing required fields');
        }
        
        const channelId = message.channelId;
        
        if (!state.messages[channelId]) {
          state.messages[channelId] = [];
        }
        
        // Check if message already exists to prevent duplicates
        const existingIndex = state.messages[channelId].findIndex(m => m.messageId === message.messageId);
        if (existingIndex >= 0) {
          state.messages[channelId][existingIndex] = message;
        } else {
          state.messages[channelId].push(message);
          // Sort messages by timestamp
          state.messages[channelId].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          // Increment unread count if not active channel
          if (state.activeChannelId !== channelId) {
            state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
          }
        }
        
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Message addition failed';
      }
    },
    setActiveChannel: (state, action: PayloadAction<string>) => {
      state.activeChannelId = action.payload;
      // Clear unread count for active channel
      state.unreadCounts[action.payload] = 0;
    },
    markChannelAsRead: (state, action: PayloadAction<string>) => {
      state.unreadCounts[action.payload] = 0;
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setTypingUsers: (state, action: PayloadAction<{ channelId: string; userIds: string[] }>) => {
      const { channelId, userIds } = action.payload;
      state.typingUsers[channelId] = userIds;
    },
    addTypingUser: (state, action: PayloadAction<{ channelId: string; userId: string }>) => {
      const { channelId, userId } = action.payload;
      if (!state.typingUsers[channelId]) {
        state.typingUsers[channelId] = [];
      }
      if (!state.typingUsers[channelId].includes(userId)) {
        state.typingUsers[channelId].push(userId);
      }
    },
    removeTypingUser: (state, action: PayloadAction<{ channelId: string; userId: string }>) => {
      const { channelId, userId } = action.payload;
      if (state.typingUsers[channelId]) {
        state.typingUsers[channelId] = state.typingUsers[channelId].filter(id => id !== userId);
      }
    },
    // New reducer for handling corrupted state recovery
    recoverChatState: (state, action: PayloadAction<Partial<ChatState>>) => {
      try {
        const recoveryData = action.payload;
        
        // Recover channels if valid
        if (Array.isArray(recoveryData.channels)) {
          const validChannels = recoveryData.channels.filter(channel => 
            channel && channel.channelId && channel.name
          );
          if (validChannels.length > 0) {
            state.channels = validChannels;
            
            // Initialize unread counts for recovered channels
            validChannels.forEach(channel => {
              if (!(channel.channelId in state.unreadCounts)) {
                state.unreadCounts[channel.channelId] = 0;
              }
            });
          }
        }
        
        // Recover messages if valid
        if (recoveryData.messages && typeof recoveryData.messages === 'object') {
          for (const [channelId, messages] of Object.entries(recoveryData.messages)) {
            if (Array.isArray(messages)) {
              const validMessages = messages.filter(msg => 
                msg && msg.messageId && msg.content && msg.senderId
              );
              if (validMessages.length > 0) {
                state.messages[channelId] = validMessages;
              }
            }
          }
        }
        
        // Recover unread counts if valid
        if (recoveryData.unreadCounts && typeof recoveryData.unreadCounts === 'object') {
          for (const [channelId, count] of Object.entries(recoveryData.unreadCounts)) {
            if (typeof count === 'number' && count >= 0) {
              state.unreadCounts[channelId] = count;
            }
          }
        }
        
        // Recover active channel if valid
        if (recoveryData.activeChannelId && 
            state.channels.find(c => c.channelId === recoveryData.activeChannelId)) {
          state.activeChannelId = recoveryData.activeChannelId;
        }
        
        // Recover connection status
        if (typeof recoveryData.isConnected === 'boolean') {
          state.isConnected = recoveryData.isConnected;
        }
        
        // Clear error and loading states during recovery
        state.loading = false;
        state.error = null;
      } catch (error) {
        // If recovery fails, reset to safe state
        Object.assign(state, initialState);
        state.error = 'Chat state recovery failed';
      }
    },
  },
});

export const {
  setChannels,
  addChannel,
  removeChannel,
  setMessages,
  addMessage,
  setActiveChannel,
  markChannelAsRead,
  setConnectionStatus,
  setLoading,
  setError,
  setTypingUsers,
  addTypingUser,
  removeTypingUser,
  recoverChatState,
} = chatSlice.actions;

export default chatSlice.reducer;