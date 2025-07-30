"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceOptimizationService = exports.PerformanceOptimizationService = void 0;
const redis_1 = require("redis");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
class PerformanceOptimizationService {
    constructor(config) {
        this.redisClient = null;
        this.connectionPool = new Map();
        this.connectionUsage = new Map();
        this.localCache = new Map();
        this.cacheStats = new Map();
        this.batchQueue = new Map();
        this.batchTimers = new Map();
        this.activeBatches = new Set();
        this.gcTimer = null;
        this.memoryMonitorTimer = null;
        this.lastGcTime = 0;
        this.config = config;
        this.dbClient = new client_dynamodb_1.DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1',
        });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(this.dbClient);
        this.initializeServices();
    }
    async initializeServices() {
        await this.initializeRedis();
        this.initializeConnectionPool();
        this.initializeBatchProcessing();
        this.initializeMemoryManagement();
    }
    async initializeRedis() {
        try {
            this.redisClient = (0, redis_1.createClient)({
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
        }
        catch (error) {
            console.error('Failed to initialize Redis:', error);
        }
    }
    async cacheActiveQueueState(playerId, queue) {
        const key = `${this.config.redis.keyPrefix}:queue:${playerId}`;
        const data = JSON.stringify(queue);
        try {
            if (this.redisClient) {
                await this.redisClient.setEx(key, this.config.redis.ttl.activeQueue, data);
            }
            else {
                this.setLocalCache(key, queue, this.config.redis.ttl.activeQueue);
            }
        }
        catch (error) {
            console.error('Failed to cache queue state:', error);
            this.setLocalCache(key, queue, this.config.redis.ttl.activeQueue);
        }
    }
    async getCachedQueueState(playerId) {
        const key = `${this.config.redis.keyPrefix}:queue:${playerId}`;
        try {
            if (this.redisClient) {
                const data = await this.redisClient.get(key);
                if (data) {
                    this.updateCacheStats(key, 'hit');
                    return JSON.parse(data);
                }
            }
            else {
                const cached = this.getLocalCache(key);
                if (cached) {
                    this.updateCacheStats(key, 'hit');
                    return cached;
                }
            }
            this.updateCacheStats(key, 'miss');
            return null;
        }
        catch (error) {
            console.error('Failed to get cached queue state:', error);
            this.updateCacheStats(key, 'miss');
            return null;
        }
    }
    async cacheTaskProgress(taskId, progress) {
        const key = `${this.config.redis.keyPrefix}:progress:${taskId}`;
        const data = JSON.stringify(progress);
        try {
            if (this.redisClient) {
                await this.redisClient.setEx(key, this.config.redis.ttl.taskProgress, data);
            }
            else {
                this.setLocalCache(key, progress, this.config.redis.ttl.taskProgress);
            }
        }
        catch (error) {
            console.error('Failed to cache task progress:', error);
            this.setLocalCache(key, progress, this.config.redis.ttl.taskProgress);
        }
    }
    async getCachedTaskProgress(taskId) {
        const key = `${this.config.redis.keyPrefix}:progress:${taskId}`;
        try {
            if (this.redisClient) {
                const data = await this.redisClient.get(key);
                if (data) {
                    this.updateCacheStats(key, 'hit');
                    return JSON.parse(data);
                }
            }
            else {
                const cached = this.getLocalCache(key);
                if (cached) {
                    this.updateCacheStats(key, 'hit');
                    return cached;
                }
            }
            this.updateCacheStats(key, 'miss');
            return null;
        }
        catch (error) {
            console.error('Failed to get cached task progress:', error);
            this.updateCacheStats(key, 'miss');
            return null;
        }
    }
    async cacheFrequentData(key, data, customTtl) {
        const cacheKey = `${this.config.redis.keyPrefix}:data:${key}`;
        const ttl = customTtl || this.config.redis.ttl.frequentData;
        const serializedData = JSON.stringify(data);
        try {
            if (this.redisClient) {
                await this.redisClient.setEx(cacheKey, ttl, serializedData);
            }
            else {
                this.setLocalCache(cacheKey, data, ttl);
            }
        }
        catch (error) {
            console.error('Failed to cache frequent data:', error);
            this.setLocalCache(cacheKey, data, ttl);
        }
    }
    async getCachedFrequentData(key) {
        const cacheKey = `${this.config.redis.keyPrefix}:data:${key}`;
        try {
            if (this.redisClient) {
                const data = await this.redisClient.get(cacheKey);
                if (data) {
                    this.updateCacheStats(cacheKey, 'hit');
                    return JSON.parse(data);
                }
            }
            else {
                const cached = this.getLocalCache(cacheKey);
                if (cached) {
                    this.updateCacheStats(cacheKey, 'hit');
                    return cached;
                }
            }
            this.updateCacheStats(cacheKey, 'miss');
            return null;
        }
        catch (error) {
            console.error('Failed to get cached frequent data:', error);
            this.updateCacheStats(cacheKey, 'miss');
            return null;
        }
    }
    initializeConnectionPool() {
        this.dbClient = new client_dynamodb_1.DynamoDBClient({
            region: this.config.database.region,
            maxAttempts: 3,
            requestHandler: {
                connectionTimeout: this.config.database.connectionTimeout,
                socketTimeout: this.config.database.idleTimeout,
            },
        });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(this.dbClient, {
            marshallOptions: {
                convertEmptyValues: false,
                removeUndefinedValues: true,
                convertClassInstanceToMap: false,
            },
            unmarshallOptions: {
                wrapNumbers: false,
            },
        });
        for (let i = 0; i < Math.min(5, this.config.database.maxConnections); i++) {
            const connectionId = `conn_${i}`;
            const client = lib_dynamodb_1.DynamoDBDocumentClient.from(this.dbClient);
            this.connectionPool.set(connectionId, client);
            this.connectionUsage.set(connectionId, { count: 0, lastUsed: Date.now() });
        }
        setInterval(() => {
            this.maintainConnectionPool();
        }, 30000);
    }
    getOptimizedConnection() {
        let bestConnection = null;
        let minUsage = Infinity;
        for (const [connectionId, usage] of this.connectionUsage.entries()) {
            if (usage.count < minUsage) {
                minUsage = usage.count;
                bestConnection = connectionId;
            }
        }
        if (bestConnection && this.connectionPool.has(bestConnection)) {
            const usage = this.connectionUsage.get(bestConnection);
            usage.count++;
            usage.lastUsed = Date.now();
            return this.connectionPool.get(bestConnection);
        }
        if (this.connectionPool.size < this.config.database.maxConnections) {
            const connectionId = `conn_${this.connectionPool.size}`;
            const client = lib_dynamodb_1.DynamoDBDocumentClient.from(this.dbClient);
            this.connectionPool.set(connectionId, client);
            this.connectionUsage.set(connectionId, { count: 1, lastUsed: Date.now() });
            return client;
        }
        return this.docClient;
    }
    maintainConnectionPool() {
        const now = Date.now();
        const idleThreshold = this.config.database.idleTimeout;
        for (const [connectionId, usage] of this.connectionUsage.entries()) {
            if (this.connectionPool.size > 2 &&
                now - usage.lastUsed > idleThreshold &&
                usage.count === 0) {
                this.connectionPool.delete(connectionId);
                this.connectionUsage.delete(connectionId);
            }
            else {
                usage.count = Math.max(0, usage.count - 1);
            }
        }
    }
    initializeBatchProcessing() {
        setInterval(() => {
            this.processPendingBatches();
        }, this.config.batch.batchTimeout);
    }
    addToBatch(operation) {
        const batchKey = `${operation.tableName}_${operation.type}`;
        if (!this.batchQueue.has(batchKey)) {
            this.batchQueue.set(batchKey, []);
        }
        const batch = this.batchQueue.get(batchKey);
        batch.push(operation);
        batch.sort((a, b) => b.priority - a.priority);
        if (batch.length >= this.config.batch.maxBatchSize) {
            this.processBatch(batchKey);
        }
        else {
            if (!this.batchTimers.has(batchKey)) {
                const timer = setTimeout(() => {
                    this.processBatch(batchKey);
                }, this.config.batch.batchTimeout);
                this.batchTimers.set(batchKey, timer);
            }
        }
    }
    async processPendingBatches() {
        const batchKeys = Array.from(this.batchQueue.keys());
        for (const batchKey of batchKeys) {
            if (!this.activeBatches.has(batchKey)) {
                await this.processBatch(batchKey);
            }
        }
    }
    async processBatch(batchKey) {
        if (this.activeBatches.has(batchKey) ||
            this.activeBatches.size >= this.config.batch.maxConcurrentBatches) {
            return;
        }
        const batch = this.batchQueue.get(batchKey);
        if (!batch || batch.length === 0) {
            return;
        }
        this.activeBatches.add(batchKey);
        const timer = this.batchTimers.get(batchKey);
        if (timer) {
            clearTimeout(timer);
            this.batchTimers.delete(batchKey);
        }
        try {
            const operations = batch.splice(0, this.config.batch.maxBatchSize);
            await this.executeBatchOperations(operations);
        }
        catch (error) {
            console.error(`Failed to process batch ${batchKey}:`, error);
        }
        finally {
            this.activeBatches.delete(batchKey);
            if (batch.length === 0) {
                this.batchQueue.delete(batchKey);
            }
        }
    }
    async executeBatchOperations(operations) {
        const groupedOps = new Map();
        for (const op of operations) {
            const key = `${op.tableName}_${op.type}`;
            if (!groupedOps.has(key)) {
                groupedOps.set(key, []);
            }
            groupedOps.get(key).push(op);
        }
        const promises = Array.from(groupedOps.entries()).map(([key, ops]) => {
            return this.executeBatchGroup(ops);
        });
        await Promise.allSettled(promises);
    }
    async executeBatchGroup(operations) {
        const client = this.getOptimizedConnection();
        for (const op of operations) {
            try {
                switch (op.type) {
                    case 'read':
                        break;
                    case 'write':
                        break;
                    case 'update':
                        break;
                    case 'delete':
                        break;
                }
            }
            catch (error) {
                console.error(`Failed to execute batch operation ${op.id}:`, error);
            }
        }
    }
    initializeMemoryManagement() {
        if (this.config.memory.enableGcOptimization) {
            this.gcTimer = setInterval(() => {
                this.optimizeGarbageCollection();
            }, this.config.memory.gcInterval);
            this.memoryMonitorTimer = setInterval(() => {
                this.monitorMemoryUsage();
            }, 10000);
        }
    }
    optimizeGarbageCollection() {
        const now = Date.now();
        const memStats = process.memoryUsage();
        if (memStats.heapUsed > this.config.memory.memoryThreshold &&
            now - this.lastGcTime > this.config.memory.gcInterval) {
            if (global.gc) {
                console.log('Triggering garbage collection - Memory usage:', {
                    heapUsed: Math.round(memStats.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(memStats.heapTotal / 1024 / 1024) + 'MB'
                });
                global.gc();
                this.lastGcTime = now;
                this.cleanupLocalCache();
            }
        }
    }
    monitorMemoryUsage() {
        const memStats = this.getMemoryStats();
        if (memStats.heapUsed > this.config.memory.memoryThreshold) {
            console.warn('High memory usage detected:', memStats);
            if (memStats.heapUsed > this.config.memory.memoryThreshold * 1.5) {
                this.aggressiveCacheCleanup();
            }
        }
    }
    cleanupLocalCache() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, entry] of this.localCache.entries()) {
            if (now - entry.timestamp > entry.ttl * 1000) {
                this.localCache.delete(key);
                cleanedCount++;
            }
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
    aggressiveCacheCleanup() {
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
    setLocalCache(key, data, ttlSeconds) {
        const entry = {
            data,
            timestamp: Date.now(),
            ttl: ttlSeconds,
            accessCount: 0,
            lastAccessed: Date.now()
        };
        this.localCache.set(key, entry);
        if (this.localCache.size > this.config.memory.maxCacheSize) {
            this.cleanupLocalCache();
        }
    }
    getLocalCache(key) {
        const entry = this.localCache.get(key);
        if (!entry) {
            return null;
        }
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl * 1000) {
            this.localCache.delete(key);
            return null;
        }
        entry.accessCount++;
        entry.lastAccessed = now;
        return entry.data;
    }
    updateCacheStats(key, type) {
        if (!this.cacheStats.has(key)) {
            this.cacheStats.set(key, { hits: 0, misses: 0, evictions: 0 });
        }
        const stats = this.cacheStats.get(key);
        if (type === 'hit') {
            stats.hits++;
        }
        else {
            stats.misses++;
        }
    }
    getMemoryStats() {
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
    getCacheStats() {
        return new Map(this.cacheStats);
    }
    getBatchStats() {
        const queueSizes = new Map();
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
    async shutdown() {
        if (this.gcTimer) {
            clearInterval(this.gcTimer);
        }
        if (this.memoryMonitorTimer) {
            clearInterval(this.memoryMonitorTimer);
        }
        for (const timer of this.batchTimers.values()) {
            clearTimeout(timer);
        }
        await this.processPendingBatches();
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        this.localCache.clear();
        this.connectionPool.clear();
        this.connectionUsage.clear();
        this.batchQueue.clear();
    }
}
exports.PerformanceOptimizationService = PerformanceOptimizationService;
exports.performanceOptimizationService = new PerformanceOptimizationService({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: 'steampunk_idle',
        ttl: {
            activeQueue: 300,
            taskProgress: 60,
            playerStats: 600,
            frequentData: 1800,
        },
        maxRetries: 3,
        retryDelayMs: 1000,
    },
    database: {
        maxConnections: 10,
        connectionTimeout: 5000,
        idleTimeout: 300000,
        region: process.env.AWS_REGION || 'us-east-1',
    },
    batch: {
        maxBatchSize: 25,
        batchTimeout: 1000,
        maxConcurrentBatches: 5,
    },
    memory: {
        maxCacheSize: 10000,
        gcInterval: 30000,
        memoryThreshold: 100 * 1024 * 1024,
        enableGcOptimization: true,
    },
});
