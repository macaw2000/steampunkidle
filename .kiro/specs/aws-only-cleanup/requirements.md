# AWS-Only Codebase Cleanup Requirements

## Introduction

This specification outlines the requirements for cleaning up the Steampunk Idle Game codebase to remove all local development infrastructure, mock services, and local fallback mechanisms. The goal is to create a streamlined, AWS-only architecture that assumes all development, testing, and debugging will occur on AWS infrastructure.

## Requirements

### Requirement 1: Remove Local Development Server

**User Story:** As a developer, I want the codebase to only support AWS deployment so that there's no confusion about where the application should run.

#### Acceptance Criteria

1. WHEN reviewing the codebase THEN there SHALL be no local development server files
2. WHEN examining package.json scripts THEN there SHALL be no local development commands
3. WHEN looking at the server directory THEN there SHALL be no gameEngine.local.js file
4. WHEN checking npm scripts THEN there SHALL be no start:server:local or dev commands that reference local servers

### Requirement 2: Remove Mock Services and Fallback Mechanisms

**User Story:** As a developer, I want all services to connect directly to AWS resources so that local testing doesn't mask production issues.

#### Acceptance Criteria

1. WHEN examining service files THEN there SHALL be no mock service implementations
2. WHEN reviewing serverTaskQueueService THEN there SHALL be no useLocalFallback flags or local fallback logic
3. WHEN checking taskQueueService THEN there SHALL be no localStorage fallback mechanisms
4. WHEN looking at database services THEN there SHALL be no in-memory or local storage implementations
5. WHEN examining authentication services THEN there SHALL be no mock authentication providers

### Requirement 3: Remove Development-Only Components

**User Story:** As a developer, I want to remove development-specific UI components that aren't needed in production.

#### Acceptance Criteria

1. WHEN reviewing components THEN there SHALL be no dev-specific components like ServiceHealthIndicator for local services
2. WHEN examining debug components THEN there SHALL be no local development debugging interfaces
3. WHEN checking AppHeaderDebug THEN there SHALL be no local development status indicators
4. WHEN looking at NetworkStatusIndicator THEN there SHALL be no local connection status checks

### Requirement 4: Clean Up Environment Configuration

**User Story:** As a developer, I want environment configuration to only support AWS environments so that configuration is simplified.

#### Acceptance Criteria

1. WHEN examining environmentService THEN there SHALL be no local development environment detection
2. WHEN reviewing configuration files THEN there SHALL be no local development specific settings
3. WHEN checking API URLs THEN there SHALL be no localhost or local development endpoints
4. WHEN looking at environment variables THEN there SHALL be no local development overrides

### Requirement 5: Remove Local Development Specs and Documentation

**User Story:** As a developer, I want documentation and specs to only reference AWS deployment so that there's no confusion about supported deployment methods.

#### Acceptance Criteria

1. WHEN reviewing specs directory THEN there SHALL be no local-development-fixes spec
2. WHEN examining documentation THEN there SHALL be no references to local development setup
3. WHEN checking README files THEN there SHALL be no local development instructions
4. WHEN looking at deployment guides THEN there SHALL only be AWS deployment instructions

### Requirement 6: Update Package.json Dependencies

**User Story:** As a developer, I want package.json to only include dependencies needed for AWS deployment so that the build is optimized.

#### Acceptance Criteria

1. WHEN examining package.json THEN there SHALL be no development-only dependencies for local servers
2. WHEN reviewing scripts THEN there SHALL be no local development scripts
3. WHEN checking devDependencies THEN there SHALL be no local development tools that aren't needed for AWS deployment
4. WHEN looking at npm scripts THEN there SHALL only be AWS deployment and testing scripts

### Requirement 7: Clean Up Service Integrations

**User Story:** As a developer, I want all service integrations to assume AWS infrastructure so that there are no fallback paths to local services.

#### Acceptance Criteria

1. WHEN examining service files THEN there SHALL be no conditional logic for local vs AWS environments
2. WHEN reviewing API clients THEN there SHALL be no local endpoint configurations
3. WHEN checking database connections THEN there SHALL be no local database fallbacks
4. WHEN looking at WebSocket connections THEN there SHALL be no local WebSocket server references

### Requirement 8: Remove Test Files for Local Development

**User Story:** As a developer, I want test files to only test AWS integrations so that testing is focused on production scenarios.

#### Acceptance Criteria

1. WHEN examining test files THEN there SHALL be no tests for local development scenarios
2. WHEN reviewing integration tests THEN there SHALL be no local service mocking that doesn't represent AWS behavior
3. WHEN checking test configurations THEN there SHALL be no local development test setups
4. WHEN looking at test utilities THEN there SHALL be no local development test helpers

### Requirement 9: Update Build and Deployment Scripts

**User Story:** As a developer, I want build and deployment scripts to only target AWS so that deployment is streamlined.

#### Acceptance Criteria

1. WHEN examining build scripts THEN there SHALL be no local development build targets
2. WHEN reviewing deployment scripts THEN there SHALL only be AWS deployment configurations
3. WHEN checking CI/CD configurations THEN there SHALL be no local development pipeline steps
4. WHEN looking at Docker files THEN there SHALL be no local development specific configurations

### Requirement 10: Validate AWS-Only Architecture

**User Story:** As a developer, I want to ensure the cleaned codebase works correctly with AWS services so that functionality is preserved.

#### Acceptance Criteria

1. WHEN deploying to AWS THEN the application SHALL function correctly without any local dependencies
2. WHEN running tests THEN all tests SHALL pass using only AWS services
3. WHEN examining logs THEN there SHALL be no references to local services or fallback mechanisms
4. WHEN checking error handling THEN there SHALL be no local development error paths
5. WHEN reviewing monitoring THEN there SHALL only be AWS-based monitoring and alerting