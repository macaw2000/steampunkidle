/**
 * Tests for CharacterCreation component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CharacterCreation from '../CharacterCreation';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';
import { CharacterService } from '../../../services/characterService';

// Mock CharacterService
jest.mock('../../../services/characterService');
const mockCharacterService = CharacterService as jest.Mocked<typeof CharacterService>;

// Mock CSS imports
jest.mock('../CharacterCreation.css', () => ({}));

describe('CharacterCreation', () => {
  const createMockStore = (authState = {}, gameState = {}) => {
    return configureStore({
      reducer: {
        auth: authReducer,
        game: gameReducer,
      },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: { userId: 'test-user-id', email: 'test@example.com', socialProviders: [], lastLogin: '2023-01-01' },
          tokens: null,
          loading: false,
          error: null,
          ...authState,
        },
        game: {
          character: null,
          isOnline: false,
          lastSyncTime: null,
          loading: false,
          error: null,
          ...gameState,
        },
      },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render character creation form', () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    expect(screen.getByText('Create Your Steampunk Character')).toBeInTheDocument();
    expect(screen.getByLabelText('Character Name')).toBeInTheDocument();
    expect(screen.getByText('Create Character')).toBeInTheDocument();
  });

  it('should show starting stats and skills', () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    expect(screen.getByText('Starting Stats')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Vitality')).toBeInTheDocument();

    expect(screen.getByText('Starting Skills')).toBeInTheDocument();
    expect(screen.getByText('Clockmaking: Level 1')).toBeInTheDocument();
    expect(screen.getByText('Engineering: Level 1')).toBeInTheDocument();
    expect(screen.getByText('Alchemy: Level 1')).toBeInTheDocument();
    expect(screen.getByText('Steamcraft: Level 1')).toBeInTheDocument();
  });

  it('should validate character name length', async () => {
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

    // Test too long name
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(21) } });
    await waitFor(() => {
      expect(screen.getByText('Character name must be no more than 20 characters long')).toBeInTheDocument();
    });

    // Test valid name
    fireEvent.change(nameInput, { target: { value: 'ValidName' } });
    await waitFor(() => {
      expect(screen.queryByText(/Character name must be/)).not.toBeInTheDocument();
    });
  });

  it('should validate character name format', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    
    // Test invalid characters
    fireEvent.change(nameInput, { target: { value: 'Invalid Name!' } });
    await waitFor(() => {
      expect(screen.getByText('Character name can only contain letters, numbers, underscores, and hyphens')).toBeInTheDocument();
    });

    // Test valid characters
    fireEvent.change(nameInput, { target: { value: 'Valid_Name-123' } });
    await waitFor(() => {
      expect(screen.queryByText(/Character name can only contain/)).not.toBeInTheDocument();
    });
  });

  it('should disable submit button when name is invalid', () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const submitButton = screen.getByText('Create Character');
    const nameInput = screen.getByLabelText('Character Name');
    
    // Initially disabled (no name)
    expect(submitButton).toBeDisabled();

    // Still disabled with invalid name
    fireEvent.change(nameInput, { target: { value: 'ab' } });
    expect(submitButton).toBeDisabled();

    // Enabled with valid name
    fireEvent.change(nameInput, { target: { value: 'ValidName' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('should create character successfully', async () => {
    const mockCharacter = {
      userId: 'test-user-id',
      characterId: 'test-character-id',
      name: 'TestCharacter',
      level: 1,
      experience: 0,
      currency: 100,
      stats: {},
      specialization: {},
      currentActivity: {},
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };

    mockCharacterService.createCharacter.mockResolvedValue(mockCharacter as any);

    const mockOnCharacterCreated = jest.fn();
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation onCharacterCreated={mockOnCharacterCreated} />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByText('Create Character');

    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCharacterService.createCharacter).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'TestCharacter',
      });
    });

    await waitFor(() => {
      expect(mockOnCharacterCreated).toHaveBeenCalled();
    });
  });

  it('should show loading state during character creation', async () => {
    mockCharacterService.createCharacter.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByText('Create Character');

    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating Character...')).toBeInTheDocument();
    });
  });

  it('should show error message on creation failure', async () => {
    mockCharacterService.createCharacter.mockRejectedValue(new Error('Creation failed'));

    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByText('Create Character');

    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creation failed')).toBeInTheDocument();
    });
  });

  it('should show error if user is not authenticated', () => {
    const store = createMockStore({ user: null });
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByText('Create Character');

    fireEvent.change(nameInput, { target: { value: 'TestCharacter' } });
    fireEvent.click(submitButton);

    // Should show error in Redux state, which would be displayed by parent component
    const state = store.getState();
    expect(state.game.error).toBe('User not authenticated');
  });

  it('should disable form when loading', () => {
    const store = createMockStore({}, { loading: true });
    
    render(
      <Provider store={store}>
        <CharacterCreation />
      </Provider>
    );

    const nameInput = screen.getByLabelText('Character Name');
    const submitButton = screen.getByText('Creating Character...');

    expect(nameInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});