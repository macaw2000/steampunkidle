#!/usr/bin/env pwsh

# Frontend Deployment Script for Steampunk Idle Game
# This script deploys the React build to S3 and sets up CloudFront

param(
    [string]$BucketName = "steampunk-idle-game-frontend-$(Get-Random)",
    [string]$Region = "us-west-2"
)

Write-Host "🚀 Starting frontend deployment..." -ForegroundColor Blue

# Check if build directory exists
if (-not (Test-Path "build")) {
    Write-Host "❌ Build directory not found. Please run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# Create S3 bucket for static website hosting
Write-Host "📦 Creating S3 bucket: $BucketName" -ForegroundColor Yellow
try {
    aws s3 mb "s3://$BucketName" --region $Region
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create S3 bucket"
    }
} catch {
    Write-Host "❌ Failed to create S3 bucket: $_" -ForegroundColor Red
    exit 1
}

# Configure bucket for static website hosting
Write-Host "🌐 Configuring static website hosting..." -ForegroundColor Yellow
try {
    aws s3 website "s3://$BucketName" --index-document index.html --error-document index.html
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure website hosting"
    }
} catch {
    Write-Host "❌ Failed to configure website hosting: $_" -ForegroundColor Red
    exit 1
}

# Set bucket policy for public read access
Write-Host "🔓 Setting bucket policy for public access..." -ForegroundColor Yellow
$policyJson = "{`"Version`": `"2012-10-17`", `"Statement`": [{`"Sid`": `"PublicReadGetObject`", `"Effect`": `"Allow`", `"Principal`": `"*`", `"Action`": `"s3:GetObject`", `"Resource`": `"arn:aws:s3:::$BucketName/*`"}]}"
$policyJson | Out-File -FilePath "temp-bucket-policy.json" -Encoding UTF8
try {
    aws s3api put-bucket-policy --bucket $BucketName --policy file://temp-bucket-policy.json
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set bucket policy"
    }
} catch {
    Write-Host "❌ Failed to set bucket policy: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item "temp-bucket-policy.json" -ErrorAction SilentlyContinue
}

# Upload build files to S3
Write-Host "📤 Uploading build files to S3..." -ForegroundColor Yellow
try {
    aws s3 sync build/ "s3://$BucketName" --delete --cache-control "max-age=31536000" --exclude "*.html"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload static files"
    }
    
    # Upload HTML files with no cache
    aws s3 sync build/ "s3://$BucketName" --delete --cache-control "no-cache" --include "*.html"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload HTML files"
    }
} catch {
    Write-Host "❌ Failed to upload files: $_" -ForegroundColor Red
    exit 1
}

# Get website URL
$websiteUrl = "http://$BucketName.s3-website-$Region.amazonaws.com"

Write-Host "✅ Frontend deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $BucketName" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host "  Website URL: $websiteUrl" -ForegroundColor White
Write-Host "  API URL: https://ks7h6drcjd.execute-api.us-west-2.amazonaws.com/prod/" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Your Steampunk Idle Game is now live at: $websiteUrl" -ForegroundColor Green

# Test the deployment
Write-Host "🔍 Testing deployment..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $websiteUrl -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Website is accessible and responding!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Website responded with status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test website accessibility: $_" -ForegroundColor Yellow
    Write-Host "   The website might still be propagating. Try accessing it in a few minutes." -ForegroundColor Yellow
}