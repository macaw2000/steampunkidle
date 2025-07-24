# User Acceptance Testing Framework

This directory contains the comprehensive user acceptance testing framework for the Task Queue System, implementing the requirements from task 22 of the task queue system specification.

## Overview

The User Acceptance Testing (UAT) framework validates that the task queue system meets real-world user needs and performs well under realistic conditions. It covers four main areas:

1. **Player Usage Patterns** - Tests typical player workflows and interactions
2. **Offline/Online Transitions** - Validates data synchronization and offline functionality  
3. **Performance Validation** - Tests system performance under realistic load conditions
4. **Usability Testing** - Evaluates user interface and experience quality

## Requirements Validation

This testing framework validates the following requirements:

- **Requirement 1.1**: Global Player Task Queue - Tests persistent task queue functionality
- **Requirement 5.1**: Real-time Progress Updates - Validates progress synchronization
- **Requirement 9.1**: Cross-Platform Synchronization - Tests offline/online transitions

## Directory Structure

```
src/testing/userAcceptance/
├── UserAcceptanceTestSuite.ts          # Main test orchestrator
├── runUserAcceptanceTests.ts           # CLI test runner
├── README.md                           # This documentation
├── scenarios/                          # Test scenario implementations
│   ├── PlayerUsagePatternTests.ts      # Player workflow tests
│   ├── OfflineOnlineTransitionTests.ts # Sync and offline tests
│   ├── PerformanceValidationTests.ts   # Performance and load tests
│   └── UsabilityTests.ts              # UI/UX usability tests
├── utils/                              # Test utilities
│   ├── TestDataGenerator.ts           # Generates realistic test data
│   └── TestReporter.ts                # Creates test reports
├── reports/                            # Generated test reports
└── __tests__/                         # Jest test wrappers
    └── userAcceptanceTestSuite.test.ts
```

## Running Tests

### Via Jest (Recommended)

```bash
# Run all user acceptance tests
npm test -- src/testing/userAcceptance/__tests__/userAcceptanceTestSuite.test.ts

# Run with verbose output
npm test -- --verbose src/testing/userAcceptance/__tests__/userAcceptanceTestSuite.test.ts

# Run specific test category
npm test -- --testNamePattern="Player Usage Pattern Tests"
```

### Via Direct Execution

```bash
# Run the complete test suite
npx ts-node src/testing/userAcceptance/runUserAcceptanceTests.ts

# Or with Node.js
node -r ts-node/register src/testing/userAcceptance/runUserAcceptanceTests.ts
```

## Test Categories

### 1. Player Usage Pattern Tests

Tests typical player workflows and validates that common operations work smoothly:

- **Typical Queue Operations**: Add, remove, reorder tasks
- **Multi-Activity Workflows**: Mixed harvesting, crafting, combat sequences
- **Long-Running Sessions**: Extended play with large queues
- **Casual Play Patterns**: Quick check-ins and short sessions
- **Queue Management**: Pause, resume, stop operations
- **Resource Validation**: Prerequisite and resource checking

### 2. Offline/Online Transition Tests

Validates data synchronization and offline functionality:

- **Offline Task Processing**: Tasks continue when player is offline
- **Online Reconnection Sync**: Proper synchronization when reconnecting
- **Conflict Resolution**: Handling conflicting offline/online changes
- **Data Integrity**: Ensuring no data loss during transitions
- **Incremental Sync**: Efficient synchronization of changes
- **Extended Offline Periods**: Long offline sessions

### 3. Performance Validation Tests

Tests system performance under realistic conditions:

- **Concurrent Player Load**: Multiple players using system simultaneously
- **Queue Processing Speed**: Task processing performance
- **UI Responsiveness**: Interface performance under load
- **Memory Usage Patterns**: Memory efficiency over time
- **Database Performance**: Database operation speed
- **Scalability Limits**: Maximum concurrent user capacity

### 4. Usability Tests

Evaluates user interface and experience quality:

- **Queue Management Interface**: Usability of queue controls
- **Task Addition Workflow**: Ease of adding tasks
- **Queue Reordering**: Drag-and-drop and reordering usability
- **Progress Visualization**: Clarity of progress indicators
- **Error Handling UX**: User-friendly error messages
- **Mobile Responsiveness**: Mobile device compatibility

## Test Data Generation

The framework includes a comprehensive test data generator that creates:

- **Realistic Players**: Different player types (Casual, Hardcore, Newbie)
- **Varied Task Queues**: Mixed activity types and queue sizes
- **Usage Scenarios**: Common player interaction patterns
- **Load Test Data**: Multiple concurrent players for performance testing

## Reporting

Tests generate comprehensive reports in multiple formats:

- **HTML Reports**: Visual reports with charts and detailed results
- **JSON Reports**: Machine-readable results for CI/CD integration
- **Console Output**: Real-time test progress and summary

Reports are saved to the `reports/` directory with timestamps.

## Acceptance Criteria

Tests use the following acceptance criteria:

- **Overall Pass Rate**: ≥75% of all tests must pass
- **Player Usage Patterns**: ≥80% pass rate
- **Offline/Online Transitions**: ≥70% pass rate (complex functionality)
- **Performance Validation**: ≥75% pass rate
- **Usability Testing**: ≥80% pass rate

## Performance Thresholds

The framework validates these performance requirements:

- **Response Time**: <100ms for typical operations
- **Queue Status**: <200ms for status retrieval
- **Task Addition**: <500ms per task
- **UI Updates**: <200ms for interface updates
- **Sync Operations**: <2s for offline/online sync
- **Concurrent Users**: Support for 100+ concurrent players

## Integration with CI/CD

The test suite is designed for integration with continuous integration:

```yaml
# Example GitHub Actions integration
- name: Run User Acceptance Tests
  run: npm test -- src/testing/userAcceptance/__tests__/userAcceptanceTestSuite.test.ts
  timeout-minutes: 10
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase Jest timeout for performance tests
2. **Network Errors**: Tests fall back to local simulation when server unavailable
3. **Memory Issues**: Tests include memory usage monitoring
4. **Flaky Tests**: Built-in retry logic for network-dependent operations

### Debug Mode

Enable detailed logging by setting environment variable:

```bash
DEBUG=user-acceptance-tests npm test
```

## Contributing

When adding new test scenarios:

1. Follow the existing pattern in scenario files
2. Include proper error handling and fallbacks
3. Add meaningful assertions and metrics
4. Update this README with new test descriptions
5. Ensure tests are deterministic and reliable

## Dependencies

The testing framework relies on:

- **Jest**: Test runner and assertions
- **TypeScript**: Type safety and modern JavaScript features
- **Task Queue Services**: Integration with actual system components
- **Load Testing Framework**: Performance testing utilities
- **Test Data Generators**: Realistic test data creation

This comprehensive testing framework ensures the task queue system meets user needs and performs reliably under real-world conditions.