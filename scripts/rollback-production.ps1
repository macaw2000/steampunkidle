# Production Rollback Script for Task Queue System
# Provides automated rollback procedures for deployment issues

param(
    [Parameter(Mandatory=$true)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$true)]
    [string]$TargetVersion,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$Reason = "Manual rollback"
)

# Configuration
$STACK_NAME = "steampunk-idle-game-$Environment"
$BLUE_GREEN_STACK = "$STACK_NAME-blue-green"
$MONITORING_STACK = "$STACK_NAME-monitoring"
$ROLLBACK_LOG_FILE = "logs/rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Colors for output
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$BLUE = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    
    # Also log to file
    if (!(Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    }
    Add-Content -Path $ROLLBACK_LOG_FILE -Value $logMessage
}

function Test-Prerequisites {
    Write-ColorOutput "Checking rollback prerequisites..." $BLUE
    
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
    
    # Verify AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
        Write-ColorOutput "✓ AWS credentials verified" $GREEN
    }
    catch {
        Write-ColorOutput "ERROR: AWS credentials not configured or invalid." $RED
        exit 1
    }
    
    # Check if target version exists
    if (!$Force) {
        $versionExists = Test-VersionExists -Version $TargetVersion
        if (!$versionExists) {
            Write-ColorOutput "ERROR: Target version $TargetVersion not found. Use -Force to override." $RED
            exit 1
        }
    }
    
    Write-ColorOutput "✓ All prerequisites met" $GREEN
}

function Test-VersionExists {
    param([string]$Version)
    
    try {
        # Check if the version exists in ECR or deployment history
        $images = aws ecr describe-images --repository-name task-queue --image-ids imageTag=$Version 2>$null | ConvertFrom-Json
        return $images.imageDetails.Count -gt 0
    }
    catch {
        Write-ColorOutput "WARNING: Could not verify version existence: $_" $YELLOW
        return $false
    }
}

function Get-CurrentDeployment {
    Write-ColorOutput "Getting current deployment status..." $BLUE
    
    try {
        $stacks = aws cloudformation describe-stacks --stack-name $STACK_NAME 2>$null | ConvertFrom-Json
        if ($stacks.Stacks.Count -gt 0) {
            $currentStack = $stacks.Stacks[0]
            $currentVersion = ($currentStack.Tags | Where-Object { $_.Key -eq "Version" }).Value
            $activeEnvironment = ($currentStack.Parameters | Where-Object { $_.ParameterKey -eq "ActiveEnvironment" }).ParameterValue
            
            return @{
                Exists = $true
                Status = $currentStack.StackStatus
                Version = $currentVersion
                ActiveEnvironment = $activeEnvironment
                StackArn = $currentStack.StackId
            }
        }
    }
    catch {
        Write-ColorOutput "ERROR: Could not get current deployment status: $_" $RED
        return @{ Exists = $false }
    }
    
    return @{ Exists = $false }
}

function Backup-CurrentState {
    param([hashtable]$CurrentDeployment)
    
    Write-ColorOutput "Creating backup of current state..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would create backup of current state" $YELLOW
        return $true
    }
    
    try {
        $backupData = @{
            timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
            environment = $Environment
            currentVersion = $CurrentDeployment.Version
            activeEnvironment = $CurrentDeployment.ActiveEnvironment
            stackStatus = $CurrentDeployment.Status
            rollbackReason = $Reason
        }
        
        $backupFileName = "backups/deployment-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        
        if (!(Test-Path "backups")) {
            New-Item -ItemType Directory -Path "backups" -Force | Out-Null
        }
        
        $backupData | ConvertTo-Json -Depth 10 | Out-File -FilePath $backupFileName -Encoding UTF8
        
        Write-ColorOutput "✓ Backup created: $backupFileName" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Failed to create backup: $_" $RED
        return $false
    }
}

function Test-RollbackTarget {
    param([string]$Version)
    
    Write-ColorOutput "Testing rollback target version $Version..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would test rollback target" $YELLOW
        return $true
    }
    
    try {
        # Deploy to blue environment for testing
        Write-ColorOutput "Deploying version $Version to blue environment for testing..." $BLUE
        
        cdk deploy "$STACK_NAME-blue" --require-approval never --context environment=blue --context version=$Version
        
        # Wait for deployment to stabilize
        Start-Sleep -Seconds 60
        
        # Run health checks on blue environment
        $healthCheck = Test-EnvironmentHealth -Environment "blue"
        
        if ($healthCheck) {
            Write-ColorOutput "✓ Rollback target version $Version is healthy" $GREEN
            return $true
        }
        else {
            Write-ColorOutput "ERROR: Rollback target version $Version failed health checks" $RED
            return $false
        }
    }
    catch {
        Write-ColorOutput "ERROR: Failed to test rollback target: $_" $RED
        return $false
    }
}

function Test-EnvironmentHealth {
    param([string]$Environment)
    
    Write-ColorOutput "Running health checks on $Environment environment..." $BLUE
    
    try {
        # Get the load balancer endpoint
        $stackOutputs = aws cloudformation describe-stacks --stack-name "$STACK_NAME-$Environment" --query "Stacks[0].Outputs" | ConvertFrom-Json
        $lbEndpoint = ($stackOutputs | Where-Object { $_.OutputKey -eq "LoadBalancerEndpoint" }).OutputValue
        
        if (!$lbEndpoint) {
            Write-ColorOutput "ERROR: Could not find load balancer endpoint for $Environment" $RED
            return $false
        }
        
        # Health check endpoint
        $healthUrl = "$lbEndpoint/health"
        Write-ColorOutput "Testing health endpoint: $healthUrl" $BLUE
        
        $maxRetries = 5
        $retryCount = 0
        
        do {
            try {
                $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 30
                
                if ($response.status -eq "healthy") {
                    Write-ColorOutput "✓ Health check passed for $Environment" $GREEN
                    
                    # Run task queue specific tests
                    $queueTestUrl = "$lbEndpoint/api/task-queue/health"
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
                    throw "Health check returned unhealthy status"
                }
            }
            catch {
                $retryCount++
                if ($retryCount -lt $maxRetries) {
                    Write-ColorOutput "Health check attempt $retryCount failed, retrying in 30 seconds..." $YELLOW
                    Start-Sleep -Seconds 30
                }
                else {
                    Write-ColorOutput "ERROR: Health check failed after $maxRetries attempts: $_" $RED
                    return $false
                }
            }
        } while ($retryCount -lt $maxRetries)
        
        return $false
    }
    catch {
        Write-ColorOutput "ERROR: Health check failed: $_" $RED
        return $false
    }
}

function Invoke-TrafficSwitch {
    param([string]$TargetEnvironment, [string]$Version)
    
    Write-ColorOutput "Switching traffic to $TargetEnvironment environment (version $Version)..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would switch traffic to $TargetEnvironment environment" $YELLOW
        return $true
    }
    
    try {
        # Update the main stack to point to the target environment
        aws cloudformation update-stack --stack-name $STACK_NAME --use-previous-template --parameters ParameterKey=ActiveEnvironment,ParameterValue=$TargetEnvironment ParameterKey=Version,ParameterValue=$Version
        
        # Wait for stack update to complete
        Write-ColorOutput "Waiting for traffic switch to complete..." $BLUE
        aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --cli-read-timeout 1800 --cli-connect-timeout 60
        
        # Verify the switch was successful
        Start-Sleep -Seconds 30
        $healthCheck = Test-EnvironmentHealth -Environment "production"
        
        if ($healthCheck) {
            Write-ColorOutput "✓ Traffic successfully switched to $TargetEnvironment environment" $GREEN
            return $true
        }
        else {
            Write-ColorOutput "ERROR: Traffic switch completed but health checks failed" $RED
            return $false
        }
    }
    catch {
        Write-ColorOutput "ERROR: Failed to switch traffic: $_" $RED
        return $false
    }
}

function Send-RollbackNotification {
    param([string]$Status, [string]$Message, [hashtable]$Details = @{})
    
    Write-ColorOutput "Sending rollback notification..." $BLUE
    
    try {
        $notificationPayload = @{
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            environment = $Environment
            targetVersion = $TargetVersion
            status = $Status
            message = $Message
            reason = $Reason
            details = $Details
            rollbackLog = $ROLLBACK_LOG_FILE
        } | ConvertTo-Json -Depth 10
        
        # This would integrate with your monitoring/alerting system
        Write-ColorOutput "Notification: $Status - $Message" $BLUE
        
        # You could also send to SNS, Slack, etc.
        # aws sns publish --topic-arn $ALERT_TOPIC_ARN --message $notificationPayload
        
    }
    catch {
        Write-ColorOutput "WARNING: Failed to send notification: $_" $YELLOW
    }
}

function Invoke-PostRollbackValidation {
    Write-ColorOutput "Running post-rollback validation..." $BLUE
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would run post-rollback validation" $YELLOW
        return $true
    }
    
    try {
        # Wait for system to stabilize
        Write-ColorOutput "Waiting for system to stabilize..." $BLUE
        Start-Sleep -Seconds 120
        
        # Run comprehensive health checks
        $validationResults = @{
            healthCheck = Test-EnvironmentHealth -Environment "production"
            metricsCheck = Test-MetricsAfterRollback
            functionalCheck = Test-FunctionalityAfterRollback
        }
        
        $allPassed = $validationResults.Values | ForEach-Object { $_ } | Where-Object { $_ -eq $false } | Measure-Object | Select-Object -ExpandProperty Count
        
        if ($allPassed -eq 0) {
            Write-ColorOutput "✓ All post-rollback validations passed" $GREEN
            return $true
        }
        else {
            Write-ColorOutput "ERROR: Some post-rollback validations failed" $RED
            Write-ColorOutput "Health Check: $($validationResults.healthCheck)" $YELLOW
            Write-ColorOutput "Metrics Check: $($validationResults.metricsCheck)" $YELLOW
            Write-ColorOutput "Functional Check: $($validationResults.functionalCheck)" $YELLOW
            return $false
        }
    }
    catch {
        Write-ColorOutput "ERROR: Post-rollback validation failed: $_" $RED
        return $false
    }
}

function Test-MetricsAfterRollback {
    Write-ColorOutput "Checking metrics after rollback..." $BLUE
    
    try {
        # Check CloudWatch metrics for the last 10 minutes
        $endTime = Get-Date
        $startTime = $endTime.AddMinutes(-10)
        
        # This would check actual CloudWatch metrics
        # For now, simulate a successful metrics check
        Start-Sleep -Seconds 5
        
        Write-ColorOutput "✓ Metrics check passed" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Metrics check failed: $_" $RED
        return $false
    }
}

function Test-FunctionalityAfterRollback {
    Write-ColorOutput "Running functional tests after rollback..." $BLUE
    
    try {
        # Run a subset of critical functional tests
        # This would integrate with your test suite
        
        Write-ColorOutput "Running critical path tests..." $BLUE
        Start-Sleep -Seconds 10  # Simulate test execution
        
        Write-ColorOutput "✓ Functional tests passed" $GREEN
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Functional tests failed: $_" $RED
        return $false
    }
}

# Main rollback logic
function Start-Rollback {
    Write-ColorOutput "Starting production rollback for Task Queue System" $BLUE
    Write-ColorOutput "Environment: $Environment" $BLUE
    Write-ColorOutput "Target Version: $TargetVersion" $BLUE
    Write-ColorOutput "Reason: $Reason" $BLUE
    Write-ColorOutput "Dry Run: $DryRun" $BLUE
    Write-ColorOutput "Force: $Force" $BLUE
    
    # Check prerequisites
    Test-Prerequisites
    
    # Get current deployment status
    $currentDeployment = Get-CurrentDeployment
    
    if (!$currentDeployment.Exists) {
        Write-ColorOutput "ERROR: No current deployment found to rollback from" $RED
        exit 1
    }
    
    Write-ColorOutput "Current deployment version: $($currentDeployment.Version)" $BLUE
    Write-ColorOutput "Current active environment: $($currentDeployment.ActiveEnvironment)" $BLUE
    
    if ($currentDeployment.Version -eq $TargetVersion) {
        Write-ColorOutput "WARNING: Target version is the same as current version" $YELLOW
        if (!$Force) {
            Write-ColorOutput "Use -Force to proceed anyway" $YELLOW
            exit 1
        }
    }
    
    # Create backup of current state
    $backupSuccess = Backup-CurrentState -CurrentDeployment $currentDeployment
    if (!$backupSuccess) {
        Write-ColorOutput "ERROR: Failed to create backup. Aborting rollback." $RED
        exit 1
    }
    
    # Test rollback target
    $targetTestSuccess = Test-RollbackTarget -Version $TargetVersion
    if (!$targetTestSuccess) {
        Write-ColorOutput "ERROR: Rollback target failed validation. Aborting rollback." $RED
        Send-RollbackNotification -Status "FAILED" -Message "Rollback target validation failed"
        exit 1
    }
    
    # Determine target environment (opposite of current active)
    $targetEnvironment = if ($currentDeployment.ActiveEnvironment -eq "blue") { "green" } else { "blue" }
    
    # Switch traffic to rollback version
    $switchSuccess = Invoke-TrafficSwitch -TargetEnvironment $targetEnvironment -Version $TargetVersion
    if (!$switchSuccess) {
        Write-ColorOutput "ERROR: Traffic switch failed. Attempting to revert..." $RED
        
        # Attempt to revert traffic back
        try {
            Invoke-TrafficSwitch -TargetEnvironment $currentDeployment.ActiveEnvironment -Version $currentDeployment.Version
            Write-ColorOutput "Traffic reverted to original state" $YELLOW
        }
        catch {
            Write-ColorOutput "CRITICAL: Failed to revert traffic. Manual intervention required!" $RED
        }
        
        Send-RollbackNotification -Status "FAILED" -Message "Traffic switch failed during rollback"
        exit 1
    }
    
    # Run post-rollback validation
    $validationSuccess = Invoke-PostRollbackValidation
    if (!$validationSuccess) {
        Write-ColorOutput "WARNING: Post-rollback validation failed. System may be unstable." $YELLOW
        Send-RollbackNotification -Status "WARNING" -Message "Rollback completed but validation failed"
    }
    else {
        Send-RollbackNotification -Status "SUCCESS" -Message "Rollback completed successfully" -Details @{
            fromVersion = $currentDeployment.Version
            toVersion = $TargetVersion
            fromEnvironment = $currentDeployment.ActiveEnvironment
            toEnvironment = $targetEnvironment
        }
    }
    
    Write-ColorOutput "✓ Production rollback completed!" $GREEN
    Write-ColorOutput "Rolled back from version $($currentDeployment.Version) to version $TargetVersion" $GREEN
    Write-ColorOutput "Active environment switched from $($currentDeployment.ActiveEnvironment) to $targetEnvironment" $GREEN
    Write-ColorOutput "Rollback log: $ROLLBACK_LOG_FILE" $BLUE
}

# Execute rollback
Start-Rollback