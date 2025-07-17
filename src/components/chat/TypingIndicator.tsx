/**
 * Typing indicator component
 */

import React, { useEffect, useState } from 'react';
import './TypingIndicator.css';

interface TypingIndicatorProps {
  userIds: string[];
  getUserName?: (userId: string) => string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  userIds,
  getUserName = (userId) => `User ${userId.slice(-4)}`, // Default fallback
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (userIds.length > 0) {
      setVisible(true);
    } else {
      // Delay hiding to prevent flickering
      const timeout = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [userIds]);

  if (!visible || userIds.length === 0) {
    return null;
  }

  const formatTypingText = () => {
    const names = userIds.map(getUserName);
    
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else if (names.length === 3) {
      return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
    }
  };

  return (
    <div className="typing-indicator">
      <div className="typing-content">
        <div className="typing-dots">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
        <span className="typing-text">
          {formatTypingText()}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;