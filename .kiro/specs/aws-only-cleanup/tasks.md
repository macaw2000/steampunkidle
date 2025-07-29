# AWS-Only Codebase Cleanup Implementation Plan

## Phase 1: Remove Local Development Files

- [ ] 1.1 Delete local development server files
  - Remove `src/server/gameEngine.local.js`
  - Remove any local server configuration files
  - _Requirements: 1.1, 1.3_

- [ ] 1.2 Remove mock service files
  - Delete `src/services/mockCharacterService.ts`
  - Delete `src/services/mockApiService.ts`
  - Delete `src/services/devServiceManager.ts`
  - Remove any other mock service implementations
  - _Requirements: 2.1, 2.2_

- [ ] 1.3 Delete development-only components
  - Remove `src/components/dev/ServiceHealthIndicator.*`
  - Remove `src/components/common/AppHeaderDebug.tsx`
  - Remove other development-specific UI components
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 1.4 Remove local development specs
  - Delete `.kiro/specs/local-development-fixes/` directory
  - Remove references to local development in other specs
  - _Requirements: 5.1, 5.2_

## Phase 2: Clean Service Implementations

- [ ] 2.1 Clean ServerTaskQueueService
  - Remove `useLocalFallback` flag and all related logic
  - Remove local fallback mechanisms in all methods
  - Remove localStorage usage
  - Ensure all methods connect directly to AWS services
  - _Requirements: 2.2, 2.3, 7.1_

- [ ] 2.2 Clean TaskQueueService
  - Remove localStorage fallback in development mode
  - Remove local database simulation
  - Ensure all persistence goes through AWS DynamoDB
  - Remove `loadPlayerQueue` localStorage logic
  - _Requirements: 2.3, 2.4, 7.3_

- [ ] 2.3 Clean EnvironmentService
  - Remove local development environment detection
  - Simplify to only handle AWS environments (staging, production)
  - Remove localhost URL configurations
  - Update environment variable handling
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2.4 Clean DatabaseService
  - Remove any in-memory database implementations
  - Ensure all operations use AWS DynamoDB
  - Remove local development connection logic
  - Update error handling for AWS-only scenarios
  - _Requirements: 2.4, 7.3_

## Phase 3: Update Configuration and Dependencies

- [ ] 3.1 Clean package.json
  - Remove local development scripts (`start:server:local`, `dev`)
  - Remove development-only dependencies (concurrently if only used for local dev)
  - Keep only AWS deployment and testing scripts
  - Update script descriptions to reflect AWS-only deployment
  - _Requirements: 1.2, 1.4, 6.1, 6.2, 6.3_

- [ ] 3.2 Update environment configurations
  - Remove local development environment variables
  - Ensure all configurations point to AWS resources
  - Remove localhost endpoints from all configuration files
  - Update API URL defaults to AWS endpoints
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 3.3 Clean service integrations
  - Remove conditional logic for local vs AWS environments
  - Update API clients to remove local endpoint configurations
  - Remove local database fallbacks
  - Remove local WebSocket server references
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

## Phase 4: Update Tests and Remove Local Development Tests

- [ ] 4.1 Remove local development test files
  - Remove tests for local development scenarios
  - Delete test files that only test mock services
  - Remove local development test configurations
  - Remove local development test helpers
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 4.2 Update integration tests
  - Update integration tests to use AWS services
  - Remove local service mocking that doesn't represent AWS behavior
  - Add AWS-specific integration test scenarios
  - Update test configurations for AWS-only testing
  - _Requirements: 8.2, 8.3_

- [ ] 4.3 Update unit tests
  - Remove unit tests for local development features
  - Update existing unit tests to remove local development logic
  - Add unit tests for AWS error handling scenarios
  - Ensure all tests focus on AWS service interactions
  - _Requirements: 8.1, 8.4_

## Phase 5: Update Build and Deployment

- [ ] 5.1 Clean build scripts
  - Remove local development build targets
  - Update Docker configurations for AWS deployment only
  - Remove local development specific build steps
  - Ensure builds only target AWS deployment
  - _Requirements: 9.1, 9.4_

- [ ] 5.2 Update deployment scripts
  - Remove local development deployment configurations
  - Ensure deployment scripts only target AWS
  - Update CI/CD configurations to remove local development steps
  - Add AWS service health checks to deployment process
  - _Requirements: 9.2, 9.3_

- [ ] 5.3 Update documentation
  - Remove local development setup instructions
  - Update README files to only reference AWS deployment
  - Update deployment guides to only include AWS instructions
  - Remove references to local development in all documentation
  - _Requirements: 5.2, 5.3, 5.4_

## Phase 6: Validation and Testing

- [ ] 6.1 Validate AWS-only deployment
  - Deploy application to AWS staging environment
  - Verify all functionality works without local dependencies
  - Test all service integrations with AWS resources
  - Validate error handling for AWS service failures
  - _Requirements: 10.1, 10.2_

- [ ] 6.2 Run comprehensive testing
  - Execute all tests using only AWS services
  - Verify no tests reference local services or fallback mechanisms
  - Test error scenarios with AWS services
  - Validate monitoring and alerting works with AWS-only setup
  - _Requirements: 10.2, 10.3, 10.4, 10.5_

- [ ] 6.3 Performance and monitoring validation
  - Verify AWS-based monitoring and alerting works correctly
  - Test application performance with AWS-only architecture
  - Validate logging shows no references to local services
  - Ensure error handling only uses AWS-based error paths
  - _Requirements: 10.3, 10.4, 10.5_

## Phase 7: Final Cleanup and Documentation

- [ ] 7.1 Final code review
  - Review entire codebase for any remaining local development references
  - Ensure no localhost URLs or local service references remain
  - Verify all environment variables point to AWS resources
  - Check that all error messages reference AWS services appropriately
  - _Requirements: 10.1, 10.3_

- [ ] 7.2 Update project documentation
  - Update main README with AWS-only setup instructions
  - Update architecture documentation to reflect AWS-only design
  - Create deployment guide focused on AWS infrastructure
  - Document AWS service dependencies and configurations
  - _Requirements: 5.2, 5.3, 5.4_

- [ ] 7.3 Production deployment validation
  - Deploy cleaned codebase to production environment
  - Monitor for any issues related to removed local development code
  - Validate all AWS service integrations work in production
  - Confirm monitoring and alerting functions correctly
  - _Requirements: 10.1, 10.5_