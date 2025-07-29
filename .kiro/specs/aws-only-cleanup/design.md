# AWS-Only Codebase Cleanup Design

## Overview

This design document outlines the systematic approach to removing all local development infrastructure from the Steampunk Idle Game codebase, ensuring a clean AWS-only architecture.

## Architecture

### Current State Analysis

The codebase currently contains:
- Local development server (gameEngine.local.js)
- Mock services and fallback mechanisms
- Local storage implementations
- Development-specific UI components
- Local environment configurations
- Mixed local/AWS service integrations

### Target State

The cleaned codebase will have:
- AWS-only service integrations
- Direct connections to AWS resources (DynamoDB, Lambda, API Gateway, etc.)
- Streamlined configuration for AWS environments only
- Production-focused error handling and monitoring
- Simplified deployment pipeline

## Components and Interfaces

### Files to Remove

#### Local Development Server Files
- `src/server/gameEngine.local.js` - Local development game engine
- Any local server configuration files

#### Mock Services
- `src/services/mockCharacterService.ts` - Mock character service
- `src/services/mockApiService.ts` - Mock API service
- `src/services/devServiceManager.ts` - Development service manager
- Any other mock service implementations

#### Development-Only Components
- `src/components/dev/ServiceHealthIndicator.*` - Local service health indicator
- `src/components/common/AppHeaderDebug.tsx` - Debug header for local development
- Development-specific UI components

#### Local Development Specs
- `.kiro/specs/local-development-fixes/` - Entire local development spec directory

### Services to Clean

#### ServerTaskQueueService
- Remove `useLocalFallback` flag and all related logic
- Remove local fallback mechanisms
- Remove localStorage usage
- Ensure all methods connect directly to AWS services

#### TaskQueueService
- Remove localStorage fallback in development mode
- Remove local database simulation
- Ensure all persistence goes through AWS DynamoDB

#### EnvironmentService
- Remove local development environment detection
- Simplify to only handle AWS environments (staging, production)
- Remove localhost URL configurations

#### DatabaseService
- Remove any in-memory database implementations
- Ensure all operations use AWS DynamoDB
- Remove local development connection logic

### Configuration Changes

#### Package.json
- Remove local development scripts (`start:server:local`, `dev`)
- Remove development-only dependencies
- Keep only AWS deployment and testing scripts

#### Environment Variables
- Remove local development environment variables
- Ensure all configurations point to AWS resources
- Remove localhost endpoints

## Data Models

### Service Integration Model

```typescript
// Before (with local fallback)
interface ServiceConfig {
  useLocal: boolean;
  localEndpoint?: string;
  awsEndpoint: string;
  fallbackEnabled: boolean;
}

// After (AWS-only)
interface ServiceConfig {
  awsEndpoint: string;
  region: string;
  environment: 'staging' | 'production';
}
```

### Error Handling Model

```typescript
// Before (with local fallback)
interface ErrorResponse {
  error: string;
  fallbackUsed?: boolean;
  localServiceAvailable?: boolean;
}

// After (AWS-only)
interface ErrorResponse {
  error: string;
  awsService: string;
  region: string;
  retryable: boolean;
}
```

## Error Handling

### AWS Service Failures
- Implement proper AWS service error handling
- Add retry logic for transient AWS failures
- Implement circuit breaker patterns for AWS services
- Add comprehensive logging for AWS service interactions

### Network Connectivity
- Handle AWS service connectivity issues
- Implement exponential backoff for AWS API calls
- Add proper timeout handling for AWS services

## Testing Strategy

### Integration Testing
- Update all integration tests to use AWS services
- Remove local service mocking that doesn't represent AWS behavior
- Add AWS service integration tests

### Unit Testing
- Update unit tests to remove local development scenarios
- Focus tests on AWS service interactions
- Add tests for AWS error handling scenarios

### End-to-End Testing
- Ensure E2E tests run against AWS infrastructure
- Remove local development E2E test scenarios
- Add AWS-specific E2E test cases

## Deployment Considerations

### Build Process
- Remove local development build targets
- Ensure builds only target AWS deployment
- Update Docker configurations for AWS deployment only

### CI/CD Pipeline
- Remove local development pipeline steps
- Focus pipeline on AWS deployment stages
- Add AWS service health checks to deployment process

### Monitoring and Logging
- Remove local development monitoring
- Ensure all monitoring uses AWS CloudWatch
- Add AWS-specific alerting and metrics

## Migration Steps

### Phase 1: Remove Local Files
1. Delete local development server files
2. Remove mock service files
3. Delete development-only components
4. Remove local development specs

### Phase 2: Clean Services
1. Remove local fallback logic from services
2. Update service configurations for AWS-only
3. Remove localStorage usage
4. Update error handling for AWS services

### Phase 3: Update Configuration
1. Clean package.json scripts and dependencies
2. Update environment configurations
3. Remove local development environment variables
4. Update API endpoint configurations

### Phase 4: Update Tests
1. Remove local development tests
2. Update integration tests for AWS services
3. Add AWS-specific test scenarios
4. Update test configurations

### Phase 5: Validate and Deploy
1. Test AWS-only deployment
2. Validate all functionality works with AWS services
3. Update documentation
4. Deploy to staging for validation