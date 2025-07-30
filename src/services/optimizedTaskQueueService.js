"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizedTaskQueueService = void 0;
const performanceOptimizations_1 = require("./performanceOptimizations");
const taskValidation_1 = require("./taskValidation");
class OptimizedTaskQueueService {
    constructor(persistenceService, config = {
        enableCaching: true,
        enableBatching: true,
        enableConnectionPooling: true,
        cacheStrategy: 'adaptive',
        batchStrategy: 'smart'
    }) {
        this.activeQueues = new Map();
        this.queueUpdateTimers = new Map();
        this.persistenceService = persistenceService;
        this.config = config;
    }
    async loadPlayerQueue(playerId) {
        if (this.config.enableCaching) {
            const cachedQueue = await performanceOptimizations_1.performanceOptimizationService.getCachedQueueState(playerId);
            if (cachedQueue) {
                this.activeQueues.set(playerId, cachedQueue);
                return cachedQueue;
            }
        }
        const queue = await this.persistenceService.loadQueue(playerId);
        if (queue) {
            this.activeQueues.set(playerId, queue);
            if (this.config.enableCaching) {
                await this.cacheQueueState(playerId, queue);
            }
            return queue;
        }
        return undefined;
    }
    async savePlayerQueue(playerId, queue) {
        this.activeQueues.set(playerId, queue);
        if (this.config.enableCaching) {
            await this.cacheQueueState(playerId, queue);
        }
        if (this.config.enableBatching && this.config.batchStrategy !== 'immediate') {
            await this.batchQueueSave(playerId, queue);
        }
        else {
            await this.persistenceService.saveQueueWithAtomicUpdate(queue);
        }
    }
    async addTask(playerId, task, playerStats, playerLevel, playerInventory) {
        const validation = taskValidation_1.TaskValidationService.validateTask(task, playerStats, playerLevel, playerInventory);
        if (!validation.isValid) {
            throw new Error(`Task validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        let queue = await this.loadPlayerQueue(playerId);
        if (!queue) {
            queue = this.createDefaultQueue(playerId);
        }
        queue.queuedTasks.push(task);
        queue.lastUpdated = Date.now();
        queue.version++;
        if (!queue.currentTask && !queue.isRunning && queue.queuedTasks.length === 1) {
            queue.currentTask = task;
            queue.isRunning = true;
        }
        await this.savePlayerQueue(playerId, queue);
        if (this.config.enableCaching && queue.currentTask?.id === task.id) {
            await performanceOptimizations_1.performanceOptimizationService.cacheTaskProgress(task.id, {
                taskId: task.id,
                progress: task.progress,
                timeRemaining: this.calculateTimeRemaining(task),
                isComplete: task.completed
            });
        }
    }
    async updateTaskProgress(playerId, taskId, progress) {
        const queue = this.activeQueues.get(playerId);
        if (!queue || !queue.currentTask || queue.currentTask.id !== taskId) {
            return;
        }
        queue.currentTask.progress = progress;
        queue.lastUpdated = Date.now();
        if (this.config.enableCaching) {
            const taskProgress = {
                taskId,
                progress,
                timeRemaining: this.calculateTimeRemaining(queue.currentTask),
                isComplete: progress >= 1.0
            };
            await performanceOptimizations_1.performanceOptimizationService.cacheTaskProgress(taskId, taskProgress);
        }
        if (this.shouldBatchProgressUpdate(progress)) {
            await this.batchProgressUpdate(playerId, queue);
        }
        else {
            await this.savePlayerQueue(playerId, queue);
        }
    }
    async completeTask(playerId, taskId, rewards) {
        const queue = this.activeQueues.get(playerId);
        if (!queue || !queue.currentTask || queue.currentTask.id !== taskId) {
            throw new Error('Task not found or not current');
        }
        const completedTask = queue.currentTask;
        completedTask.completed = true;
        completedTask.progress = 1.0;
        completedTask.rewards = rewards;
        queue.totalTasksCompleted++;
        queue.totalTimeSpent += completedTask.duration;
        queue.totalRewardsEarned.push(...rewards);
        queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== taskId);
        queue.currentTask = queue.queuedTasks.length > 0 ? queue.queuedTasks[0] : null;
        queue.isRunning = queue.currentTask !== null;
        queue.lastUpdated = Date.now();
        await this.savePlayerQueue(playerId, queue);
        if (this.config.enableCaching) {
            await this.cacheFrequentPlayerData(playerId, {
                totalCompleted: queue.totalTasksCompleted,
                totalRewards: queue.totalRewardsEarned.length,
                currentTask: queue.currentTask?.id || null
            });
        }
        return {
            task: completedTask,
            rewards,
            nextTask: queue.currentTask
        };
    }
    async getQueueStatus(playerId) {
        let queue = this.activeQueues.get(playerId);
        if (!queue) {
            queue = await this.loadPlayerQueue(playerId);
        }
        if (!queue) {
            return {
                currentTask: null,
                queueLength: 0,
                queuedTasks: [],
                isRunning: false,
                totalCompleted: 0
            };
        }
        return {
            currentTask: queue.currentTask,
            queueLength: queue.queuedTasks.length,
            queuedTasks: queue.queuedTasks,
            isRunning: queue.isRunning,
            totalCompleted: queue.totalTasksCompleted
        };
    }
    async removeTask(playerId, taskId) {
        const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
        if (!queue) {
            return;
        }
        queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== taskId);
        if (queue.currentTask?.id === taskId) {
            queue.currentTask = queue.queuedTasks.length > 0 ? queue.queuedTasks[0] : null;
            queue.isRunning = queue.currentTask !== null;
        }
        queue.lastUpdated = Date.now();
        queue.version++;
        await this.savePlayerQueue(playerId, queue);
    }
    async stopAllTasks(playerId) {
        const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
        if (!queue) {
            return;
        }
        queue.currentTask = null;
        queue.isRunning = false;
        queue.isPaused = false;
        queue.queuedTasks = [];
        queue.lastUpdated = Date.now();
        queue.version++;
        await this.persistenceService.saveQueueWithAtomicUpdate(queue);
        if (this.config.enableCaching) {
            await this.cacheQueueState(playerId, queue);
        }
    }
    async batchOperations(operations) {
        const playerOps = new Map();
        for (const op of operations) {
            if (!playerOps.has(op.playerId)) {
                playerOps.set(op.playerId, []);
            }
            playerOps.get(op.playerId).push(op);
        }
        const promises = Array.from(playerOps.entries()).map(async ([playerId, ops]) => {
            const queue = this.activeQueues.get(playerId) || await this.loadPlayerQueue(playerId);
            if (!queue)
                return;
            let modified = false;
            for (const op of ops) {
                switch (op.type) {
                    case 'add':
                        if (op.data) {
                            queue.queuedTasks.push(op.data);
                            modified = true;
                        }
                        break;
                    case 'remove':
                        if (op.taskId) {
                            const initialLength = queue.queuedTasks.length;
                            queue.queuedTasks = queue.queuedTasks.filter(t => t.id !== op.taskId);
                            modified = queue.queuedTasks.length !== initialLength;
                        }
                        break;
                    case 'update':
                        if (op.taskId && op.data) {
                            const task = queue.queuedTasks.find(t => t.id === op.taskId);
                            if (task) {
                                Object.assign(task, op.data);
                                modified = true;
                            }
                        }
                        break;
                }
            }
            if (modified) {
                queue.lastUpdated = Date.now();
                queue.version++;
                await this.savePlayerQueue(playerId, queue);
            }
        });
        await Promise.allSettled(promises);
    }
    async cacheQueueState(playerId, queue) {
        await performanceOptimizations_1.performanceOptimizationService.cacheActiveQueueState(playerId, queue);
    }
    async batchQueueSave(playerId, queue) {
        const operation = {
            id: `queue_save_${playerId}_${Date.now()}`,
            type: 'update',
            tableName: 'task-queues',
            key: { playerId },
            data: queue,
            timestamp: Date.now(),
            priority: this.calculateSavePriority(queue)
        };
        performanceOptimizations_1.performanceOptimizationService.addToBatch(operation);
    }
    async batchProgressUpdate(playerId, queue) {
        const existingTimer = this.queueUpdateTimers.get(playerId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(async () => {
            await this.savePlayerQueue(playerId, queue);
            this.queueUpdateTimers.delete(playerId);
        }, 2000);
        this.queueUpdateTimers.set(playerId, timer);
    }
    shouldBatchProgressUpdate(progress) {
        if (this.config.batchStrategy === 'immediate') {
            return false;
        }
        if (this.config.batchStrategy === 'delayed') {
            return true;
        }
        const importantMilestones = [0.25, 0.5, 0.75, 1.0];
        return !importantMilestones.some(milestone => Math.abs(progress - milestone) < 0.01);
    }
    calculateSavePriority(queue) {
        let priority = 5;
        if (queue.isRunning)
            priority += 2;
        if (Date.now() - queue.lastUpdated < 30000)
            priority += 1;
        if (queue.queuedTasks.length > 5)
            priority += 1;
        return Math.min(10, priority);
    }
    calculateTimeRemaining(task) {
        const elapsed = task.progress * task.duration;
        return Math.max(0, task.duration - elapsed);
    }
    async cacheFrequentPlayerData(playerId, data) {
        await performanceOptimizations_1.performanceOptimizationService.cacheFrequentData(`player_${playerId}`, data, 600);
    }
    createDefaultQueue(playerId) {
        return {
            playerId,
            currentTask: null,
            queuedTasks: [],
            isRunning: false,
            isPaused: false,
            pauseReason: undefined,
            canResume: true,
            totalTasksCompleted: 0,
            totalTimeSpent: 0,
            totalRewardsEarned: [],
            averageTaskDuration: 0,
            taskCompletionRate: 0,
            queueEfficiencyScore: 0,
            totalPauseTime: 0,
            config: {
                maxQueueSize: 50,
                maxTaskDuration: 24 * 60 * 60 * 1000,
                maxTotalQueueDuration: 7 * 24 * 60 * 60 * 1000,
                autoStart: true,
                priorityHandling: true,
                retryEnabled: true,
                maxRetries: 3,
                validationEnabled: true,
                syncInterval: 5000,
                offlineProcessingEnabled: true,
                pauseOnError: true,
                resumeOnResourceAvailable: true,
                persistenceInterval: 30000,
                integrityCheckInterval: 300000,
                maxHistorySize: 10
            },
            lastUpdated: Date.now(),
            lastSynced: Date.now(),
            createdAt: Date.now(),
            version: 1,
            checksum: '',
            lastValidated: Date.now(),
            stateHistory: [],
            maxHistorySize: 100
        };
    }
    getPerformanceStats() {
        return {
            activeQueues: this.activeQueues.size,
            cacheStats: performanceOptimizations_1.performanceOptimizationService.getCacheStats(),
            memoryStats: performanceOptimizations_1.performanceOptimizationService.getMemoryStats(),
            batchStats: performanceOptimizations_1.performanceOptimizationService.getBatchStats()
        };
    }
    async shutdown() {
        for (const timer of this.queueUpdateTimers.values()) {
            clearTimeout(timer);
        }
        this.queueUpdateTimers.clear();
        const savePromises = Array.from(this.activeQueues.entries()).map(([playerId, queue]) => this.persistenceService.saveQueueWithAtomicUpdate(queue));
        await Promise.allSettled(savePromises);
        this.activeQueues.clear();
        await performanceOptimizations_1.performanceOptimizationService.shutdown();
    }
}
exports.OptimizedTaskQueueService = OptimizedTaskQueueService;
