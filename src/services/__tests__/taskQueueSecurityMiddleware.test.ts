import { TaskQueueSecurityMiddleware } from '../taskQueueSecurityMiddleware';
import { TaskQueueTokenManager } from '../taskQueueSecurity';
import { Task, TaskType } from '../../types/taskQueue';

describe('TaskQueueSecurityMiddleware', () => {
  let validToken: string;
  let adminToken: string;

  beforeEach(() => {
    // Clear all security state before each test
    (TaskQueueTokenManager as any).tokens.clear();
    
    // Generate valid tokens for testing
    const playerSession = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read', 'queue:write']);
    validToken = playerSession.token;

    const adminSession = TaskQueueTokenManager.generateSessionToken('admin-456', ['admin:modify_player_queue', 'admin:view_player_queue']);
    adminToken = adminSession.token;
  });

  describe('validateOperation', () => {
    const validContext = {
      token: '',
      ipAddress: '192.168.1.1',
      userAgent: 'Test Browser',
      sessionId: 'session-123'
    };

    it('should validate correct operation', async () => {
      const taskData: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting' as TaskType,
        name: 'Harvest Wood',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { ...validContext, token: validToken }
      );

      expect(result.success).toBe(true);
      expect(result.sanitizedData).toBeDefined();
      expect(result.playerId).toBe('player-123');
    });

    it('should reject operation with invalid token', async () => {
      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        {},
        { ...validContext, token: 'invalid-token' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.statusCode).toBe(401);
    });

    it('should reject operation exceeding rate limit', async () => {
      const taskData: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting' as TaskType,
        name: 'Harvest Wood',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      // Exceed rate limit by making too many requests
      for (let i = 0; i < 11; i++) {
        await TaskQueueSecurityMiddleware.validateOperation(
          'add',
          'player-123',
          taskData,
          { ...validContext, token: validToken }
        );
      }

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { ...validContext, token: validToken }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(result.statusCode).toBe(429);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reject operation with invalid input', async () => {
      const invalidTaskData = {
        id: 'task<script>alert("xss")</script>',
        type: 'invalid-type',
        name: '',
        playerId: 'player-123',
        duration: -1000,
        priority: 15
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        invalidTaskData,
        { ...validContext, token: validToken }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
      expect(result.statusCode).toBe(400);
      expect(result.details).toBeDefined();
      expect(result.details!.length).toBeGreaterThan(0);
    });

    it('should handle insufficient permissions', async () => {
      // Create token with only read permissions
      const readOnlySession = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read']);
      
      const taskData: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting' as TaskType,
        name: 'Harvest Wood',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { ...validContext, token: readOnlySession.token }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.statusCode).toBe(401);
    });

    it('should sanitize input data', async () => {
      const taskData: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting' as TaskType,
        name: 'Harvest <script>alert("xss")</script> Wood',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { ...validContext, token: validToken }
      );

      expect(result.success).toBe(true);
      expect(result.sanitizedData?.name).toBe('Harvest alert(xss) Wood');
    });
  });

  describe('validateAdminOperation', () => {
    const adminContext = {
      token: '',
      ipAddress: '192.168.1.100',
      userAgent: 'Admin Browser',
      sessionId: 'admin-session-123',
      adminLevel: 'moderator'
    };

    it('should validate correct admin operation', async () => {
      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'view_player_queue',
        'admin-456',
        'player-123',
        { action: 'view' },
        { ...adminContext, token: adminToken }
      );

      expect(result.success).toBe(true);
      expect(result.playerId).toBe('admin-456');
    });

    it('should reject admin operation with invalid token', async () => {
      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'view_player_queue',
        'admin-456',
        'player-123',
        { action: 'view' },
        { ...adminContext, token: 'invalid-admin-token' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin authentication failed');
      expect(result.statusCode).toBe(403);
    });

    it('should reject admin operation with insufficient permissions', async () => {
      // Create admin token without required permission
      const limitedAdminSession = TaskQueueTokenManager.generateSessionToken('admin-456', ['admin:view_player_queue']);
      
      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'modify_player_queue',
        'admin-456',
        'player-123',
        { action: 'clear' },
        { ...adminContext, token: limitedAdminSession.token }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin authentication failed');
      expect(result.statusCode).toBe(403);
    });

    it('should apply admin-specific rate limiting', async () => {
      // Exceed admin rate limit
      for (let i = 0; i < 31; i++) {
        await TaskQueueSecurityMiddleware.validateAdminOperation(
          'view_player_queue',
          'admin-456',
          'player-123',
          { action: 'view' },
          { ...adminContext, token: adminToken }
        );
      }

      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'view_player_queue',
        'admin-456',
        'player-123',
        { action: 'view' },
        { ...adminContext, token: adminToken }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin rate limit exceeded');
      expect(result.statusCode).toBe(429);
    });
  });

  describe('getSecurityStatus', () => {
    it('should return security status', async () => {
      // Generate some security events
      await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        { invalid: 'data' },
        { token: 'invalid-token', sessionId: 'test' }
      );

      const status = TaskQueueSecurityMiddleware.getSecurityStatus();

      expect(status.timestamp).toBeGreaterThan(0);
      expect(status.securityEvents).toBeGreaterThanOrEqual(0);
      expect(status.failedOperations).toBeGreaterThanOrEqual(0);
      expect(status.authenticationFailures).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(status.recentAlerts)).toBe(true);
    });

    it('should track different types of security events', async () => {
      // Create authentication failure
      await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        {},
        { token: 'invalid-token', sessionId: 'test' }
      );

      // Create validation failure
      await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        { invalid: 'data' },
        { token: validToken, sessionId: 'test' }
      );

      const status = TaskQueueSecurityMiddleware.getSecurityStatus();

      expect(status.authenticationFailures).toBeGreaterThan(0);
      expect(status.validationFailures).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle middleware errors gracefully', async () => {
      // Mock an error in the validation process
      const originalValidateToken = TaskQueueTokenManager.validateToken;
      TaskQueueTokenManager.validateToken = jest.fn().mockImplementation(() => {
        throw new Error('Mock validation error');
      });

      const result = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        {},
        { token: validToken, sessionId: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Security validation failed');
      expect(result.statusCode).toBe(500);

      // Restore original function
      TaskQueueTokenManager.validateToken = originalValidateToken;
    });

    it('should handle admin middleware errors gracefully', async () => {
      // Mock an error in the admin validation process
      const originalValidateToken = TaskQueueTokenManager.validateToken;
      TaskQueueTokenManager.validateToken = jest.fn().mockImplementation(() => {
        throw new Error('Mock admin validation error');
      });

      const result = await TaskQueueSecurityMiddleware.validateAdminOperation(
        'view_player_queue',
        'admin-456',
        'player-123',
        {},
        { token: adminToken, sessionId: 'test', adminLevel: 'moderator' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin security validation failed');
      expect(result.statusCode).toBe(500);

      // Restore original function
      TaskQueueTokenManager.validateToken = originalValidateToken;
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete security workflow', async () => {
      const taskData: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting' as TaskType,
        name: 'Harvest Wood',
        playerId: 'player-123',
        duration: 30000,
        priority: 5
      };

      // Valid operation should succeed
      const result1 = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { token: validToken, sessionId: 'test' }
      );
      expect(result1.success).toBe(true);

      // Rate limited operation should fail
      for (let i = 0; i < 10; i++) {
        await TaskQueueSecurityMiddleware.validateOperation(
          'add',
          'player-123',
          taskData,
          { token: validToken, sessionId: 'test' }
        );
      }

      const result2 = await TaskQueueSecurityMiddleware.validateOperation(
        'add',
        'player-123',
        taskData,
        { token: validToken, sessionId: 'test' }
      );
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Rate limit exceeded');

      // Security status should reflect the events
      const status = TaskQueueSecurityMiddleware.getSecurityStatus();
      expect(status.rateLimitViolations).toBeGreaterThan(0);
    });
  });
});