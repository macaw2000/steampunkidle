/**
 * Tests for mandatory character creation flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CharacterCreation from '../CharacterCreation';
import authSlice from '../../../store/slices/authSlice';
import gameSlice from '../../../store/slices/gameSlice';
import chatSlice from '../../../store/slices/chatSlice';
import { AdaptiveCharacterService } from '../../../services/adaptiveCharacterService';

// Mock the AdaptiveCharacterService
jest.mock('../../../services/adaptiveCharacterService');
const mockAdaptiveCharacterService = AdaptiveCharacterService as jest.Mocked<typeof AdaptiveCharacterService>;

// Mock NetworkStatusIndicator
jest.mock('../../common/NetworkStatusIndicator', () => {
  return function MockNetworkStatusIndicator() {
    return <div data-testid="network-status-indicator">Network Status</div>;
  };
});

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      game: gameSlice,
      chat: chatSlice,
    },
    preloadedState: {
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user-id', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: {
        character: null,
        hasCharacter: false,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
      chat: {
        messages: [],
        activeChannel: 'general',
        isConnected: false,
        error: null,
      },
      ...initialState,
    },
  });
};

describe('CharacterCreation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders character creation form', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    expect(screen.getByText('Create Your Steampunk Character')).toBeInTheDocument();
    expect(screen.getByLabelText('Character Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create character/i })).toBeInTheDocument();
  });

  it('validates character name format', async () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    
    // Test too short name
    fireEvent.change(nameInput, { target: { value: 'ab' } });
    await waitFor(() => {
      expect(screen.getByText('Character name must be at least 3 characters long')).toBeInTheDocument();
    });

    // Test invalid characters
    fireEvent.change(nameInput, { target: { value: 'test@name' } });
    await waitFor(() => {
      expect(screen.getByText('Character name can only contain letters, numbers, underscores, and hyphens')).toBeInTheDocument();
    });

    // Test too long name
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(21) } });
    await waitFor(() => {
      expect(screen.getByText('Character name must be no more than 20 characters long')).toBeInTheDocument();
    });
  });

  it('validates character name uniqueness', async () => {
    const store = createMockStore();
    mockAdaptiveCharacterService.validateCharacterName.mockResolvedValue({
      available: false,
      message: 'Name is already taken'
    });

    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    
    // Enter a valid format name
    fireEvent.change(nameInput, { target: { value: 'TestName' } });

    // Wait for validation to complete
    await waitFor(() => {
      expect(mockAdaptiveCharacterService.validateCharacterName).toHaveBeenCalledWith('TestName');
    });

    await waitFor(() => {
      expect(screen.getByText('Name is already taken')).toBeInTheDocument();
    });
  });

  it('shows success indicator for available name', async () => {
    const store = createMockStore();
    mockAdaptiveCharacterService.validateCharacterName.mockResolvedValue({
      available: true,
      message: 'Name is available'
    });

    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    
    // Enter a valid format name
    fireEvent.change(nameInput, { target: { value: 'AvailableName' } });

    // Wait for validation to complete
    await waitFor(() => {
      expect(mockAdaptiveCharacterService.validateCharacterName).toHaveBeenCalledWith('AvailableName');
    });

    await waitFor(() => {
      expect(screen.getByText('Name is available!')).toBeInTheDocument();
    });
  });

  it('disables submit button until name is validated and available', async () => {
    const store = createMockStore();
    mockAdaptiveCharacterService.validateCharacterName.mockResolvedValue({
      available: true,
      message: 'Name is available'
    });

    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const submitButton = screen.getByRole('button', { name: /create character/i });
    const nameInput = screen.getByLabelText('Character Name');

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Still disabled with invalid name
    fireEvent.change(nameInput, { target: { value: 'ab' } });
    expect(submitButton).toBeDisabled();

    // Still disabled while validating
    fireEvent.change(nameInput, { target: { value: 'ValidName' } });
    expect(submitButton).toBeDisabled();

    // Enabled after successful validation
    await waitFor(() => {
      expect(mockAdaptiveCharacterService.validateCharacterName).toHaveBeenCalledWith('ValidName');
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('creates character when form is submitted with valid name', async () => {
    const store = createMockStore();
    const mockCharacter = {
      characterId: 'char-123',
      userId: 'test-user-id',
      name: 'TestCharacter',
      level: 1,
      experience: 0,
    };

    mockAdaptiveCharacterService.validateCharacterName.mockResolvedValue({
      available: true,
      message: 'Name is available'
    });
    mockAdaptiveCharacterService.createCharacter.mockResolvedValue(mockCharacter as any);

    const onCharacterCreated = jest.fn();

    render(
      <Provider store={store}>
        <CharacterCreation onCharacterCreated={onCharacterCreated} />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByRole('button', { name: /create character/i });

    // Enter valid name and wait for validation
    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    
    await waitFor(() => {
      expect(mockAdaptiveCharacterService.validateCharacterName).toHaveBeenCalledWith('TestCharacter');
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAdaptiveCharacterService.createCharacter).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'TestCharacter',
      });
    });

    await waitFor(() => {
      expect(onCharacterCreated).toHaveBeenCalled();
    });
  });

  it('handles character creation errors', async () => {
    const store = createMockStore();
    mockAdaptiveCharacterService.validateCharacterName.mockResolvedValue({
      available: true,
      message: 'Name is available'
    });
    mockAdaptiveCharacterService.createCharacter.mockRejectedValue(
      new Error('Character name is already taken. Please choose a different name.')
    );

    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByRole('button', { name: /create character/i });

    // Enter valid name and wait for validation
    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Character name is already taken. Please choose a different name.')).toBeInTheDocument();
    });
  });

  it('prevents access to game until character is created', () => {
    // This test verifies that the character creation component is shown
    // when hasCharacter is false, which is handled by GameDashboard
    const store = createMockStore({
      game: {
        character: null,
        hasCharacter: false,
        characterLoading: false,
        loading: false,
        error: null,
        isOnline: true,
        currentActivity: null,
        inventory: [],
        currency: 0,
        notifications: [],
      },
    });

    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    // Character creation form should be visible
    expect(screen.getByText('Create Your Steampunk Character')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the world of steam and gears! Create your character to begin your idle adventure.')).toBeInTheDocument();
  });
});