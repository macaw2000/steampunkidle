module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/lambda'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/lambda/**/*.ts',
    '!src/lambda/**/__tests__/**',
    '!src/lambda/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/lambda/jest.setup.ts'],
};