import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BiddingInterface from '../BiddingInterface';
import { AuctionListing } from '../../../types/auction';
import { AuctionService } from '../../../services/auctionService';
import authReducer from '../../../store/slices/authSlice';
import gameReducer from '../../../store/slices/gameSlice';

// Mock AuctionService
jest.mock('../../../services/auctionService');
const mockAuctionService = AuctionService as jest.Mocked<typeof AuctionService>;

const createMockStore = (currency: number) => {
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
      game: {
        character: {
          userId: 'test-user',
          characterId: 'test-character',
          name: 'Test Character',
          level: 10,
          experience: 1000,
          currency: currency,
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
        },
        activityProgress: null,
        isOnline: true,
        lastSyncTime: null,
        loading: false,
        error: null,
        activitySwitching: false,
      },
    },
  });
};

describe('BiddingInterface', () => {
  const mockAuction: AuctionListing = {
    listingId: 'test-listing-1',
    sellerId: 'seller-1',
    sellerName: 'Test Seller',
    itemId: 'item-1',
    itemName: 'Brass Gear',
    itemRarity: 'common',
    quantity: 1,
    startingPrice: 50,
    buyoutPrice: 100,
    currentBid: 75,
    currentBidderId: 'bidder-1',
    currentBidderName: 'Test Bidder',
    bidHistory: [],
    auctionType: 'both',
    status: 'active',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    expiresAt: new Date(Date.now() + 3600000),
    fees: {
      listingFee: 5,
      successFee: 10,
      totalFees: 15,
    },
  };

  const mockProps = {
    auction: mockAuction,
    currentUserId: 'test-user',
    onClose: jest.fn(),
    onBidSuccess: jest.fn(),
    onBuyoutSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuctionService.getRarityColor.mockReturnValue('#9d9d9d');
    mockAuctionService.canAffordBid.mockReturnValue(true);
    mockAuctionService.placeBid.mockResolvedValue({
      bid: { bidId: 'test-bid', bidderId: 'test-user', amount: 80, timestamp: new Date() },
      currentBid: 80,
    });
    mockAuctionService.buyoutAuction.mockResolvedValue({
      transaction: {
        transactionId: 'test-transaction',
        listingId: 'test-listing-1',
        sellerId: 'seller-1',
        buyerId: 'test-user',
        itemId: 'item-1',
        quantity: 1,
        finalPrice: 100,
        fees: mockAuction.fees,
        completedAt: new Date(),
        status: 'completed',
      },
      finalPrice: 100,
      fees: mockAuction.fees,
    });
  });

  it('renders bidding interface with auction details', () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    expect(screen.getByText('💰 Bid on Brass Gear')).toBeInTheDocument();
    expect(screen.getByText('Brass Gear')).toBeInTheDocument();
    expect(screen.getByText('Common')).toBeInTheDocument();
    expect(screen.getByText('Current Price:')).toBeInTheDocument();
    expect(screen.getByText('💰 75')).toBeInTheDocument();
    expect(screen.getByText('Buyout Price:')).toBeInTheDocument();
    expect(screen.getByText('💰 100')).toBeInTheDocument();
    expect(screen.getByText('Your Currency:')).toBeInTheDocument();
    expect(screen.getByText('💰 500')).toBeInTheDocument();
  });

  it('allows placing a valid bid', async () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const bidInput = screen.getByLabelText(/Bid Amount/);
    fireEvent.change(bidInput, { target: { value: '80' } });
    
    const placeBidButton = screen.getByRole('button', { name: /Place Bid \(80\)/ });
    fireEvent.click(placeBidButton);

    await waitFor(() => {
      expect(mockAuctionService.placeBid).toHaveBeenCalledWith({
        listingId: 'test-listing-1',
        bidderId: 'test-user',
        bidAmount: 80,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Bid placed successfully for 80 Steam Coins!')).toBeInTheDocument();
    });
  });

  it('prevents bidding below minimum amount', () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const bidInput = screen.getByLabelText(/Bid Amount/);
    fireEvent.change(bidInput, { target: { value: '70' } }); // Below minimum of 76
    
    const placeBidButton = screen.getByRole('button', { name: /Place Bid \(70\)/ });
    fireEvent.click(placeBidButton);

    expect(screen.getByText('❌ Bid must be at least 76 (current price + 1)')).toBeInTheDocument();
    expect(mockAuctionService.placeBid).not.toHaveBeenCalled();
  });

  it('prevents bidding with insufficient funds', () => {
    const store = createMockStore(50); // Less than bid amount
    mockAuctionService.canAffordBid.mockReturnValue(false);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const bidInput = screen.getByLabelText(/Bid Amount/);
    fireEvent.change(bidInput, { target: { value: '80' } });
    
    // The button should be disabled and there should be a warning
    const placeBidButton = screen.getByRole('button', { name: /Place Bid \(80\)/ });
    expect(placeBidButton).toBeDisabled();
    expect(screen.getByText('⚠️ Insufficient funds for this bid')).toBeInTheDocument();
    
    // Clicking the disabled button shouldn't call the service
    fireEvent.click(placeBidButton);
    expect(mockAuctionService.placeBid).not.toHaveBeenCalled();
  });

  it('allows buyout when available and affordable', async () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const buyoutButton = screen.getByText('Buy Now (100)');
    fireEvent.click(buyoutButton);

    await waitFor(() => {
      expect(mockAuctionService.buyoutAuction).toHaveBeenCalledWith({
        listingId: 'test-listing-1',
        buyerId: 'test-user',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Item purchased successfully for 100 Steam Coins!')).toBeInTheDocument();
    });
  });

  it('prevents buyout with insufficient funds', () => {
    const store = createMockStore(50); // Less than buyout price
    mockAuctionService.canAffordBid.mockReturnValue(false);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    // The buyout button should be disabled when user can't afford it
    const buyoutButton = screen.getByText('Buy Now (100)');
    expect(buyoutButton).toBeDisabled();
    
    // There should be a warning about insufficient funds
    expect(screen.getByText('⚠️ Insufficient funds for buyout')).toBeInTheDocument();
    
    // Clicking the disabled button shouldn't call the service
    fireEvent.click(buyoutButton);
    expect(mockAuctionService.buyoutAuction).not.toHaveBeenCalled();
  });

  it('does not show buyout section for auction-only listings', () => {
    const auctionOnlyListing = {
      ...mockAuction,
      auctionType: 'auction' as const,
    };

    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} auction={auctionOnlyListing} />
      </Provider>
    );

    expect(screen.queryByText('Buy Now')).not.toBeInTheDocument();
    expect(screen.getByText('Place Bid')).toBeInTheDocument();
  });

  it('closes interface when close button is clicked', () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    fireEvent.click(screen.getByText('×'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes interface when cancel button is clicked', () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const store = createMockStore(500);
    mockAuctionService.placeBid.mockRejectedValue(new Error('Network error'));

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const bidInput = screen.getByLabelText(/Bid Amount/);
    fireEvent.change(bidInput, { target: { value: '80' } });
    
    const placeBidButton = screen.getByRole('button', { name: /Place Bid \(80\)/ });
    fireEvent.click(placeBidButton);

    await waitFor(() => {
      expect(screen.getByText('❌ Network error')).toBeInTheDocument();
    });
  });

  it('validates bid amount input to only accept valid numbers', () => {
    const store = createMockStore(500);

    render(
      <Provider store={store}>
        <BiddingInterface {...mockProps} />
      </Provider>
    );

    const bidInput = screen.getByLabelText(/Bid Amount/) as HTMLInputElement;

    // Initially empty
    expect(bidInput.value).toBe('');

    // Valid number should be accepted
    fireEvent.change(bidInput, { target: { value: '80' } });
    expect(bidInput.value).toBe('80');

    // Test that the button text updates with valid input
    expect(screen.getByRole('button', { name: /Place Bid \(80\)/ })).toBeInTheDocument();

    // Empty string should be allowed
    fireEvent.change(bidInput, { target: { value: '' } });
    expect(bidInput.value).toBe('');
    expect(screen.getByRole('button', { name: /Place Bid \(0\)/ })).toBeInTheDocument();

    // Valid number again
    fireEvent.change(bidInput, { target: { value: '100' } });
    expect(bidInput.value).toBe('100');
    expect(screen.getByRole('button', { name: /Place Bid \(100\)/ })).toBeInTheDocument();
  });
});