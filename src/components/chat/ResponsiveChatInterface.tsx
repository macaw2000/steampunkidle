import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import './ResponsiveChatInterface.css';

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  channel: string;
  type: 'user' | 'system' | 'achievement';
}

type ChatChannel = 'global' | 'guild' | 'trade' | 'help';

const ResponsiveChatInterface: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Check device type and sidebar state
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const desktop = width >= 1024;
      
      setIsMobile(mobile);
      setIsDesktop(desktop);
      
      // Auto-collapse on mobile initially
      if (mobile && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, [isCollapsed]);

  // Mock messages for development
  const generateMockMessages = (): ChatMessage[] => {
    const mockMessages: ChatMessage[] = [];
    const now = Date.now();
    
    const globalMessages = [
      { sender: 'System', content: 'Welcome to the Steam Telegraph Network!', type: 'system' as const, time: 1800000 },
      { sender: 'VictorianEngineer', content: 'Good morning, fellow inventors!', type: 'user' as const, time: 1740000 },
      { sender: 'SteamMaster', content: 'Has anyone tried the new boiler designs?', type: 'user' as const, time: 1680000 },
      { sender: 'ClockworkTinker', content: 'Yes! The efficiency is remarkable', type: 'user' as const, time: 1620000 },
      { sender: 'BrassFoundry', content: 'I can supply materials if anyone needs them', type: 'user' as const, time: 1560000 },
      { sender: 'System', content: 'ClockworkTinker reached level 15!', type: 'achievement' as const, time: 1500000 },
      { sender: 'GearMaster', content: 'Anyone know where to find Steam Crystals?', type: 'user' as const, time: 1440000 },
      { sender: 'ClockworkQueen', content: 'Try the mining zones in the eastern districts!', type: 'user' as const, time: 1380000 },
    ];

    const tradeMessages = [
      { sender: 'BrassBuilder', content: 'WTS: Clockwork Gears x10 - 50 coins each', type: 'user' as const, time: 1500000 },
      { sender: 'SteamTrader', content: 'WTB: Steam Crystals - paying premium', type: 'user' as const, time: 1200000 },
      { sender: 'GearMerchant', content: 'Selling rare mechanical parts, PM me', type: 'user' as const, time: 900000 },
    ];

    const guildMessages = [
      { sender: 'GuildLeader', content: 'Welcome to the Clockwork Collective!', type: 'user' as const, time: 1800000 },
      { sender: 'GuildOfficer', content: 'Remember to contribute to guild projects', type: 'user' as const, time: 1200000 },
      { sender: 'GuildMember1', content: 'Working on the steam engine upgrade', type: 'user' as const, time: 600000 },
    ];

    const helpMessages = [
      { sender: 'Helper', content: 'Welcome! Ask any questions here', type: 'user' as const, time: 1800000 },
      { sender: 'Newbie', content: 'How do I start harvesting?', type: 'user' as const, time: 1200000 },
      { sender: 'Veteran', content: 'Click Resource Harvesting in the left sidebar', type: 'user' as const, time: 1100000 },
    ];

    // Add messages for each channel
    [
      { messages: globalMessages, channel: 'global' },
      { messages: tradeMessages, channel: 'trade' },
      { messages: guildMessages, channel: 'guild' },
      { messages: helpMessages, channel: 'help' }
    ].forEach(({ messages: channelMessages, channel }) => {
      channelMessages.forEach((msg, index) => {
        mockMessages.push({
          id: `${channel}-${index}`,
          sender: msg.sender,
          content: msg.content,
          timestamp: new Date(now - msg.time),
          channel,
          type: msg.type
        });
      });
    });

    return mockMessages;
  };

  // Initialize messages
  useEffect(() => {
    setMessages(generateMockMessages());
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  // Touch gesture handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const channels: ChatChannel[] = ['global', 'guild', 'trade', 'help'];
      const currentIndex = channels.indexOf(activeChannel);
      
      if (deltaX > 0 && currentIndex < channels.length - 1) {
        // Swipe left - next channel
        setActiveChannel(channels[currentIndex + 1]);
      } else if (deltaX < 0 && currentIndex > 0) {
        // Swipe right - previous channel
        setActiveChannel(channels[currentIndex - 1]);
      }
    }

    touchStartX.current = 0;
    touchStartY.current = 0;
  }, [activeChannel]);

  // Handle sending messages
  const handleSendMessage = () => {
    if (!inputMessage.trim() || !character) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: character.name,
      content: inputMessage.trim(),
      timestamp: new Date(),
      channel: activeChannel,
      type: 'user'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter messages by active channel
  const filteredMessages = messages.filter(msg => msg.channel === activeChannel);

  // Format timestamp
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      ...(isMobile ? {} : { second: '2-digit' })
    });
  };

  // Get channel info
  const getChannelInfo = (channel: ChatChannel) => {
    const channelData = {
      global: { name: 'Global', icon: '🌍', color: '#4a7c59' },
      guild: { name: 'Guild', icon: '🏰', color: '#8b4513' },
      trade: { name: 'Trade', icon: '💼', color: '#b8860b' },
      help: { name: 'Help', icon: '❓', color: '#6495ed' }
    };
    return channelData[channel];
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      ref={chatRef}
      className={`responsive-chat-interface ${isCollapsed ? 'collapsed' : 'expanded'} ${isMobile ? 'mobile' : isDesktop ? 'desktop sidebar-expanded' : 'tablet'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Collapse/Expand Button */}
      <button 
        className="chat-toggle-button"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
      >
        <span className="toggle-icon">
          {isCollapsed ? '⬆️' : '⬇️'}
        </span>
        <span className="toggle-text">
          {isCollapsed ? 'Show Chat' : 'Hide Chat'}
        </span>
      </button>

      {/* Chat Content */}
      <div className="chat-content">
        {/* Channel Header */}
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-icon">💬</span>
            <span className="title-text">Steam Telegraph</span>

          </div>
          
          {/* Channel Tabs */}
          <div className="channel-tabs">
            {(['global', 'guild', 'trade', 'help'] as ChatChannel[]).map(channel => {
              const info = getChannelInfo(channel);
              return (
                <button
                  key={channel}
                  className={`channel-tab ${activeChannel === channel ? 'active' : ''}`}
                  onClick={() => setActiveChannel(channel)}
                  style={{ '--channel-color': info.color } as React.CSSProperties}
                  title={info.name}
                >
                  <span className="channel-icon">{info.icon}</span>
                  {!isMobile && <span className="channel-name">{info.name}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages Area */}
        <div className="chat-messages">
          {filteredMessages.map(message => (
            <div
              key={message.id}
              className={`chat-message ${message.type}`}
            >
              <div className="message-line">
                <span className="message-time">{formatTime(message.timestamp)}</span>
                <span className="message-sender">{message.sender}:</span>
                <span className="message-content">{message.content}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${getChannelInfo(activeChannel).name}...`}
              className="chat-input"
              maxLength={200}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="send-button"
              aria-label="Send message"
            >
              📤
            </button>
          </div>
          
          {!isMobile && (
            <div className="input-info">
              <span className="char-count">{inputMessage.length}/200</span>
              <span className="input-hint">Press Enter to send • Swipe to change channels</span>
            </div>
          )}
          
          {isMobile && (
            <div className="mobile-input-info">
              <span className="swipe-hint">← Swipe to change channels →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveChatInterface;