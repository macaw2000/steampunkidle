import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import './ChatInterface.css';

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  channel: string;
  type: 'user' | 'system' | 'achievement';
}

type ChatChannel = 'global' | 'guild' | 'trade' | 'help';

const ChatInterface: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock messages for development
  const generateMockMessages = (): ChatMessage[] => {
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        sender: 'System',
        content: 'Welcome to the Steam Telegraph Network!',
        timestamp: new Date(Date.now() - 300000),
        channel: 'global',
        type: 'system'
      },
      {
        id: '2',
        sender: 'GearMaster',
        content: 'Anyone know where to find Steam Crystals?',
        timestamp: new Date(Date.now() - 240000),
        channel: 'global',
        type: 'user'
      },
      {
        id: '3',
        sender: 'ClockworkQueen',
        content: 'Try the mining zones in the eastern districts!',
        timestamp: new Date(Date.now() - 180000),
        channel: 'global',
        type: 'user'
      },
      {
        id: '4',
        sender: 'System',
        content: 'SteamPunk87 reached level 20!',
        timestamp: new Date(Date.now() - 120000),
        channel: 'global',
        type: 'achievement'
      },
      {
        id: '5',
        sender: 'BrassBuilder',
        content: 'WTS: Clockwork Gears x10 - 50 coins each',
        timestamp: new Date(Date.now() - 60000),
        channel: 'trade',
        type: 'user'
      }
    ];

    return mockMessages;
  };

  // Initialize messages
  useEffect(() => {
    setMessages(generateMockMessages());
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // Simulate other players responding (for demo)
    if (Math.random() < 0.3) {
      setTimeout(() => {
        const responses = [
          'Nice one!',
          'Agreed!',
          'Thanks for the info!',
          'Good point!',
          'I see what you mean.',
        ];
        
        const responseMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'MechMaster',
          content: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
          channel: activeChannel,
          type: 'user'
        };
        
        setMessages(prev => [...prev, responseMessage]);
      }, 1000 + Math.random() * 2000);
    }
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="chat-interface expanded">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <span>Steam Telegraph</span>
          <span className="channel-indicator">
            {getChannelInfo(activeChannel).icon} {getChannelInfo(activeChannel).name}
          </span>
        </div>
      </div>

      {/* Chat Content - Always Visible */}
      <div className="chat-content">
        {/* Channel Tabs */}
        <div className="chat-channels">
          {(['global', 'guild', 'trade', 'help'] as ChatChannel[]).map(channel => {
            const info = getChannelInfo(channel);
            return (
              <button
                key={channel}
                className={`channel-tab ${activeChannel === channel ? 'active' : ''}`}
                onClick={() => setActiveChannel(channel)}
                style={{ '--channel-color': info.color } as React.CSSProperties}
              >
                <span className="channel-icon">{info.icon}</span>
                <span className="channel-name">{info.name}</span>
              </button>
            );
          })}
        </div>

        {/* Messages Area */}
        <div className="chat-messages">
          {filteredMessages.map(message => (
            <div
              key={message.id}
              className={`chat-message ${message.type}`}
            >
              <div className="message-header">
                <span className="message-sender">{message.sender}</span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div className="message-content">{message.content}</div>
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
            >
              📤
            </button>
          </div>
          <div className="input-info">
            <span className="char-count">{inputMessage.length}/200</span>
            <span className="input-hint">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;