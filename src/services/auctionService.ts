/**
 * Auction service for managing marketplace operations
 */

import {
  AuctionListing,
  AuctionSearchFilters,
  AuctionSearchResult,
  CreateAuctionRequest,
  PlaceBidRequest,
  BuyoutRequest,
  AuctionTransaction,
} from '../types/auction';

export class AuctionService {
  /**
   * Create a new auction listing
   */
  static async createAuction(request: CreateAuctionRequest): Promise<AuctionListing> {
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create auction');
      }

      const result = await response.json();
      return result.listing;
    } catch (error) {
      console.error('Error creating auction:', error);
      throw error;
    }
  }

  /**
   * Search and filter auction listings
   */
  static async searchAuctions(filters: AuctionSearchFilters = {}): Promise<AuctionSearchResult> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.itemType) queryParams.append('itemType', filters.itemType);
      if (filters.rarity) queryParams.append('rarity', filters.rarity);
      if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
      if (filters.sellerName) queryParams.append('sellerName', filters.sellerName);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.offset) queryParams.append('offset', filters.offset.toString());

      const response = await fetch(`/api/auction/search?${queryParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search auctions');
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      console.error('Error searching auctions:', error);
      throw error;
    }
  }

  /**
   * Get a specific auction listing
   */
  static async getAuction(listingId: string): Promise<{
    listing: AuctionListing;
    timeRemaining: number;
    isExpired: boolean;
    currentPrice: number;
    canBid: boolean;
    canBuyout: boolean;
  }> {
    try {
      const response = await fetch(`/api/auction/${listingId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get auction');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting auction:', error);
      throw error;
    }
  }

  /**
   * Place a bid on an auction
   */
  static async placeBid(request: PlaceBidRequest): Promise<{
    bid: any;
    currentBid: number;
  }> {
    try {
      const response = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place bid');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error placing bid:', error);
      throw error;
    }
  }

  /**
   * Buyout an auction immediately
   */
  static async buyoutAuction(request: BuyoutRequest): Promise<{
    transaction: AuctionTransaction;
    finalPrice: number;
    fees: any;
  }> {
    try {
      const response = await fetch('/api/auction/buyout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to buyout auction');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error buying out auction:', error);
      throw error;
    }
  }

  /**
   * Get user's auction listings (selling and bidding)
   */
  static async getUserAuctions(userId: string, type: 'selling' | 'bidding' | 'all' = 'all'): Promise<{
    userId: string;
    selling: {
      active: AuctionListing[];
      expired: AuctionListing[];
      sold: AuctionListing[];
      cancelled: AuctionListing[];
    };
    bidding: {
      active: AuctionListing[];
      expired: AuctionListing[];
      sold: AuctionListing[];
      cancelled: AuctionListing[];
    };
    summary: {
      totalSelling: number;
      totalBidding: number;
      activeSelling: number;
      activeBidding: number;
    };
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (type !== 'all') queryParams.append('type', type);

      const response = await fetch(`/api/auction/user/${userId}?${queryParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user auctions');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting user auctions:', error);
      throw error;
    }
  }

  /**
   * Cancel an auction listing
   */
  static async cancelAuction(listingId: string, userId: string): Promise<{
    message: string;
    listingId: string;
    itemsReturned: number;
  }> {
    try {
      const response = await fetch(`/api/auction/${listingId}/cancel?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel auction');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error cancelling auction:', error);
      throw error;
    }
  }

  /**
   * Calculate auction fees
   */
  static calculateListingFee(startingPrice: number): number {
    return Math.max(1, Math.floor(startingPrice * 0.05)); // 5% listing fee
  }

  /**
   * Calculate success fee
   */
  static calculateSuccessFee(finalPrice: number): number {
    return Math.floor(finalPrice * 0.10); // 10% success fee
  }

  /**
   * Calculate total fees for an auction
   */
  static calculateTotalFees(startingPrice: number, finalPrice?: number): {
    listingFee: number;
    successFee: number;
    totalFees: number;
  } {
    const listingFee = this.calculateListingFee(startingPrice);
    const successFee = finalPrice ? this.calculateSuccessFee(finalPrice) : 0;
    
    return {
      listingFee,
      successFee,
      totalFees: listingFee + successFee,
    };
  }

  /**
   * Format time remaining for display
   */
  static formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Expired';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get auction status display text
   */
  static getStatusDisplayText(status: string): string {
    const statusMap = {
      active: 'Active',
      sold: 'Sold',
      expired: 'Expired',
      cancelled: 'Cancelled',
    };
    
    return statusMap[status as keyof typeof statusMap] || status;
  }

  /**
   * Get auction type display text
   */
  static getAuctionTypeDisplayText(type: string): string {
    const typeMap = {
      auction: 'Auction Only',
      buyout: 'Buyout Only',
      both: 'Auction & Buyout',
    };
    
    return typeMap[type as keyof typeof typeMap] || type;
  }

  /**
   * Get rarity color for display
   */
  static getRarityColor(rarity: string): string {
    const colorMap = {
      common: '#9d9d9d',
      uncommon: '#1eff00',
      rare: '#0070dd',
      epic: '#a335ee',
      legendary: '#ff8000',
    };
    
    return colorMap[rarity as keyof typeof colorMap] || '#9d9d9d';
  }

  /**
   * Validate auction creation request
   */
  static validateCreateAuctionRequest(request: CreateAuctionRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.sellerId) {
      errors.push('Seller ID is required');
    }

    if (!request.itemId) {
      errors.push('Item ID is required');
    }

    if (!request.quantity || request.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (!request.startingPrice || request.startingPrice < 1) {
      errors.push('Starting price must be at least 1');
    }

    if (request.startingPrice > 999999) {
      errors.push('Starting price cannot exceed 999,999');
    }

    if (request.buyoutPrice && request.buyoutPrice <= request.startingPrice) {
      errors.push('Buyout price must be higher than starting price');
    }

    if (!request.duration || request.duration < 1 || request.duration > 168) {
      errors.push('Duration must be between 1 and 168 hours');
    }

    if (!['auction', 'buyout', 'both'].includes(request.auctionType)) {
      errors.push('Invalid auction type');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get suggested starting price based on item rarity
   */
  static getSuggestedStartingPrice(rarity: string): number {
    const priceMap = {
      common: 10,
      uncommon: 25,
      rare: 50,
      epic: 100,
      legendary: 250,
    };
    
    return priceMap[rarity as keyof typeof priceMap] || 10;
  }

  /**
   * Get suggested buyout multiplier
   */
  static getSuggestedBuyoutMultiplier(): number {
    return 2.0; // 2x starting price
  }

  /**
   * Check if user can afford to list an auction
   */
  static canAffordListing(userCurrency: number, startingPrice: number): boolean {
    const listingFee = this.calculateListingFee(startingPrice);
    return userCurrency >= listingFee;
  }

  /**
   * Check if user can afford to bid
   */
  static canAffordBid(userCurrency: number, bidAmount: number): boolean {
    return userCurrency >= bidAmount;
  }

  /**
   * Get auction search suggestions
   */
  static getSearchSuggestions(): {
    itemTypes: string[];
    rarities: string[];
    sortOptions: { value: string; label: string }[];
  } {
    return {
      itemTypes: ['weapon', 'armor', 'trinket', 'material', 'consumable', 'tool'],
      rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      sortOptions: [
        { value: 'timeLeft', label: 'Time Remaining' },
        { value: 'price', label: 'Price' },
        { value: 'rarity', label: 'Rarity' },
        { value: 'name', label: 'Name' },
      ],
    };
  }
}

export default AuctionService;