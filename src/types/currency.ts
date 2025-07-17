/**
 * Currency-related type definitions for the Steampunk Idle Game
 */

export interface CurrencyTransaction {
  transactionId: string;
  userId: string;
  type: 'earned' | 'spent' | 'transferred';
  amount: number;
  source: 'activity' | 'crafting' | 'harvesting' | 'combat' | 'auction' | 'guild' | 'admin';
  description: string;
  metadata?: {
    activityType?: string;
    itemId?: string;
    auctionId?: string;
    guildId?: string;
    recipientId?: string;
  };
  timestamp: Date;
  balanceAfter: number;
}

export interface CurrencyBalance {
  userId: string;
  balance: number;
  lastUpdated: Date;
}

export interface CurrencyHistory {
  userId: string;
  transactions: CurrencyTransaction[];
  totalPages: number;
  currentPage: number;
}

export interface EarnCurrencyRequest {
  userId: string;
  amount: number;
  source: CurrencyTransaction['source'];
  description: string;
  metadata?: CurrencyTransaction['metadata'];
}

export interface SpendCurrencyRequest {
  userId: string;
  amount: number;
  source: CurrencyTransaction['source'];
  description: string;
  metadata?: CurrencyTransaction['metadata'];
}

export interface TransferCurrencyRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  description: string;
  metadata?: CurrencyTransaction['metadata'];
}

export interface GetCurrencyHistoryRequest {
  userId: string;
  page?: number;
  limit?: number;
  source?: CurrencyTransaction['source'];
}

export interface CurrencyValidationResult {
  isValid: boolean;
  error?: string;
  currentBalance?: number;
}

// Currency constants
export const CURRENCY_CONFIG = {
  STARTING_BALANCE: 100,
  MAX_BALANCE: 999999999, // 999 million steam coins
  MIN_TRANSACTION: 1,
  ACTIVITY_RATES: {
    crafting: {
      baseRate: 5, // coins per minute
      skillMultiplier: 0.1, // additional coins per skill level
    },
    harvesting: {
      baseRate: 3,
      skillMultiplier: 0.08,
    },
    combat: {
      baseRate: 8,
      skillMultiplier: 0.12,
    },
  },
  TRANSACTION_HISTORY_LIMIT: 50,
} as const;

export type CurrencySource = CurrencyTransaction['source'];
export type CurrencyTransactionType = CurrencyTransaction['type'];