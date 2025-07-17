/**
 * Chat channel tabs component
 */

import React from 'react';
import { ChatChannel } from '../../types/chat';
import './ChatChannelTabs.css';

interface ChatChannelTabsProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  onChannelSwitch: (channelId: string) => void;
}

const ChatChannelTabs: React.FC<ChatChannelTabsProps> = ({
  channels,
  activeChannelId,
  unreadCounts,
  onChannelSwitch,
}) => {
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'general':
        return '🌍';
      case 'guild':
        return '🏰';
      case 'party':
        return '👥';
      case 'whisper':
        return '💬';
      case 'zone':
        return '⚔️';
      default:
        return '💭';
    }
  };

  const getChannelDisplayName = (channel: ChatChannel) => {
    if (channel.type === 'whisper') {
      return channel.name; // Already formatted as recipient name
    }
    return channel.name;
  };

  return (
    <div className="chat-channel-tabs">
      <div className="tabs-container">
        {channels.map((channel) => {
          const isActive = channel.channelId === activeChannelId;
          const unreadCount = unreadCounts[channel.channelId] || 0;
          
          return (
            <button
              key={channel.channelId}
              className={`channel-tab ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
              onClick={() => onChannelSwitch(channel.channelId)}
              title={`${channel.name} (${channel.type})`}
            >
              <span className="channel-icon">
                {getChannelIcon(channel.type)}
              </span>
              <span className="channel-name">
                {getChannelDisplayName(channel)}
              </span>
              {unreadCount > 0 && (
                <span className="unread-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Tab scroll buttons for mobile */}
      <div className="tab-scroll-buttons">
        <button 
          className="scroll-button left"
          onClick={() => {
            const container = document.querySelector('.tabs-container');
            if (container) {
              container.scrollBy({ left: -100, behavior: 'smooth' });
            }
          }}
        >
          ‹
        </button>
        <button 
          className="scroll-button right"
          onClick={() => {
            const container = document.querySelector('.tabs-container');
            if (container) {
              container.scrollBy({ left: 100, behavior: 'smooth' });
            }
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
};

export default ChatChannelTabs;