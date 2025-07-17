import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import UserProfile from '../UserProfile';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';
import { authService } from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService', () => ({
  authService: {
    logout: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState: initialState,
  });
};

const renderWithProvider = (component: React.ReactElement, initialState = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

const mockUser = {
  userId: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  socialProviders: ['Google', 'Facebook'],
  lastLogin: '2023-12-01T10:00:00.000Z',
};

const mockTokens = {
  accessToken: 'mock-access-token',
  idToken: 'mock-id-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

describe('UserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user profile with basic information', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows email as name when name is not provided', () => {
    const userWithoutName = { ...mockUser, name: undefined };
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: userWithoutName,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    // Email should appear twice - once as name, once as email
    const emailElements = screen.getAllByText('test@example.com');
    expect(emailElements).toHaveLength(2);
  });

  it('toggles profile details when clicked', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    // Details should not be visible initially
    expect(screen.queryByText('Account Information')).not.toBeInTheDocument();
    
    // Click to show details
    const toggleButton = screen.getByTitle('Show details');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    
    // Click to hide details
    const hideButton = screen.getByTitle('Hide details');
    fireEvent.click(hideButton);
    
    expect(screen.queryByText('Account Information')).not.toBeInTheDocument();
  });

  it('displays user details when expanded', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    // Expand details
    const toggleButton = screen.getByTitle('Show details');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('test-user-123')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', async () => {
    mockAuthService.logout.mockResolvedValue();
    
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    // Expand details to show logout button
    const toggleButton = screen.getByTitle('Show details');
    fireEvent.click(toggleButton);
    
    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalledWith('mock-access-token');
    });
  });

  it('shows loading state during logout', async () => {
    mockAuthService.logout.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<UserProfile />, initialState);
    
    // Expand details to show logout button
    const toggleButton = screen.getByTitle('Show details');
    fireEvent.click(toggleButton);
    
    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(screen.getByText('Logging out...')).toBeInTheDocument();
    });
  });

  it('returns null when user is not provided', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: null,
        tokens: mockTokens,
        loading: false,
        error: null,
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    const { container } = renderWithProvider(<UserProfile />, initialState);
    
    expect(container.firstChild).toBeNull();
  });
});