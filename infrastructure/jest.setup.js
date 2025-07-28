// Jest setup for infrastructure tests
// Mock AWS SDK calls to prevent actual AWS API calls during testing

// Mock AWS CDK context
process.env.CDK_DEFAULT_ACCOUNT = '123456789012';
process.env.CDK_DEFAULT_REGION = 'us-east-1';

// Suppress CDK warnings during tests
process.env.CDK_DISABLE_VERSION_CHECK = '1';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce test output noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep errors visible
  info: jest.fn(),
  debug: jest.fn(),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});