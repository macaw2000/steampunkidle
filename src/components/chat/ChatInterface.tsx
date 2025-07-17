/**
 * Main chat interface component with tabbed channels
 */

import React, { useState, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import ChatChannelTabs from './ChatChannelTabs';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import PrivateMessageModal from './PrivateMessageModal';
import './ChatInterface.css';

interface ChatInterfaceProps {
  className?: string;
  height?: string;
  showChannelTabs?: boolean;
  enablePrivateMessages?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  className = '',
  height = '400px',
  showChannelTabs = true,
  enablePrivateMessages = true,
}) => {
  const {
    channels,
    activeChannel,
    activeMessages,
    unreadCounts,
    isConnected,
    loading,
    error,
    typingUsers,
    sendMessage,
    switchChannel,
    sendTypingIndicator,
    createPrivateConversation,
  } = useChat();

  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!activeChannel) return;
    
    await sendMessage(content);
  };

  // Handle slash commands
  const handleSlashCommand = async (command: string, args: string[]) => {
    if (!activeChannel) return;
    
    // This would typically get the current user info from auth context
    const currentUserId = activeChannel.participants[0]; // Placeholder
    const currentUserName = 'Player'; // Placeholder - should come from auth
    
    try {
      // Process the slash command through the chat service
      // The actual processing will be handled by the backend
      console.log(`Processing command: /${command} with args:`, args);
    } catch (error) {
      console.error('Failed to process slash command:', error);
    }
  };

  // Handle channel switching
  const handleChannelSwitch = (channelId: string) => {
    switchChannel(channelId);
  };

  // Handle private message creation
  const handleCreatePrivateMessage = (recipientId: string, recipientName: string) => {
    createPrivateConversation(recipientId, recipientName);
    setShowPrivateModal(false);
  };

  // Handle typing indicators
  const handleTyping = () => {
    sendTypingIndicator();
  };

  if (loading) {
    return (
      <div className={`chat-interface loading ${className}`} style={{ height }}>
        <div className="chat-loading">
          <div className="loading-spinner"></div>
          <span>Connecting to chat...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`chat-interface error ${className}`} style={{ height }}>
        <div className="chat-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-interface ${isMinimized ? 'minimized' : ''} ${className}`} style={{ height: isMinimized ? 'auto' : height }}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <span>Chat</span>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="chat-controls">
          {enablePrivateMessages && (
            <button
              className="private-message-button"
              onClick={() => setShowPrivateModal(true)}
              title="Start private conversation"
            >
              ✉️
            </button>
          )}
          <button
            className="minimize-button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand chat' : 'Minimize chat'}
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Channel Tabs */}
          {showChannelTabs && channels.length > 0 && (
            <ChatChannelTabs
              channels={channels}
              activeChannelId={activeChannel?.channelId || null}
              unreadCounts={unreadCounts}
              onChannelSwitch={handleChannelSwitch}
            />
          )}

          {/* Chat Content */}
          <div className="chat-content">
            {activeChannel ? (
              <>
                {/* Message List */}
                <ChatMessageList
                  messages={activeMessages}
                  currentUserId={activeChannel.participants[0]} // This should come from auth
                  typingUsers={typingUsers[activeChannel.channelId] || []}
                  channelType={activeChannel.type}
                />

                {/* Chat Input */}
                <ChatInput
                  onSendMessage={handleSendMessage}
                  onSlashCommand={handleSlashCommand}
                  onTyping={handleTyping}
                  placeholder={`Message ${activeChannel.name}...`}
                  disabled={!isConnected}
                  currentUserId={activeChannel.participants[0]} // This should come from auth
                  currentUserName="Player" // This should come from auth
                  channelId={activeChannel.channelId}
                  messageType={activeChannel.type === 'general' ? 'general' : activeChannel.type === 'guild' ? 'guild' : 'private'}
                />
              </>
            ) : (
              <div className="no-channel-selected">
                <div className="no-channel-icon">💭</div>
                <div className="no-channel-message">
                  Select a channel to start chatting
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Private Message Modal */}
      {showPrivateModal && (
        <PrivateMessageModal
          onClose={() => setShowPrivateModal(false)}
          onCreateConversation={handleCreatePrivateMessage}
        />
      )}
    </div>
  );
};

export default ChatInterface;