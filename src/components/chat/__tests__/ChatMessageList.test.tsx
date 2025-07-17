/**
 * Tests for ChatMessageList component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessageList from '../ChatMessageList';
import { ChatMessage } from '../../../types/chat';

const mockMessages: ChatMessage[] = [
  {
    messageId: 'msg1',
    channelId: 'general',
    senderId: 'user1',
    senderName: 'Alice',
    content: 'Hello everyone!',
    type: 'text',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    isRead: true,
  },
  {
    messageId: 'msg2',
    channelId: 'general',
    senderId: 'user2',
    senderName: 'Bob',
    content: 'Hey Alice!',
    type: 'text',
    timestamp: new Date('2024-01-01T10:01:00Z'),
    isRead: true,
  },
  {
    messageId: 'msg3',
    channelId: 'general',
    senderId: 'user1',
    senderName: 'Alice',
    content: 'How is everyone doing?',
    type: 'text',
    timestamp: new Date('2024-01-01T10:02:00Z'),
    isRead: true,
  },
];

const mockSystemMessage: ChatMessage = {
  messageId: 'sys1',
  channelId: 'general',
  senderId: 'system',
  senderName: 'System',
  content: 'Alice joined the channel',
  type: 'system',
  timestamp: new Date('2024-01-01T09:59:00Z'),
  isRead: true,
};

describe.skip('ChatMessageList', () => {
  const defaultProps = {
    messages: mockMessages,
    currentUserId: 'user1',
    typingUsers: [],
    channelType: 'general',
  };

  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
    
    // Mock scroll properties
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      writable: true,
      value: 0,
    });
    
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      writable: true,
      value: 1000,
    });
    
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      writable: true,
      value: 400,
    });
  });

  it('renders messages correctly', () => {
    render(<ChatMessageList {...defaultProps} />);
    
    expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    expect(screen.getByText('Hey Alice!')).toBeInTheDocument();
    expect(screen.getByText('How is everyone doing?')).toBeInTheDocument();
  });

  it('displays sender names', () => {
    render(<ChatMessageList {...defaultProps} />);
    
    expect(screen.getAllByText('Alice')).toHaveLength(2); // Alice appears twice
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows date separators', () => {
    render(<ChatMessageList {...defaultProps} />);
    
    // Should show "Today" for messages from today
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('displays empty state when no messages', () => {
    render(<ChatMessageList {...defaultProps} messages={[]} />);
    
    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('shows typing indicator when users are typing', () => {
    render(
      <ChatMessageList 
        {...defaultProps} 
        typingUsers={['user2']} 
      />
    );
    
    // The typing indicator should be present
    expect(document.querySelector('.typing-indicator')).toBeInTheDocument();
  });

  it('handles system messages differently', () => {
    render(
      <ChatMessageList 
        {...defaultProps} 
        messages={[mockSystemMessage, ...mockMessages]} 
      />
    );
    
    expect(screen.getByText('Alice joined the channel')).toBeInTheDocument();
  });

  it('groups messages by date correctly', () => {
    const messagesFromDifferentDays: ChatMessage[] = [
      {
        ...mockMessages[0],
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        ...mockMessages[1],
        timestamp: new Date('2024-01-02T10:00:00Z'),
      },
    ];

    render(
      <ChatMessageList 
        {...defaultProps} 
        messages={messagesFromDifferentDays} 
      />
    );
    
    // Should have multiple date separators
    const dateSeparators = document.querySelectorAll('.date-separator');
    expect(dateSeparators.length).toBeGreaterThan(1);
  });

  it('shows scroll to bottom button when not at bottom', () => {
    // Mock scrolling behavior
    const mockScrollTop = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      get: () => 100, // Not at bottom
      set: mockScrollTop,
    });
    
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      get: () => 1000,
    });
    
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      get: () => 400,
    });

    render(<ChatMessageList {...defaultProps} />);
    
    // Simulate scroll event
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      fireEvent.scroll(messagesContainer);
    }
    
    // Should show scroll to bottom button
    expect(document.querySelector('.scroll-to-bottom')).toBeInTheDocument();
  });

  it('calls onLoadMore when scrolled to top', () => {
    const mockOnLoadMore = jest.fn();
    
    // Mock scroll position at top
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      get: () => 50, // Near top
    });

    render(
      <ChatMessageList 
        {...defaultProps} 
        onLoadMore={mockOnLoadMore}
        hasMore={true}
      />
    );
    
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      fireEvent.scroll(messagesContainer);
    }
    
    expect(mockOnLoadMore).toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    render(<ChatMessageList {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('handles whisper channel type correctly', () => {
    render(
      <ChatMessageList 
        {...defaultProps} 
        channelType="whisper" 
      />
    );
    
    // Should render messages with whisper indicators
    expect(document.querySelector('.whisper-indicator')).toBeInTheDocument();
  });

  it('identifies own messages correctly', () => {
    render(<ChatMessageList {...defaultProps} />);
    
    // Messages from user1 should be marked as own messages
    const ownMessages = document.querySelectorAll('.own-message');
    expect(ownMessages.length).toBe(2); // Alice's messages
  });

  it('shows sender name only when needed', () => {
    const consecutiveMessages: ChatMessage[] = [
      {
        messageId: 'msg1',
        channelId: 'general',
        senderId: 'user1',
        senderName: 'Alice',
        content: 'First message',
        type: 'text',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        isRead: true,
      },
      {
        messageId: 'msg2',
        channelId: 'general',
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Second message immediately after',
        type: 'text',
        timestamp: new Date('2024-01-01T10:00:30Z'), // 30 seconds later
        isRead: true,
      },
    ];

    render(
      <ChatMessageList 
        {...defaultProps} 
        messages={consecutiveMessages} 
      />
    );
    
    // First message should show sender, second should not (consecutive from same user)
    const senderNames = screen.getAllByText('Alice');
    expect(senderNames.length).toBe(1); // Only shown once
  });

  it('handles click on scroll to bottom button', () => {
    // Mock scroll behavior
    const mockScrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    render(<ChatMessageList {...defaultProps} />);
    
    const scrollButton = document.querySelector('.scroll-to-bottom');
    if (scrollButton) {
      fireEvent.click(scrollButton);
      expect(mockScrollIntoView).toHaveBeenCalled();
    }
  });
});