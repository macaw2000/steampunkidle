#!/bin/bash

# Production Deployment Script for Steampunk Idle Game
# This script handles the complete production deployment with all optimizations

set -e

# Configuration
ENVIRONMENT="production"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_PREFIX="SteampunkIdleGame"
DEPLOYMENT_BUCKET="${DEPLOYMENT_BUCKET:-steampunk-deployment-artifacts}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and test the application
build_and_test() {
    log_info "Building and testing application..."
    
    # Install dependencies
    npm ci
    
    # Run tests
    npm run test:ci
    
    # Build the application
    npm run build
    
    # Build Docker images for Fargate
    if [ -d "src/server" ]; then
        log_info "Building Fargate game engine Docker image..."
        cd src/server
        docker build -t steampunk-game-engine:latest .
        cd ../..
    fi
    
    log_success "Build and test completed"
}

# Deploy infrastructure stacks
deploy_infrastructure() {
    log_info "Deploying infrastructure stacks..."
    
    # Bootstrap CDK if needed
    cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}
    
    # Deploy performance optimization stack first
    log_info "Deploying performance optimization stack..."
    cdk deploy ${STACK_PREFIX}-PerformanceOptimization-${ENVIRONMENT} \
        --require-approval never \
        --context environment=${ENVIRONMENT}
    
    # Deploy main application stack
    log_info "Deploying main application stack..."
    cdk deploy ${STACK_PREFIX}-${ENVIRONMENT} \
        --require-approval never \
        --context environment=${ENVIRONMENT}
    
    # Deploy load testing stack
    log_info "Deploying load testing stack..."
    cdk deploy ${STACK_PREFIX}-LoadTesting-${ENVIRONMENT} \
        --require-approval never \
        --context environment=${ENVIRONMENT}
    
    # Deploy blue-green deployment stack
    log_info "Deploying blue-green deployment stack..."
    cdk deploy ${STACK_PREFIX}-BlueGreenDeployment-${ENVIRONMENT} \
        --require-approval never \
        --context environment=${ENVIRONMENT}
    
    log_success "Infrastructure deployment completed"
}

# Run load tests
run_load_tests() {
    log_info "Running load tests..."
    
    # Get the load test state machine ARN
    LOAD_TEST_ARN=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_PREFIX}-LoadTesting-${ENVIRONMENT} \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadTestStateMachineArn`].OutputValue' \
        --output text)
    
    if [ -z "$LOAD_TEST_ARN" ]; then
        log_warning "Load test state machine not found, skipping load tests"
        return
    fi
    
    # Execute load test
    EXECUTION_ARN=$(aws stepfunctions start-execution \
        --state-machine-arn $LOAD_TEST_ARN \
        --name "production-deployment-$(date +%s)" \
        --input '{
            "testId": "production-deployment-test",
            "concurrentUsers": 100,
            "testDurationMinutes": 10,
            "testType": "mixed"
        }' \
        --query 'executionArn' \
        --output text)
    
    log_info "Load test started: $EXECUTION_ARN"
    
    # Wait for load test to complete
    log_info "Waiting for load test to complete..."
    aws stepfunctions wait execution-succeeded --execution-arn $EXECUTION_ARN
    
    # Get load test results
    RESULT=$(aws stepfunctions describe-execution \
        --execution-arn $EXECUTION_ARN \
        --query 'output' \
        --output text)
    
    log_success "Load test completed: $RESULT"
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."
    
    # Get API Gateway URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_PREFIX}-${ENVIRONMENT} \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)
    
    # Get Game Engine URL
    GAME_ENGINE_URL=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_PREFIX}-${ENVIRONMENT} \
        --query 'Stacks[0].Outputs[?OutputKey==`GameEngineURL`].OutputValue' \
        --output text)
    
    # Test API Gateway health
    if [ ! -z "$API_URL" ]; then
        log_info "Testing API Gateway health..."
        if curl -f "${API_URL}health" > /dev/null 2>&1; then
            log_success "API Gateway health check passed"
        else
            log_error "API Gateway health check failed"
            exit 1
        fi
    fi
    
    # Test Game Engine health
    if [ ! -z "$GAME_ENGINE_URL" ]; then
        log_info "Testing Game Engine health..."
        if curl -f "${GAME_ENGINE_URL}/health" > /dev/null 2>&1; then
            log_success "Game Engine health check passed"
        else
            log_error "Game Engine health check failed"
            exit 1
        fi
    fi
    
    log_success "Deployment validation completed"
}

# Setup monitoring and alerts
setup_monitoring() {
    log_info "Setting up monitoring and alerts..."
    
    # Deploy monitoring stack
    cdk deploy ${STACK_PREFIX}-ProductionMonitoring-${ENVIRONMENT} \
        --require-approval never \
        --context environment=${ENVIRONMENT}
    
    log_success "Monitoring setup completed"
}

# Main deployment function
main() {
    log_info "Starting production deployment for Steampunk Idle Game"
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $AWS_REGION"
    
    # Get AWS account ID
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_info "AWS Account: $AWS_ACCOUNT_ID"
    
    # Run deployment steps
    check_prerequisites
    build_and_test
    deploy_infrastructure
    validate_deployment
    setup_monitoring
    
    # Run load tests if requested
    if [ "$RUN_LOAD_TESTS" = "true" ]; then
        run_load_tests
    else
        log_info "Skipping load tests (set RUN_LOAD_TESTS=true to enable)"
    fi
    
    log_success "Production deployment completed successfully!"
    
    # Output important URLs
    echo ""
    log_info "Deployment Summary:"
    if [ ! -z "$API_URL" ]; then
        echo "  API Gateway URL: $API_URL"
    fi
    if [ ! -z "$GAME_ENGINE_URL" ]; then
        echo "  Game Engine URL: $GAME_ENGINE_URL"
    fi
    echo "  CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=SteampunkProduction-${ENVIRONMENT}"
    echo ""
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        validate_deployment
        ;;
    "load-test")
        RUN_LOAD_TESTS=true
        run_load_tests
        ;;
    "monitoring")
        setup_monitoring
        ;;
    *)
        echo "Usage: $0 [deploy|validate|load-test|monitoring]"
        echo "  deploy     - Full production deployment (default)"
        echo "  validate   - Validate existing deployment"
        echo "  load-test  - Run load tests only"
        echo "  monitoring - Setup monitoring only"
        exit 1
        ;;
esac