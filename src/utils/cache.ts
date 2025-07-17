// In-memory cache utility for Lambda functions
// Note: This is per-Lambda instance, not shared across instances

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000, // Convert to milliseconds
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache key generators
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  character: (userId: string) => `character:${userId}`,
  guild: (guildId: string) => `guild:${guildId}`,
  guildMembers: (guildId: string) => `guild:${guildId}:members`,
  leaderboard: (statType: string) => `leaderboard:${statType}`,
  itemDefinition: (itemId: string) => `item:${itemId}`,
  craftingRecipe: (recipeId: string) => `recipe:${recipeId}`,
  userInventory: (userId: string) => `inventory:${userId}`,
  activeAuctions: () => 'auctions:active',
  userAuctions: (userId: string) => `auctions:user:${userId}`,
  partyInfo: (partyId: string) => `party:${partyId}`,
  zoneInstance: (instanceId: string) => `zone:${instanceId}`,
};

// Helper function to get or set cached data
export async function getOrSetCache<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // If not in cache, fetch the data
  const data = await fetchFunction();
  
  // Store in cache
  cache.set(key, data, ttlSeconds);
  
  return data;
}

// Batch cache operations
export function setCacheBatch<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
  entries.forEach(({ key, data, ttl = 300 }) => {
    cache.set(key, data, ttl);
  });
}

// Cache warming function for frequently accessed data
export async function warmCache(): Promise<void> {
  // This would be called during Lambda cold start to pre-populate cache
  // Implementation would depend on specific use cases
  console.log('Cache warming initiated');
  
  // Clean up any expired entries
  cache.cleanup();
}

// Cache statistics for monitoring
export function getCacheStats(): {
  size: number;
  hitRate?: number;
} {
  return {
    size: cache.size(),
    // Hit rate would need to be tracked separately if needed
  };
}