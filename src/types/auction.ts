/**
 * Auction and marketplace type definitions for the Steampunk Idle Game
 */

export type AuctionStatus = 'active' | 'sold' | 'expired' | 'cancelled';
export type AuctionType = 'auction' | 'buyout' | 'both';

export interface AuctionBid {
  bidId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: Date;
}

export interface AuctionListing {
  listingId: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  itemName: string;
  itemRarity: string;
  quantity: number;
  startingPrice: number;
  buyoutPrice?: number;
  currentBid?: number;
  currentBidderId?: string;
  currentBidderName?: string;
  bidHistory: AuctionBid[];
  auctionType: AuctionType;
  status: AuctionStatus;
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  fees: AuctionFees;
}

export interface AuctionFees {
  listingFee: number;
  successFee: number; // percentage of final sale price
  totalFees: number;
}

export interface CreateAuctionRequest {
  sellerId: string;
  itemId: string;
  quantity: number;
  startingPrice: number;
  buyoutPrice?: number;
  duration: number; // in hours
  auctionType: AuctionType;
}

export interface PlaceBidRequest {
  listingId: string;
  bidderId: string;
  bidAmount: number;
}

export interface BuyoutRequest {
  listingId: string;
  buyerId: string;
}

export interface AuctionSearchFilters {
  itemType?: string;
  rarity?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerName?: string;
  sortBy?: 'price' | 'timeLeft' | 'rarity' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface AuctionSearchResult {
  listings: AuctionListing[];
  totalCount: number;
  hasMore: boolean;
}

export interface AuctionTransaction {
  transactionId: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  itemId: string;
  quantity: number;
  finalPrice: number;
  fees: AuctionFees;
  completedAt: Date;
  status: 'completed' | 'failed' | 'refunded';
}