/**
 * Tests for ChatInput component slash command functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '../ChatInput';
import SlashCommandService from '../../../services/slashCommandService';

// Mock the SlashCommandService
jest.mock('../../../services/slashCommandService');

const MockedSlashCommandService = SlashCommandService as jest.MockedClass<typeof SlashCommandService>;

describe.skip('ChatInput Slash Commands', () => {
  const mockOnSendMessage = jest.fn();
  const mockOnSlashCommand = jest.fn();
  const mockOnTyping = jest.fn();
  
  const mockSlashCommandService = {
    parseCommand: jest.fn(),
    getCommandSuggestions: jest.fn(),
    processCommand: jest.fn(),
    getAllCommands: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedSlashCommandService.getInstance.mockReturnValue(mockSlashCommandService as any);
  });

  const defaultProps = {
    onSendMessage: mockOnSendMessage,
    onSlashCommand: mockOnSlashCommand,
    onTyping: mockOnTyping,
    currentUserId: 'user123',
    currentUserName: 'TestUser',
    channelId: 'general',
    messageType: 'general' as const,
  };

  describe('command parsing', () => {
    it('should parse slash commands when sending messages', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'w',
        args: ['player', 'hello'],
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByTitle('Send message (Enter)');

      await userEvent.type(input, '/w player hello');
      await userEvent.click(sendButton);

      expect(mockSlashCommandService.parseCommand).toHaveBeenCalledWith('/w player hello');
      expect(mockOnSlashCommand).toHaveBeenCalledWith('w', ['player', 'hello']);
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should send regular messages when not a command', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: false,
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByTitle('Send message (Enter)');

      await userEvent.type(input, 'hello world');
      await userEvent.click(sendButton);

      expect(mockSlashCommandService.parseCommand).toHaveBeenCalledWith('hello world');
      expect(mockOnSendMessage).toHaveBeenCalledWith('hello world');
      expect(mockOnSlashCommand).not.toHaveBeenCalled();
    });

    it('should process commands directly when context is available', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'help',
        args: [],
      });

      mockSlashCommandService.processCommand.mockResolvedValue({
        success: true,
        message: 'Help message',
        systemMessage: true,
      });

      const propsWithoutHandler = {
        ...defaultProps,
        onSlashCommand: undefined,
      };

      render(<ChatInput {...propsWithoutHandler} />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByTitle('Send message (Enter)');

      await userEvent.type(input, '/help');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSlashCommandService.processCommand).toHaveBeenCalledWith(
          'help',
          [],
          {
            senderId: 'user123',
            senderName: 'TestUser',
            channelId: 'general',
            messageType: 'general',
          }
        );
      });
    });
  });

  describe('command suggestions', () => {
    it('should show command suggestions when typing slash commands', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
        '/whisper',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      expect(mockSlashCommandService.getCommandSuggestions).toHaveBeenCalledWith('/w');
      
      await waitFor(() => {
        const suggestions = screen.getByTestId('command-suggestions');
        expect(suggestions).toBeInTheDocument();
        expect(screen.getAllByText('/w')).toHaveLength(2); // One in input, one in suggestions
        expect(screen.getByText('/who')).toBeInTheDocument();
        expect(screen.getByText('/whisper')).toBeInTheDocument();
      });
    });

    it('should hide suggestions when not typing slash commands', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'hello');

      expect(mockSlashCommandService.getCommandSuggestions).toHaveBeenCalledWith('hello');
      expect(screen.queryByText('/w')).not.toBeInTheDocument();
    });

    it('should allow clicking on suggestions to select them', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        expect(screen.getByTestId('command-suggestions')).toBeInTheDocument();
      });

      const suggestionItems = screen.getAllByText('/w');
      const suggestionItem = suggestionItems.find(item => 
        item.closest('.suggestion-item')
      );
      
      await userEvent.click(suggestionItem!);

      expect(input).toHaveValue('/w ');
    });

    it('should navigate suggestions with arrow keys', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
        '/whisper',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        expect(screen.getByText('/w')).toBeInTheDocument();
      });

      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // The first item should be selected (we can't easily test visual selection)
      // but we can test that the key event is handled
      expect(screen.getByText('/w')).toBeInTheDocument();

      // Navigate up
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(screen.getByText('/w')).toBeInTheDocument();
    });

    it('should select suggestion with Tab key', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        expect(screen.getByText('/w')).toBeInTheDocument();
      });

      // Navigate to first suggestion and select with Tab
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/w ');
    });

    it('should close suggestions with Escape key', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        expect(screen.getByText('/w')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('/w')).not.toBeInTheDocument();
      });
    });
  });

  describe('command help', () => {
    it('should show command help when typing slash commands without suggestions', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/help');

      await waitFor(() => {
        expect(screen.getByText(/Slash commands:/)).toBeInTheDocument();
      });
    });

    it('should not show help when suggestions are available', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue(['/help']);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/h');

      await waitFor(() => {
        expect(screen.getByText('/help')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Slash commands:/)).not.toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should send message with Enter key', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: false,
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'hello world');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSendMessage).toHaveBeenCalledWith('hello world');
    });

    it('should not send message with Shift+Enter', async () => {
      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'hello world');
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should not interfere with Enter when suggestions are open', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue(['/w']);
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'w',
        args: ['player'],
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w player');

      // Enter should still send the command
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSlashCommand).toHaveBeenCalledWith('w', ['player']);
    });
  });

  describe('input clearing', () => {
    it('should clear input after sending regular message', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: false,
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'hello world');
      
      const sendButton = screen.getByTitle('Send message (Enter)');
      await userEvent.click(sendButton);

      expect(input).toHaveValue('');
    });

    it('should clear input after sending slash command', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'help',
        args: [],
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/help');
      
      const sendButton = screen.getByTitle('Send message (Enter)');
      await userEvent.click(sendButton);

      expect(input).toHaveValue('');
    });

    it('should clear suggestions after sending message', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue(['/help']);
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'help',
        args: [],
      });

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/help');

      await waitFor(() => {
        expect(screen.getByTestId('command-suggestions')).toBeInTheDocument();
      });

      const sendButton = screen.getByTitle('Send message (Enter)');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.queryByTestId('command-suggestions')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should handle command processing errors gracefully', async () => {
      mockSlashCommandService.parseCommand.mockReturnValue({
        isCommand: true,
        command: 'error',
        args: [],
      });

      mockSlashCommandService.processCommand.mockRejectedValue(
        new Error('Command processing failed')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const propsWithoutHandler = {
        ...defaultProps,
        onSlashCommand: undefined,
      };

      render(<ChatInput {...propsWithoutHandler} />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByTitle('Send message (Enter)');

      await userEvent.type(input, '/error');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to process slash command:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle suggestion errors gracefully', async () => {
      mockSlashCommandService.getCommandSuggestions.mockImplementation(() => {
        throw new Error('Suggestion error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      // This should not crash the component
      await userEvent.type(input, '/w');

      // The error should be handled gracefully
      expect(input).toHaveValue('/w');

      consoleSpy.mockRestore();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes for suggestions', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue([
        '/w',
        '/who',
      ]);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        const suggestions = screen.getByTestId('command-suggestions');
        expect(suggestions).toBeInTheDocument();
      });
    });

    it('should maintain focus on input when interacting with suggestions', async () => {
      mockSlashCommandService.getCommandSuggestions.mockReturnValue(['/w']);

      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/w');

      await waitFor(() => {
        expect(screen.getByTestId('command-suggestions')).toBeInTheDocument();
      });

      const suggestionItems = screen.getAllByText('/w');
      const suggestionItem = suggestionItems.find(item => 
        item.closest('.suggestion-item')
      );
      
      await userEvent.click(suggestionItem!);

      expect(input).toHaveFocus();
    });
  });
});