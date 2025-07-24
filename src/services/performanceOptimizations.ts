/**
 * Performance Optimizations Service
 * Implements Redis caching, connection pooling, batch processing, and memory management
 */

import { createClient, RedisClientType } from 'redis';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { TaskQueue, Task, TaskProgress, TaskCompletionResult } from '../types/taskQueue';

export interface PerformanceConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    ttl: {
      activeQueue: number;
      taskProgress: number;
      playerStats: number;
      frequentData: number;
    };
    maxRetries: number;
    retryDelayMs: number;
  };
  database: {
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    region: string;
  };
  batch: {
    maxBatchSize: number;
    batchTimeout: number;
    maxConcurrentBatches: number;
  };
  memory: {
    maxCacheSize: number;
    gcInterval: number;
    memoryThreshold: number;
    enableGcOptimization: boolean;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface BatchOperation {
  id: string;
  type: 'read' | 'write' | 'update' | 'delete';
  tableName: string;
  key: any;
  data?: any;
  timestamp: number;
  priority: number;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  cacheSize: number;
  connectionPoolSize: number;
  batchQueueSize: number;
}

export class PerformanceOptimizationService {
  private redisClient: RedisClientType | null = null;
  private dbClient: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private config: PerformanceConfig;
  
  // Connection pooling
  private connectionPool: Map<string, DynamoDBDocumentClient> = new Map();
  private connectionUsage: Map<string, { count: number; lastUsed: number }> = new Map();
  
  // Caching
  private localCache: Map<string, CacheEntry<any>> = new Map();
  private cacheStats: Map<string, { hits: number; misses: number; evictions: number }> = new Map();
  
  // Batch processing
  private batchQueue: Map<string, BatchOperation[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private activeBatches: Set<string> = new Set();
  
  // Memory management
  private gcTimer: NodeJS.Timeout | null = null;
  private memoryMonitorTimer: NodeJS.Timeout | null = null;
  private lastGcTime: number = 0;

  constructor(config: PerformanceConfig) {
    this.config = config;
    
    // Initialize DynamoDB clients
    this.dbClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(this.dbClient);
    
    this.initializeServices();
  }

  /**
   * Initialize all performance optimization services
   */
  private async initializeServices(): Promise<void> {
    await this.initializeRedis();
    this.initializeConnectionPool();
    this.initializeBatchProcessing();
    this.initializeMemoryManagement();
  }

  /**
   * Redis Caching Implementation
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
        },
        password: this.config.redis.password,
        database: this.config.redis.db,
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        console.log('Redis Client Connected');
      });

      this.redisClient.on('ready', () => {
        console.log('Redis Client Ready');
      });

      await this.redisClient.connect();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      // Continue without Redis - fall back to local cache
    }
  }

  /**
   * Cache active queue states and frequently accessed data
   */
  async cacheActiveQueueState(playerId: string, queue: TaskQueue): Promise<void> {
    const key = `${this.config.redis.keyPrefix}:queue:${playerId}`;
    const data = JSON.stringify(queue);
    
    try {
      if (this.redisClient) {
        await this.redisClient.setEx(key, this.config.redis.ttl.activeQueue, data);
      } else {
        // Fall back to local cache
        this.setLocalCache(key, queue, this.config.redis.ttl.activeQueue);
      }
    } catch (error) {
      console.error('Failed to cache queue state:', error);
      // Fall back to local cache
      this.setLocalCache(key, queue, this.config.redis.ttl.activeQueue);
    }
  }

  async getCachedQueueState(playerId: string): Promise<TaskQueue | null> {
    const key = `${this.config.redis.keyPrefix}:queue:${playerId}`;
    
    try {
      if (this.redisClient) {
        const data = await this.redisClient.get(key);
        if (data) {
          this.updateCacheStats(key, 'hit');
          return JSON.parse(data);
        }
      } else {
        // Check local cache
        const cached = this.getLocalCache<TaskQueue>(key);
        if (cached) {
          this.updateCacheStats(key, 'hit');
          return cached;
        }
      }
      
      this.updateCacheStats(key, 'miss');
      return null;
    } catch (error) {
      console.error('Failed to get cached queue state:', error);
      this.updateCacheStats(key, 'miss');
      return null;
    }
  }

  async cacheTaskProgress(taskId: string, progress: TaskProgress): Promise<void> {
    const key = `${this.config.redis.keyPrefix}:progress:${taskId}`;
    const data = JSON.stringify(progress);
    
    try {
      if (this.redisClient) {
        await this.redisClient.setEx(key, this.config.redis.ttl.taskProgress, data);
      } else {
        this.setLocalCache(key, progress, this.config.redis.ttl.taskProgress);
      }
    } catch (error) {
      console.error('Failed to cache task progress:', error);
      this.setLocalCache(key, progress, this.config.redis.ttl.taskProgress);
    }
  }

  async getCachedTaskProgress(taskId: string): Promise<TaskProgress | null> {
    const key = `${this.config.redis.keyPrefix}:progress:${taskId}`;
    
    try {
      if (this.redisClient) {
        const data = await this.redisClient.get(key);
        if (data) {
          this.updateCacheStats(key, 'hit');
          return JSON.parse(data);
        }
      } else {
        const cached = this.getLocalCache<TaskProgress>(key);
        if (cached) {
          this.updateCacheStats(key, 'hit');
          return cached;
        }
      }
      
      this.updateCacheStats(key, 'miss');
      return null;
    } catch (error) {
      console.error('Failed to get cached task progress:', error);
      this.updateCacheStats(key, 'miss');
      return null;
    }
  }

  async cacheFrequentData(key: string, data: any, customTtl?: number): Promise<void> {
    const cacheKey = `${this.config.redis.keyPrefix}:data:${key}`;
    const ttl = customTtl || this.config.redis.ttl.frequentData;
    const serializedData = JSON.stringify(data);
    
    try {
      if (this.redisClient) {
        await this.redisClient.setEx(cacheKey, ttl, serializedData);
      } else {
        this.setLocalCache(cacheKey, data, ttl);
      }
    } catch (error) {
      console.error('Failed to cache frequent data:', error);
      this.setLocalCache(cacheKey, data, ttl);
    }
  }

  async getCachedFrequentData<T>(key: string): Promise<T | null> {
    const cacheKey = `${this.config.redis.keyPrefix}:data:${key}`;
    
    try {
      if (this.redisClient) {
        const data = await this.redisClient.get(cacheKey);
        if (data) {
          this.updateCacheStats(cacheKey, 'hit');
          return JSON.parse(data);
        }
      } else {
        const cached = this.getLocalCache<T>(cacheKey);
        if (cached) {
          this.updateCacheStats(cacheKey, 'hit');
          return cached;
        }
      }
      
      this.updateCacheStats(cacheKey, 'miss');
      return null;
    } catch (error) {
      console.error('Failed to get cached frequent data:', error);
      this.updateCacheStats(cacheKey, 'miss');
      return null;
    }
  }

  /**
   * Database Connection Pooling Implementation
   */
  private initializeConnectionPool(): void {
    this.dbClient = new DynamoDBClient({
      region: this.config.database.region,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: this.config.database.connectionTimeout,
        socketTimeout: this.config.database.idleTimeout,
      },
    });

    this.docClient = DynamoDBDocumentClient.from(this.dbClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    // Initialize connection pool with pre-warmed connections
    for (let i = 0; i < Math.min(5, this.config.database.maxConnections); i++) {
      const connectionId = `conn_${i}`;
      const client = DynamoDBDocumentClient.from(this.dbClient);
      this.connectionPool.set(connectionId, client);
      this.connectionUsage.set(connectionId, { count: 0, lastUsed: Date.now() });
    }

    // Start connection pool maintenance
    setInterval(() => {
      this.maintainConnectionPool();
    }, 30000); // Every 30 seconds
  }

  getOptimizedConnection(): DynamoDBDocumentClient {
    // Find least used connection
    let bestConnection: string | null = null;
    let minUsage = Infinity;

    for (const [connectionId, usage] of this.connectionUsage.entries()) {
      if (usage.count < minUsage) {
        minUsage = usage.count;
        bestConnection = connectionId;
      }
    }

    if (bestConnection && this.connectionPool.has(bestConnection)) {
      const usage = this.connectionUsage.get(bestConnection)!;
      usage.count++;
      usage.lastUsed = Date.now();
      return this.connectionPool.get(bestConnection)!;
    }

    // Create new connection if pool not full
    if (this.connectionPool.size < this.config.database.maxConnections) {
      const connectionId = `conn_${this.connectionPool.size}`;
      const client = DynamoDBDocumentClient.from(this.dbClient);
      this.connectionPool.set(connectionId, client);
      this.connectionUsage.set(connectionId, { count: 1, lastUsed: Date.now() });
      return client;
    }

    // Fall back to default client
    return this.docClient;
  }

  private maintainConnectionPool(): void {
    const now = Date.now();
    const idleThreshold = this.config.database.idleTimeout;

    // Remove idle connections (keep at least 2)
    for (const [connectionId, usage] of this.connectionUsage.entries()) {
      if (this.connectionPool.size > 2 && 
          now - usage.lastUsed > idleThreshold && 
          usage.count === 0) {
        this.connectionPool.delete(connectionId);
        this.connectionUsage.delete(connectionId);
      } else {
        // Reset usage count periodically
        usage.count = Math.max(0, usage.count - 1);
      }
    }
  }

  /**
   * Batch Processing Implementation
   */
  private initializeBatchProcessing(): void {
    // Process batches periodically
    setInterval(() => {
      this.processPendingBatches();
    }, this.config.batch.batchTimeout);
  }

  addToBatch(operation: BatchOperation): void {
    const batchKey = `${operation.tableName}_${operation.type}`;
    
    if (!this.batchQueue.has(batchKey)) {
      this.batchQueue.set(batchKey, []);
    }

    const batch = this.batchQueue.get(batchKey)!;
    batch.push(operation);

    // Sort by priority (higher priority first)
    batch.sort((a, b) => b.priority - a.priority);

    // Process batch if it reaches max size
    if (batch.length >= this.config.batch.maxBatchSize) {
      this.processBatch(batchKey);
    } else {
      // Set timer for batch processing if not already set
      if (!this.batchTimers.has(batchKey)) {
        const timer = setTimeout(() => {
          this.processBatch(batchKey);
        }, this.config.batch.batchTimeout);
        this.batchTimers.set(batchKey, timer);
      }
    }
  }

  private async processPendingBatches(): Promise<void> {
    const batchKeys = Array.from(this.batchQueue.keys());
    
    for (const batchKey of batchKeys) {
      if (!this.activeBatches.has(batchKey)) {
        await this.processBatch(batchKey);
      }
    }
  }

  private async processBatch(batchKey: string): Promise<void> {
    if (this.activeBatches.has(batchKey) || 
        this.activeBatches.size >= this.config.batch.maxConcurrentBatches) {
      return;
    }

    const batch = this.batchQueue.get(batchKey);
    if (!batch || batch.length === 0) {
      return;
    }

    this.activeBatches.add(batchKey);
    
    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    try {
      const operations = batch.splice(0, this.config.batch.maxBatchSize);
      await this.executeBatchOperations(operations);
    } catch (error) {
      console.error(`Failed to process batch ${batchKey}:`, error);
    } finally {
      this.activeBatches.delete(batchKey);
      
      // Clean up empty batch
      if (batch.length === 0) {
        this.batchQueue.delete(batchKey);
      }
    }
  }

  private async executeBatchOperations(operations: BatchOperation[]): Promise<void> {
    // Group operations by type and table
    const groupedOps = new Map<string, BatchOperation[]>();
    
    for (const op of operations) {
      const key = `${op.tableName}_${op.type}`;
      if (!groupedOps.has(key)) {
        groupedOps.set(key, []);
      }
      groupedOps.get(key)!.push(op);
    }

    // Execute grouped operations
    const promises = Array.from(groupedOps.entries()).map(([key, ops]) => {
      return this.executeBatchGroup(ops);
    });

    await Promise.allSettled(promises);
  }

  private async executeBatchGroup(operations: BatchOperation[]): Promise<void> {
    const client = this.getOptimizedConnection();
    
    // Implementation would depend on specific operation types
    // This is a simplified example
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'read':
            // Batch read operations
            break;
          case 'write':
            // Batch write operations
            break;
          case 'update':
            // Batch update operations
            break;
          case 'delete':
            // Batch delete operations
            break;
        }
      } catch (error) {
        console.error(`Failed to execute batch operation ${op.id}:`, error);
      }
    }
  }

  /**
   * Memory Management and Garbage Collection Optimization
   */
  private initializeMemoryManagement(): void {
    if (this.config.memory.enableGcOptimization) {
      // Start garbage collection optimization
      this.gcTimer = setInterval(() => {
        this.optimizeGarbageCollection();
      }, this.config.memory.gcInterval);

      // Start memory monitoring
      this.memoryMonitorTimer = setInterval(() => {
        this.monitorMemoryUsage();
      }, 10000); // Every 10 seconds
    }
  }

  private optimizeGarbageCollection(): void {
    const now = Date.now();
    const memStats = process.memoryUsage();
    
    // Force GC if memory usage is high and enough time has passed
    if (memStats.heapUsed > this.config.memory.memoryThreshold &&
        now - this.lastGcTime > this.config.memory.gcInterval) {
      
      if (global.gc) {
        console.log('Triggering garbage collection - Memory usage:', {
          heapUsed: Math.round(memStats.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memStats.heapTotal / 1024 / 1024) + 'MB'
        });
        
        global.gc();
        this.lastGcTime = now;
        
        // Clean up local caches after GC
        this.cleanupLocalCache();
      }
    }
  }

  private monitorMemoryUsage(): void {
    const memStats = this.getMemoryStats();
    
    // Log memory stats if usage is high
    if (memStats.heapUsed > this.config.memory.memoryThreshold) {
      console.warn('High memory usage detected:', memStats);
      
      // Aggressive cache cleanup if memory is critically high
      if (memStats.heapUsed > this.config.memory.memoryThreshold * 1.5) {
        this.aggressiveCacheCleanup();
      }
    }
  }

  private cleanupLocalCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.localCache.entries()) {
      // Remove expired entries
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.localCache.delete(key);
        cleanedCount++;
      }
      // Remove least recently used entries if cache is too large
      else if (this.localCache.size > this.config.memory.maxCacheSize) {
        const entries = Array.from(this.localCache.entries())
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
        for (const [keyToRemove] of toRemove) {
          this.localCache.delete(keyToRemove);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} cache entries`);
    }
  }

  private aggressiveCacheCleanup(): void {
    // Clear half of the cache, keeping only most recently accessed items
    const entries = Array.from(this.localCache.entries())
      .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
    
    const keepCount = Math.floor(entries.length / 2);
    this.localCache.clear();
    
    for (let i = 0; i < keepCount; i++) {
      const [key, entry] = entries[i];
      this.localCache.set(key, entry);
    }

    console.log(`Aggressive cache cleanup: kept ${keepCount} of ${entries.length} entries`);
  }

  /**
   * Local Cache Implementation (fallback for Redis)
   */
  private setLocalCache<T>(key: string, data: T, ttlSeconds: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.localCache.set(key, entry);
    
    // Cleanup if cache is getting too large
    if (this.localCache.size > this.config.memory.maxCacheSize) {
      this.cleanupLocalCache();
    }
  }

  private getLocalCache<T>(key: string): T | null {
    const entry = this.localCache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.localCache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;
    
    return entry.data;
  }

  /**
   * Utility Methods
   */
  private updateCacheStats(key: string, type: 'hit' | 'miss'): void {
    if (!this.cacheStats.has(key)) {
      this.cacheStats.set(key, { hits: 0, misses: 0, evictions: 0 });
    }
    
    const stats = this.cacheStats.get(key)!;
    if (type === 'hit') {
      stats.hits++;
    } else {
      stats.misses++;
    }
  }

  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cacheSize: this.localCache.size,
      connectionPoolSize: this.connectionPool.size,
      batchQueueSize: Array.from(this.batchQueue.values()).reduce((sum, batch) => sum + batch.length, 0)
    };
  }

  getCacheStats(): Map<string, { hits: number; misses: number; evictions: number }> {
    return new Map(this.cacheStats);
  }

  getBatchStats(): {
    queueSizes: Map<string, number>;
    activeBatches: number;
    totalPendingOperations: number;
  } {
    const queueSizes = new Map<string, number>();
    let totalPending = 0;
    
    for (const [key, batch] of this.batchQueue.entries()) {
      queueSizes.set(key, batch.length);
      totalPending += batch.length;
    }
    
    return {
      queueSizes,
      activeBatches: this.activeBatches.size,
      totalPendingOperations: totalPending
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
    }
    
    // Clear batch timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    
    // Process remaining batches
    await this.processPendingBatches();
    
    // Close Redis connection
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    // Clear caches
    this.localCache.clear();
    this.connectionPool.clear();
    this.connectionUsage.clear();
    this.batchQueue.clear();
  }
}

// Export singleton instance
export const performanceOptimizationService = new PerformanceOptimizationService({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'steampunk_idle',
    ttl: {
      activeQueue: 300, // 5 minutes
      taskProgress: 60, // 1 minute
      playerStats: 600, // 10 minutes
      frequentData: 1800, // 30 minutes
    },
    maxRetries: 3,
    retryDelayMs: 1000,
  },
  database: {
    maxConnections: 10,
    connectionTimeout: 5000,
    idleTimeout: 300000, // 5 minutes
    region: process.env.AWS_REGION || 'us-east-1',
  },
  batch: {
    maxBatchSize: 25,
    batchTimeout: 1000, // 1 second
    maxConcurrentBatches: 5,
  },
  memory: {
    maxCacheSize: 10000,
    gcInterval: 30000, // 30 seconds
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    enableGcOptimization: true,
  },
});