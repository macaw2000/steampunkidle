/**
 * Chat message list component with timestamps and sender info
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../../types/chat';
import ChatMessageItem from './ChatMessageItem';
import TypingIndicator from './TypingIndicator';
import './ChatMessageList.css';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  typingUsers: string[];
  channelType: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  currentUserId,
  typingUsers,
  channelType,
  onLoadMore,
  hasMore = false,
  loading = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Check if user is near bottom of messages
  const checkScrollPosition = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShouldAutoScroll(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);
  };

  // Handle scroll events
  const handleScroll = () => {
    checkScrollPosition();
    
    // Load more messages when scrolled to top
    if (messagesContainerRef.current && onLoadMore && hasMore && !loading) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop < 100) {
        onLoadMore();
      }
    }
  };

  // Auto-scroll when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, []);

  // Group messages by date for date separators
  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-message-list empty">
        <div className="empty-messages">
          <div className="empty-icon">💭</div>
          <div className="empty-text">
            No messages yet. Start the conversation!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-message-list">
      <div 
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Load more indicator */}
        {loading && (
          <div className="load-more-indicator">
            <div className="loading-spinner small"></div>
            <span>Loading messages...</span>
          </div>
        )}

        {/* Messages grouped by date */}
        {messageGroups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="message-group">
            {/* Date separator */}
            <div className="date-separator">
              <div className="date-line"></div>
              <div className="date-text">
                {formatDateSeparator(group.date)}
              </div>
              <div className="date-line"></div>
            </div>

            {/* Messages for this date */}
            {group.messages.map((message, messageIndex) => (
              <ChatMessageItem
                key={message.messageId}
                message={message}
                isOwnMessage={message.senderId === currentUserId}
                showSender={
                  messageIndex === 0 || 
                  group.messages[messageIndex - 1].senderId !== message.senderId ||
                  new Date(message.timestamp).getTime() - new Date(group.messages[messageIndex - 1].timestamp).getTime() > 300000 // 5 minutes
                }
                channelType={channelType}
              />
            ))}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator userIds={typingUsers} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <span className="scroll-icon">⬇️</span>
          {messages.length > 0 && (
            <span className="new-messages-count">
              New messages
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default ChatMessageList;