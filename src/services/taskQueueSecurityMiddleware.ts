import { 
  TaskQueueInputValidator, 
  TaskQueueRateLimiter, 
  TaskQueueAuditLogger, 
  TaskQueueTokenManager 
} from './taskQueueSecurity';
import { Task, TaskQueue } from '../types/taskQueue';

/**
 * Security middleware for task queue operations
 */
export class TaskQueueSecurityMiddleware {
  /**
   * Validate and secure a task queue operation
   */
  static async validateOperation(
    operation: string,
    playerId: string,
    data: any,
    context: SecurityContext
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    let auditDetails: Record<string, any> = {
      operation,
      playerId,
      timestamp: startTime
    };

    try {
      // 1. Token validation
      const tokenValidation = TaskQueueTokenManager.validateToken(
        context.token,
        this.getRequiredPermission(operation)
      );

      if (!tokenValidation.valid) {
        await this.logSecurityEvent('token_validation_failed', playerId, {
          reason: tokenValidation.reason,
          operation
        }, context);
        
        return {
          success: false,
          error: 'Authentication failed',
          statusCode: 401
        };
      }

      // 2. Rate limiting
      const rateLimitCheck = TaskQueueRateLimiter.isOperationAllowed(playerId, operation);
      if (!rateLimitCheck.allowed) {
        await this.logSecurityEvent('rate_limit_exceeded', playerId, {
          operation,
          retryAfter: rateLimitCheck.retryAfter
        }, context);

        return {
          success: false,
          error: 'Rate limit exceeded',
          statusCode: 429,
          retryAfter: rateLimitCheck.retryAfter
        };
      }

      // 3. Input validation
      const inputValidation = this.validateInput(operation, data);
      if (!inputValidation.isValid) {
        auditDetails.validationErrors = inputValidation.errors;
        
        TaskQueueAuditLogger.logOperation({
          type: 'validation_failed',
          playerId,
          details: auditDetails,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: false,
          errorMessage: inputValidation.errors.join(', ')
        });

        return {
          success: false,
          error: 'Invalid input',
          details: inputValidation.errors,
          statusCode: 400
        };
      }

      // 4. Suspicious activity detection
      const suspiciousActivity = TaskQueueRateLimiter.detectSuspiciousActivity(playerId);
      if (suspiciousActivity.suspicious) {
        await this.logSecurityEvent('suspicious_activity', playerId, {
          reason: suspiciousActivity.reason,
          operation
        }, context);

        // Don't block the operation but flag for monitoring
        auditDetails.suspiciousActivity = suspiciousActivity.reason;
      }

      // 5. Log successful validation
      TaskQueueAuditLogger.logOperation({
        type: operation,
        playerId,
        details: auditDetails,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        success: true,
        metadata: {
          validationTime: Date.now() - startTime,
          suspiciousActivity: suspiciousActivity.suspicious
        }
      });

      return {
        success: true,
        sanitizedData: inputValidation.sanitizedData,
        playerId: tokenValidation.playerId!
      };

    } catch (error: any) {
      TaskQueueAuditLogger.logOperation({
        type: 'security_error',
        playerId,
        details: auditDetails,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        success: false,
        errorMessage: error.message,
        metadata: { error: 'Security middleware failure' }
      });

      return {
        success: false,
        error: 'Security validation failed',
        statusCode: 500
      };
    }
  }

  /**
   * Validate admin operation with elevated security
   */
  static async validateAdminOperation(
    operation: string,
    adminId: string,
    targetPlayerId: string,
    data: any,
    context: SecurityContext & { adminLevel: string }
  ): Promise<SecurityValidationResult> {
    const startTime = Date.now();

    try {
      // 1. Admin token validation with elevated permissions
      const tokenValidation = TaskQueueTokenManager.validateToken(
        context.token,
        `admin:${operation}`
      );

      if (!tokenValidation.valid) {
        TaskQueueAuditLogger.logAdminAction({
          type: 'admin_auth_failed',
          playerId: adminId,
          adminId,
          targetPlayerId,
          adminLevel: context.adminLevel,
          details: { operation, reason: tokenValidation.reason },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: false,
          errorMessage: tokenValidation.reason,
          severity: 'high'
        });

        return {
          success: false,
          error: 'Admin authentication failed',
          statusCode: 403
        };
      }

      // 2. Admin-specific rate limiting (more restrictive)
      const rateLimitCheck = TaskQueueRateLimiter.isOperationAllowed(`admin:${adminId}`, operation);
      if (!rateLimitCheck.allowed) {
        TaskQueueAuditLogger.logAdminAction({
          type: 'admin_rate_limited',
          playerId: adminId,
          adminId,
          targetPlayerId,
          adminLevel: context.adminLevel,
          details: { operation, retryAfter: rateLimitCheck.retryAfter },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          success: false,
          errorMessage: 'Admin rate limit exceeded',
          severity: 'medium'
        });

        return {
          success: false,
          error: 'Admin rate limit exceeded',
          statusCode: 429,
          retryAfter: rateLimitCheck.retryAfter
        };
      }

      // 3. Log successful admin operation
      TaskQueueAuditLogger.logAdminAction({
        type: operation,
        playerId: adminId,
        adminId,
        targetPlayerId,
        adminLevel: context.adminLevel,
        details: { operation, data },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        success: true,
        metadata: {
          validationTime: Date.now() - startTime
        },
        severity: this.getOperationSeverity(operation)
      });

      return {
        success: true,
        playerId: adminId
      };

    } catch (error: any) {
      TaskQueueAuditLogger.logAdminAction({
        type: 'admin_security_error',
        playerId: adminId,
        adminId,
        targetPlayerId,
        adminLevel: context.adminLevel,
        details: { operation, error: error.message },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        success: false,
        errorMessage: error.message,
        severity: 'critical'
      });

      return {
        success: false,
        error: 'Admin security validation failed',
        statusCode: 500
      };
    }
  }

  /**
   * Get security status for monitoring
   */
  static getSecurityStatus(): SecurityStatus {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);

    const securityEvents = TaskQueueAuditLogger.getSecurityEvents(24);
    const failedOperations = TaskQueueAuditLogger.getFailedOperations(24);

    return {
      timestamp: now,
      securityEvents: securityEvents.length,
      failedOperations: failedOperations.length,
      rateLimitViolations: securityEvents.filter(e => e.operation === 'rate_limit_exceeded').length,
      suspiciousActivities: securityEvents.filter(e => e.operation === 'suspicious_activity').length,
      authenticationFailures: securityEvents.filter(e => e.operation.includes('auth_failed')).length,
      validationFailures: securityEvents.filter(e => e.operation === 'validation_failed').length,
      recentAlerts: securityEvents.slice(0, 10).map(event => ({
        timestamp: event.timestamp,
        type: event.operation,
        playerId: event.playerId,
        severity: event.metadata?.severity || 'medium'
      }))
    };
  }

  private static validateInput(operation: string, data: any): { isValid: boolean; errors: string[]; sanitizedData?: any } {
    switch (operation) {
      case 'add':
        return TaskQueueInputValidator.validateTask(data);
      case 'remove':
      case 'reorder':
      case 'stop':
      case 'pause':
      case 'resume':
      case 'clear':
        return TaskQueueInputValidator.validateQueueOperation(operation, data.playerId, data);
      default:
        return { isValid: false, errors: [`Unknown operation: ${operation}`] };
    }
  }

  private static getRequiredPermission(operation: string): string {
    const permissionMap: Record<string, string> = {
      'add': 'queue:write',
      'remove': 'queue:write',
      'reorder': 'queue:write',
      'stop': 'queue:write',
      'pause': 'queue:write',
      'resume': 'queue:write',
      'clear': 'queue:write',
      'view': 'queue:read'
    };

    return permissionMap[operation] || 'queue:read';
  }

  private static getOperationSeverity(operation: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'view_player_queue': 'low',
      'modify_player_queue': 'medium',
      'delete_player_queue': 'high',
      'system_maintenance': 'critical'
    };

    return severityMap[operation] || 'medium';
  }

  private static async logSecurityEvent(
    eventType: string,
    playerId: string,
    details: Record<string, any>,
    context: SecurityContext
  ): Promise<void> {
    TaskQueueAuditLogger.logOperation({
      type: eventType,
      playerId,
      details,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      success: false,
      metadata: { security: true }
    });
  }
}

interface SecurityContext {
  token: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface SecurityValidationResult {
  success: boolean;
  error?: string;
  details?: string[];
  statusCode?: number;
  retryAfter?: number;
  sanitizedData?: any;
  playerId?: string;
}

interface SecurityStatus {
  timestamp: number;
  securityEvents: number;
  failedOperations: number;
  rateLimitViolations: number;
  suspiciousActivities: number;
  authenticationFailures: number;
  validationFailures: number;
  recentAlerts: Array<{
    timestamp: number;
    type: string;
    playerId: string;
    severity: string;
  }>;
}