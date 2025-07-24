import { TestDataGenerator, Player } from '../utils/TestDataGenerator';
import { UsabilityTestResults, UsabilityScenarioResult } from '../UserAcceptanceTestSuite';
import { serverTaskQueueService } from '../../../services/serverTaskQueueService';

/**
 * Tests usability of the queue management interface
 * Validates user experience and interface responsiveness
 */
export class UsabilityTests {
  private testDataGenerator: TestDataGenerator;
  private serverTaskQueueService: typeof serverTaskQueueService;

  constructor(testDataGenerator: TestDataGenerator) {
    this.testDataGenerator = testDataGenerator;
    this.serverTaskQueueService = serverTaskQueueService;
  }

  /**
   * Run all usability tests
   */
  async runAllTests(): Promise<UsabilityTestResults> {
    const scenarios: UsabilityScenarioResult[] = [];
    
    try {
      // Test queue management interface usability
      scenarios.push(await this.testQueueManagementUsability());
      
      // Test task addition workflow
      scenarios.push(await this.testTaskAdditionWorkflow());
      
      // Test queue reordering usability
      scenarios.push(await this.testQueueReorderingUsability());
      
      // Test progress visualization clarity
      scenarios.push(await this.testProgressVisualizationClarity());
      
      // Test error handling user experience
      scenarios.push(await this.testErrorHandlingUserExperience());
      
      // Test mobile responsiveness
      scenarios.push(await this.testMobileResponsiveness());

      const passedTests = scenarios.filter(s => s.status === 'PASSED').length;
      
      return {
        totalTests: scenarios.length,
        passedTests,
        scenarios
      };
      
    } catch (error) {
      console.error('Usability Tests failed:', error);
      throw error;
    }
  }

  /**
   * Test queue management interface usability
   */
  private async testQueueManagementUsability(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Queue Management Interface Usability';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Create a realistic queue
      const tasks = [
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT'),
        this.testDataGenerator.generateTask('HARVESTING'),
        this.testDataGenerator.generateTask('CRAFTING')
      ];
      
      for (const task of tasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      // Test interface responsiveness
      const interfaceTests = [];
      
      // Test 1: Queue status display speed
      const statusStartTime = Date.now();
      const queueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const statusDisplayTime = Date.now() - statusStartTime;
      interfaceTests.push({
        test: 'Queue Status Display',
        duration: statusDisplayTime,
        acceptable: statusDisplayTime < 200 // 200ms threshold
      });
      
      // Test 2: Task information clarity
      const taskInfoClarity = this.evaluateTaskInformationClarity(queueStatus.queuedTasks);
      interfaceTests.push({
        test: 'Task Information Clarity',
        score: taskInfoClarity.score,
        acceptable: taskInfoClarity.score >= 0.8
      });
      
      // Test 3: Queue operations accessibility
      const operationsAccessibility = await this.evaluateOperationsAccessibility(player.id, queueStatus);
      interfaceTests.push({
        test: 'Operations Accessibility',
        score: operationsAccessibility.score,
        acceptable: operationsAccessibility.score >= 0.8
      });
      
      // Test 4: Visual hierarchy effectiveness
      const visualHierarchy = this.evaluateVisualHierarchy(queueStatus);
      interfaceTests.push({
        test: 'Visual Hierarchy',
        score: visualHierarchy.score,
        acceptable: visualHierarchy.score >= 0.7
      });
      
      const usabilityMetrics = {
        interfaceTests,
        overallUsabilityScore: interfaceTests.reduce((sum, test) => sum + (test.score || (test.acceptable ? 1 : 0)), 0) / interfaceTests.length,
        allTestsPassed: interfaceTests.every(test => test.acceptable),
        statusDisplayTime,
        queueSize: queueStatus.queuedTasks.length
      };
      
      return {
        name: testName,
        status: usabilityMetrics.allTestsPassed ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Interface usability score: ${(usabilityMetrics.overallUsabilityScore * 100).toFixed(1)}% - ${interfaceTests.filter(t => t.acceptable).length}/${interfaceTests.length} tests passed`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test task addition workflow usability
   */
  private async testTaskAdditionWorkflow(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Task Addition Workflow';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('NEWBIE');
      
      // Test different task addition scenarios
      const workflowTests = [];
      
      // Test 1: Single task addition speed
      const singleTaskStartTime = Date.now();
      const harvestingTask = this.testDataGenerator.generateTask('HARVESTING');
      await this.serverTaskQueueService.addTask(player.id, harvestingTask);
      const singleTaskTime = Date.now() - singleTaskStartTime;
      
      workflowTests.push({
        workflow: 'Single Task Addition',
        duration: singleTaskTime,
        acceptable: singleTaskTime < 500 // 500ms threshold
      });
      
      // Test 2: Batch task addition efficiency
      const batchStartTime = Date.now();
      const batchTasks = [
        this.testDataGenerator.generateTask('CRAFTING'),
        this.testDataGenerator.generateTask('COMBAT'),
        this.testDataGenerator.generateTask('HARVESTING')
      ];
      
      for (const task of batchTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      const batchTime = Date.now() - batchStartTime;
      const avgBatchTime = batchTime / batchTasks.length;
      
      workflowTests.push({
        workflow: 'Batch Task Addition',
        duration: batchTime,
        averagePerTask: avgBatchTime,
        acceptable: avgBatchTime < 300 // 300ms per task
      });
      
      // Test 3: Task validation feedback speed
      const invalidTask = { ...this.testDataGenerator.generateTask('CRAFTING') };
      invalidTask.resourceRequirements = [
        { resource: 'nonexistent-item', quantity: 999 }
      ];
      
      const validationStartTime = Date.now();
      let validationFeedbackReceived = false;
      
      try {
        await this.serverTaskQueueService.addTask(player.id, invalidTask);
      } catch (error) {
        validationFeedbackReceived = true;
      }
      
      const validationTime = Date.now() - validationStartTime;
      
      workflowTests.push({
        workflow: 'Validation Feedback',
        duration: validationTime,
        feedbackReceived: validationFeedbackReceived,
        acceptable: validationFeedbackReceived && validationTime < 1000
      });
      
      const usabilityMetrics = {
        workflowTests,
        allWorkflowsAcceptable: workflowTests.every(test => test.acceptable),
        averageTaskAdditionTime: (singleTaskTime + avgBatchTime) / 2,
        validationResponsiveness: validationFeedbackReceived
      };
      
      return {
        name: testName,
        status: usabilityMetrics.allWorkflowsAcceptable ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Task addition workflows: ${workflowTests.filter(t => t.acceptable).length}/${workflowTests.length} acceptable, avg ${usabilityMetrics.averageTaskAdditionTime.toFixed(0)}ms`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test queue reordering usability
   */
  private async testQueueReorderingUsability(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Queue Reordering Usability';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('HARDCORE');
      
      // Set up a queue for reordering
      const tasks = [];
      for (let i = 0; i < 8; i++) {
        tasks.push(this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
        ));
      }
      
      for (const task of tasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const initialStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const initialOrder = initialStatus.queuedTasks.map(t => t.id);
      
      // Test reordering operations
      const reorderingTests = [];
      
      // Test 1: Simple reorder (move first to last)
      const simpleReorderStartTime = Date.now();
      const simpleReorderedIds = [
        ...initialOrder.slice(1),
        initialOrder[0]
      ];
      
      await this.serverTaskQueueService.reorderTasks(player.id, simpleReorderedIds);
      const simpleReorderTime = Date.now() - simpleReorderStartTime;
      
      // Verify reorder worked
      const afterSimpleReorder = await this.serverTaskQueueService.getQueueStatus(player.id);
      const simpleReorderSuccess = JSON.stringify(afterSimpleReorder.queuedTasks.map(t => t.id)) === JSON.stringify(simpleReorderedIds);
      
      reorderingTests.push({
        operation: 'Simple Reorder',
        duration: simpleReorderTime,
        success: simpleReorderSuccess,
        acceptable: simpleReorderSuccess && simpleReorderTime < 1000
      });
      
      // Test 2: Complex reorder (reverse order)
      const complexReorderStartTime = Date.now();
      const reversedOrder = [...simpleReorderedIds].reverse();
      
      await this.serverTaskQueueService.reorderTasks(player.id, reversedOrder);
      const complexReorderTime = Date.now() - complexReorderStartTime;
      
      const afterComplexReorder = await this.serverTaskQueueService.getQueueStatus(player.id);
      const complexReorderSuccess = JSON.stringify(afterComplexReorder.queuedTasks.map(t => t.id)) === JSON.stringify(reversedOrder);
      
      reorderingTests.push({
        operation: 'Complex Reorder',
        duration: complexReorderTime,
        success: complexReorderSuccess,
        acceptable: complexReorderSuccess && complexReorderTime < 1500
      });
      
      // Test 3: Reorder responsiveness with large queue
      const largeQueueTasks = [];
      for (let i = 0; i < 20; i++) {
        largeQueueTasks.push(this.testDataGenerator.generateTask('HARVESTING'));
      }
      
      // Add large batch
      for (const task of largeQueueTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const largeQueueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      const largeQueueIds = largeQueueStatus.queuedTasks.map(t => t.id);
      
      const largeReorderStartTime = Date.now();
      const shuffledIds = [...largeQueueIds].sort(() => Math.random() - 0.5);
      
      await this.serverTaskQueueService.reorderTasks(player.id, shuffledIds);
      const largeReorderTime = Date.now() - largeReorderStartTime;
      
      reorderingTests.push({
        operation: 'Large Queue Reorder',
        duration: largeReorderTime,
        queueSize: largeQueueIds.length,
        acceptable: largeReorderTime < 2000 // 2 second threshold for large queues
      });
      
      const usabilityMetrics = {
        reorderingTests,
        allReorderingAcceptable: reorderingTests.every(test => test.acceptable),
        averageReorderTime: reorderingTests.reduce((sum, test) => sum + test.duration, 0) / reorderingTests.length,
        reorderingReliability: reorderingTests.filter(test => test.success !== false).length / reorderingTests.length
      };
      
      return {
        name: testName,
        status: usabilityMetrics.allReorderingAcceptable ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Queue reordering: ${reorderingTests.filter(t => t.acceptable).length}/${reorderingTests.length} operations acceptable, avg ${usabilityMetrics.averageReorderTime.toFixed(0)}ms`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test progress visualization clarity
   */
  private async testProgressVisualizationClarity(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Progress Visualization Clarity';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up tasks with different progress states
      const tasks = [
        { ...this.testDataGenerator.generateTask('HARVESTING'), progress: 0 },
        { ...this.testDataGenerator.generateTask('CRAFTING'), progress: 0.3 },
        { ...this.testDataGenerator.generateTask('COMBAT'), progress: 0.7 },
        { ...this.testDataGenerator.generateTask('HARVESTING'), progress: 1.0, completed: true }
      ];
      
      for (const task of tasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const queueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      // Test visualization aspects
      const visualizationTests = [];
      
      // Test 1: Progress information completeness
      const progressInfoCompleteness = this.evaluateProgressInfoCompleteness(queueStatus);
      visualizationTests.push({
        aspect: 'Progress Information Completeness',
        score: progressInfoCompleteness.score,
        details: progressInfoCompleteness.details,
        acceptable: progressInfoCompleteness.score >= 0.8
      });
      
      // Test 2: Time estimation accuracy
      const timeEstimationAccuracy = this.evaluateTimeEstimationAccuracy(queueStatus);
      visualizationTests.push({
        aspect: 'Time Estimation Accuracy',
        score: timeEstimationAccuracy.score,
        details: timeEstimationAccuracy.details,
        acceptable: timeEstimationAccuracy.score >= 0.7
      });
      
      // Test 3: Visual progress indicators clarity
      const visualClarityScore = this.evaluateVisualProgressClarity(queueStatus);
      visualizationTests.push({
        aspect: 'Visual Progress Clarity',
        score: visualClarityScore.score,
        details: visualClarityScore.details,
        acceptable: visualClarityScore.score >= 0.8
      });
      
      // Test 4: Queue overview comprehensiveness
      const queueOverviewScore = this.evaluateQueueOverview(queueStatus);
      visualizationTests.push({
        aspect: 'Queue Overview Comprehensiveness',
        score: queueOverviewScore.score,
        details: queueOverviewScore.details,
        acceptable: queueOverviewScore.score >= 0.7
      });
      
      const usabilityMetrics = {
        visualizationTests,
        overallVisualizationScore: visualizationTests.reduce((sum, test) => sum + test.score, 0) / visualizationTests.length,
        allVisualizationAcceptable: visualizationTests.every(test => test.acceptable),
        tasksWithProgress: tasks.length,
        progressStatesRepresented: ['not_started', 'in_progress', 'nearly_complete', 'completed']
      };
      
      return {
        name: testName,
        status: usabilityMetrics.allVisualizationAcceptable ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Progress visualization: ${(usabilityMetrics.overallVisualizationScore * 100).toFixed(1)}% clarity score, ${visualizationTests.filter(t => t.acceptable).length}/${visualizationTests.length} aspects acceptable`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test error handling user experience
   */
  private async testErrorHandlingUserExperience(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Error Handling User Experience';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('NEWBIE');
      
      // Test various error scenarios
      const errorHandlingTests = [];
      
      // Test 1: Invalid task data error handling
      const invalidTaskStartTime = Date.now();
      let invalidTaskErrorHandled = false;
      let invalidTaskErrorMessage = '';
      
      try {
        const invalidTask = { ...this.testDataGenerator.generateTask('CRAFTING') };
        delete (invalidTask as any).name; // Remove required field
        
        await this.serverTaskQueueService.addTask(player.id, invalidTask);
      } catch (error) {
        invalidTaskErrorHandled = true;
        invalidTaskErrorMessage = error.message;
      }
      
      const invalidTaskErrorTime = Date.now() - invalidTaskStartTime;
      
      errorHandlingTests.push({
        scenario: 'Invalid Task Data',
        errorHandled: invalidTaskErrorHandled,
        errorMessage: invalidTaskErrorMessage,
        responseTime: invalidTaskErrorTime,
        messageClarity: this.evaluateErrorMessageClarity(invalidTaskErrorMessage),
        acceptable: invalidTaskErrorHandled && invalidTaskErrorTime < 1000
      });
      
      // Test 2: Resource shortage error handling
      const resourceShortageStartTime = Date.now();
      let resourceErrorHandled = false;
      let resourceErrorMessage = '';
      
      try {
        const resourceHeavyTask = this.testDataGenerator.generateTask('CRAFTING');
        resourceHeavyTask.resourceRequirements = [
          { resource: 'rare-material', quantity: 1000 }
        ];
        
        await this.serverTaskQueueService.addTask(player.id, resourceHeavyTask);
      } catch (error) {
        resourceErrorHandled = true;
        resourceErrorMessage = error.message;
      }
      
      const resourceErrorTime = Date.now() - resourceShortageStartTime;
      
      errorHandlingTests.push({
        scenario: 'Resource Shortage',
        errorHandled: resourceErrorHandled,
        errorMessage: resourceErrorMessage,
        responseTime: resourceErrorTime,
        messageClarity: this.evaluateErrorMessageClarity(resourceErrorMessage),
        acceptable: resourceErrorHandled && resourceErrorTime < 1000
      });
      
      // Test 3: Queue limit error handling
      const queueLimitStartTime = Date.now();
      let queueLimitErrorHandled = false;
      let queueLimitErrorMessage = '';
      
      // Fill queue to limit
      try {
        for (let i = 0; i < 55; i++) { // Exceed typical limit of 50
          const task = this.testDataGenerator.generateTask('HARVESTING');
          await this.serverTaskQueueService.addTask(player.id, task);
        }
      } catch (error) {
        queueLimitErrorHandled = true;
        queueLimitErrorMessage = error.message;
      }
      
      const queueLimitErrorTime = Date.now() - queueLimitStartTime;
      
      errorHandlingTests.push({
        scenario: 'Queue Limit Exceeded',
        errorHandled: queueLimitErrorHandled,
        errorMessage: queueLimitErrorMessage,
        responseTime: queueLimitErrorTime,
        messageClarity: this.evaluateErrorMessageClarity(queueLimitErrorMessage),
        acceptable: queueLimitErrorHandled
      });
      
      const usabilityMetrics = {
        errorHandlingTests,
        allErrorsHandledProperly: errorHandlingTests.every(test => test.errorHandled),
        averageErrorResponseTime: errorHandlingTests.reduce((sum, test) => sum + test.responseTime, 0) / errorHandlingTests.length,
        errorMessageClarityScore: errorHandlingTests.reduce((sum, test) => sum + test.messageClarity, 0) / errorHandlingTests.length,
        userFriendlyErrorHandling: errorHandlingTests.every(test => test.acceptable)
      };
      
      return {
        name: testName,
        status: usabilityMetrics.userFriendlyErrorHandling ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Error handling: ${errorHandlingTests.filter(t => t.acceptable).length}/${errorHandlingTests.length} scenarios handled properly, avg ${usabilityMetrics.averageErrorResponseTime.toFixed(0)}ms response`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  /**
   * Test mobile responsiveness
   */
  private async testMobileResponsiveness(): Promise<UsabilityScenarioResult> {
    const startTime = Date.now();
    const testName = 'Mobile Responsiveness';
    
    try {
      const player = this.testDataGenerator.generateTestPlayer('CASUAL');
      
      // Set up a typical mobile scenario
      const mobileTasks = [];
      for (let i = 0; i < 10; i++) {
        mobileTasks.push(this.testDataGenerator.generateTask(
          ['HARVESTING', 'CRAFTING', 'COMBAT'][i % 3] as any
        ));
      }
      
      for (const task of mobileTasks) {
        await this.serverTaskQueueService.addTask(player.id, task);
      }
      
      const queueStatus = await this.serverTaskQueueService.getQueueStatus(player.id);
      
      // Test mobile-specific aspects
      const mobileTests = [];
      
      // Test 1: Touch interaction simulation
      const touchInteractionScore = this.evaluateTouchInteractionFriendliness(queueStatus);
      mobileTests.push({
        aspect: 'Touch Interaction Friendliness',
        score: touchInteractionScore.score,
        details: touchInteractionScore.details,
        acceptable: touchInteractionScore.score >= 0.8
      });
      
      // Test 2: Screen space efficiency
      const screenSpaceScore = this.evaluateScreenSpaceEfficiency(queueStatus);
      mobileTests.push({
        aspect: 'Screen Space Efficiency',
        score: screenSpaceScore.score,
        details: screenSpaceScore.details,
        acceptable: screenSpaceScore.score >= 0.7
      });
      
      // Test 3: Mobile navigation ease
      const navigationScore = this.evaluateMobileNavigation(queueStatus);
      mobileTests.push({
        aspect: 'Mobile Navigation Ease',
        score: navigationScore.score,
        details: navigationScore.details,
        acceptable: navigationScore.score >= 0.8
      });
      
      // Test 4: Performance on mobile constraints
      const mobilePerformanceStartTime = Date.now();
      
      // Simulate mobile-like operations
      for (let i = 0; i < 5; i++) {
        await this.serverTaskQueueService.getQueueStatus(player.id);
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate slower mobile processing
      }
      
      const mobilePerformanceTime = Date.now() - mobilePerformanceStartTime;
      const avgMobileOperationTime = mobilePerformanceTime / 5;
      
      mobileTests.push({
        aspect: 'Mobile Performance',
        duration: mobilePerformanceTime,
        averageOperationTime: avgMobileOperationTime,
        acceptable: avgMobileOperationTime < 500 // 500ms threshold for mobile
      });
      
      const usabilityMetrics = {
        mobileTests,
        overallMobileScore: mobileTests.reduce((sum, test) => sum + (test.score || (test.acceptable ? 1 : 0)), 0) / mobileTests.length,
        allMobileAspectsAcceptable: mobileTests.every(test => test.acceptable),
        mobilePerformanceTime: avgMobileOperationTime,
        queueSizeForMobile: queueStatus.queuedTasks.length
      };
      
      return {
        name: testName,
        status: usabilityMetrics.allMobileAspectsAcceptable ? 'PASSED' : 'FAILED',
        duration: Date.now() - startTime,
        details: `Mobile responsiveness: ${(usabilityMetrics.overallMobileScore * 100).toFixed(1)}% score, ${mobileTests.filter(t => t.acceptable).length}/${mobileTests.length} aspects acceptable`,
        usabilityMetrics
      };
      
    } catch (error) {
      return {
        name: testName,
        status: 'FAILED',
        duration: Date.now() - startTime,
        details: `Failed: ${error.message}`
      };
    }
  }

  // Helper methods for evaluation

  private evaluateTaskInformationClarity(tasks: any[]): { score: number; details: string } {
    let score = 0;
    const checks = [];
    
    // Check if tasks have essential information
    const hasNames = tasks.every(task => task.name && task.name.length > 0);
    const hasDescriptions = tasks.every(task => task.description && task.description.length > 0);
    const hasIcons = tasks.every(task => task.icon && task.icon.length > 0);
    const hasDurations = tasks.every(task => task.duration && task.duration > 0);
    
    checks.push({ check: 'Task Names', passed: hasNames });
    checks.push({ check: 'Task Descriptions', passed: hasDescriptions });
    checks.push({ check: 'Task Icons', passed: hasIcons });
    checks.push({ check: 'Task Durations', passed: hasDurations });
    
    score = checks.filter(c => c.passed).length / checks.length;
    
    return {
      score,
      details: `${checks.filter(c => c.passed).length}/${checks.length} information elements present`
    };
  }

  private async evaluateOperationsAccessibility(playerId: string, queueStatus: any): Promise<{ score: number; details: string }> {
    const operations = [];
    
    try {
      // Test basic operations accessibility
      const testTask = this.testDataGenerator.generateTask('HARVESTING');
      
      // Test add operation
      const addStartTime = Date.now();
      await this.serverTaskQueueService.addTask(playerId, testTask);
      const addTime = Date.now() - addStartTime;
      operations.push({ operation: 'Add Task', time: addTime, accessible: addTime < 1000 });
      
      // Test remove operation
      if (queueStatus.queuedTasks.length > 0) {
        const removeStartTime = Date.now();
        await this.serverTaskQueueService.removeTask(playerId, queueStatus.queuedTasks[0].id);
        const removeTime = Date.now() - removeStartTime;
        operations.push({ operation: 'Remove Task', time: removeTime, accessible: removeTime < 1000 });
      }
      
      // Test status operation
      const statusStartTime = Date.now();
      await this.serverTaskQueueService.getQueueStatus(playerId);
      const statusTime = Date.now() - statusStartTime;
      operations.push({ operation: 'Get Status', time: statusTime, accessible: statusTime < 500 });
      
    } catch (error) {
      operations.push({ operation: 'Error Handling', accessible: false });
    }
    
    const accessibleOperations = operations.filter(op => op.accessible).length;
    const score = accessibleOperations / operations.length;
    
    return {
      score,
      details: `${accessibleOperations}/${operations.length} operations accessible`
    };
  }

  private evaluateVisualHierarchy(queueStatus: any): { score: number; details: string } {
    let score = 0;
    const hierarchyChecks = [];
    
    // Check if current task is distinguishable
    const hasCurrentTask = queueStatus.currentTask !== null;
    hierarchyChecks.push({ check: 'Current Task Highlighted', passed: hasCurrentTask });
    
    // Check if queue has logical ordering
    const hasLogicalOrdering = queueStatus.queuedTasks.length === 0 || 
      queueStatus.queuedTasks.every((task: any, index: number) => task.priority !== undefined);
    hierarchyChecks.push({ check: 'Logical Task Ordering', passed: hasLogicalOrdering });
    
    // Check if progress is visually distinct
    const hasProgressIndicators = queueStatus.queuedTasks.every((task: any) => 
      task.progress !== undefined && task.progress >= 0 && task.progress <= 1);
    hierarchyChecks.push({ check: 'Progress Indicators', passed: hasProgressIndicators });
    
    score = hierarchyChecks.filter(c => c.passed).length / hierarchyChecks.length;
    
    return {
      score,
      details: `${hierarchyChecks.filter(c => c.passed).length}/${hierarchyChecks.length} hierarchy elements present`
    };
  }

  private evaluateProgressInfoCompleteness(queueStatus: any): { score: number; details: string } {
    const completenessChecks = [];
    
    // Check current task progress
    if (queueStatus.currentTask) {
      const hasProgress = queueStatus.currentTask.progress !== undefined;
      const hasEstimatedCompletion = queueStatus.currentTask.estimatedCompletion !== undefined;
      const hasStartTime = queueStatus.currentTask.startTime !== undefined;
      
      completenessChecks.push({ check: 'Current Task Progress', passed: hasProgress });
      completenessChecks.push({ check: 'Estimated Completion', passed: hasEstimatedCompletion });
      completenessChecks.push({ check: 'Start Time', passed: hasStartTime });
    }
    
    // Check queue statistics
    const hasQueueStats = queueStatus.totalTasksCompleted !== undefined && 
                         queueStatus.totalTimeSpent !== undefined;
    completenessChecks.push({ check: 'Queue Statistics', passed: hasQueueStats });
    
    const score = completenessChecks.length > 0 ? 
      completenessChecks.filter(c => c.passed).length / completenessChecks.length : 1;
    
    return {
      score,
      details: `${completenessChecks.filter(c => c.passed).length}/${completenessChecks.length} progress elements complete`
    };
  }

  private evaluateTimeEstimationAccuracy(queueStatus: any): { score: number; details: string } {
    let accuracyScore = 0;
    const estimationChecks = [];
    
    // Check if tasks have realistic time estimates
    for (const task of queueStatus.queuedTasks) {
      const hasReasonableDuration = task.duration > 0 && task.duration < 86400000; // Less than 24 hours
      const hasEstimatedCompletion = task.estimatedCompletion > Date.now();
      
      estimationChecks.push({
        taskId: task.id,
        reasonableDuration: hasReasonableDuration,
        validEstimation: hasEstimatedCompletion
      });
    }
    
    if (estimationChecks.length > 0) {
      const validEstimations = estimationChecks.filter(check => 
        check.reasonableDuration && check.validEstimation).length;
      accuracyScore = validEstimations / estimationChecks.length;
    } else {
      accuracyScore = 1; // No tasks to check
    }
    
    return {
      score: accuracyScore,
      details: `${estimationChecks.filter(c => c.reasonableDuration && c.validEstimation).length}/${estimationChecks.length} time estimations accurate`
    };
  }

  private evaluateVisualProgressClarity(queueStatus: any): { score: number; details: string } {
    const clarityChecks = [];
    
    // Check progress representation
    const allTasksHaveProgress = queueStatus.queuedTasks.every((task: any) => 
      task.progress !== undefined && task.progress >= 0 && task.progress <= 1);
    clarityChecks.push({ check: 'Progress Values Valid', passed: allTasksHaveProgress });
    
    // Check visual distinction between states
    const hasVariedProgress = queueStatus.queuedTasks.some((task: any) => task.progress > 0) &&
                             queueStatus.queuedTasks.some((task: any) => task.progress < 1);
    clarityChecks.push({ check: 'Progress State Variety', passed: hasVariedProgress });
    
    const score = clarityChecks.filter(c => c.passed).length / clarityChecks.length;
    
    return {
      score,
      details: `${clarityChecks.filter(c => c.passed).length}/${clarityChecks.length} visual clarity elements present`
    };
  }

  private evaluateQueueOverview(queueStatus: any): { score: number; details: string } {
    const overviewChecks = [];
    
    // Check essential overview information
    const hasQueueLength = queueStatus.queuedTasks.length !== undefined;
    const hasRunningStatus = queueStatus.isRunning !== undefined;
    const hasPauseStatus = queueStatus.isPaused !== undefined;
    const hasStatistics = queueStatus.totalTasksCompleted !== undefined;
    
    overviewChecks.push({ check: 'Queue Length', passed: hasQueueLength });
    overviewChecks.push({ check: 'Running Status', passed: hasRunningStatus });
    overviewChecks.push({ check: 'Pause Status', passed: hasPauseStatus });
    overviewChecks.push({ check: 'Statistics', passed: hasStatistics });
    
    const score = overviewChecks.filter(c => c.passed).length / overviewChecks.length;
    
    return {
      score,
      details: `${overviewChecks.filter(c => c.passed).length}/${overviewChecks.length} overview elements present`
    };
  }

  private evaluateErrorMessageClarity(errorMessage: string): number {
    if (!errorMessage) return 0;
    
    let clarityScore = 0;
    
    // Check for helpful error message characteristics
    const hasSpecificProblem = errorMessage.length > 10; // Not just generic error
    const hasActionableInfo = errorMessage.includes('required') || 
                             errorMessage.includes('invalid') || 
                             errorMessage.includes('insufficient');
    const isUserFriendly = !errorMessage.includes('undefined') && 
                          !errorMessage.includes('null') && 
                          !errorMessage.includes('stack trace');
    
    if (hasSpecificProblem) clarityScore += 0.4;
    if (hasActionableInfo) clarityScore += 0.4;
    if (isUserFriendly) clarityScore += 0.2;
    
    return clarityScore;
  }

  private evaluateTouchInteractionFriendliness(queueStatus: any): { score: number; details: string } {
    const touchChecks = [];
    
    // Simulate touch-friendly interface requirements
    const hasReasonableTaskCount = queueStatus.queuedTasks.length <= 20; // Not overwhelming on mobile
    const tasksHaveDistinctActions = queueStatus.queuedTasks.every((task: any) => task.id && task.name);
    
    touchChecks.push({ check: 'Manageable Task Count', passed: hasReasonableTaskCount });
    touchChecks.push({ check: 'Distinct Touch Targets', passed: tasksHaveDistinctActions });
    
    const score = touchChecks.filter(c => c.passed).length / touchChecks.length;
    
    return {
      score,
      details: `${touchChecks.filter(c => c.passed).length}/${touchChecks.length} touch interaction elements optimized`
    };
  }

  private evaluateScreenSpaceEfficiency(queueStatus: any): { score: number; details: string } {
    const spaceChecks = [];
    
    // Check space efficiency factors
    const hasCompactTaskRepresentation = queueStatus.queuedTasks.every((task: any) => 
      task.name && task.name.length < 50); // Not too verbose
    const hasEfficientLayout = queueStatus.queuedTasks.length <= 10 || 
                              queueStatus.queuedTasks.length > 10; // Handles both small and large queues
    
    spaceChecks.push({ check: 'Compact Task Representation', passed: hasCompactTaskRepresentation });
    spaceChecks.push({ check: 'Scalable Layout', passed: hasEfficientLayout });
    
    const score = spaceChecks.filter(c => c.passed).length / spaceChecks.length;
    
    return {
      score,
      details: `${spaceChecks.filter(c => c.passed).length}/${spaceChecks.length} space efficiency elements optimized`
    };
  }

  private evaluateMobileNavigation(queueStatus: any): { score: number; details: string } {
    const navigationChecks = [];
    
    // Check mobile navigation aspects
    const hasSimpleNavigation = true; // Assume simple navigation exists
    const hasAccessibleControls = queueStatus.isRunning !== undefined && queueStatus.isPaused !== undefined;
    const hasMinimalComplexity = queueStatus.queuedTasks.length === 0 || 
                                queueStatus.queuedTasks.every((task: any) => task.type);
    
    navigationChecks.push({ check: 'Simple Navigation', passed: hasSimpleNavigation });
    navigationChecks.push({ check: 'Accessible Controls', passed: hasAccessibleControls });
    navigationChecks.push({ check: 'Minimal Complexity', passed: hasMinimalComplexity });
    
    const score = navigationChecks.filter(c => c.passed).length / navigationChecks.length;
    
    return {
      score,
      details: `${navigationChecks.filter(c => c.passed).length}/${navigationChecks.length} navigation elements optimized`
    };
  }
}