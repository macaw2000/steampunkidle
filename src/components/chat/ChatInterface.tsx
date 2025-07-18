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

  // Mock messages for development - Extended history for scrolling
  const generateMockMessages = (): ChatMessage[] => {
    const mockMessages: ChatMessage[] = [];
    const now = Date.now();
    
    // Generate more messages for better scrolling experience
    const globalMessages = [
      { sender: 'System', content: 'Welcome to the Steam Telegraph Network!', type: 'system' as const, time: 1800000 },
      { sender: 'VictorianEngineer', content: 'Good morning, fellow inventors!', type: 'user' as const, time: 1740000 },
      { sender: 'SteamMaster', content: 'Has anyone tried the new boiler designs?', type: 'user' as const, time: 1680000 },
      { sender: 'ClockworkTinker', content: 'Yes! The efficiency is remarkable', type: 'user' as const, time: 1620000 },
      { sender: 'BrassFoundry', content: 'I can supply materials if anyone needs them', type: 'user' as const, time: 1560000 },
      { sender: 'System', content: 'ClockworkTinker reached level 15!', type: 'achievement' as const, time: 1500000 },
      { sender: 'GearMaster', content: 'Anyone know where to find Steam Crystals?', type: 'user' as const, time: 1440000 },
      { sender: 'ClockworkQueen', content: 'Try the mining zones in the eastern districts!', type: 'user' as const, time: 1380000 },
      { sender: 'VictorianEngineer', content: 'The northern mines have better quality crystals', type: 'user' as const, time: 1320000 },
      { sender: 'SteamMaster', content: 'Thanks for the tips everyone!', type: 'user' as const, time: 1260000 },
      { sender: 'System', content: 'SteamPunk87 reached level 20!', type: 'achievement' as const, time: 1200000 },
      { sender: 'BrassFoundry', content: 'Congratulations SteamPunk87!', type: 'user' as const, time: 1140000 },
      { sender: 'ClockworkTinker', content: 'Well done! What build are you using?', type: 'user' as const, time: 1080000 },
      { sender: 'GearMaster', content: 'The harvesting rates seem improved today', type: 'user' as const, time: 1020000 },
      { sender: 'ClockworkQueen', content: 'I noticed that too! Found 3 rare items already', type: 'user' as const, time: 960000 },
      { sender: 'VictorianEngineer', content: 'Lucky! I\'ve been searching all morning', type: 'user' as const, time: 900000 },
      { sender: 'SteamMaster', content: 'Patience is key with rare finds', type: 'user' as const, time: 840000 },
      { sender: 'BrassFoundry', content: 'Anyone interested in forming a guild?', type: 'user' as const, time: 780000 },
      { sender: 'ClockworkTinker', content: 'I\'d be interested! What focus?', type: 'user' as const, time: 720000 },
      { sender: 'GearMaster', content: 'Count me in if it\'s crafting focused', type: 'user' as const, time: 660000 },
      { sender: 'ClockworkQueen', content: 'We could specialize in mechanical engineering', type: 'user' as const, time: 600000 },
      { sender: 'VictorianEngineer', content: 'That sounds perfect!', type: 'user' as const, time: 540000 },
      { sender: 'System', content: 'Guild "Clockwork Collective" has been formed!', type: 'system' as const, time: 480000 },
      { sender: 'BrassFoundry', content: 'Excellent! Welcome to the guild everyone', type: 'user' as const, time: 420000 },
      { sender: 'SteamMaster', content: 'The new update looks promising', type: 'user' as const, time: 360000 },
      { sender: 'ClockworkTinker', content: 'What changes did they make?', type: 'user' as const, time: 300000 },
      { sender: 'GearMaster', content: 'Improved harvesting rewards and new exotic items', type: 'user' as const, time: 240000 },
      { sender: 'ClockworkQueen', content: 'Ooh, I love finding exotic treasures!', type: 'user' as const, time: 180000 },
      { sender: 'VictorianEngineer', content: 'The skill bonuses for exotic discovery are nice', type: 'user' as const, time: 120000 },
      { sender: 'BrassFoundry', content: 'Time to get back to harvesting then!', type: 'user' as const, time: 60000 }
    ];

    const tradeMessages = [
      { sender: 'BrassBuilder', content: 'WTS: Clockwork Gears x10 - 50 coins each', type: 'user' as const, time: 1500000 },
      { sender: 'SteamTrader', content: 'WTB: Steam Crystals - paying premium', type: 'user' as const, time: 1200000 },
      { sender: 'GearMerchant', content: 'Selling rare mechanical parts, PM me', type: 'user' as const, time: 900000 },
      { sender: 'ClockworkDealer', content: 'WTS: Precision Bearings x5 - 75 coins each', type: 'user' as const, time: 600000 },
      { sender: 'BrassBuilder', content: 'Still have gears available!', type: 'user' as const, time: 300000 }
    ];

    const guildMessages = [
      { sender: 'GuildLeader', content: 'Welcome to the Clockwork Collective!', type: 'user' as const, time: 1800000 },
      { sender: 'GuildOfficer', content: 'Remember to contribute to guild projects', type: 'user' as const, time: 1200000 },
      { sender: 'GuildMember1', content: 'Working on the steam engine upgrade', type: 'user' as const, time: 600000 },
      { sender: 'GuildMember2', content: 'Great work everyone!', type: 'user' as const, time: 300000 }
    ];

    const helpMessages = [
      { sender: 'Helper', content: 'Welcome! Ask any questions here', type: 'user' as const, time: 1800000 },
      { sender: 'Newbie', content: 'How do I start harvesting?', type: 'user' as const, time: 1200000 },
      { sender: 'Veteran', content: 'Click Resource Harvesting in the left sidebar', type: 'user' as const, time: 1100000 },
      { sender: 'Helper', content: 'Choose an activity and set your rounds, then click Start', type: 'user' as const, time: 1000000 },
      { sender: 'Newbie', content: 'Thanks! That helped a lot', type: 'user' as const, time: 900000 },
      { sender: 'AnotherNewbie', content: 'What are exotic items?', type: 'user' as const, time: 600000 },
      { sender: 'Veteran', content: 'Very rare treasures you can find while harvesting', type: 'user' as const, time: 500000 },
      { sender: 'Helper', content: 'Your skill level improves the chance to find them', type: 'user' as const, time: 400000 },
      { sender: 'AnotherNewbie', content: 'Cool! I\'ll keep harvesting then', type: 'user' as const, time: 300000 }
    ];

    // Add global messages
    globalMessages.forEach((msg, index) => {
      mockMessages.push({
        id: `global-${index}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(now - msg.time),
        channel: 'global',
        type: msg.type
      });
    });

    // Add trade messages
    tradeMessages.forEach((msg, index) => {
      mockMessages.push({
        id: `trade-${index}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(now - msg.time),
        channel: 'trade',
        type: msg.type
      });
    });

    // Add guild messages
    guildMessages.forEach((msg, index) => {
      mockMessages.push({
        id: `guild-${index}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(now - msg.time),
        channel: 'guild',
        type: msg.type
      });
    });

    // Add help messages
    helpMessages.forEach((msg, index) => {
      mockMessages.push({
        id: `help-${index}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(now - msg.time),
        channel: 'help',
        type: msg.type
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

  // Format timestamp with seconds
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
      {/* Chat Content - Always Visible */}
      <div className="chat-content">
        {/* Compact Channel Tabs */}
        <div className="chat-channels">
          <div className="chat-title">
            <span className="chat-icon">💬</span>
            <span>Steam Telegraph</span>
          </div>
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