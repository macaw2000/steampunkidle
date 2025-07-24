import { Task, TaskType, TaskQueue } from '../types/taskQueue';
import { HarvestingActivity } from '../types/harvesting';
import { CraftingRecipe } from '../types/crafting';
import { Enemy } from '../types/combat';

/**
 * Input validation and sanitization for task queue operations
 */
export class TaskQueueInputValidator {
  private static readonly MAX_STRING_LENGTH = 1000;
  private static readonly MAX_QUEUE_SIZE = 50;
  private static readonly MAX_TASK_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly ALLOWED_TASK_TYPES: TaskType[] = [TaskType.HARVESTING, TaskType.CRAFTING, TaskType.COMBAT];

  /**
   * Validate and sanitize task input
   */
  static validateTask(task: Partial<Task>): { isValid: boolean; errors: string[]; sanitizedTask?: Task } {
    const errors: string[] = [];
    
    // Validate required fields
    if (!task.id || typeof task.id !== 'string') {
      errors.push('Task ID is required and must be a string');
    } else if (!this.isValidId(task.id)) {
      errors.push('Task ID contains invalid characters');
    }

    if (!task.type || !this.ALLOWED_TASK_TYPES.includes(task.type as TaskType)) {
      errors.push(`Task type must be one of: ${this.ALLOWED_TASK_TYPES.join(', ')}`);
    }

    if (!task.name || typeof task.name !== 'string') {
      errors.push('Task name is required and must be a string');
    } else if (task.name.length > this.MAX_STRING_LENGTH) {
      errors.push(`Task name must be less than ${this.MAX_STRING_LENGTH} characters`);
    }

    if (!task.playerId || typeof task.playerId !== 'string') {
      errors.push('Player ID is required and must be a string');
    } else if (!this.isValidId(task.playerId)) {
      errors.push('Player ID contains invalid characters');
    }

    if (typeof task.duration !== 'number' || task.duration <= 0) {
      errors.push('Task duration must be a positive number');
    } else if (task.duration > this.MAX_TASK_DURATION) {
      errors.push(`Task duration cannot exceed ${this.MAX_TASK_DURATION}ms (24 hours)`);
    }

    if (typeof task.priority !== 'number' || task.priority < 0 || task.priority > 10) {
      errors.push('Task priority must be a number between 0 and 10');
    }

    // Validate activity-specific data
    if (task.activityData) {
      const activityErrors = this.validateActivityData(task.type as TaskType, task.activityData);
      errors.push(...activityErrors);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Sanitize the task
    const sanitizedTask: Task = {
      id: this.sanitizeString(task.id!),
      type: task.type as TaskType,
      name: this.sanitizeString(task.name!),
      description: this.sanitizeString(task.description || ''),
      icon: this.sanitizeString(task.icon || ''),
      duration: Math.floor(task.duration!),
      startTime: typeof task.startTime === 'number' ? task.startTime : Date.now(),
      playerId: this.sanitizeString(task.playerId!),
      activityData: task.activityData || this.getDefaultActivityData(task.type as TaskType),
      prerequisites: Array.isArray(task.prerequisites) ? task.prerequisites : [],
      resourceRequirements: Array.isArray(task.resourceRequirements) ? task.resourceRequirements : [],
      progress: typeof task.progress === 'number' ? Math.max(0, Math.min(100, task.progress)) : 0,
      completed: Boolean(task.completed),
      rewards: Array.isArray(task.rewards) ? task.rewards : [],
      priority: Math.floor(task.priority!),
      estimatedCompletion: typeof task.estimatedCompletion === 'number' ? task.estimatedCompletion : Date.now() + task.duration!,
      retryCount: typeof task.retryCount === 'number' ? Math.max(0, task.retryCount) : 0,
      maxRetries: typeof task.maxRetries === 'number' ? Math.max(0, task.maxRetries) : 3,
      isValid: true,
      validationErrors: []
    };

    return { isValid: true, errors: [], sanitizedTask };
  }

  /**
   * Get default activity data based on task type
   */
  private static getDefaultActivityData(taskType: TaskType): any {
    switch (taskType) {
      case TaskType.HARVESTING:
        return {
          activity: null,
          playerStats: {},
          location: null,
          tools: [],
          expectedYield: []
        };
      case TaskType.CRAFTING:
        return {
          recipe: null,
          materials: [],
          craftingStation: null,
          playerSkillLevel: 1,
          qualityModifier: 1,
          expectedOutputs: []
        };
      case TaskType.COMBAT:
        return {
          enemy: null,
          playerLevel: 1,
          playerStats: {},
          equipment: [],
          combatStrategy: 'balanced',
          estimatedOutcome: {}
        };
      default:
        return {};
    }
  }

  /**
   * Validate queue operations
   */
  static validateQueueOperation(operation: string, playerId: string, data?: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allowedOperations = ['add', 'remove', 'reorder', 'stop', 'pause', 'resume', 'clear'];

    if (!allowedOperations.includes(operation)) {
      errors.push(`Invalid operation: ${operation}`);
    }

    if (!playerId || typeof playerId !== 'string' || !this.isValidId(playerId)) {
      errors.push('Valid player ID is required');
    }

    // Operation-specific validation
    switch (operation) {
      case 'add':
        if (!data || typeof data !== 'object') {
          errors.push('Task data is required for add operation');
        }
        break;
      case 'remove':
        if (!data?.taskId || typeof data.taskId !== 'string' || !this.isValidId(data.taskId)) {
          errors.push('Valid task ID is required for remove operation');
        }
        break;
      case 'reorder':
        if (!Array.isArray(data?.taskIds) || data.taskIds.some((id: any) => typeof id !== 'string' || !this.isValidId(id))) {
          errors.push('Valid array of task IDs is required for reorder operation');
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate queue size limits
   */
  static validateQueueSize(queue: TaskQueue): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const totalTasks = (queue.currentTask ? 1 : 0) + queue.queuedTasks.length;

    if (totalTasks > this.MAX_QUEUE_SIZE) {
      errors.push(`Queue size (${totalTasks}) exceeds maximum allowed (${this.MAX_QUEUE_SIZE})`);
    }

    return { isValid: errors.length === 0, errors };
  }

  private static validateActivityData(taskType: TaskType, activityData: any): string[] {
    const errors: string[] = [];

    switch (taskType) {
      case 'harvesting':
        if (!activityData.activity || typeof activityData.activity !== 'object') {
          errors.push('Harvesting activity data is required');
        }
        break;
      case 'crafting':
        if (!activityData.recipe || typeof activityData.recipe !== 'object') {
          errors.push('Crafting recipe data is required');
        }
        break;
      case 'combat':
        if (!activityData.enemy || typeof activityData.enemy !== 'object') {
          errors.push('Combat enemy data is required');
        }
        break;
    }

    return errors;
  }

  private static isValidId(id: string): boolean {
    // Allow alphanumeric characters, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
  }

  private static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim()
      .substring(0, this.MAX_STRING_LENGTH);
  }
}
/**
 
* Rate limiting service to prevent queue spam and abuse
 */
export class TaskQueueRateLimiter {
  private static readonly rateLimits = new Map<string, RateLimitData>();
  private static readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private static readonly MAX_OPERATIONS_PER_MINUTE = 30;
  private static readonly MAX_TASKS_PER_MINUTE = 10;
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static {
    // Cleanup expired rate limit data periodically
    setInterval(() => {
      this.cleanupExpiredLimits();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Check if operation is allowed for player
   */
  static isOperationAllowed(playerId: string, operation: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const key = `${playerId}:${operation}`;
    
    let limitData = this.rateLimits.get(key);
    if (!limitData) {
      limitData = {
        count: 0,
        windowStart: now,
        lastOperation: now
      };
      this.rateLimits.set(key, limitData);
    }

    // Reset window if expired
    if (now - limitData.windowStart >= this.RATE_LIMIT_WINDOW) {
      limitData.count = 0;
      limitData.windowStart = now;
    }

    // Check rate limits based on operation type
    const maxOperations = operation === 'add' ? this.MAX_TASKS_PER_MINUTE : this.MAX_OPERATIONS_PER_MINUTE;
    
    if (limitData.count >= maxOperations) {
      const retryAfter = this.RATE_LIMIT_WINDOW - (now - limitData.windowStart);
      return { allowed: false, retryAfter };
    }

    // Update counters
    limitData.count++;
    limitData.lastOperation = now;

    return { allowed: true };
  }

  /**
   * Check for suspicious activity patterns
   */
  static detectSuspiciousActivity(playerId: string): { suspicious: boolean; reason?: string } {
    const playerOperations = Array.from(this.rateLimits.entries())
      .filter(([key]) => key.startsWith(`${playerId}:`))
      .map(([, data]) => data);

    if (playerOperations.length === 0) {
      return { suspicious: false };
    }

    const now = Date.now();
    const recentOperations = playerOperations.filter(data => 
      now - data.lastOperation < this.RATE_LIMIT_WINDOW
    );

    // Check for rapid-fire operations
    const totalRecentOperations = recentOperations.reduce((sum, data) => sum + data.count, 0);
    if (totalRecentOperations > this.MAX_OPERATIONS_PER_MINUTE * 2) {
      return { suspicious: true, reason: 'Excessive operation rate detected' };
    }

    // Check for consistent maximum rate usage (potential bot behavior)
    const maxRateOperations = recentOperations.filter(data => 
      data.count >= this.MAX_OPERATIONS_PER_MINUTE * 0.9
    );
    if (maxRateOperations.length >= 3) {
      return { suspicious: true, reason: 'Consistent maximum rate usage detected' };
    }

    return { suspicious: false };
  }

  /**
   * Get current rate limit status for player
   */
  static getRateLimitStatus(playerId: string): RateLimitStatus {
    const now = Date.now();
    const playerLimits = Array.from(this.rateLimits.entries())
      .filter(([key]) => key.startsWith(`${playerId}:`))
      .reduce((acc, [key, data]) => {
        const operation = key.split(':')[1];
        const remaining = Math.max(0, this.RATE_LIMIT_WINDOW - (now - data.windowStart));
        acc[operation] = {
          count: data.count,
          limit: operation === 'add' ? this.MAX_TASKS_PER_MINUTE : this.MAX_OPERATIONS_PER_MINUTE,
          resetTime: data.windowStart + this.RATE_LIMIT_WINDOW
        };
        return acc;
      }, {} as Record<string, any>);

    return {
      playerId,
      operations: playerLimits,
      windowDuration: this.RATE_LIMIT_WINDOW
    };
  }

  private static cleanupExpiredLimits(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, data] of this.rateLimits.entries()) {
      if (now - data.lastOperation > this.RATE_LIMIT_WINDOW * 2) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.rateLimits.delete(key));
  }
}

interface RateLimitData {
  count: number;
  windowStart: number;
  lastOperation: number;
}

interface RateLimitStatus {
  playerId: string;
  operations: Record<string, {
    count: number;
    limit: number;
    resetTime: number;
  }>;
  windowDuration: number;
}/*
*
 * Audit logging service for task queue operations
 */
export class TaskQueueAuditLogger {
  private static readonly auditLogs: AuditLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 10000;
  private static readonly LOG_RETENTION_DAYS = 90;

  /**
   * Log queue operation
   */
  static logOperation(operation: AuditOperation): void {
    const logEntry: AuditLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      operation: operation.type,
      playerId: operation.playerId,
      details: operation.details,
      ipAddress: operation.ipAddress,
      userAgent: operation.userAgent,
      sessionId: operation.sessionId,
      success: operation.success,
      errorMessage: operation.errorMessage,
      metadata: operation.metadata
    };

    this.auditLogs.push(logEntry);
    this.cleanupOldLogs();

    // In production, this would be sent to a logging service like CloudWatch
    console.log('[AUDIT]', JSON.stringify(logEntry));
  }

  /**
   * Log admin action
   */
  static logAdminAction(action: AdminAuditOperation): void {
    const logEntry: AuditLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      operation: `admin:${action.type}`,
      playerId: action.adminId,
      details: {
        ...action.details,
        targetPlayerId: action.targetPlayerId,
        adminLevel: action.adminLevel
      },
      ipAddress: action.ipAddress,
      userAgent: action.userAgent,
      sessionId: action.sessionId,
      success: action.success,
      errorMessage: action.errorMessage,
      metadata: {
        ...action.metadata,
        isAdminAction: true,
        severity: action.severity || 'medium'
      }
    };

    this.auditLogs.push(logEntry);
    this.cleanupOldLogs();

    // Admin actions should be logged with higher priority
    console.warn('[ADMIN_AUDIT]', JSON.stringify(logEntry));
  }

  /**
   * Get audit logs for a player
   */
  static getPlayerAuditLogs(playerId: string, limit: number = 100): AuditLogEntry[] {
    return this.auditLogs
      .filter(log => log.playerId === playerId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get audit logs by operation type
   */
  static getAuditLogsByOperation(operation: string, limit: number = 100): AuditLogEntry[] {
    return this.auditLogs
      .filter(log => log.operation === operation)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get recent failed operations
   */
  static getFailedOperations(hours: number = 24): AuditLogEntry[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.auditLogs
      .filter(log => !log.success && log.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get security-related events
   */
  static getSecurityEvents(hours: number = 24): AuditLogEntry[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const securityOperations = ['rate_limit_exceeded', 'suspicious_activity', 'validation_failed', 'unauthorized_access'];
    
    return this.auditLogs
      .filter(log => 
        log.timestamp > cutoff && 
        (securityOperations.includes(log.operation) || log.metadata?.security === true)
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate audit report
   */
  static generateAuditReport(startTime: number, endTime: number): AuditReport {
    const logs = this.auditLogs.filter(log => 
      log.timestamp >= startTime && log.timestamp <= endTime
    );

    const operationCounts = logs.reduce((acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const failedOperations = logs.filter(log => !log.success);
    const uniquePlayers = new Set(logs.map(log => log.playerId)).size;

    return {
      period: { start: startTime, end: endTime },
      totalOperations: logs.length,
      failedOperations: failedOperations.length,
      successRate: logs.length > 0 ? ((logs.length - failedOperations.length) / logs.length) * 100 : 100,
      uniquePlayers,
      operationBreakdown: operationCounts,
      topErrors: this.getTopErrors(failedOperations),
      securityEvents: this.getSecurityEvents((endTime - startTime) / (60 * 60 * 1000))
    };
  }

  private static generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static cleanupOldLogs(): void {
    // Remove excess logs
    if (this.auditLogs.length > this.MAX_LOG_ENTRIES) {
      this.auditLogs.splice(0, this.auditLogs.length - this.MAX_LOG_ENTRIES);
    }

    // Remove old logs
    const cutoff = Date.now() - (this.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const validLogs = this.auditLogs.filter(log => log.timestamp > cutoff);
    this.auditLogs.length = 0;
    this.auditLogs.push(...validLogs);
  }

  private static getTopErrors(failedLogs: AuditLogEntry[]): Array<{ error: string; count: number }> {
    const errorCounts = failedLogs.reduce((acc, log) => {
      const error = log.errorMessage || 'Unknown error';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

interface AuditOperation {
  type: string;
  playerId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface AdminAuditOperation extends AuditOperation {
  adminId: string;
  targetPlayerId?: string;
  adminLevel: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  operation: string;
  playerId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface AuditReport {
  period: { start: number; end: number };
  totalOperations: number;
  failedOperations: number;
  successRate: number;
  uniquePlayers: number;
  operationBreakdown: Record<string, number>;
  topErrors: Array<{ error: string; count: number }>;
  securityEvents: AuditLogEntry[];
}/**
 * E
ncryption service for player data protection
 */
export class TaskQueueEncryption {
  private static readonly ENCRYPTION_KEY = process.env.TASK_QUEUE_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
  private static readonly ALGORITHM = 'aes-256-gcm';

  /**
   * Encrypt sensitive task data
   */
  static encryptTaskData(data: any): EncryptedData {
    try {
      const crypto = require('crypto');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ALGORITHM, this.ENCRYPTION_KEY);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.ALGORITHM
      };
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive task data
   */
  static decryptTaskData(encryptedData: EncryptedData): any {
    try {
      const crypto = require('crypto');
      const decipher = crypto.createDecipher(this.ALGORITHM, this.ENCRYPTION_KEY);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data for storage
   */
  static hashData(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data + this.ENCRYPTION_KEY).digest('hex');
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }
}

/**
 * Secure token management for task queue operations
 */
export class TaskQueueTokenManager {
  private static readonly tokens = new Map<string, TokenData>();
  private static readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_TOKENS_PER_PLAYER = 5;
  private static readonly CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

  static {
    // Cleanup expired tokens periodically
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Generate secure session token for player
   */
  static generateSessionToken(playerId: string, permissions: string[] = []): SessionToken {
    // Clean up old tokens for this player
    this.cleanupPlayerTokens(playerId);

    const tokenId = TaskQueueEncryption.generateSecureToken();
    const expiresAt = Date.now() + this.TOKEN_EXPIRY;
    
    const tokenData: TokenData = {
      playerId,
      permissions,
      createdAt: Date.now(),
      expiresAt,
      lastUsed: Date.now(),
      ipAddress: '', // Should be set by the calling service
      userAgent: '' // Should be set by the calling service
    };

    this.tokens.set(tokenId, tokenData);

    return {
      token: tokenId,
      expiresAt,
      permissions
    };
  }

  /**
   * Validate session token
   */
  static validateToken(token: string, requiredPermission?: string): TokenValidationResult {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      return { valid: false, reason: 'Token not found' };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.tokens.delete(token);
      return { valid: false, reason: 'Token expired' };
    }

    if (requiredPermission && !tokenData.permissions.includes(requiredPermission)) {
      return { valid: false, reason: 'Insufficient permissions' };
    }

    // Update last used timestamp
    tokenData.lastUsed = Date.now();

    return {
      valid: true,
      playerId: tokenData.playerId,
      permissions: tokenData.permissions
    };
  }

  /**
   * Revoke token
   */
  static revokeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  /**
   * Revoke all tokens for a player
   */
  static revokePlayerTokens(playerId: string): number {
    let revokedCount = 0;
    
    for (const [token, data] of this.tokens.entries()) {
      if (data.playerId === playerId) {
        this.tokens.delete(token);
        revokedCount++;
      }
    }
    
    return revokedCount;
  }

  /**
   * Get active tokens for a player
   */
  static getPlayerTokens(playerId: string): Array<{ token: string; createdAt: number; expiresAt: number; lastUsed: number }> {
    const playerTokens: Array<{ token: string; createdAt: number; expiresAt: number; lastUsed: number }> = [];
    
    for (const [token, data] of this.tokens.entries()) {
      if (data.playerId === playerId && Date.now() < data.expiresAt) {
        playerTokens.push({
          token: token.substring(0, 8) + '...', // Partial token for security
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          lastUsed: data.lastUsed
        });
      }
    }
    
    return playerTokens.sort((a, b) => b.lastUsed - a.lastUsed);
  }

  /**
   * Refresh token expiry
   */
  static refreshToken(token: string): boolean {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData || Date.now() > tokenData.expiresAt) {
      return false;
    }

    tokenData.expiresAt = Date.now() + this.TOKEN_EXPIRY;
    tokenData.lastUsed = Date.now();
    
    return true;
  }

  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredTokens: string[] = [];

    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        expiredTokens.push(token);
      }
    }

    expiredTokens.forEach(token => this.tokens.delete(token));
  }

  private static cleanupPlayerTokens(playerId: string): void {
    const playerTokens = Array.from(this.tokens.entries())
      .filter(([, data]) => data.playerId === playerId)
      .sort(([, a], [, b]) => b.lastUsed - a.lastUsed);

    // Keep only the most recent tokens, remove excess
    if (playerTokens.length >= this.MAX_TOKENS_PER_PLAYER) {
      const tokensToRemove = playerTokens.slice(this.MAX_TOKENS_PER_PLAYER - 1);
      tokensToRemove.forEach(([token]) => this.tokens.delete(token));
    }
  }
}

interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

interface TokenData {
  playerId: string;
  permissions: string[];
  createdAt: number;
  expiresAt: number;
  lastUsed: number;
  ipAddress: string;
  userAgent: string;
}

interface SessionToken {
  token: string;
  expiresAt: number;
  permissions: string[];
}

interface TokenValidationResult {
  valid: boolean;
  reason?: string;
  playerId?: string;
  permissions?: string[];
}