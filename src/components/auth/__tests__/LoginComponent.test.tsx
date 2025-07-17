import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import LoginComponent from '../LoginComponent';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';
import { authService } from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService', () => ({
  authService: {
    loginWithGoogle: jest.fn(),
    loginWithFacebook: jest.fn(),
    loginWithX: jest.fn(),
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

describe('LoginComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login component with social login buttons', () => {
    renderWithProvider(<LoginComponent />);
    
    expect(screen.getByText('Welcome to Steampunk Idle Game')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with Facebook')).toBeInTheDocument();
    expect(screen.getByText('Continue with X')).toBeInTheDocument();
  });

  it('displays steampunk flavor text', () => {
    renderWithProvider(<LoginComponent />);
    
    expect(screen.getByText('"In the age of steam and gears, every adventurer needs proper credentials!"')).toBeInTheDocument();
  });

  it('calls Google login when Google button is clicked', async () => {
    mockAuthService.loginWithGoogle.mockRejectedValue(new Error('Redirect to Google OAuth'));
    
    renderWithProvider(<LoginComponent />);
    
    const googleButton = screen.getByText('Continue with Google');
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(mockAuthService.loginWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('calls Facebook login when Facebook button is clicked', async () => {
    mockAuthService.loginWithFacebook.mockRejectedValue(new Error('Redirect to Facebook OAuth'));
    
    renderWithProvider(<LoginComponent />);
    
    const facebookButton = screen.getByText('Continue with Facebook');
    fireEvent.click(facebookButton);
    
    await waitFor(() => {
      expect(mockAuthService.loginWithFacebook).toHaveBeenCalledTimes(1);
    });
  });

  it('calls X login when X button is clicked', async () => {
    mockAuthService.loginWithX.mockRejectedValue(new Error('Redirect to X OAuth'));
    
    renderWithProvider(<LoginComponent />);
    
    const xButton = screen.getByText('Continue with X');
    fireEvent.click(xButton);
    
    await waitFor(() => {
      expect(mockAuthService.loginWithX).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state when login is in progress', async () => {
    mockAuthService.loginWithGoogle.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithProvider(<LoginComponent />);
    
    const googleButton = screen.getByText('Continue with Google');
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  it('displays error message when login fails', () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
        error: 'Login failed',
      },
      game: {
        character: null,
        isOnline: false,
        lastSyncTime: null,
        loading: false,
        error: null,
      },
    };
    
    renderWithProvider(<LoginComponent />, initialState);
    
    expect(screen.getByText('Login failed')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: true,
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
    
    renderWithProvider(<LoginComponent />, initialState);
    
    const googleButton = screen.getByText('Continue with Google').closest('button');
    const facebookButton = screen.getByText('Continue with Facebook').closest('button');
    const xButton = screen.getByText('Continue with X').closest('button');
    
    expect(googleButton).toBeDisabled();
    expect(facebookButton).toBeDisabled();
    expect(xButton).toBeDisabled();
  });
});