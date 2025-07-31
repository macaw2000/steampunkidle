#!/bin/bash

# Frontend Deployment Script for Steampunk Idle Game
set -e

# Configuration
BUCKET_NAME="steampunk-idle-game-frontend-$(date +%s)"
REGION="us-west-2"

echo "🚀 Starting frontend deployment..."

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Build directory not found. Please run 'npm run build' first."
    exit 1
fi

# Create S3 bucket for static website hosting
echo "📦 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb "s3://$BUCKET_NAME" --region $REGION

# Configure bucket for static website hosting
echo "🌐 Configuring static website hosting..."
aws s3 website "s3://$BUCKET_NAME" --index-document index.html --error-document index.html

# Set bucket policy for public read access
echo "🔓 Setting bucket policy for public access..."
cat > temp-bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://temp-bucket-policy.json
rm temp-bucket-policy.json

# Upload build files to S3
echo "📤 Uploading build files to S3..."
aws s3 sync build/ "s3://$BUCKET_NAME" --delete --cache-control "max-age=31536000" --exclude "*.html"
aws s3 sync build/ "s3://$BUCKET_NAME" --delete --cache-control "no-cache" --include "*.html"

# Get website URL
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

echo "✅ Frontend deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Region: $REGION"
echo "  Website URL: $WEBSITE_URL"
echo "  API URL: https://ks7h6drcjd.execute-api.us-west-2.amazonaws.com/prod/"
echo ""
echo "🌐 Your Steampunk Idle Game is now live at: $WEBSITE_URL"

# Test the deployment
echo "🔍 Testing deployment..."
if curl -f "$WEBSITE_URL" > /dev/null 2>&1; then
    echo "✅ Website is accessible and responding!"
else
    echo "⚠️  Website might still be propagating. Try accessing it in a few minutes."
fi