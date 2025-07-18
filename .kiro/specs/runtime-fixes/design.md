# Design Document

## Overview

This design addresses runtime issues preventing the Steampunk Idle Game from starting successfully and implements a robust server-side architecture for true idle game functionality. The analysis reveals several potential failure points in the application startup process, including authentication initialization, Redux store configuration, component rendering, and service dependencies. Additionally, the design establishes a continuous background processing system using ECS Fargate to maintain idle game mechanics.

## Architecture

### Error Boundary Implementation
- Implement React Error Boundaries at strategic levels to catch and handle runtime errors gracefully
- Create a global error boundary wrapper around the main App component
- Add specific error boundaries for major feature sections (Auth, Game Dashboard, Marketplace)

### Service Initialization Strategy
- Implement a service health check system to verify external dependencies before component rendering
- Add fallback mechanisms for when services are unavailable
- Create a startup sequence that initializes services in the correct order

### State Management Resilience
- Add error handling to Redux actions and reducers
- Implement state validation to prevent invalid states from causing crashes
- Add recovery mechanisms for corrupted or missing state data

### ECS Fargate Game Engine Architecture
- Deploy a containerized Node.js service on ECS Fargate for continuous background processing
- Implement REST API endpoints for client-server communication
- Process all player task queues every second for real-time idle game mechanics
- Auto-scaling configuration to handle varying player loads
- Health checks and automatic container replacement for high availability

### Client-Server Synchronization
- Hybrid architecture with server-first approach and local fallback
- Real-time synchronization between browser client and Fargate service
- Graceful degradation when server is unavailable
- Automatic reconnection and state synchronization when server becomes available

## Components and Interfaces

### Error Boundary Components

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error}>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}
```

### Service Health Check Interface

```typescript
interface ServiceHealthCheck {
  serviceName: string;
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
}

interface StartupStatus {
  isReady: boolean;
  services: ServiceHealthCheck[];
  errors: string[];
}
```

### Safe Component Wrapper

```typescript
interface SafeComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorMessage?: string;
}
```

### Server Task Queue Interface

```typescript
interface ServerTaskQueue {
  currentTask: Task | null;
  queueLength: number;
  queuedTasks: Task[];
  isRunning: boolean;
  totalCompleted: number;
}

interface Task {
  id: string;
  type: 'HARVESTING' | 'COMBAT' | 'CRAFTING';
  name: string;
  description: string;
  icon: string;
  duration: number;
  startTime: number;
  playerId: string;
  activityData: any;
  completed: boolean;
  rewards?: TaskReward[];
}

interface TaskReward {
  type: 'resource' | 'experience' | 'currency' | 'item';
  itemId?: string;
  quantity: number;
  rarity?: string;
  isRare?: boolean;
}
```

### Fargate Service Interface

```typescript
interface GameEngineStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  activeQueues: number;
  uptime: number;
}

interface TaskQueueSyncRequest {
  playerId: string;
  action: 'sync' | 'addTask' | 'stopTasks';
  task?: Task;
}
```

## Data Models

### Error Tracking
- Runtime errors will be categorized by type (Authentication, Network, Component, State)
- Error context will include component stack, user actions, and system state
- Recovery actions will be logged and tracked for effectiveness

### Service Status
- Each external service will have a health status tracked in application state
- Service failures will be logged with timestamps and error details
- Recovery attempts will be tracked and rate-limited

## Error Handling

### Authentication Errors
- Handle token expiration gracefully without crashing
- Provide clear feedback when authentication services are unavailable
- Implement automatic retry logic with exponential backoff

### Network Errors
- Catch and handle API call failures
- Implement offline mode detection and appropriate UI states
- Add request timeout handling and retry mechanisms

### Component Rendering Errors
- Use Error Boundaries to catch component rendering failures
- Provide meaningful error messages to users
- Implement component-level recovery mechanisms

### State Management Errors
- Validate Redux state before rendering components
- Handle missing or corrupted state data gracefully
- Implement state recovery from localStorage or default values

## Testing Strategy

### Error Simulation
- Create test utilities to simulate various error conditions
- Test error boundaries with different types of component failures
- Verify graceful degradation when services are unavailable

### Integration Testing
- Test the complete startup sequence under various conditions
- Verify error recovery mechanisms work as expected
- Test offline/online transitions and service recovery

### User Experience Testing
- Ensure error messages are user-friendly and actionable
- Test that the application remains usable even with partial failures
- Verify that recovery mechanisms don't interfere with normal operation

## UI Design Constraints

### Single Progress Bar Principle
- **CRITICAL CONSTRAINT**: The application SHALL maintain only one progress bar at any time
- **ABSOLUTE RULE**: NO additional progress bars SHALL EVER be created under any circumstances
- All task progress, loading states, and activity indicators MUST use the unified progress system
- The ONLY progress bar is located in the AppHeader as the UnifiedProgressBar component
- New features MUST NOT introduce additional progress bars or progress indicators
- Any attempt to create additional progress bars MUST be immediately rejected and removed

### Progress Bar Implementation
- Use the existing progress bar in the `live-activity-section` for all progress display
- Task queue service provides progress updates through callbacks
- Progress bar shows current active task completion percentage
- Multiple queued tasks are indicated by queue count, not additional progress bars

### Design Enforcement
- Code reviews MUST check for additional progress bar implementations
- Any new progress-related UI MUST integrate with the existing unified system
- Progress indicators in modals or components MUST use text-based status instead of bars

## Implementation Approach

### Phase 1: Error Boundaries
- Implement global and component-level error boundaries
- Add error logging and reporting mechanisms
- Create fallback UI components for error states

### Phase 2: ECS Fargate Game Engine
- Deploy containerized Node.js service on ECS Fargate for 24/7 operation
- Implement REST API endpoints for task queue management
- Create continuous background processing of all player queues
- Set up auto-scaling and health monitoring for high availability

### Phase 3: Client-Server Integration
- Implement hybrid client-server task queue synchronization
- Add fallback mechanisms for offline/local processing
- Create real-time progress updates from server to client
- Implement automatic reconnection and state synchronization

### Phase 4: State Resilience
- Add state validation and recovery
- Implement graceful degradation for missing data
- Add error handling to all Redux actions
- Ensure seamless transitions between server and local modes

### Phase 5: User Experience
- Improve error messages and user feedback
- Add loading states and progress indicators (text-based only)
- Implement retry mechanisms and recovery options
- Ensure consistent experience across server and local modes