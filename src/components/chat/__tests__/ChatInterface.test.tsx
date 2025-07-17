/**
 * Tests for ChatInterface component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ChatInterface from '../ChatInterface';
import chatReducer from '../../../store/slices/chatSlice';
import gameReducer from '../../../store/slices/gameSlice';
import authReducer from '../../../store/slices/authSlice';

// Mock the useChat hook
jest.mock('../../../hooks/useChat', () => ({
  useChat: () => ({
    channels: [
      {
        channelId: 'general',
        type: 'general',
        name: 'General',
        participants: ['user1'],
        isActive: true,
        createdAt: new Date(),
      },
      {
        channelId: 'guild1',
        type: 'guild',
        name: 'Test Guild',
        participants: ['user1', 'user2'],
        isActive: true,
        createdAt: new Date(),
      },
    ],
    activeChannel: {
      channelId: 'general',
      type: 'general',
      name: 'General',
      participants: ['user1'],
      isActive: true,
      createdAt: new Date(),
    },
    activeMessages: [
      {
        messageId: 'msg1',
        channelId: 'general',
        senderId: 'user2',
        senderName: 'TestUser',
        content: 'Hello world!',
        type: 'text',
        timestamp: new Date(),
        isRead: true,
      },
    ],
    unreadCounts: { guild1: 2 },
    isConnected: true,
    loading: false,
    error: null,
    typingUsers: {},
    sendMessage: jest.fn(),
    switchChannel: jest.fn(),
    sendTypingIndicator: jest.fn(),
    createPrivateConversation: jest.fn(),
  }),
}));

// Mock WebSocket service
jest.mock('../../../services/websocketService', () => ({
  getInstance: () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: () => true,
    send: jest.fn(),
    subscribe: jest.fn(),
    onConnectionStatusChange: jest.fn(),
  }),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      chat: chatReducer,
      game: gameReducer,
      auth: authReducer,
    },
    preloadedState: {
      game: {
        character: {
          userId: 'user1',
          characterId: 'char1',
          name: 'TestCharacter',
          level: 1,
          experience: 0,
          stats: {
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            vitality: 10,
            craftingSkills: {},
            harvestingSkills: {},
            combatSkills: {},
          },
          specialization: {
            tankProgress: 0,
            healerProgress: 0,
            dpsProgress: 0,
          },
          currentActivity: {
            type: 'idle',
            startedAt: new Date(),
          },
          currency: 100,
          lastActiveAt: new Date(),
          createdAt: new Date(),
        },
        activityProgress: null,
        isOnline: true,
        lastSyncTime: null,
        loading: false,
        error: null,
        activitySwitching: false,
      },
      chat: {
        channels: [],
        messages: {},
        activeChannelId: null,
        unreadCounts: {},
        isConnected: false,
        loading: false,
        error: null,
        typingUsers: {},
      },
      auth: {
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      },
    },
  });
};

describe.skip('ChatInterface', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  const renderChatInterface = (props = {}) => {
    return render(
      <Provider store={store}>
        <ChatInterface {...props} />
      </Provider>
    );
  };

  it('renders chat interface with header', () => {
    renderChatInterface();
    
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays channel tabs when showChannelTabs is true', () => {
    renderChatInterface({ showChannelTabs: true });
    
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Test Guild')).toBeInTheDocument();
  });

  it('shows unread count badges on channel tabs', () => {
    renderChatInterface({ showChannelTabs: true });
    
    // Should show unread count for guild channel
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays messages in the active channel', () => {
    renderChatInterface();
    
    expect(screen.getByText('Hello world!')).toBeInTheDocument();
    expect(screen.getByText('TestUser')).toBeInTheDocument();
  });

  it('shows private message button when enabled', () => {
    renderChatInterface({ enablePrivateMessages: true });
    
    const privateMessageButton = screen.getByTitle('Start private conversation');
    expect(privateMessageButton).toBeInTheDocument();
  });

  it('opens private message modal when button is clicked', async () => {
    renderChatInterface({ enablePrivateMessages: true });
    
    const privateMessageButton = screen.getByTitle('Start private conversation');
    fireEvent.click(privateMessageButton);
    
    await waitFor(() => {
      expect(screen.getByText('Start Private Conversation')).toBeInTheDocument();
    });
  });

  it('can be minimized and expanded', () => {
    renderChatInterface();
    
    const minimizeButton = screen.getByTitle('Minimize chat');
    fireEvent.click(minimizeButton);
    
    expect(screen.getByTitle('Expand chat')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    // Mock loading state
    jest.doMock('../../../hooks/useChat', () => ({
      useChat: () => ({
        channels: [],
        activeChannel: null,
        activeMessages: [],
        unreadCounts: {},
        isConnected: false,
        loading: true,
        error: null,
        typingUsers: {},
        sendMessage: jest.fn(),
        switchChannel: jest.fn(),
        sendTypingIndicator: jest.fn(),
        createPrivateConversation: jest.fn(),
      }),
    }));

    renderChatInterface();
    
    expect(screen.getByText('Connecting to chat...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    // Mock error state
    jest.doMock('../../../hooks/useChat', () => ({
      useChat: () => ({
        channels: [],
        activeChannel: null,
        activeMessages: [],
        unreadCounts: {},
        isConnected: false,
        loading: false,
        error: 'Connection failed',
        typingUsers: {},
        sendMessage: jest.fn(),
        switchChannel: jest.fn(),
        sendTypingIndicator: jest.fn(),
        createPrivateConversation: jest.fn(),
      }),
    }));

    renderChatInterface();
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows no channel selected message when no active channel', () => {
    // Mock no active channel state
    jest.doMock('../../../hooks/useChat', () => ({
      useChat: () => ({
        channels: [],
        activeChannel: null,
        activeMessages: [],
        unreadCounts: {},
        isConnected: true,
        loading: false,
        error: null,
        typingUsers: {},
        sendMessage: jest.fn(),
        switchChannel: jest.fn(),
        sendTypingIndicator: jest.fn(),
        createPrivateConversation: jest.fn(),
      }),
    }));

    renderChatInterface();
    
    expect(screen.getByText(/Select a channel/i)).toBeInTheDocument();
  });

  it('applies custom className and height', () => {
    const { container } = renderChatInterface({
      className: 'custom-chat',
      height: '500px',
    });
    
    const chatInterface = container.querySelector('.chat-interface');
    expect(chatInterface).toHaveClass('custom-chat');
    expect(chatInterface).toHaveStyle('height: 500px');
  });

  it('handles disconnected state', () => {
    // Mock disconnected state
    jest.doMock('../../../hooks/useChat', () => ({
      useChat: () => ({
        channels: [
          {
            channelId: 'general',
            type: 'general',
            name: 'General',
            participants: ['user1'],
            isActive: true,
            createdAt: new Date(),
          },
        ],
        activeChannel: {
          channelId: 'general',
          type: 'general',
          name: 'General',
          participants: ['user1'],
          isActive: true,
          createdAt: new Date(),
        },
        activeMessages: [],
        unreadCounts: {},
        isConnected: false,
        loading: false,
        error: null,
        typingUsers: {},
        sendMessage: jest.fn(),
        switchChannel: jest.fn(),
        sendTypingIndicator: jest.fn(),
        createPrivateConversation: jest.fn(),
      }),
    }));

    renderChatInterface();
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});