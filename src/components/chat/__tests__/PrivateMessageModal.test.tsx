/**
 * Tests for PrivateMessageModal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivateMessageModal from '../PrivateMessageModal';

describe.skip('PrivateMessageModal', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateConversation = jest.fn();

  const defaultProps = {
    onClose: mockOnClose,
    onCreateConversation: mockOnCreateConversation,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    expect(screen.getByText('Start Private Conversation')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Search for players...')).toBeInTheDocument();
  });

  it('displays list of players', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('SteamEngineer')).toBeInTheDocument();
      expect(screen.getByText('CogMaster')).toBeInTheDocument();
      expect(screen.getByText('BrassWorker')).toBeInTheDocument();
    });
  });

  it('shows online/offline status for players', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Online')).toHaveLength(4); // 4 online players
      expect(screen.getByText('5m ago')).toBeInTheDocument(); // BrassWorker offline 5 minutes ago
    });
  });

  it('filters players based on search term', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for players...');
    
    await userEvent.type(searchInput, 'Steam');
    
    await waitFor(() => {
      expect(screen.getByText('SteamEngineer')).toBeInTheDocument();
      expect(screen.queryByText('CogMaster')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no players match search', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for players...');
    
    await userEvent.type(searchInput, 'NonexistentPlayer');
    
    await waitFor(() => {
      expect(screen.getByText('No players found matching your search.')).toBeInTheDocument();
    });
  });

  it('calls onCreateConversation when player is selected', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      const playerButton = screen.getByText('SteamEngineer').closest('button');
      expect(playerButton).toBeInTheDocument();
    });
    
    const playerButton = screen.getByText('SteamEngineer').closest('button');
    if (playerButton) {
      await userEvent.click(playerButton);
    }
    
    expect(mockOnCreateConversation).toHaveBeenCalledWith('1', 'SteamEngineer');
  });

  it('closes modal when close button is clicked', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const closeButton = screen.getByTitle('Close');
    await userEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const backdrop = document.querySelector('.private-message-modal-backdrop');
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when Escape key is pressed', () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close modal when clicking inside modal content', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const modalContent = document.querySelector('.private-message-modal');
    if (modalContent) {
      await userEvent.click(modalContent);
    }
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('focuses search input on mount', () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for players...');
    expect(searchInput).toHaveFocus();
  });

  it('displays correct last seen time formatting', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      // BrassWorker was offline 5 minutes ago
      expect(screen.getByText('5m ago')).toBeInTheDocument();
      // PipeWelder was offline 1 hour ago
      expect(screen.getByText('1h ago')).toBeInTheDocument();
      // SteamPunk was offline 1 day ago
      expect(screen.getByText('1d ago')).toBeInTheDocument();
    });
  });

  it('shows online indicator for online players', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      const onlineStatusDots = document.querySelectorAll('.status-dot.online');
      expect(onlineStatusDots).toHaveLength(4); // 4 online players
    });
  });

  it('shows offline indicator for offline players', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      const offlineStatusDots = document.querySelectorAll('.status-dot.offline');
      expect(offlineStatusDots).toHaveLength(3); // 3 offline players
    });
  });

  it('applies correct styling to online and offline players', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    await waitFor(() => {
      const onlinePlayer = screen.getByText('SteamEngineer').closest('.player-item');
      const offlinePlayer = screen.getByText('BrassWorker').closest('.player-item');
      
      expect(onlinePlayer).toHaveClass('online');
      expect(offlinePlayer).toHaveClass('offline');
    });
  });

  it('shows footer text', () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    expect(screen.getByText('Select a player to start a private conversation')).toBeInTheDocument();
  });

  it('handles case-insensitive search', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for players...');
    
    await userEvent.type(searchInput, 'STEAM');
    
    await waitFor(() => {
      expect(screen.getByText('SteamEngineer')).toBeInTheDocument();
      expect(screen.getByText('SteamPunk')).toBeInTheDocument();
    });
  });

  it('clears search results when search term is cleared', async () => {
    render(<PrivateMessageModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for players...');
    
    // Type search term
    await userEvent.type(searchInput, 'Steam');
    
    await waitFor(() => {
      expect(screen.getByText('SteamEngineer')).toBeInTheDocument();
      expect(screen.queryByText('CogMaster')).not.toBeInTheDocument();
    });
    
    // Clear search term
    await userEvent.clear(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('SteamEngineer')).toBeInTheDocument();
      expect(screen.getByText('CogMaster')).toBeInTheDocument();
    });
  });
});