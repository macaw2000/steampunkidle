import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuctionCard from '../AuctionCard';
import { AuctionListing } from '../../../types/auction';
import { AuctionService } from '../../../services/auctionService';

// Mock the BiddingInterface component
jest.mock('../BiddingInterface', () => {
  return function MockBiddingInterface({ onClose, onBidSuccess, onBuyoutSuccess }: any) {
    return (
      <div data-testid="bidding-interface">
        <button onClick={onClose}>Close</button>
        <button onClick={onBidSuccess}>Bid Success</button>
        <button onClick={onBuyoutSuccess}>Buyout Success</button>
      </div>
    );
  };
});

// Mock AuctionService
jest.mock('../../../services/auctionService');
const mockAuctionService = AuctionService as jest.Mocked<typeof AuctionService>;

describe('AuctionCard', () => {
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
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    fees: {
      listingFee: 5,
      successFee: 10,
      totalFees: 15,
    },
  };

  const mockOnAuctionUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuctionService.getRarityColor.mockReturnValue('#9d9d9d');
    mockAuctionService.getStatusDisplayText.mockReturnValue('Active');
    mockAuctionService.formatTimeRemaining.mockReturnValue('59m 30s');
  });

  it('renders auction card with basic information', () => {
    render(
      <AuctionCard
        auction={mockAuction}
        currentUserId="test-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('Brass Gear')).toBeInTheDocument();
    expect(screen.getByText('Common')).toBeInTheDocument();
    expect(screen.getByText('Test Seller')).toBeInTheDocument();
    expect(screen.getByText('💰 75')).toBeInTheDocument(); // Current price
    expect(screen.getByText('💰 100')).toBeInTheDocument(); // Buyout price
    expect(screen.getByText('Test Bidder')).toBeInTheDocument();
  });

  it('shows own auction notice for seller', () => {
    render(
      <AuctionCard
        auction={mockAuction}
        currentUserId="seller-1"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('📝 Your Auction')).toBeInTheDocument();
    expect(screen.queryByText('💰 Place Bid')).not.toBeInTheDocument();
  });

  it('shows bid buttons for other users', () => {
    render(
      <AuctionCard
        auction={mockAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('💰 Place Bid')).toBeInTheDocument();
    expect(screen.getByText('⚡ Buy Now')).toBeInTheDocument();
  });

  it('opens bidding interface when bid button is clicked', () => {
    render(
      <AuctionCard
        auction={mockAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    fireEvent.click(screen.getByText('💰 Place Bid'));
    expect(screen.getByTestId('bidding-interface')).toBeInTheDocument();
  });

  it('closes bidding interface and calls onAuctionUpdate on bid success', async () => {
    render(
      <AuctionCard
        auction={mockAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    fireEvent.click(screen.getByText('💰 Place Bid'));
    fireEvent.click(screen.getByText('Bid Success'));

    await waitFor(() => {
      expect(screen.queryByTestId('bidding-interface')).not.toBeInTheDocument();
    });
    expect(mockOnAuctionUpdate).toHaveBeenCalled();
  });

  it('handles expired auction correctly', () => {
    const expiredAuction = {
      ...mockAuction,
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    };

    mockAuctionService.formatTimeRemaining.mockReturnValue('Expired');

    render(
      <AuctionCard
        auction={expiredAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('⏰ Auction Expired')).toBeInTheDocument();
    expect(screen.queryByText('💰 Place Bid')).not.toBeInTheDocument();
  });

  it('handles sold auction correctly', () => {
    const soldAuction = {
      ...mockAuction,
      status: 'sold' as const,
    };

    mockAuctionService.getStatusDisplayText.mockReturnValue('Sold');

    render(
      <AuctionCard
        auction={soldAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('✅ Sold')).toBeInTheDocument();
    expect(screen.queryByText('💰 Place Bid')).not.toBeInTheDocument();
  });

  it('shows quantity when greater than 1', () => {
    const multipleItemAuction = {
      ...mockAuction,
      quantity: 5,
    };

    render(
      <AuctionCard
        auction={multipleItemAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('x5')).toBeInTheDocument();
  });

  it('does not show buyout button for auction-only type', () => {
    const auctionOnlyListing = {
      ...mockAuction,
      auctionType: 'auction' as const,
    };

    render(
      <AuctionCard
        auction={auctionOnlyListing}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('💰 Place Bid')).toBeInTheDocument();
    expect(screen.queryByText('⚡ Buy Now')).not.toBeInTheDocument();
  });

  it('shows starting price when no current bid', () => {
    const noBidAuction = {
      ...mockAuction,
      currentBid: undefined,
      currentBidderId: undefined,
      currentBidderName: undefined,
    };

    render(
      <AuctionCard
        auction={noBidAuction}
        currentUserId="other-user"
        onAuctionUpdate={mockOnAuctionUpdate}
      />
    );

    expect(screen.getByText('💰 50')).toBeInTheDocument(); // Starting price
    expect(screen.queryByText('Test Bidder')).not.toBeInTheDocument();
  });
});