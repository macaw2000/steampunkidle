# Comprehensive Task Queue Test Suite

This directory contains a comprehensive test suite for the Task Queue System that covers all components, edge cases, and integration scenarios.

## Overview

The test suite is organized into four main categories:

1. **Unit Tests** - Test individual components and functions in isolation
2. **Integration Tests** - Test interactions between components and services
3. **End-to-End Tests** - Test complete user workflows and task lifecycles
4. **Regression Tests** - Test critical functionality to prevent regressions

## Test Structure

```
src/testing/comprehensive/
├── taskQueueTestSuite.ts           # Main test orchestrator
├── runComprehensiveTests.ts        # CLI test runner
├── README.md                       # This documentation
├── __tests__/
│   └── comprehensiveTestSuite.test.ts  # Jest integration
├── unit/
│   └── taskQueueUnitTests.ts       # Unit test implementations
├── integration/
│   └── taskQueueIntegrationTests.ts # Integration test implementations
├── e2e/
│   └── taskQueueE2ETests.ts        # End-to-end test implementations
└── regression/
    └── taskQueueRegressionTests.ts # Regression test implementations
```

## Running Tests

### Using Jest (Recommended)

```bash
# Run all comprehensive tests
npm test -- src/testing/comprehensive/__tests__/comprehensiveTestSuite.test.ts

# Run with coverage
npm run test:coverage -- src/testing/comprehensive/__tests__/comprehensiveTestSuite.test.ts
```

### Using the CLI Runner

```bash
# Run all test categories
npx ts-node src/testing/comprehensive/runComprehensiveTests.ts

# Run specific categories
npx ts-node src/testing/comprehensive/runComprehensiveTests.ts unit integration
npx ts-node src/testing/comprehensive/runComprehensiveTests.ts e2e
npx ts-node src/testing/comprehensive/runComprehensiveTests.ts regression
```

### Using the Test Suite Directly

```typescript
import { taskQueueTestSuite } from './taskQueueTestSuite';

// Run all tests
const results = await taskQueueTestSuite.runAllTests();

// Run specific categories
const unitResults = await taskQueueTestSuite.runUnitTests();
const integrationResults = await taskQueueTestSuite.runIntegrationTests();
```

## Test Categories

### Unit Tests

Tests individual components in isolation:

- **Task Validation Service** - All validation rules and edge cases
- **Queue State Manager** - State persistence, validation, and repair
- **Task Utils** - Task creation, duration calculation, and utilities
- **Task Queue Operations** - Queue status and statistics calculation
- **Edge Cases** - Empty queues, invalid data, boundary conditions
- **Error Handling** - Null checks, invalid inputs, corruption recovery
- **Performance** - Large queue handling, checksum calculation speed

**Coverage**: 25+ tests covering all validation scenarios, state management, and edge cases.

### Integration Tests

Tests interactions between components:

- **Client-Server Sync** - Queue synchronization and conflict resolution
- **WebSocket Integration** - Real-time progress updates and notifications
- **Offline/Online Sync** - Offline processing and reconnection handling
- **Service Interactions** - Task queue service integration with other services
- **Data Consistency** - Queue state consistency across operations
- **Concurrent Operations** - Multiple simultaneous operations
- **Error Recovery** - Network failures and data corruption recovery

**Coverage**: 20+ tests covering all service interactions and synchronization scenarios.

### End-to-End Tests

Tests complete user workflows:

- **Complete Task Lifecycle** - From creation to completion with rewards
- **Multi-Activity Workflow** - Harvesting → Crafting → Combat chains
- **Offline to Online Flow** - Extended offline periods and sync
- **Queue Management Flow** - Add, remove, reorder, pause/resume operations
- **Error Recovery Flow** - Task failures, retries, and corruption recovery
- **Concurrent Player Flow** - Multiple players with independent queues
- **Long-Running Scenarios** - Extended offline processing and large queues

**Coverage**: 15+ tests covering complete user journeys and complex scenarios.

### Regression Tests

Tests critical functionality to prevent regressions:

- **Critical Bug Fixes** - Previously fixed bugs (duplication, negative progress, etc.)
- **Performance Regressions** - Validation speed, checksum calculation, status calculation
- **Data Integrity Regressions** - ID collisions, version conflicts, reward consistency
- **API Compatibility** - Method signatures, data structures, enum values
- **Security Regressions** - Input validation, sanitization, access control
- **Scalability Regressions** - Large queue handling, concurrent operations, memory usage
- **Backward Compatibility** - Legacy format support, API version compatibility

**Coverage**: 25+ tests covering all critical functionality and known issue areas.

## Test Features

### Comprehensive Coverage

- **All Task Types**: Harvesting, Crafting, Combat
- **All Queue Operations**: Add, remove, reorder, pause, resume, clear
- **All Validation Scenarios**: Prerequisites, resources, equipment, levels
- **All Error Conditions**: Network failures, data corruption, invalid inputs
- **All Performance Scenarios**: Large queues, concurrent operations, memory usage

### Realistic Test Data

- **Mock Player Stats**: Realistic character statistics and skill levels
- **Mock Activities**: Harvesting activities, crafting recipes, combat enemies
- **Mock Equipment**: Tools, weapons, armor with durability and requirements
- **Mock Resources**: Materials, currencies, and inventory items

### Performance Testing

- **Speed Benchmarks**: Validation should complete within time limits
- **Memory Monitoring**: Memory usage should stay within reasonable bounds
- **Concurrency Testing**: Multiple operations should not interfere
- **Scalability Testing**: Large data sets should be handled efficiently

### Error Simulation

- **Network Failures**: Connection drops, timeouts, server errors
- **Data Corruption**: Invalid checksums, missing data, malformed structures
- **Resource Conflicts**: Insufficient materials, broken equipment, level requirements
- **Concurrent Conflicts**: Version mismatches, simultaneous modifications

## Expected Results

### Success Criteria

- **All Tests Pass**: 100% pass rate for comprehensive test suite
- **Performance Targets**: 
  - Unit tests complete within 10 seconds
  - Integration tests complete within 15 seconds
  - E2E tests complete within 20 seconds
  - Regression tests complete within 15 seconds
- **Coverage Targets**:
  - 80+ total tests across all categories
  - All critical code paths covered
  - All error scenarios tested

### Performance Benchmarks

- **Validation Speed**: 100 tasks validated in < 500ms
- **Checksum Calculation**: 100 tasks checksummed in < 100ms
- **Queue Status**: Large queue status calculated in < 50ms
- **Memory Usage**: < 100MB increase for large test data sets

## Maintenance

### Adding New Tests

1. **Unit Tests**: Add to `unit/taskQueueUnitTests.ts` in appropriate category
2. **Integration Tests**: Add to `integration/taskQueueIntegrationTests.ts`
3. **E2E Tests**: Add to `e2e/taskQueueE2ETests.ts` for new workflows
4. **Regression Tests**: Add to `regression/taskQueueRegressionTests.ts` for bug fixes

### Updating Test Data

- **Mock Data**: Update helper methods in each test file
- **Test Scenarios**: Add new scenarios as features are added
- **Performance Targets**: Adjust benchmarks as system evolves

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Run Comprehensive Tests
  run: npm test -- src/testing/comprehensive/__tests__/comprehensiveTestSuite.test.ts

- name: Run Performance Tests
  run: npx ts-node src/testing/comprehensive/runComprehensiveTests.ts unit

- name: Generate Test Report
  run: npx ts-node src/testing/comprehensive/runComprehensiveTests.ts > test-report.txt
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase Jest timeout or optimize slow tests
2. **Mock Failures**: Ensure all required services are properly mocked
3. **Memory Issues**: Check for memory leaks in test data creation
4. **Flaky Tests**: Add proper async/await handling and timing controls

### Debug Mode

```typescript
// Enable detailed logging
process.env.DEBUG_TESTS = 'true';

// Run specific test category with detailed output
const results = await taskQueueTestSuite.runUnitTests();
console.log('Detailed results:', JSON.stringify(results, null, 2));
```

### Performance Profiling

```typescript
// Monitor memory usage
const initialMemory = process.memoryUsage();
await taskQueueTestSuite.runAllTests();
const finalMemory = process.memoryUsage();
console.log('Memory delta:', finalMemory.heapUsed - initialMemory.heapUsed);
```

## Contributing

When adding new features to the task queue system:

1. **Add Unit Tests** for new functions and components
2. **Add Integration Tests** for new service interactions
3. **Add E2E Tests** for new user workflows
4. **Add Regression Tests** for any bug fixes
5. **Update Documentation** to reflect new test coverage
6. **Verify Performance** doesn't degrade with new tests

The comprehensive test suite ensures the task queue system remains reliable, performant, and bug-free as it evolves.