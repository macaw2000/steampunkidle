/**
 * Load Testing Infrastructure Stack
 * Sets up comprehensive load testing for concurrent users and real-time features
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface LoadTestingStackProps extends cdk.StackProps {
  gameEngineUrl: string;
  apiGatewayUrl: string;
  environment: string;
}

export class LoadTestingStack extends cdk.Stack {
  public readonly loadTestFunction: lambda.Function;
  public readonly loadTestOrchestrator: stepfunctions.StateMachine;
  public readonly resultsBucket: s3.Bucket;
  public readonly metricsFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LoadTestingStackProps) {
    super(scope, id, props);

    // S3 bucket for storing load test results
    this.resultsBucket = new s3.Bucket(this, 'LoadTestResultsBucket', {
      bucketName: `steampunk-load-test-results-${props.environment}-${this.account}`,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldResults',
          expiration: cdk.Duration.days(30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Load test execution function
    this.loadTestFunction = new lambda.Function(this, 'LoadTestFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'loadTest.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');
        const http = require('http');
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const s3 = new S3Client({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          const {
            testId,
            concurrentUsers = 100,
            testDurationMinutes = 5,
            gameEngineUrl,
            apiGatewayUrl,
            testType = 'mixed'
          } = event;

          console.log(\`Starting load test: \${testId}, Users: \${concurrentUsers}, Duration: \${testDurationMinutes}m\`);

          const startTime = Date.now();
          const endTime = startTime + (testDurationMinutes * 60 * 1000);
          
          const results = {
            testId,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            concurrentUsers,
            testDurationMinutes,
            testType,
            metrics: {
              totalRequests: 0,
              successfulRequests: 0,
              failedRequests: 0,
              averageResponseTime: 0,
              maxResponseTime: 0,
              minResponseTime: Infinity,
              responseTimes: [],
              errorTypes: {},
              throughputPerSecond: 0,
            },
            userMetrics: [],
          };

          try {
            // Create concurrent user simulations
            const userPromises = [];
            for (let i = 0; i < concurrentUsers; i++) {
              userPromises.push(simulateUser(i, endTime, gameEngineUrl, apiGatewayUrl, testType));
            }

            // Wait for all users to complete
            const userResults = await Promise.allSettled(userPromises);
            
            // Aggregate results
            userResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                const userMetrics = result.value;
                results.userMetrics.push(userMetrics);
                
                results.metrics.totalRequests += userMetrics.totalRequests;
                results.metrics.successfulRequests += userMetrics.successfulRequests;
                results.metrics.failedRequests += userMetrics.failedRequests;
                results.metrics.responseTimes.push(...userMetrics.responseTimes);
                
                // Merge error types
                Object.entries(userMetrics.errorTypes).forEach(([errorType, count]) => {
                  results.metrics.errorTypes[errorType] = (results.metrics.errorTypes[errorType] || 0) + count;
                });
              } else {
                console.error(\`User \${index} simulation failed:\`, result.reason);
                results.metrics.failedRequests++;
              }
            });

            // Calculate aggregate metrics
            if (results.metrics.responseTimes.length > 0) {
              results.metrics.averageResponseTime = results.metrics.responseTimes.reduce((a, b) => a + b, 0) / results.metrics.responseTimes.length;
              results.metrics.maxResponseTime = Math.max(...results.metrics.responseTimes);
              results.metrics.minResponseTime = Math.min(...results.metrics.responseTimes);
            }

            const actualDuration = (Date.now() - startTime) / 1000;
            results.metrics.throughputPerSecond = results.metrics.totalRequests / actualDuration;

            // Store results in S3
            await s3.send(new PutObjectCommand({
              Bucket: process.env.RESULTS_BUCKET,
              Key: \`load-tests/\${testId}/results.json\`,
              Body: JSON.stringify(results, null, 2),
              ContentType: 'application/json',
            }));

            // Send metrics to CloudWatch
            await sendMetricsToCloudWatch(results);

            console.log(\`Load test completed: \${results.metrics.totalRequests} requests, \${results.metrics.successfulRequests} successful\`);

            return {
              statusCode: 200,
              body: JSON.stringify({
                testId,
                summary: {
                  totalRequests: results.metrics.totalRequests,
                  successRate: (results.metrics.successfulRequests / results.metrics.totalRequests) * 100,
                  averageResponseTime: results.metrics.averageResponseTime,
                  throughputPerSecond: results.metrics.throughputPerSecond,
                },
                resultsLocation: \`s3://\${process.env.RESULTS_BUCKET}/load-tests/\${testId}/results.json\`,
              }),
            };
          } catch (error) {
            console.error('Load test failed:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Load test failed', details: error.message }),
            };
          }
        };

        async function simulateUser(userId, endTime, gameEngineUrl, apiGatewayUrl, testType) {
          const userMetrics = {
            userId,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errorTypes: {},
          };

          while (Date.now() < endTime) {
            try {
              const testScenario = getRandomTestScenario(testType);
              const startTime = Date.now();
              
              await executeTestScenario(testScenario, gameEngineUrl, apiGatewayUrl, userId);
              
              const responseTime = Date.now() - startTime;
              userMetrics.totalRequests++;
              userMetrics.successfulRequests++;
              userMetrics.responseTimes.push(responseTime);
              
              // Random delay between requests (1-5 seconds)
              await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000));
            } catch (error) {
              userMetrics.totalRequests++;
              userMetrics.failedRequests++;
              
              const errorType = error.code || error.message || 'Unknown';
              userMetrics.errorTypes[errorType] = (userMetrics.errorTypes[errorType] || 0) + 1;
              
              // Shorter delay on error
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          return userMetrics;
        }

        function getRandomTestScenario(testType) {
          const scenarios = {
            mixed: [
              'character-status',
              'task-queue-status',
              'activity-switch',
              'guild-info',
              'leaderboard',
              'marketplace-browse',
            ],
            realtime: [
              'task-queue-status',
              'activity-switch',
              'character-status',
            ],
            database: [
              'character-status',
              'guild-info',
              'leaderboard',
              'marketplace-browse',
            ],
            fargate: [
              'task-queue-status',
              'activity-switch',
              'queue-management',
            ],
          };

          const availableScenarios = scenarios[testType] || scenarios.mixed;
          return availableScenarios[Math.floor(Math.random() * availableScenarios.length)];
        }

        async function executeTestScenario(scenario, gameEngineUrl, apiGatewayUrl, userId) {
          switch (scenario) {
            case 'character-status':
              return makeRequest(\`\${apiGatewayUrl}/character\`, 'GET');
            
            case 'task-queue-status':
              return makeRequest(\`\${gameEngineUrl}/api/queue/status/user\${userId}\`, 'GET');
            
            case 'activity-switch':
              return makeRequest(\`\${gameEngineUrl}/api/queue/user\${userId}/activity\`, 'POST', {
                activity: ['harvesting', 'crafting', 'combat'][Math.floor(Math.random() * 3)],
              });
            
            case 'guild-info':
              return makeRequest(\`\${apiGatewayUrl}/guild\`, 'GET');
            
            case 'leaderboard':
              return makeRequest(\`\${apiGatewayUrl}/leaderboard\`, 'GET');
            
            case 'marketplace-browse':
              return makeRequest(\`\${apiGatewayUrl}/auction\`, 'GET');
            
            case 'queue-management':
              return makeRequest(\`\${gameEngineUrl}/api/queue/user\${userId}\`, 'GET');
            
            default:
              throw new Error(\`Unknown scenario: \${scenario}\`);
          }
        }

        function makeRequest(url, method, body = null) {
          return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
              path: urlObj.pathname + urlObj.search,
              method,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LoadTest/1.0',
              },
            };

            if (body) {
              const bodyString = JSON.stringify(body);
              options.headers['Content-Length'] = Buffer.byteLength(bodyString);
            }

            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request(options, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve({ statusCode: res.statusCode, data });
                } else {
                  reject(new Error(\`HTTP \${res.statusCode}: \${data}\`));
                }
              });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
              req.destroy();
              reject(new Error('Request timeout'));
            });

            if (body) {
              req.write(JSON.stringify(body));
            }
            req.end();
          });
        }

        async function sendMetricsToCloudWatch(results) {
          const metrics = [
            {
              MetricName: 'LoadTestTotalRequests',
              Value: results.metrics.totalRequests,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [
                { Name: 'TestId', Value: results.testId },
                { Name: 'ConcurrentUsers', Value: results.concurrentUsers.toString() },
              ],
            },
            {
              MetricName: 'LoadTestSuccessRate',
              Value: (results.metrics.successfulRequests / results.metrics.totalRequests) * 100,
              Unit: 'Percent',
              Timestamp: new Date(),
              Dimensions: [
                { Name: 'TestId', Value: results.testId },
                { Name: 'ConcurrentUsers', Value: results.concurrentUsers.toString() },
              ],
            },
            {
              MetricName: 'LoadTestAverageResponseTime',
              Value: results.metrics.averageResponseTime,
              Unit: 'Milliseconds',
              Timestamp: new Date(),
              Dimensions: [
                { Name: 'TestId', Value: results.testId },
                { Name: 'ConcurrentUsers', Value: results.concurrentUsers.toString() },
              ],
            },
            {
              MetricName: 'LoadTestThroughput',
              Value: results.metrics.throughputPerSecond,
              Unit: 'Count/Second',
              Timestamp: new Date(),
              Dimensions: [
                { Name: 'TestId', Value: results.testId },
                { Name: 'ConcurrentUsers', Value: results.concurrentUsers.toString() },
              ],
            },
          ];

          await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'SteampunkIdleGame/LoadTesting',
            MetricData: metrics,
          }));
        }
      `),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        RESULTS_BUCKET: this.resultsBucket.bucketName,
        GAME_ENGINE_URL: props.gameEngineUrl,
        API_GATEWAY_URL: props.apiGatewayUrl,
      },
    });

    // Grant permissions to load test function
    this.resultsBucket.grantWrite(this.loadTestFunction);
    this.loadTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // Metrics analysis function
    this.metricsFunction = new lambda.Function(this, 'LoadTestMetricsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'metrics.handler',
      code: lambda.Code.fromInline(`
        const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const s3 = new S3Client({});
        const cloudwatch = new CloudWatchClient({});

        exports.handler = async (event) => {
          try {
            const { testId } = event;
            
            // Retrieve test results from S3
            const result = await s3.send(new GetObjectCommand({
              Bucket: process.env.RESULTS_BUCKET,
              Key: \`load-tests/\${testId}/results.json\`,
            }));
            
            const testResults = JSON.parse(await result.Body.transformToString());
            
            // Analyze results and generate insights
            const analysis = analyzeLoadTestResults(testResults);
            
            // Store analysis back to S3
            await s3.send(new PutObjectCommand({
              Bucket: process.env.RESULTS_BUCKET,
              Key: \`load-tests/\${testId}/analysis.json\`,
              Body: JSON.stringify(analysis, null, 2),
              ContentType: 'application/json',
            }));
            
            // Send analysis metrics to CloudWatch
            await sendAnalysisMetrics(testId, analysis);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                testId,
                analysis,
                recommendations: analysis.recommendations,
              }),
            };
          } catch (error) {
            console.error('Metrics analysis failed:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Metrics analysis failed' }),
            };
          }
        };

        function analyzeLoadTestResults(results) {
          const analysis = {
            testId: results.testId,
            performanceGrade: 'A',
            bottlenecks: [],
            recommendations: [],
            scalabilityAssessment: {},
            resourceUtilization: {},
          };

          // Performance grading
          const successRate = (results.metrics.successfulRequests / results.metrics.totalRequests) * 100;
          const avgResponseTime = results.metrics.averageResponseTime;
          
          if (successRate < 95 || avgResponseTime > 2000) {
            analysis.performanceGrade = 'F';
          } else if (successRate < 98 || avgResponseTime > 1000) {
            analysis.performanceGrade = 'C';
          } else if (successRate < 99.5 || avgResponseTime > 500) {
            analysis.performanceGrade = 'B';
          }

          // Identify bottlenecks
          if (avgResponseTime > 1000) {
            analysis.bottlenecks.push('High average response time indicates server-side bottlenecks');
          }
          
          if (successRate < 99) {
            analysis.bottlenecks.push('Error rate indicates system instability under load');
          }
          
          if (results.metrics.maxResponseTime > avgResponseTime * 5) {
            analysis.bottlenecks.push('High response time variance indicates inconsistent performance');
          }

          // Generate recommendations
          if (avgResponseTime > 500) {
            analysis.recommendations.push('Consider increasing Lambda memory allocation');
            analysis.recommendations.push('Implement caching for frequently accessed data');
            analysis.recommendations.push('Optimize database queries and add indexes');
          }
          
          if (successRate < 99) {
            analysis.recommendations.push('Implement circuit breakers and retry logic');
            analysis.recommendations.push('Add auto-scaling for Fargate services');
            analysis.recommendations.push('Review error logs for common failure patterns');
          }
          
          if (results.metrics.throughputPerSecond < results.concurrentUsers * 0.1) {
            analysis.recommendations.push('System throughput is low - investigate resource constraints');
          }

          // Scalability assessment
          analysis.scalabilityAssessment = {
            currentCapacity: results.concurrentUsers,
            estimatedMaxCapacity: Math.floor(results.concurrentUsers * (successRate / 100) * 2),
            scalingBottleneck: identifyScalingBottleneck(results),
            recommendedScaling: generateScalingRecommendations(results),
          };

          return analysis;
        }

        function identifyScalingBottleneck(results) {
          const avgResponseTime = results.metrics.averageResponseTime;
          const errorRate = (results.metrics.failedRequests / results.metrics.totalRequests) * 100;
          
          if (errorRate > 5) {
            return 'Error rate increases significantly under load';
          } else if (avgResponseTime > 2000) {
            return 'Response time degrades severely under load';
          } else if (results.metrics.throughputPerSecond < results.concurrentUsers * 0.05) {
            return 'Throughput does not scale linearly with user count';
          } else {
            return 'No significant bottlenecks identified';
          }
        }

        function generateScalingRecommendations(results) {
          const recommendations = [];
          
          if (results.metrics.averageResponseTime > 1000) {
            recommendations.push('Scale up Fargate service CPU and memory');
            recommendations.push('Implement horizontal scaling for Lambda functions');
          }
          
          if (results.metrics.failedRequests > results.metrics.totalRequests * 0.01) {
            recommendations.push('Add DynamoDB auto-scaling');
            recommendations.push('Implement connection pooling');
          }
          
          recommendations.push('Monitor CloudWatch metrics during scaling events');
          recommendations.push('Implement gradual traffic ramping');
          
          return recommendations;
        }

        async function sendAnalysisMetrics(testId, analysis) {
          const metrics = [
            {
              MetricName: 'LoadTestPerformanceGrade',
              Value: gradeToNumber(analysis.performanceGrade),
              Unit: 'None',
              Timestamp: new Date(),
              Dimensions: [{ Name: 'TestId', Value: testId }],
            },
            {
              MetricName: 'LoadTestBottleneckCount',
              Value: analysis.bottlenecks.length,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [{ Name: 'TestId', Value: testId }],
            },
            {
              MetricName: 'EstimatedMaxCapacity',
              Value: analysis.scalabilityAssessment.estimatedMaxCapacity,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [{ Name: 'TestId', Value: testId }],
            },
          ];

          await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'SteampunkIdleGame/LoadTestAnalysis',
            MetricData: metrics,
          }));
        }

        function gradeToNumber(grade) {
          const gradeMap = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
          return gradeMap[grade] || 0;
        }
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        RESULTS_BUCKET: this.resultsBucket.bucketName,
      },
    });

    // Grant permissions to metrics function
    this.resultsBucket.grantReadWrite(this.metricsFunction);
    this.metricsFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // Step Functions state machine for orchestrating load tests
    const loadTestTask = new stepfunctionsTasks.LambdaInvoke(this, 'ExecuteLoadTest', {
      lambdaFunction: this.loadTestFunction,
      outputPath: '$.Payload',
    });

    const metricsTask = new stepfunctionsTasks.LambdaInvoke(this, 'AnalyzeMetrics', {
      lambdaFunction: this.metricsFunction,
      inputPath: '$.body',
      outputPath: '$.Payload',
    });

    const definition = loadTestTask.next(metricsTask);

    this.loadTestOrchestrator = new stepfunctions.StateMachine(this, 'LoadTestOrchestrator', {
      definition,
      timeout: cdk.Duration.minutes(30),
      stateMachineName: `SteampunkLoadTestOrchestrator-${props.environment}`,
    });

    // Create CloudWatch dashboard for load testing
    const dashboard = new cloudwatch.Dashboard(this, 'LoadTestDashboard', {
      dashboardName: `SteampunkLoadTesting-${props.environment}`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'Load Test Performance',
            left: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTesting',
                metricName: 'LoadTestSuccessRate',
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTesting',
                metricName: 'LoadTestAverageResponseTime',
                statistic: 'Average',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTesting',
                metricName: 'LoadTestThroughput',
                statistic: 'Average',
              }),
            ],
            width: 24,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Load Test Analysis',
            left: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTestAnalysis',
                metricName: 'LoadTestPerformanceGrade',
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTestAnalysis',
                metricName: 'LoadTestBottleneckCount',
                statistic: 'Sum',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'SteampunkIdleGame/LoadTestAnalysis',
                metricName: 'EstimatedMaxCapacity',
                statistic: 'Maximum',
              }),
            ],
            width: 24,
          }),
        ],
      ],
    });

    // Output important resources
    new cdk.CfnOutput(this, 'LoadTestStateMachineArn', {
      value: this.loadTestOrchestrator.stateMachineArn,
      description: 'Load Test State Machine ARN',
      exportName: `SteampunkLoadTestStateMachine-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'LoadTestResultsBucket', {
      value: this.resultsBucket.bucketName,
      description: 'Load Test Results S3 Bucket',
      exportName: `SteampunkLoadTestResults-${props.environment}`,
    });
  }
}