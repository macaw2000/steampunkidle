import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MarketplaceHub from '../MarketplaceHub';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';

// Mock the child components
jest.mock('../AuctionBrowser', () => {
  return function MockAuctionBrowser() {
    return <div data-testid="auction-browser">Auction Browser</div>;
  };
});

jest.mock('../CreateAuctionForm', () => {
  return function MockCreateAuctionForm() {
    return <div data-testid="create-auction-form">Create Auction Form</div>;
  };
});

jest.mock('../MyAuctions', () => {
  return function MockMyAuctions() {
    return <div data-testid="my-auctions">My Auctions</div>;
  };
});

const createMockStore = (gameState: any) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState: {
      auth: {
        isAuthenticated: true,
        user: { userId: 'test-user', email: 'test@example.com' },
        loading: false,
        error: null,
      },
      game: gameState,
    },
  });
};

describe('MarketplaceHub', () => {
  const mockCharacter = {
    userId: 'test-user',
    characterId: 'test-character',
    name: 'Test Character',
    level: 10,
    experience: 1000,
    currency: 500,
    stats: {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
      craftingSkills: {},
      harvestingSkills: {},
      combatSkills: {},
    },
    specialization: {
      tankProgress: 0,
      healerProgress: 0,
      dpsProgress: 0,
    },
    currentActivity: {
      type: 'crafting' as const,
      startedAt: new Date(),
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  it('renders marketplace hub with character', () => {
    const store = createMockStore({
      character: mockCharacter,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    expect(screen.getByText('🏪 Steampunk Marketplace')).toBeInTheDocument();
    expect(screen.getByText('💰 500 Steam Coins')).toBeInTheDocument();
    expect(screen.getByText('🔍 Browse Auctions')).toBeInTheDocument();
    expect(screen.getByText('📝 Create Auction')).toBeInTheDocument();
    expect(screen.getByText('📊 My Auctions')).toBeInTheDocument();
  });

  it('shows error when no character is available', () => {
    const store = createMockStore({
      character: null,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    expect(screen.getByText('Marketplace Unavailable')).toBeInTheDocument();
    expect(screen.getByText('You need a character to access the marketplace.')).toBeInTheDocument();
  });

  it('switches between tabs correctly', () => {
    const store = createMockStore({
      character: mockCharacter,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    // Default tab should be browse
    expect(screen.getByTestId('auction-browser')).toBeInTheDocument();

    // Switch to create auction tab
    fireEvent.click(screen.getByText('📝 Create Auction'));
    expect(screen.getByTestId('create-auction-form')).toBeInTheDocument();

    // Switch to my auctions tab
    fireEvent.click(screen.getByText('📊 My Auctions'));
    expect(screen.getByTestId('my-auctions')).toBeInTheDocument();

    // Switch back to browse tab
    fireEvent.click(screen.getByText('🔍 Browse Auctions'));
    expect(screen.getByTestId('auction-browser')).toBeInTheDocument();
  });

  it('displays correct currency amount', () => {
    const characterWithDifferentCurrency = {
      ...mockCharacter,
      currency: 1250,
    };

    const store = createMockStore({
      character: characterWithDifferentCurrency,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    expect(screen.getByText('💰 1250 Steam Coins')).toBeInTheDocument();
  });

  it('handles zero currency correctly', () => {
    const characterWithZeroCurrency = {
      ...mockCharacter,
      currency: 0,
    };

    const store = createMockStore({
      character: characterWithZeroCurrency,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    expect(screen.getByText('💰 0 Steam Coins')).toBeInTheDocument();
  });

  it('handles undefined currency correctly', () => {
    const characterWithUndefinedCurrency = {
      ...mockCharacter,
      currency: undefined,
    };

    const store = createMockStore({
      character: characterWithUndefinedCurrency,
      activityProgress: null,
      isOnline: true,
      lastSyncTime: null,
      loading: false,
      error: null,
      activitySwitching: false,
    });

    render(
      <Provider store={store}>
        <MarketplaceHub />
      </Provider>
    );

    expect(screen.getByText('💰 0 Steam Coins')).toBeInTheDocument();
  });
});