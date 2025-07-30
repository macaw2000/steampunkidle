"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = exports.NetworkUtils = void 0;
class NetworkUtils {
    static async fetchJson(url, headers = {}, options = {}) {
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };
        return this.makeRequest(url, requestOptions, options);
    }
    static async postJson(url, body, options = {}) {
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(body),
        };
        return this.makeRequest(url, requestOptions, options);
    }
    static async putJson(url, body, options = {}) {
        const requestOptions = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(body),
        };
        return this.makeRequest(url, requestOptions, options);
    }
    static async deleteJson(url, options = {}) {
        const requestOptions = {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };
        return this.makeRequest(url, requestOptions, options);
    }
    static async delete(url, requestOptions, options = {}) {
        return this.makeRequest(url, requestOptions, options);
    }
    static async makeRequest(url, requestOptions, options) {
        const { timeout = this.DEFAULT_TIMEOUT, retries = this.DEFAULT_RETRIES, exponentialBackoff = true, } = options;
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`, response.status, response.statusText, url);
                }
                try {
                    const data = await response.json();
                    return data;
                }
                catch (parseError) {
                    const text = await response.text();
                    return text;
                }
            }
            catch (error) {
                lastError = error;
                const isOffline = !navigator.onLine;
                if (error.name === 'AbortError') {
                    throw new NetworkError(`Request timeout after ${timeout}ms`, 408, 'Request Timeout', url, { isTimeout: true, isOffline });
                }
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    throw new NetworkError(isOffline ? 'You appear to be offline' : 'Network request failed', 0, 'Network Error', url, { isOffline });
                }
                if (error instanceof NetworkError && error.status >= 400 && error.status < 500) {
                    throw error;
                }
                if (attempt === retries) {
                    throw error;
                }
                const delay = exponentialBackoff
                    ? this.BASE_DELAY * Math.pow(2, attempt)
                    : this.BASE_DELAY;
                console.warn(`NetworkUtils: Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, error.message);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static async isReachable(url, timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    static getNetworkStatus() {
        const navigator = window.navigator;
        return {
            online: navigator.onLine,
            effectiveType: navigator.connection?.effectiveType,
            downlink: navigator.connection?.downlink,
            rtt: navigator.connection?.rtt,
        };
    }
    static isOnline() {
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    static waitForOnline(timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (this.isOnline()) {
                resolve();
                return;
            }
            const timeoutId = setTimeout(() => {
                window.removeEventListener('online', onlineHandler);
                reject(new Error('Timeout waiting for online connection'));
            }, timeout);
            const onlineHandler = () => {
                clearTimeout(timeoutId);
                window.removeEventListener('online', onlineHandler);
                resolve();
            };
            window.addEventListener('online', onlineHandler);
        });
    }
    static onNetworkStatusChange(callback) {
        const onlineHandler = () => callback(true);
        const offlineHandler = () => callback(false);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);
        return () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        };
    }
    static calculateRetryDelay(attempt, baseDelay = 1000, exponentialBackoff = true) {
        if (!exponentialBackoff) {
            return baseDelay;
        }
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.min(30000, exponentialDelay + jitter);
    }
    static withAuth(token) {
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
        };
        return {
            fetchJson: (url, options = {}) => this.fetchJson(url, authHeaders, options),
            postJson: (url, body, options = {}) => this.postJson(url, body, { ...options, headers: { ...authHeaders, ...options.headers } }),
            putJson: (url, body, options = {}) => this.putJson(url, body, { ...options, headers: { ...authHeaders, ...options.headers } }),
            deleteJson: (url, options = {}) => this.deleteJson(url, { ...options, headers: { ...authHeaders, ...options.headers } }),
        };
    }
    static createNetworkError(message, options = {}) {
        return new NetworkError(message, options.status || 0, options.statusText || 'Network Error', options.url || '', {
            isTimeout: options.isTimeout || false,
            isOffline: options.isOffline || false
        });
    }
    static async fetchWithRetry(url, headers = {}, options = {}) {
        return this.fetchJson(url, headers, options);
    }
}
exports.NetworkUtils = NetworkUtils;
NetworkUtils.DEFAULT_TIMEOUT = 10000;
NetworkUtils.DEFAULT_RETRIES = 3;
NetworkUtils.BASE_DELAY = 1000;
class NetworkError extends Error {
    constructor(message, status, statusText, url, options = {}) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.isNetworkError = true;
        this.isTimeout = false;
        this.isOffline = false;
        this.name = 'NetworkError';
        this.isTimeout = options.isTimeout || false;
        this.isOffline = options.isOffline || false;
    }
    get statusCode() {
        return this.status;
    }
}
exports.NetworkError = NetworkError;
exports.default = NetworkUtils;
