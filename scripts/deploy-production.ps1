# Production Deployment Script for Task Queue System
# Implements blue-green deployment strategy with zero-downtime updates

param(
    [Parameter(Mandatory=$true)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "latest",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Rollback = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$RollbackVersion = ""
)

# Configuration
$STACK_NAME = "steampunk-idle-game-$Environment"
$BLUE_GREEN_STACK = "$STACK_NAME-blue-green"
$MONITORING_STACK = "$STACK_NAME-monitoring"
$CDK_APP = "infrastructure/app.ts"

# Colors for output
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$BLUE = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorOutput "Checking deployment prerequisites..." $BLUE
    
    # Check AWS CLI
    if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "ERROR: AWS CLI not found. Please install AWS CLI." $RED
        exit 1
    }
    
    # Check CDK CLI
    if (!(Get-Command cdk -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "ERROR: AWS CDK CLI not found. Please install CDK CLI." $RED
        exit 1
    }
    
    # Check Node.js
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "ERROR: Node.js not found. Please install Node.js." $RED
        exit 1
    }
    
    # Verify AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
        Write-ColorOutput "✓ AWS credentials verified" $GREEN
    }
    catch {
        Write-ColorOutput "ERROR: AWS credentials not configured or invalid." $RED
        exit 1
    }
    
    Write-ColorOutput "✓ All prerequisites met" $GREEN
}

function Get-CurrentDeployment {
    Write-ColorOutput "Getting current deployment status..." $BLUE
    
    try {
        $stacks = aws cloudformation describe-stacks --stack-name $STACK_NAME 2>$null | ConvertFrom-Json
        if ($stacks.Stacks.Count -gt 0) {
            $currentStack = $stacks.Stacks[0]
            return @{
                Exists = $true
                Status = $currentStack.StackStatus
                Version = ($currentStack.Tags | Where-Object { $_.Key -eq "Version" }).Value
                Environment = ($currentStack.Tags | Where-Object { $_.Key -eq "Environment" }).Value
            }
        }
    }
    catch {
        Write-ColorOutput "No existing deployment found" $YELLOW
    }
    
    return @{ Exists = $false }
}

function Deploy-BlueGreenInfrastructure {
    Write-ColorOutput "Deploying blue-green infrastructure..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would deploy blue-green infrastructure" $YELLOW
        return $true
    }
    
    try {
        # Deploy monitoring stack first
        Write-ColorOutput "Deploying monitoring infrastructure..." $BLUE
        cdk deploy $MONITORING_STACK --require-approval never --context environment=$Environment
        
        # Deploy blue-green infrastructure
        Write-ColorOutput "Deploying blue-green infrastructure..." $BLUE
        cdk deploy $BLUE_GREEN_STACK --require-approval never --context environment=$Environment --context version=$Version
        
        Write-ColorOutput "✓ Blue-green infrastructure deployed successfully" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Failed to deploy blue-green infrastructure: $_" $RED
        return $false
    }
}

function Test-NewDeployment {
    param([string]$TargetEnvironment)
    
    Write-ColorOutput "Running health checks on $TargetEnvironment environment..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would run health checks" $YELLOW
        return $true
    }
    
    try {
        # Get the API Gateway endpoint for the target environment
        $stackOutputs = aws cloudformation describe-stacks --stack-name "$STACK_NAME-$TargetEnvironment" --query "Stacks[0].Outputs" | ConvertFrom-Json
        $apiEndpoint = ($stackOutputs | Where-Object { $_.OutputKey -eq "ApiEndpoint" }).OutputValue
        
        if (!$apiEndpoint) {
            Write-ColorOutput "ERROR: Could not find API endpoint for $TargetEnvironment" $RED
            return $false
        }
        
        # Health check endpoint
        $healthUrl = "$apiEndpoint/health"
        Write-ColorOutput "Testing health endpoint: $healthUrl" $BLUE
        
        $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 30
        
        if ($response.status -eq "healthy") {
            Write-ColorOutput "✓ Health check passed for $TargetEnvironment" $GREEN
            
            # Run additional task queue specific tests
            Write-ColorOutput "Running task queue system tests..." $BLUE
            $queueTestUrl = "$apiEndpoint/api/task-queue/health"
            $queueResponse = Invoke-RestMethod -Uri $queueTestUrl -Method GET -TimeoutSec 30
            
            if ($queueResponse.taskProcessor -eq "healthy" -and $queueResponse.database -eq "healthy") {
                Write-ColorOutput "✓ Task queue system tests passed" $GREEN
                return $true
            }
            else {
                Write-ColorOutput "ERROR: Task queue system tests failed" $RED
                return $false
            }
        }
        else {
            Write-ColorOutput "ERROR: Health check failed for $TargetEnvironment" $RED
            return $false
        }
    }
    catch {
        Write-ColorOutput "ERROR: Health check failed: $_" $RED
        return $false
    }
}

function Switch-TrafficToGreen {
    Write-ColorOutput "Switching traffic to green environment..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would switch traffic to green environment" $YELLOW
        return $true
    }
    
    try {
        # Update Route 53 or ALB to point to green environment
        aws cloudformation update-stack --stack-name $STACK_NAME --use-previous-template --parameters ParameterKey=ActiveEnvironment,ParameterValue=green ParameterKey=Version,ParameterValue=$Version
        
        # Wait for stack update to complete
        Write-ColorOutput "Waiting for traffic switch to complete..." $BLUE
        aws cloudformation wait stack-update-complete --stack-name $STACK_NAME
        
        Write-ColorOutput "✓ Traffic switched to green environment" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Failed to switch traffic: $_" $RED
        return $false
    }
}

function Cleanup-BlueEnvironment {
    Write-ColorOutput "Cleaning up blue environment..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would cleanup blue environment" $YELLOW
        return
    }
    
    try {
        # Keep blue environment for rollback capability
        # Just scale down non-critical resources
        Write-ColorOutput "Scaling down blue environment resources..." $BLUE
        
        # Update blue environment to minimal resources
        cdk deploy "$STACK_NAME-blue" --require-approval never --context environment=blue --context scale=minimal
        
        Write-ColorOutput "✓ Blue environment scaled down" $GREEN
    }
    catch {
        Write-ColorOutput "WARNING: Failed to cleanup blue environment: $_" $YELLOW
    }
}

function Invoke-Rollback {
    param([string]$TargetVersion)
    
    Write-ColorOutput "Initiating rollback to version $TargetVersion..." $RED
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would rollback to version $TargetVersion" $YELLOW
        return $true
    }
    
    try {
        # Switch traffic back to blue environment
        Write-ColorOutput "Switching traffic back to blue environment..." $BLUE
        aws cloudformation update-stack --stack-name $STACK_NAME --use-previous-template --parameters ParameterKey=ActiveEnvironment,ParameterValue=blue ParameterKey=Version,ParameterValue=$TargetVersion
        
        # Wait for rollback to complete
        aws cloudformation wait stack-update-complete --stack-name $STACK_NAME
        
        Write-ColorOutput "✓ Rollback completed successfully" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Rollback failed: $_" $RED
        return $false
    }
}

function Send-DeploymentNotification {
    param([string]$Status, [string]$Message)
    
    Write-ColorOutput "Sending deployment notification..." $BLUE
    
    try {
        # Send notification to monitoring system
        $notificationPayload = @{
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            environment = $Environment
            version = $Version
            status = $Status
            message = $Message
        } | ConvertTo-Json
        
        # This would integrate with your monitoring/alerting system
        Write-ColorOutput "Notification: $Status - $Message" $BLUE
    }
    catch {
        Write-ColorOutput "WARNING: Failed to send notification: $_" $YELLOW
    }
}

# Main deployment logic
function Start-Deployment {
    Write-ColorOutput "Starting production deployment for Task Queue System" $BLUE
    Write-ColorOutput "Environment: $Environment" $BLUE
    Write-ColorOutput "Version: $Version" $BLUE
    Write-ColorOutput "Dry Run: $DryRun" $BLUE
    
    # Check prerequisites
    Test-Prerequisites
    
    # Handle rollback scenario
    if ($Rollback) {
        if (!$RollbackVersion) {
            Write-ColorOutput "ERROR: Rollback version must be specified" $RED
            exit 1
        }
        
        $rollbackSuccess = Invoke-Rollback -TargetVersion $RollbackVersion
        if ($rollbackSuccess) {
            Send-DeploymentNotification -Status "SUCCESS" -Message "Rollback to version $RollbackVersion completed"
            Write-ColorOutput "Rollback completed successfully" $GREEN
        }
        else {
            Send-DeploymentNotification -Status "FAILED" -Message "Rollback to version $RollbackVersion failed"
            Write-ColorOutput "Rollback failed" $RED
            exit 1
        }
        return
    }
    
    # Get current deployment status
    $currentDeployment = Get-CurrentDeployment
    
    # Deploy blue-green infrastructure
    $infraSuccess = Deploy-BlueGreenInfrastructure
    if (!$infraSuccess) {
        Send-DeploymentNotification -Status "FAILED" -Message "Infrastructure deployment failed"
        exit 1
    }
    
    # Test green environment
    $testSuccess = Test-NewDeployment -TargetEnvironment "green"
    if (!$testSuccess) {
        Write-ColorOutput "Green environment tests failed. Initiating rollback..." $RED
        if ($currentDeployment.Exists) {
            Invoke-Rollback -TargetVersion $currentDeployment.Version
        }
        Send-DeploymentNotification -Status "FAILED" -Message "Green environment tests failed, rollback initiated"
        exit 1
    }
    
    # Switch traffic to green
    $switchSuccess = Switch-TrafficToGreen
    if (!$switchSuccess) {
        Write-ColorOutput "Traffic switch failed. Initiating rollback..." $RED
        if ($currentDeployment.Exists) {
            Invoke-Rollback -TargetVersion $currentDeployment.Version
        }
        Send-DeploymentNotification -Status "FAILED" -Message "Traffic switch failed, rollback initiated"
        exit 1
    }
    
    # Final verification
    Start-Sleep -Seconds 30  # Allow time for traffic to stabilize
    $finalTest = Test-NewDeployment -TargetEnvironment "production"
    if (!$finalTest) {
        Write-ColorOutput "Final verification failed. Initiating rollback..." $RED
        if ($currentDeployment.Exists) {
            Invoke-Rollback -TargetVersion $currentDeployment.Version
        }
        Send-DeploymentNotification -Status "FAILED" -Message "Final verification failed, rollback initiated"
        exit 1
    }
    
    # Cleanup old environment
    Cleanup-BlueEnvironment
    
    # Success notification
    Send-DeploymentNotification -Status "SUCCESS" -Message "Deployment version $Version completed successfully"
    Write-ColorOutput "✓ Production deployment completed successfully!" $GREEN
    Write-ColorOutput "Version $Version is now live in $Environment" $GREEN
}

# Execute deployment
Start-Deployment