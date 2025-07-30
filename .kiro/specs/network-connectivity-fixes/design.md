# Design Document

## Overview

The network connectivity issues in the Steampunk Idle Game stem from the frontend attempting to connect to AWS backend services that are not yet deployed. The current architecture assumes full AWS infrastructure is available, causing health checks to fail and character creation to encounter network errors. This design implements a robust fallback system that allows the application to function gracefully in offline mode while maintaining the ability to connect to AWS services when they become available.

## Architecture

### Current Architecture Issues
1. **Health Check Service**: Located in `src/api/healthCheck.ts`, designed for backend deployment but used in frontend
2. **Network Client**: Attempts to connect to AWS API Gateway endpoints that don't exist
3. **Character Service**: Directly calls AWS services without proper fallback handling
4. **Network Status Indicator**: Shows incorrect status due to failed AWS connectivity tests

### Proposed Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Application                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   App Startup   │  │ Network Status  │  │ Service Health  │  │
│  │   Controller    │  │   Manager       │  │    Monitor      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Adaptive Service│  │  Fallback Data  │  │ Sync Controller │  │
│  │    Layer        │  │    Manager      │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Local Storage Layer                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Services (Optional)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  API Gateway    │  │    DynamoDB     │  │     Cognito     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. App Startup Controller
**Purpose**: Manages application initialization and service availability detection
**Location**: `src/services/appStartupController.ts`

```typescript
interface AppStartupController {
  initializeApp(): Promise<AppInitializationResult>;
  checkServiceAvailability(): Promise<ServiceAvailabilityStatus>;
  determineOperatingMode(): 'online' | 'offline' | 'limited';
}

interface AppInitializationResult {
  success: boolean;
  operatingMode: 'online' | 'offline' | 'limited';
  availableServices: string[];
  errors: string[];
}
```

### 2. Network Status Manager
**Purpose**: Centralized network connectivity monitoring and status reporting
**Location**: `src/services/networkStatusManager.ts`

```typescript
interface NetworkStatusManager {
  getCurrentStatus(): NetworkStatus;
  testConnectivity(): Promise<ConnectivityResult>;
  subscribeToStatusChanges(callback: (status: NetworkStatus) => void): void;
  unsubscribeFromStatusChanges(callback: (status: NetworkStatus) => void): void;
}

interface NetworkStatus {
  isOnline: boolean;
  operatingMode: 'online' | 'offline' | 'limited';
  lastSuccessfulConnection?: Date;
  serviceAvailability: {
    api: boolean;
    database: boolean;
    auth: boolean;
    websocket: boolean;
  };
}
```

### 3. Service Health Monitor
**Purpose**: Monitors individual service health with graceful degradation
**Location**: `src/services/serviceHealthMonitor.ts`

```typescript
interface ServiceHealthMonitor {
  checkAllServices(): Promise<ServiceHealthReport>;
  checkService(serviceName: string): Promise<ServiceHealthResult>;
  getHealthSummary(): ServiceHealthSummary;
}

interface ServiceHealthResult {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  responseTime?: number;
  error?: string;
  fallbackAvailable: boolean;
}
```

### 4. Adaptive Service Layer
**Purpose**: Provides unified interface that automatically switches between AWS and local services
**Location**: `src/services/adaptiveServiceLayer.ts`

```typescript
interface AdaptiveServiceLayer {
  character: AdaptiveCharacterService;
  auth: AdaptiveAuthService;
  taskQueue: AdaptiveTaskQueueService;
}

interface AdaptiveCharacterService {
  createCharacter(request: CreateCharacterRequest): Promise<Character>;
  getCharacter(userId: string): Promise<Character | null>;
  updateCharacter(userId: string, updates: UpdateCharacterRequest): Promise<Character>;
  syncWithServer(): Promise<SyncResult>;
}
```

### 5. Fallback Data Manager
**Purpose**: Manages local storage and data synchronization
**Location**: `src/services/fallbackDataManager.ts`

```typescript
interface FallbackDataManager {
  storeCharacterData(userId: string, character: Character): void;
  getCharacterData(userId: string): Character | null;
  markForSync(dataType: string, id: string): void;
  getPendingSyncItems(): SyncItem[];
  clearSyncedData(items: SyncItem[]): void;
}
```

## Data Models

### Network Status Model
```typescript
interface NetworkStatus {
  isOnline: boolean;
  operatingMode: 'online' | 'offline' | 'limited';
  lastSuccessfulConnection?: Date;
  connectionLatency?: number;
  serviceAvailability: {
    api: boolean;
    database: boolean;
    auth: boolean;
    websocket: boolean;
  };
  error?: string;
}
```

### Service Health Model
```typescript
interface ServiceHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  services: {
    [serviceName: string]: ServiceHealthResult;
  };
  recommendations: string[];
}
```

### Sync Item Model
```typescript
interface SyncItem {
  id: string;
  type: 'character' | 'progress' | 'settings';
  data: any;
  timestamp: Date;
  retryCount: number;
  lastAttempt?: Date;
}
```

## Error Handling

### Error Classification
1. **Network Errors**: Connection timeouts, DNS failures, offline status
2. **Service Errors**: AWS service unavailable, API endpoint not found
3. **Data Errors**: Invalid responses, corrupted local data
4. **Sync Errors**: Conflicts during data synchronization

### Error Recovery Strategies
1. **Immediate Fallback**: Switch to local storage for critical operations
2. **Retry with Backoff**: Exponential backoff for transient network issues
3. **Graceful Degradation**: Disable non-essential features when services unavailable
4. **User Notification**: Clear messaging about current operating mode

### Error Boundaries
- **Network Error Boundary**: Catches and handles all network-related errors
- **Service Error Boundary**: Manages service-specific error recovery
- **Data Error Boundary**: Handles data corruption and validation errors

## Testing Strategy

### Unit Tests
1. **Service Health Monitor**: Test health check logic with mocked AWS services
2. **Network Status Manager**: Test connectivity detection and status reporting
3. **Adaptive Service Layer**: Test fallback behavior and service switching
4. **Fallback Data Manager**: Test local storage operations and sync logic

### Integration Tests
1. **End-to-End Offline Mode**: Test complete application flow without AWS services
2. **Service Recovery**: Test behavior when AWS services become available
3. **Data Synchronization**: Test sync process with various conflict scenarios
4. **Error Recovery**: Test error handling and recovery mechanisms

### Manual Testing Scenarios
1. **Cold Start**: Application startup with no AWS services available
2. **Network Interruption**: Simulate network loss during gameplay
3. **Service Degradation**: Test behavior with partial service availability
4. **Data Migration**: Test sync process when transitioning from offline to online

## Implementation Phases

### Phase 1: Core Infrastructure
- Implement App Startup Controller
- Create Network Status Manager
- Build Service Health Monitor
- Update Network Status Indicator component

### Phase 2: Adaptive Services
- Implement Adaptive Service Layer
- Create Fallback Data Manager
- Update Character Service with fallback logic
- Implement local storage persistence

### Phase 3: Synchronization
- Build Sync Controller
- Implement conflict resolution
- Add background sync capabilities
- Create sync status indicators

### Phase 4: Polish and Optimization
- Improve error messages and user feedback
- Optimize local storage usage
- Add performance monitoring
- Implement advanced retry strategies

## Security Considerations

1. **Local Data Encryption**: Encrypt sensitive data stored locally
2. **Sync Authentication**: Ensure secure authentication during sync operations
3. **Data Validation**: Validate all data before sync to prevent corruption
4. **Privacy Protection**: Avoid storing sensitive information in local storage

## Performance Considerations

1. **Lazy Loading**: Load services only when needed
2. **Connection Pooling**: Reuse connections for AWS service calls
3. **Caching Strategy**: Cache service health status to reduce redundant checks
4. **Background Operations**: Perform sync operations in background threads
5. **Storage Optimization**: Implement efficient local storage management