/**
 * Main types export file for the Steampunk Idle Game
 */

// Core entity types
export * from './user';
export * from './character';
export * from './guild';
export * from './item';
export * from './auction';
export * from './crafting';
export * from './harvesting';
export * from './combat';

// Feature-specific types
export * from './chat';
export * from './zone';
export * from './leaderboard';

// Validation and transformation utilities
// export * from './validation'; // Temporarily disabled due to Zod version issues
export * from './transformers';

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextToken?: string;
}

export interface DatabaseEntity {
  createdAt: Date;
  updatedAt: Date;
}

export interface TimestampedEntity {
  timestamp: Date;
}

// Common error types
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}