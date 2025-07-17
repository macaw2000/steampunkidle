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
      state.channels = action.payload;
      // Initialize unread counts for new channels
      action.payload.forEach(channel => {
        if (!(channel.channelId in state.unreadCounts)) {
          state.unreadCounts[channel.channelId] = 0;
        }
      });
    },
    addChannel: (state, action: PayloadAction<ChatChannel>) => {
      const existingIndex = state.channels.findIndex(c => c.channelId === action.payload.channelId);
      if (existingIndex >= 0) {
        state.channels[existingIndex] = action.payload;
      } else {
        state.channels.push(action.payload);
        state.unreadCounts[action.payload.channelId] = 0;
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
      const { channelId, messages } = action.payload;
      state.messages[channelId] = messages;
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      const message = action.payload;
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
} = chatSlice.actions;

export default chatSlice.reducer;