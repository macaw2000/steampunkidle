/**
 * Chat input component with message sending functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import './ChatInput.css';
import SlashCommandService from '../../services/slashCommandService';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onSlashCommand?: (command: string, args: string[]) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  showEmojiPicker?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  channelId?: string;
  messageType?: 'general' | 'guild' | 'private';
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSlashCommand,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength = 500,
  showEmojiPicker = false,
  currentUserId,
  currentUserName,
  channelId,
  messageType = 'general',
}) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const slashCommandService = SlashCommandService.getInstance();

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      const maxHeight = 120; // Max 4-5 lines
      inputRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    if (value.length <= maxLength) {
      setMessage(value);
      adjustTextareaHeight();
      
      // Update command suggestions for slash commands
      if (value.startsWith('/')) {
        try {
          const suggestions = slashCommandService.getCommandSuggestions(value);
          setCommandSuggestions(suggestions || []);
          setSelectedSuggestion(-1);
        } catch (error) {
          console.error('Error getting command suggestions:', error);
          setCommandSuggestions([]);
          setSelectedSuggestion(-1);
        }
      } else {
        setCommandSuggestions([]);
        setSelectedSuggestion(-1);
      }
      
      // Trigger typing indicator
      if (onTyping && value.trim() && !isComposing) {
        onTyping();
        
        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          // Typing indicator will be stopped by the hook
        }, 3000);
      }
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command suggestion navigation
    if (commandSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < commandSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : commandSuggestions.length - 1
        );
        return;
      }
      
      if (e.key === 'Tab' && selectedSuggestion >= 0) {
        e.preventDefault();
        const suggestion = commandSuggestions[selectedSuggestion];
        setMessage(suggestion + ' ');
        setCommandSuggestions([]);
        setSelectedSuggestion(-1);
        return;
      }
      
      if (e.key === 'Escape') {
        setCommandSuggestions([]);
        setSelectedSuggestion(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      // Check if it's a slash command
      const commandParse = slashCommandService.parseCommand(trimmedMessage);
      
      if (commandParse.isCommand && commandParse.command && commandParse.args !== undefined) {
        // Process slash command
        if (onSlashCommand) {
          onSlashCommand(commandParse.command, commandParse.args);
        } else if (currentUserId && currentUserName && channelId) {
          // Process command directly if we have the required context
          try {
            const context = {
              senderId: currentUserId,
              senderName: currentUserName,
              channelId,
              messageType,
            };
            
            const result = await slashCommandService.processCommand(
              commandParse.command,
              commandParse.args,
              context
            );
            
            // Handle command result (this would typically be handled by the parent component)
            if (!result.success && result.error) {
              console.error('Command error:', result.error);
            }
          } catch (error) {
            console.error('Failed to process slash command:', error);
          }
        }
      } else {
        // Regular message
        onSendMessage(trimmedMessage);
      }
      
      setMessage('');
      setCommandSuggestions([]);
      setSelectedSuggestion(-1);
      adjustTextareaHeight();
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Handle composition events (for IME input)
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Common slash commands for autocomplete
  const slashCommands = [
    '/w', '/whisper', '/tell',
    '/profile', '/p',
    '/ginvite', '/gkick', '/guild',
    '/help', '/commands',
  ];

  // Handle slash command autocomplete
  const handleSlashAutocomplete = (input: string) => {
    if (input.startsWith('/')) {
      const command = input.toLowerCase();
      const matches = slashCommands.filter(cmd => cmd.startsWith(command));
      return matches;
    }
    return [];
  };

  const characterCount = message.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isAtLimit = characterCount >= maxLength;

  return (
    <div className="chat-input-container">
      {/* Character count indicator */}
      {isNearLimit && (
        <div className={`character-count ${isAtLimit ? 'at-limit' : 'near-limit'}`}>
          {characterCount}/{maxLength}
        </div>
      )}
      
      <div className="chat-input-wrapper">
        {/* Emoji picker button */}
        {showEmojiPicker && (
          <button
            className="emoji-button"
            onClick={() => {
              // This would open an emoji picker
              console.log('Emoji picker not implemented yet');
            }}
            disabled={disabled}
            title="Add emoji"
          >
            😊
          </button>
        )}
        
        {/* Message input */}
        <textarea
          ref={inputRef}
          className="chat-input"
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={disabled ? 'Chat is disconnected...' : placeholder}
          disabled={disabled}
          rows={1}
          maxLength={maxLength}
        />
        
        {/* Send button */}
        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={disabled || !message.trim()}
          title="Send message (Enter)"
        >
          <span className="send-icon">📤</span>
        </button>
      </div>
      
      {/* Command suggestions dropdown */}
      {commandSuggestions.length > 0 && (
        <div className="command-suggestions" data-testid="command-suggestions">
          {commandSuggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`suggestion-item ${index === selectedSuggestion ? 'selected' : ''}`}
              onClick={() => {
                setMessage(suggestion + ' ');
                setCommandSuggestions([]);
                setSelectedSuggestion(-1);
                inputRef.current?.focus();
              }}
            >
              {suggestion}
            </div>
          ))}
          <div className="suggestion-hint">
            Use ↑↓ to navigate, Tab to select, Esc to close
          </div>
        </div>
      )}
      
      {/* Slash command help */}
      {message.startsWith('/') && message.length > 1 && commandSuggestions.length === 0 && (
        <div className="slash-command-help">
          <div className="help-text">
            💡 Slash commands: /w [player] [message], /profile [player], /ginvite [player], /help
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInput;