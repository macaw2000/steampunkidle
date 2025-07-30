"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_CONFIG = void 0;
exports.CURRENCY_CONFIG = {
    STARTING_BALANCE: 100,
    MAX_BALANCE: 999999999,
    MIN_TRANSACTION: 1,
    ACTIVITY_RATES: {
        crafting: {
            baseRate: 5,
            skillMultiplier: 0.1,
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
};
