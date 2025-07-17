# Rollback Script for Steampunk Idle Game
# This script handles rollback operations for failed deployments

param(
    [Parameter(Mandatory=$true)]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$BackupTimestamp,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Starting rollback process for $Environment environment..." -ForegroundColor Yellow

# Configuration
$StackName = "steampunk-idle-game-$Environment"
$BackupBucket = "steampunk-idle-game-$Environment-backup"
$Region = "us-east-1"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-AWSCLIAvailable {
    try {
        aws --version | Out-Null
        return $true
    }
    catch {
        Write-Log "AWS CLI not found. Please install AWS CLI and configure credentials." "ERROR"
        return $false
    }
}

function Get-AvailableBackups {
    Write-Log "Fetching available backups..."
    
    try {
        $backups = aws s3 ls "s3://$BackupBucket/" --region $Region | Where-Object { $_ -match "backup-(\d{8}-\d{6})" }
        
        if ($backups) {
            Write-Log "Available backups:" "SUCCESS"
            $backups | ForEach-Object { Write-Log "  $_" }
            return $backups
        }
        else {
            Write-Log "No backups found in s3://$BackupBucket/" "WARN"
            return @()
        }
    }
    catch {
        Write-Log "Failed to list backups: $($_.Exception.Message)" "ERROR"
        return @()
    }
}

function Invoke-CloudFormationRollback {
    Write-Log "Initiating CloudFormation stack rollback..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would rollback CloudFormation stack $StackName" "WARN"
        return $true
    }
    
    try {
        # Check if stack exists and is in a rollback-able state
        $stackStatus = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].StackStatus' --output text 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Stack $StackName not found or inaccessible" "ERROR"
            return $false
        }
        
        Write-Log "Current stack status: $stackStatus"
        
        if ($stackStatus -in @("UPDATE_COMPLETE", "UPDATE_FAILED", "UPDATE_ROLLBACK_FAILED")) {
            Write-Log "Canceling stack update and rolling back..."
            aws cloudformation cancel-update-stack --stack-name $StackName --region $Region
            
            # Wait for rollback to complete
            Write-Log "Waiting for rollback to complete..."
            aws cloudformation wait stack-update-complete --stack-name $StackName --region $Region
            
            Write-Log "CloudFormation rollback completed" "SUCCESS"
            return $true
        }
        else {
            Write-Log "Stack is not in a state that supports rollback: $stackStatus" "WARN"
            return $false
        }
    }
    catch {
        Write-Log "CloudFormation rollback failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Invoke-S3Rollback {
    param([string]$BackupTimestamp)
    
    Write-Log "Rolling back S3 static assets..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would restore S3 assets from backup-$BackupTimestamp" "WARN"
        return $true
    }
    
    try {
        $websiteBucket = "steampunk-idle-game-$Environment"
        $backupPath = "s3://$BackupBucket/backup-$BackupTimestamp/"
        
        # Verify backup exists
        $backupExists = aws s3 ls $backupPath --region $Region
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Backup $backupPath not found" "ERROR"
            return $false
        }
        
        Write-Log "Restoring from backup: $backupPath"
        aws s3 sync $backupPath "s3://$websiteBucket/" --region $Region --delete
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "S3 rollback completed successfully" "SUCCESS"
            return $true
        }
        else {
            Write-Log "S3 rollback failed" "ERROR"
            return $false
        }
    }
    catch {
        Write-Log "S3 rollback failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Invoke-HealthCheck {
    Write-Log "Running post-rollback health checks..."
    
    $healthCheckScript = Join-Path $PSScriptRoot "health-check.sh"
    
    if (Test-Path $healthCheckScript) {
        try {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                # On Windows, we'll use PowerShell to simulate the health check
                $apiUrl = "https://api-$Environment.steampunk-idle-game.com"
                $response = Invoke-RestMethod -Uri "$apiUrl/health" -Method Get -TimeoutSec 30
                
                if ($response.status -eq "healthy") {
                    Write-Log "Health check passed" "SUCCESS"
                    return $true
                }
                else {
                    Write-Log "Health check failed: $($response.status)" "ERROR"
                    return $false
                }
            }
            else {
                # On Unix systems, use the bash script
                bash $healthCheckScript $Environment
                return $LASTEXITCODE -eq 0
            }
        }
        catch {
            Write-Log "Health check failed: $($_.Exception.Message)" "ERROR"
            return $false
        }
    }
    else {
        Write-Log "Health check script not found, skipping..." "WARN"
        return $true
    }
}

function Send-Notification {
    param([string]$Status, [string]$Message)
    
    Write-Log "Sending rollback notification..."
    
    # This would integrate with your notification system (Slack, email, etc.)
    # For now, just log the notification
    Write-Log "NOTIFICATION: Rollback $Status - $Message" "INFO"
}

# Main rollback process
function Start-Rollback {
    Write-Log "=== Rollback Process Started ===" "INFO"
    Write-Log "Environment: $Environment"
    Write-Log "Backup Timestamp: $BackupTimestamp"
    Write-Log "Dry Run: $DryRun"
    
    $success = $true
    
    # Check prerequisites
    if (-not (Test-AWSCLIAvailable)) {
        return $false
    }
    
    # If no backup timestamp provided, list available backups
    if (-not $BackupTimestamp) {
        $backups = Get-AvailableBackups
        if ($backups.Count -eq 0) {
            Write-Log "No backups available for rollback" "ERROR"
            return $false
        }
        
        # Use the most recent backup
        $latestBackup = $backups | Sort-Object -Descending | Select-Object -First 1
        if ($latestBackup -match "backup-(\d{8}-\d{6})") {
            $BackupTimestamp = $matches[1]
            Write-Log "Using latest backup: $BackupTimestamp" "INFO"
        }
        else {
            Write-Log "Could not determine latest backup timestamp" "ERROR"
            return $false
        }
    }
    
    # Perform rollback steps
    Write-Log "Step 1: CloudFormation rollback"
    if (-not (Invoke-CloudFormationRollback)) {
        $success = $false
        Write-Log "CloudFormation rollback failed" "ERROR"
    }
    
    Write-Log "Step 2: S3 assets rollback"
    if (-not (Invoke-S3Rollback -BackupTimestamp $BackupTimestamp)) {
        $success = $false
        Write-Log "S3 rollback failed" "ERROR"
    }
    
    # Wait a bit for services to stabilize
    if (-not $DryRun) {
        Write-Log "Waiting for services to stabilize..."
        Start-Sleep -Seconds 30
    }
    
    Write-Log "Step 3: Post-rollback health check"
    if (-not (Invoke-HealthCheck)) {
        $success = $false
        Write-Log "Post-rollback health check failed" "ERROR"
    }
    
    # Send notification
    if ($success) {
        Write-Log "=== Rollback Completed Successfully ===" "SUCCESS"
        Send-Notification -Status "SUCCESS" -Message "Rollback to $BackupTimestamp completed successfully"
    }
    else {
        Write-Log "=== Rollback Completed with Errors ===" "ERROR"
        Send-Notification -Status "FAILED" -Message "Rollback to $BackupTimestamp completed with errors"
    }
    
    return $success
}

# Execute rollback
try {
    $result = Start-Rollback
    if ($result) {
        exit 0
    }
    else {
        exit 1
    }
}
catch {
    Write-Log "Rollback script failed with exception: $($_.Exception.Message)" "ERROR"
    Send-Notification -Status "FAILED" -Message "Rollback script failed with exception: $($_.Exception.Message)"
    exit 1
}