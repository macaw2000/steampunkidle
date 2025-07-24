import {
  TaskQueueInputValidator,
  TaskQueueRateLimiter,
  TaskQueueAuditLogger,
  TaskQueueEncryption,
  TaskQueueTokenManager
} from '../taskQueueSecurity';

// Mock crypto module for testing
jest.mock('crypto', () => ({
  createCipher: jest.fn(() => ({
    update: jest.fn(() => 'encrypted'),
    final: jest.fn(() => 'data'),
    getAuthTag: jest.fn(() => Buffer.from('tag'))
  })),
  createDecipher: jest.fn(() => ({
    setAuthTag: jest.fn(),
    update: jest.fn(() => '{"test":'),
    final: jest.fn(() => '"data"}')
  })),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'hash123')
  })),
  randomBytes: jest.fn(() => Buffer.from('random'))
}));

interface Task {
  id: string;
  type: 'harvesting' | 'crafting' | 'combat';
  name: string;
  description: string;
  icon: string;
  duration: number;
  startTime: number;
  playerId: string;
  activityData: any;
  prerequisites: any[];
  resourceRequirements: any[];
  progress: number;
  completed: boolean;
  rewards: any[];
  priority: number;
  estimatedCompletion: number;
  retryCount: number;
  maxRetries: number;
}

describe('TaskQueueInputValidator', () => {
  describe('validateTask', () => {
    it('should validate a correct task', () => {
      const task: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Harvest Wood',
        playerId: 'player-456',
        duration: 30000,
        priority: 5
      };

      const result = TaskQueueInputValidator.validateTask(task);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedTask).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should reject task with invalid ID', () => {
      const task: Partial<Task> = {
        id: 'task<script>alert("xss")</script>',
        type: 'harvesting',
        name: 'Harvest Wood',
        playerId: 'player-456',
        duration: 30000,
        priority: 5
      };

      const result = TaskQueueInputValidator.validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task ID contains invalid characters');
    });

    it('should reject task with excessive duration', () => {
      const task: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Harvest Wood',
        playerId: 'player-456',
        duration: 25 * 60 * 60 * 1000, // 25 hours
        priority: 5
      };

      const result = TaskQueueInputValidator.validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task duration cannot exceed 86400000ms (24 hours)');
    });

    it('should sanitize task name', () => {
      const task: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Harvest <script>alert("xss")</script> Wood',
        playerId: 'player-456',
        duration: 30000,
        priority: 5
      };

      const result = TaskQueueInputValidator.validateTask(task);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedTask?.name).toBe('Harvest alert(xss) Wood');
    });

    it('should validate priority range', () => {
      const task: Partial<Task> = {
        id: 'task-123',
        type: 'harvesting',
        name: 'Harvest Wood',
        playerId: 'player-456',
        duration: 30000,
        priority: 15 // Invalid priority
      };

      const result = TaskQueueInputValidator.validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task priority must be a number between 0 and 10');
    });
  });

  describe('validateQueueOperation', () => {
    it('should validate correct queue operation', () => {
      const result = TaskQueueInputValidator.validateQueueOperation('add', 'player-123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid operation', () => {
      const result = TaskQueueInputValidator.validateQueueOperation('invalid-op', 'player-123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid operation: invalid-op');
    });

    it('should reject invalid player ID', () => {
      const result = TaskQueueInputValidator.validateQueueOperation('add', 'player<script>');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid player ID is required');
    });
  });
});

describe('TaskQueueRateLimiter', () => {
  beforeEach(() => {
    // Clear rate limit data before each test
    (TaskQueueRateLimiter as any).rateLimits.clear();
  });

  describe('isOperationAllowed', () => {
    it('should allow operations within rate limit', () => {
      const result = TaskQueueRateLimiter.isOperationAllowed('player-123', 'add');
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block operations exceeding rate limit', () => {
      const playerId = 'player-123';
      
      // Exceed the rate limit for add operations (10 per minute)
      for (let i = 0; i < 11; i++) {
        TaskQueueRateLimiter.isOperationAllowed(playerId, 'add');
      }

      const result = TaskQueueRateLimiter.isOperationAllowed(playerId, 'add');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should have different limits for different operations', () => {
      const playerId = 'player-123';
      
      // Add operations have lower limit (10/min)
      for (let i = 0; i < 10; i++) {
        const result = TaskQueueRateLimiter.isOperationAllowed(playerId, 'add');
        expect(result.allowed).toBe(true);
      }
      
      const addResult = TaskQueueRateLimiter.isOperationAllowed(playerId, 'add');
      expect(addResult.allowed).toBe(false);

      // Other operations have higher limit (30/min)
      const removeResult = TaskQueueRateLimiter.isOperationAllowed(playerId, 'remove');
      expect(removeResult.allowed).toBe(true);
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect excessive operation rates', () => {
      const playerId = 'player-123';
      
      // Simulate excessive operations
      for (let i = 0; i < 70; i++) {
        TaskQueueRateLimiter.isOperationAllowed(playerId, 'remove');
      }

      const result = TaskQueueRateLimiter.detectSuspiciousActivity(playerId);
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('Excessive operation rate detected');
    });

    it('should not flag normal usage as suspicious', () => {
      const playerId = 'player-123';
      
      // Normal usage
      for (let i = 0; i < 5; i++) {
        TaskQueueRateLimiter.isOperationAllowed(playerId, 'add');
      }

      const result = TaskQueueRateLimiter.detectSuspiciousActivity(playerId);
      expect(result.suspicious).toBe(false);
    });
  });
});

describe('TaskQueueAuditLogger', () => {
  beforeEach(() => {
    // Clear audit logs before each test
    (TaskQueueAuditLogger as any).auditLogs.length = 0;
  });

  describe('logOperation', () => {
    it('should log operation successfully', () => {
      TaskQueueAuditLogger.logOperation({
        type: 'add',
        playerId: 'player-123',
        details: { taskId: 'task-456' },
        success: true
      });

      const logs = TaskQueueAuditLogger.getPlayerAuditLogs('player-123');
      expect(logs).toHaveLength(1);
      expect(logs[0].operation).toBe('add');
      expect(logs[0].success).toBe(true);
    });

    it('should log failed operations with error messages', () => {
      TaskQueueAuditLogger.logOperation({
        type: 'add',
        playerId: 'player-123',
        details: { taskId: 'task-456' },
        success: false,
        errorMessage: 'Validation failed'
      });

      const logs = TaskQueueAuditLogger.getPlayerAuditLogs('player-123');
      expect(logs[0].success).toBe(false);
      expect(logs[0].errorMessage).toBe('Validation failed');
    });
  });

  describe('logAdminAction', () => {
    it('should log admin actions with elevated details', () => {
      TaskQueueAuditLogger.logAdminAction({
        type: 'modify_player_queue',
        adminId: 'admin-123',
        targetPlayerId: 'player-456',
        adminLevel: 'moderator',
        details: { action: 'clear_queue' },
        success: true
      });

      const logs = TaskQueueAuditLogger.getPlayerAuditLogs('admin-123');
      expect(logs[0].operation).toBe('admin:modify_player_queue');
      expect(logs[0].details.targetPlayerId).toBe('player-456');
      expect(logs[0].metadata?.isAdminAction).toBe(true);
    });
  });

  describe('getSecurityEvents', () => {
    it('should filter security-related events', () => {
      TaskQueueAuditLogger.logOperation({
        type: 'rate_limit_exceeded',
        playerId: 'player-123',
        details: {},
        success: false
      });

      TaskQueueAuditLogger.logOperation({
        type: 'add',
        playerId: 'player-123',
        details: {},
        success: true
      });

      const securityEvents = TaskQueueAuditLogger.getSecurityEvents(24);
      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0].operation).toBe('rate_limit_exceeded');
    });
  });
});

describe('TaskQueueEncryption', () => {
  describe('encryptTaskData and decryptTaskData', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = {
        playerId: 'player-123',
        sensitiveInfo: 'secret-data',
        nested: { value: 42 }
      };

      const encrypted = TaskQueueEncryption.encryptTaskData(originalData);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = TaskQueueEncryption.decryptTaskData(encrypted);
      expect(decrypted).toEqual(originalData);
    });

    it('should fail decryption with tampered data', () => {
      const originalData = { test: 'data' };
      const encrypted = TaskQueueEncryption.encryptTaskData(originalData);
      
      // Tamper with encrypted data
      encrypted.encryptedData = encrypted.encryptedData.slice(0, -2) + 'xx';

      expect(() => {
        TaskQueueEncryption.decryptTaskData(encrypted);
      }).toThrow('Decryption failed');
    });
  });

  describe('hashData', () => {
    it('should generate consistent hashes', () => {
      const data = 'test-data';
      const hash1 = TaskQueueEncryption.hashData(data);
      const hash2 = TaskQueueEncryption.hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different data', () => {
      const hash1 = TaskQueueEncryption.hashData('data1');
      const hash2 = TaskQueueEncryption.hashData('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate tokens of correct length', () => {
      const token = TaskQueueEncryption.generateSecureToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = TaskQueueEncryption.generateSecureToken();
      const token2 = TaskQueueEncryption.generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });
});

describe('TaskQueueTokenManager', () => {
  beforeEach(() => {
    // Clear tokens before each test
    (TaskQueueTokenManager as any).tokens.clear();
  });

  describe('generateSessionToken', () => {
    it('should generate valid session token', () => {
      const token = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read', 'queue:write']);
      
      expect(token.token).toBeDefined();
      expect(token.expiresAt).toBeGreaterThan(Date.now());
      expect(token.permissions).toEqual(['queue:read', 'queue:write']);
    });

    it('should limit tokens per player', () => {
      const playerId = 'player-123';
      
      // Generate maximum allowed tokens
      for (let i = 0; i < 6; i++) {
        TaskQueueTokenManager.generateSessionToken(playerId);
      }

      const playerTokens = TaskQueueTokenManager.getPlayerTokens(playerId);
      expect(playerTokens.length).toBeLessThanOrEqual(5);
    });
  });

  describe('validateToken', () => {
    it('should validate correct token', () => {
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read']);
      const validation = TaskQueueTokenManager.validateToken(sessionToken.token);
      
      expect(validation.valid).toBe(true);
      expect(validation.playerId).toBe('player-123');
    });

    it('should reject invalid token', () => {
      const validation = TaskQueueTokenManager.validateToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token not found');
    });

    it('should check permissions', () => {
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123', ['queue:read']);
      const validation = TaskQueueTokenManager.validateToken(sessionToken.token, 'queue:write');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Insufficient permissions');
    });

    it('should reject expired tokens', async () => {
      // Mock Date.now to simulate token expiry
      const originalNow = Date.now;
      const mockNow = jest.fn();
      Date.now = mockNow;

      mockNow.mockReturnValue(1000000);
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123');
      
      // Simulate time passing beyond token expiry
      mockNow.mockReturnValue(1000000 + 60 * 60 * 1000 + 1000); // 1 hour + 1 second
      
      const validation = TaskQueueTokenManager.validateToken(sessionToken.token);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token expired');

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('revokeToken', () => {
    it('should revoke specific token', () => {
      const sessionToken = TaskQueueTokenManager.generateSessionToken('player-123');
      
      const revoked = TaskQueueTokenManager.revokeToken(sessionToken.token);
      expect(revoked).toBe(true);
      
      const validation = TaskQueueTokenManager.validateToken(sessionToken.token);
      expect(validation.valid).toBe(false);
    });

    it('should revoke all player tokens', () => {
      const playerId = 'player-123';
      TaskQueueTokenManager.generateSessionToken(playerId);
      TaskQueueTokenManager.generateSessionToken(playerId);
      
      const revokedCount = TaskQueueTokenManager.revokePlayerTokens(playerId);
      expect(revokedCount).toBe(2);
      
      const playerTokens = TaskQueueTokenManager.getPlayerTokens(playerId);
      expect(playerTokens).toHaveLength(0);
    });
  });
});