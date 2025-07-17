// Performance optimization configuration for Lambda functions
export const LambdaPerformanceConfig = {
  // Memory configurations based on function complexity and usage patterns
  memory: {
    // Simple CRUD operations - minimal memory needed
    simple: 256, // MB
    // Complex operations with multiple DB queries
    complex: 512, // MB
    // Heavy processing (batch operations, calculations)
    heavy: 1024, // MB
    // Real-time operations (WebSocket, chat)
    realtime: 512, // MB
  },
  
  // Timeout configurations
  timeout: {
    // Quick operations (single DB read/write)
    quick: 15, // seconds
    // Standard operations (multiple DB operations)
    standard: 30, // seconds
    // Complex operations (batch processing)
    complex: 60, // seconds
    // Batch operations
    batch: 300, // seconds (5 minutes)
  },
  
  // Function-specific optimizations
  functions: {
    // Authentication functions - frequently called, keep warm
    auth: {
      memory: 256,
      timeout: 15,
      reservedConcurrency: 10,
    },
    
    // Character operations - moderate complexity
    character: {
      memory: 512,
      timeout: 30,
    },
    
    // Activity switching - real-time, needs quick response
    activity: {
      memory: 512,
      timeout: 15,
    },
    
    // Offline progress calculation - heavy processing
    offlineProgress: {
      memory: 1024,
      timeout: 60,
    },
    
    // Batch offline progress - very heavy processing
    batchOfflineProgress: {
      memory: 1024,
      timeout: 300,
    },
    
    // Guild operations - moderate complexity
    guild: {
      memory: 512,
      timeout: 30,
    },
    
    // Currency operations - need consistency, moderate memory
    currency: {
      memory: 512,
      timeout: 30,
    },
    
    // Auction operations - complex with multiple table operations
    auction: {
      memory: 512,
      timeout: 45,
    },
    
    // Chat operations - real-time, need quick response
    chat: {
      memory: 512,
      timeout: 15,
      reservedConcurrency: 20, // High concurrency for chat
    },
    
    // Leaderboard operations - heavy aggregation
    leaderboard: {
      memory: 1024,
      timeout: 60,
    },
    
    // Party operations - moderate complexity
    party: {
      memory: 512,
      timeout: 30,
    },
    
    // Zone operations - complex with multiple calculations
    zone: {
      memory: 1024,
      timeout: 60,
    },
    
    // Crafting operations - moderate complexity
    crafting: {
      memory: 512,
      timeout: 30,
    },
  },
};

// DynamoDB optimization settings
export const DynamoDBOptimizationConfig = {
  // Read/Write capacity modes and settings
  tables: {
    // High-frequency tables should use on-demand billing
    highFrequency: [
      'steampunk-idle-game-characters',
      'steampunk-idle-game-chat-connections',
      'steampunk-idle-game-chat-messages',
    ],
    
    // Medium-frequency tables
    mediumFrequency: [
      'steampunk-idle-game-users',
      'steampunk-idle-game-inventory',
      'steampunk-idle-game-currency-transactions',
    ],
    
    // Low-frequency tables can use provisioned capacity
    lowFrequency: [
      'steampunk-idle-game-guilds',
      'steampunk-idle-game-guild-members',
      'steampunk-idle-game-items',
    ],
  },
  
  // Index optimization
  indexes: {
    // Frequently queried indexes should be optimized
    critical: [
      'email-index', // User lookups
      'userId-index', // Chat connections
      'status-expires-index', // Active auctions
    ],
  },
  
  // Caching strategies
  caching: {
    // Items that should be cached
    cacheable: [
      'leaderboards',
      'guild-info',
      'item-definitions',
      'crafting-recipes',
    ],
    
    // Cache TTL in seconds
    ttl: {
      leaderboards: 300, // 5 minutes
      guildInfo: 600, // 10 minutes
      itemDefinitions: 3600, // 1 hour
      craftingRecipes: 3600, // 1 hour
    },
  },
};