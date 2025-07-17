/**
 * Individual chat message item component
 */

import React, { useState } from 'react';
import { ChatMessage } from '../../types/chat';
import './ChatMessageItem.css';

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showSender: boolean;
  channelType: string;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isOwnMessage,
  showSender,
  channelType,
}) => {
  const [showFullTimestamp, setShowFullTimestamp] = useState(false);

  const formatTimestamp = (timestamp: Date, full: boolean = false) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
    
    if (full) {
      return messageTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return messageTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getMessageTypeClass = () => {
    switch (message.type) {
      case 'system':
        return 'system-message';
      case 'command':
        return 'command-message';
      case 'emote':
        return 'emote-message';
      default:
        return 'text-message';
    }
  };

  const getSenderDisplayName = () => {
    if (message.type === 'system') {
      return 'System';
    }
    return message.senderName || 'Unknown';
  };

  const renderMessageContent = () => {
    const content = message.content;
    
    // Handle system messages
    if (message.type === 'system') {
      return <span className="system-content">{content}</span>;
    }
    
    // Handle emote messages
    if (message.type === 'emote') {
      return (
        <span className="emote-content">
          <em>{getSenderDisplayName()} {content}</em>
        </span>
      );
    }
    
    // Handle command results
    if (message.type === 'command') {
      return <span className="command-content">{content}</span>;
    }
    
    // Handle regular text with basic formatting
    // This could be extended to support markdown, mentions, etc.
    return (
      <span className="text-content">
        {content.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const handleTimestampClick = () => {
    setShowFullTimestamp(!showFullTimestamp);
  };

  return (
    <div className={`chat-message-item ${getMessageTypeClass()} ${isOwnMessage ? 'own-message' : 'other-message'}`}>
      {/* Message header (sender and timestamp) */}
      {showSender && message.type !== 'system' && (
        <div className="message-header">
          <span className={`sender-name ${isOwnMessage ? 'own-sender' : 'other-sender'}`}>
            {getSenderDisplayName()}
          </span>
          {channelType === 'whisper' && (
            <span className="whisper-indicator">
              {isOwnMessage ? '→' : '←'}
            </span>
          )}
          <span 
            className="message-timestamp"
            onClick={handleTimestampClick}
            title={formatTimestamp(message.timestamp, true)}
          >
            {formatTimestamp(message.timestamp, showFullTimestamp)}
          </span>
        </div>
      )}
      
      {/* Message content */}
      <div className="message-content">
        {renderMessageContent()}
      </div>
      
      {/* Inline timestamp for messages without header */}
      {!showSender && message.type !== 'system' && (
        <span 
          className="inline-timestamp"
          onClick={handleTimestampClick}
          title={formatTimestamp(message.timestamp, true)}
        >
          {formatTimestamp(message.timestamp, showFullTimestamp)}
        </span>
      )}
    </div>
  );
};

export default ChatMessageItem;