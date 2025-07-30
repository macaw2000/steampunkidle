"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheStats = exports.warmCache = exports.setCacheBatch = exports.getOrSetCache = exports.CacheKeys = exports.cache = void 0;
class MemoryCache {
    constructor() {
        this.cache = new Map();
    }
    set(key, data, ttlSeconds = 300) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlSeconds * 1000,
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.cache.delete(key));
    }
    size() {
        return this.cache.size;
    }
}
exports.cache = new MemoryCache();
exports.CacheKeys = {
    user: (userId) => `user:${userId}`,
    character: (userId) => `character:${userId}`,
    guild: (guildId) => `guild:${guildId}`,
    guildMembers: (guildId) => `guild:${guildId}:members`,
    leaderboard: (statType) => `leaderboard:${statType}`,
    itemDefinition: (itemId) => `item:${itemId}`,
    craftingRecipe: (recipeId) => `recipe:${recipeId}`,
    userInventory: (userId) => `inventory:${userId}`,
    activeAuctions: () => 'auctions:active',
    userAuctions: (userId) => `auctions:user:${userId}`,
    partyInfo: (partyId) => `party:${partyId}`,
    zoneInstance: (instanceId) => `zone:${instanceId}`,
};
async function getOrSetCache(key, fetchFunction, ttlSeconds = 300) {
    const cached = exports.cache.get(key);
    if (cached !== null) {
        return cached;
    }
    const data = await fetchFunction();
    exports.cache.set(key, data, ttlSeconds);
    return data;
}
exports.getOrSetCache = getOrSetCache;
function setCacheBatch(entries) {
    entries.forEach(({ key, data, ttl = 300 }) => {
        exports.cache.set(key, data, ttl);
    });
}
exports.setCacheBatch = setCacheBatch;
async function warmCache() {
    console.log('Cache warming initiated');
    exports.cache.cleanup();
}
exports.warmCache = warmCache;
function getCacheStats() {
    return {
        size: exports.cache.size(),
    };
}
exports.getCacheStats = getCacheStats;
