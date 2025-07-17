/**
 * Tests for AuctionService
 */

import { AuctionService } from '../auctionService';
import { CreateAuctionRequest, AuctionSearchFilters } from '../../types/auction';

// Mock fetch
global.fetch = jest.fn();

describe('AuctionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  describe('createAuction', () => {
    const validRequest: CreateAuctionRequest = {
      sellerId: 'user123',
      itemId: 'item456',
      quantity: 1,
      startingPrice: 100,
      buyoutPrice: 200,
      duration: 24,
      auctionType: 'both',
    };

    it('should create auction successfully', async () => {
      const mockListing = {
        listingId: 'auction123',
        ...validRequest,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ listing: mockListing }),
      } as Response);

      const result = await AuctionService.createAuction(validRequest);

      expect(result).toEqual(mockListing);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Insufficient items' }),
      } as Response);

      await expect(AuctionService.createAuction(validRequest))
        .rejects.toThrow('Insufficient items');
    });
  });

  describe('searchAuctions', () => {
    it('should search auctions with filters', async () => {
      const filters: AuctionSearchFilters = {
        itemType: 'weapon',
        rarity: 'rare',
        minPrice: 50,
        maxPrice: 200,
        sortBy: 'price',
        sortOrder: 'asc',
        limit: 10,
        offset: 0,
      };

      const mockResult = {
        listings: [],
        totalCount: 0,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockResult }),
      } as Response);

      const result = await AuctionService.searchAuctions(filters);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auction/search?')
      );
    });

    it('should search with default filters', async () => {
      const mockResult = {
        listings: [],
        totalCount: 0,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockResult }),
      } as Response);

      const result = await AuctionService.searchAuctions();

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/search?');
    });
  });

  describe('getAuction', () => {
    it('should get auction details', async () => {
      const mockAuctionDetails = {
        listing: { listingId: 'auction123' },
        timeRemaining: 3600000,
        isExpired: false,
        currentPrice: 150,
        canBid: true,
        canBuyout: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAuctionDetails,
      } as Response);

      const result = await AuctionService.getAuction('auction123');

      expect(result).toEqual(mockAuctionDetails);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/auction123');
    });
  });

  describe('placeBid', () => {
    it('should place bid successfully', async () => {
      const bidRequest = {
        listingId: 'auction123',
        bidderId: 'user456',
        bidAmount: 150,
      };

      const mockResponse = {
        bid: { bidId: 'bid123', amount: 150 },
        currentBid: 150,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await AuctionService.placeBid(bidRequest);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bidRequest),
      });
    });
  });

  describe('buyoutAuction', () => {
    it('should buyout auction successfully', async () => {
      const buyoutRequest = {
        listingId: 'auction123',
        buyerId: 'user456',
      };

      const mockResponse = {
        transaction: { transactionId: 'tx123' },
        finalPrice: 200,
        fees: { listingFee: 5, successFee: 20, totalFees: 25 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await AuctionService.buyoutAuction(buyoutRequest);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/buyout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buyoutRequest),
      });
    });
  });

  describe('getUserAuctions', () => {
    it('should get user auctions', async () => {
      const mockUserAuctions = {
        userId: 'user123',
        selling: { active: [], expired: [], sold: [], cancelled: [] },
        bidding: { active: [], expired: [], sold: [], cancelled: [] },
        summary: { totalSelling: 0, totalBidding: 0, activeSelling: 0, activeBidding: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserAuctions,
      } as Response);

      const result = await AuctionService.getUserAuctions('user123');

      expect(result).toEqual(mockUserAuctions);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/user/user123?');
    });

    it('should get user auctions with type filter', async () => {
      const mockUserAuctions = {
        userId: 'user123',
        selling: { active: [], expired: [], sold: [], cancelled: [] },
        bidding: { active: [], expired: [], sold: [], cancelled: [] },
        summary: { totalSelling: 0, totalBidding: 0, activeSelling: 0, activeBidding: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserAuctions,
      } as Response);

      const result = await AuctionService.getUserAuctions('user123', 'selling');

      expect(result).toEqual(mockUserAuctions);
      expect(mockFetch).toHaveBeenCalledWith('/api/auction/user/user123?type=selling');
    });
  });

  describe('cancelAuction', () => {
    it('should cancel auction successfully', async () => {
      const mockResponse = {
        message: 'Auction cancelled successfully',
        listingId: 'auction123',
        itemsReturned: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await AuctionService.cancelAuction('auction123', 'user123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auction/auction123/cancel?userId=user123',
        { method: 'DELETE' }
      );
    });
  });

  describe('fee calculations', () => {
    it('should calculate listing fee correctly', () => {
      expect(AuctionService.calculateListingFee(100)).toBe(5); // 5% of 100
      expect(AuctionService.calculateListingFee(10)).toBe(1); // Minimum 1
      expect(AuctionService.calculateListingFee(1)).toBe(1); // Minimum 1
    });

    it('should calculate success fee correctly', () => {
      expect(AuctionService.calculateSuccessFee(100)).toBe(10); // 10% of 100
      expect(AuctionService.calculateSuccessFee(250)).toBe(25); // 10% of 250
    });

    it('should calculate total fees correctly', () => {
      const fees = AuctionService.calculateTotalFees(100, 200);
      expect(fees.listingFee).toBe(5);
      expect(fees.successFee).toBe(20);
      expect(fees.totalFees).toBe(25);
    });

    it('should calculate total fees without final price', () => {
      const fees = AuctionService.calculateTotalFees(100);
      expect(fees.listingFee).toBe(5);
      expect(fees.successFee).toBe(0);
      expect(fees.totalFees).toBe(5);
    });
  });

  describe('utility functions', () => {
    it('should format time remaining correctly', () => {
      expect(AuctionService.formatTimeRemaining(0)).toBe('Expired');
      expect(AuctionService.formatTimeRemaining(30000)).toBe('30s');
      expect(AuctionService.formatTimeRemaining(90000)).toBe('1m 30s');
      expect(AuctionService.formatTimeRemaining(3660000)).toBe('1h 1m');
      expect(AuctionService.formatTimeRemaining(90000000)).toBe('1d 1h');
    });

    it('should get status display text', () => {
      expect(AuctionService.getStatusDisplayText('active')).toBe('Active');
      expect(AuctionService.getStatusDisplayText('sold')).toBe('Sold');
      expect(AuctionService.getStatusDisplayText('expired')).toBe('Expired');
      expect(AuctionService.getStatusDisplayText('cancelled')).toBe('Cancelled');
    });

    it('should get auction type display text', () => {
      expect(AuctionService.getAuctionTypeDisplayText('auction')).toBe('Auction Only');
      expect(AuctionService.getAuctionTypeDisplayText('buyout')).toBe('Buyout Only');
      expect(AuctionService.getAuctionTypeDisplayText('both')).toBe('Auction & Buyout');
    });

    it('should get rarity colors', () => {
      expect(AuctionService.getRarityColor('common')).toBe('#9d9d9d');
      expect(AuctionService.getRarityColor('rare')).toBe('#0070dd');
      expect(AuctionService.getRarityColor('legendary')).toBe('#ff8000');
    });
  });

  describe('validation', () => {
    it('should validate valid auction request', () => {
      const validRequest: CreateAuctionRequest = {
        sellerId: 'user123',
        itemId: 'item456',
        quantity: 1,
        startingPrice: 100,
        buyoutPrice: 200,
        duration: 24,
        auctionType: 'both',
      };

      const result = AuctionService.validateCreateAuctionRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid auction request', () => {
      const invalidRequest: CreateAuctionRequest = {
        sellerId: '',
        itemId: '',
        quantity: 0,
        startingPrice: 0,
        buyoutPrice: 50, // Lower than starting price
        duration: 0,
        auctionType: 'invalid' as any,
      };

      const result = AuctionService.validateCreateAuctionRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('suggestions and helpers', () => {
    it('should get suggested starting price by rarity', () => {
      expect(AuctionService.getSuggestedStartingPrice('common')).toBe(10);
      expect(AuctionService.getSuggestedStartingPrice('rare')).toBe(50);
      expect(AuctionService.getSuggestedStartingPrice('legendary')).toBe(250);
    });

    it('should get suggested buyout multiplier', () => {
      expect(AuctionService.getSuggestedBuyoutMultiplier()).toBe(2.0);
    });

    it('should check if user can afford listing', () => {
      expect(AuctionService.canAffordListing(100, 100)).toBe(true); // 5 fee
      expect(AuctionService.canAffordListing(4, 100)).toBe(false); // 5 fee
    });

    it('should check if user can afford bid', () => {
      expect(AuctionService.canAffordBid(200, 150)).toBe(true);
      expect(AuctionService.canAffordBid(100, 150)).toBe(false);
    });

    it('should get search suggestions', () => {
      const suggestions = AuctionService.getSearchSuggestions();
      expect(suggestions.itemTypes).toContain('weapon');
      expect(suggestions.rarities).toContain('rare');
      expect(suggestions.sortOptions).toContainEqual({
        value: 'price',
        label: 'Price',
      });
    });
  });
});