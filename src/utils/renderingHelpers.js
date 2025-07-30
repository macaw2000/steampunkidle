"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderIfExists = exports.createSafeRenderer = exports.renderAsyncState = exports.renderWithServices = exports.renderFeature = exports.renderWithFallback = exports.renderIf = void 0;
function renderIf(condition, component) {
    try {
        const shouldRender = typeof condition === 'function' ? condition() : condition;
        return shouldRender ? component : null;
    }
    catch (error) {
        console.warn('renderIf condition check failed:', error);
        return null;
    }
}
exports.renderIf = renderIf;
function renderWithFallback(component, fallback = null) {
    try {
        return component;
    }
    catch (error) {
        console.warn('Component rendering failed, using fallback:', error);
        return fallback;
    }
}
exports.renderWithFallback = renderWithFallback;
function renderFeature(featureKey, component, fallback) {
    try {
        const isFeatureEnabled = checkFeatureAvailability(featureKey);
        if (isFeatureEnabled) {
            return component;
        }
        return fallback || null;
    }
    catch (error) {
        console.warn(`Feature ${featureKey} check failed:`, error);
        return fallback || null;
    }
}
exports.renderFeature = renderFeature;
function renderWithServices(requiredServices, component, fallback) {
    try {
        const servicesAvailable = requiredServices.every(service => checkServiceAvailability(service));
        if (servicesAvailable) {
            return component;
        }
        return fallback || null;
    }
    catch (error) {
        console.warn('Service availability check failed:', error);
        return fallback || null;
    }
}
exports.renderWithServices = renderWithServices;
function renderAsyncState(state, components) {
    try {
        if (state.loading) {
            return components.loading;
        }
        if (state.error) {
            return components.error(state.error);
        }
        if (state.data !== undefined && state.data !== null) {
            return components.success(state.data);
        }
        return components.empty || null;
    }
    catch (error) {
        console.warn('Async state rendering failed:', error);
        return components.error(error);
    }
}
exports.renderAsyncState = renderAsyncState;
function checkFeatureAvailability(featureKey) {
    try {
        const features = {
            'chat': true,
            'marketplace': true,
            'guilds': true,
            'leaderboard': true,
            'crafting': true,
            'harvesting': true,
            'combat': true,
        };
        return features[featureKey] ?? false;
    }
    catch (error) {
        console.warn(`Feature availability check failed for ${featureKey}:`, error);
        return false;
    }
}
function checkServiceAvailability(serviceName) {
    try {
        const services = {
            'auth': typeof window !== 'undefined' && window.localStorage !== undefined,
            'database': true,
            'websocket': typeof WebSocket !== 'undefined',
            'notifications': 'Notification' in window,
            'storage': typeof window !== 'undefined' && window.localStorage !== undefined,
        };
        return services[serviceName] ?? false;
    }
    catch (error) {
        console.warn(`Service availability check failed for ${serviceName}:`, error);
        return false;
    }
}
function createSafeRenderer(defaultFallback = null) {
    return function safeRender(component, fallback = defaultFallback) {
        return renderWithFallback(component, fallback);
    };
}
exports.createSafeRenderer = createSafeRenderer;
function renderIfExists(obj, path, renderer, fallback) {
    try {
        const value = getNestedValue(obj, path);
        if (value !== undefined && value !== null) {
            return renderer(value);
        }
        return fallback || null;
    }
    catch (error) {
        console.warn(`Failed to access path ${path}:`, error);
        return fallback || null;
    }
}
exports.renderIfExists = renderIfExists;
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}
