#!/bin/bash

# Health Check Script for Steampunk Idle Game
# This script performs comprehensive health checks after deployment

set -e

ENVIRONMENT=${1:-staging}
API_BASE_URL=${2:-"https://api.steampunk-idle-game.com"}
MAX_RETRIES=5
RETRY_DELAY=10

echo "🔍 Starting health checks for $ENVIRONMENT environment..."
echo "API Base URL: $API_BASE_URL"

# Function to make HTTP requests with retries
make_request() {
    local url=$1
    local expected_status=${2:-200}
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        echo "  Checking $url (attempt $((retries + 1))/$MAX_RETRIES)..."
        
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$url" || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            echo "  ✅ $url returned $response"
            return 0
        else
            echo "  ❌ $url returned $response (expected $expected_status)"
            if [ -f /tmp/response.json ]; then
                echo "  Response body: $(cat /tmp/response.json)"
            fi
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            echo "  Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
    done
    
    return 1
}

# Function to check API endpoint
check_api_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    
    echo "🔍 Checking $method $endpoint..."
    
    if [ "$method" = "GET" ]; then
        make_request "$API_BASE_URL$endpoint" "$expected_status"
    else
        # For non-GET requests, we might need different handling
        echo "  ⚠️  $method requests not implemented in health check yet"
        return 0
    fi
}

# Function to validate JSON response
validate_json_response() {
    local url=$1
    local expected_field=$2
    
    echo "🔍 Validating JSON response from $url..."
    
    response=$(curl -s "$url" || echo "{}")
    
    if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo "  ✅ JSON response contains expected field: $expected_field"
        return 0
    else
        echo "  ❌ JSON response missing expected field: $expected_field"
        echo "  Response: $response"
        return 1
    fi
}

# Main health check sequence
main() {
    local failed_checks=0
    
    echo "🚀 Starting comprehensive health checks..."
    
    # Basic health check endpoint
    if check_api_endpoint "/health"; then
        echo "✅ Basic health check passed"
    else
        echo "❌ Basic health check failed"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Validate health check response structure
    if validate_json_response "$API_BASE_URL/health" "status"; then
        echo "✅ Health check response structure valid"
    else
        echo "❌ Health check response structure invalid"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check authentication endpoints (should return 401 without auth)
    if check_api_endpoint "/auth/profile" "GET" "401"; then
        echo "✅ Authentication endpoint properly secured"
    else
        echo "❌ Authentication endpoint security check failed"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check CORS headers
    echo "🔍 Checking CORS configuration..."
    cors_response=$(curl -s -H "Origin: https://steampunk-idle-game.com" \
                         -H "Access-Control-Request-Method: GET" \
                         -H "Access-Control-Request-Headers: Content-Type" \
                         -X OPTIONS "$API_BASE_URL/health" -I || echo "")
    
    if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
        echo "✅ CORS headers present"
    else
        echo "❌ CORS headers missing"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Performance check
    echo "🔍 Checking API response time..."
    start_time=$(date +%s%N)
    make_request "$API_BASE_URL/health" > /dev/null
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 5000 ]; then
        echo "✅ API response time acceptable: ${response_time}ms"
    else
        echo "⚠️  API response time high: ${response_time}ms"
    fi
    
    # Database connectivity check (via health endpoint)
    echo "🔍 Checking database connectivity..."
    db_health=$(curl -s "$API_BASE_URL/health" | jq -r '.checks[] | select(.service=="DynamoDB") | .status' 2>/dev/null || echo "unknown")
    
    if [ "$db_health" = "healthy" ]; then
        echo "✅ Database connectivity healthy"
    else
        echo "❌ Database connectivity issues detected"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Summary
    echo ""
    echo "📊 Health Check Summary"
    echo "======================"
    echo "Environment: $ENVIRONMENT"
    echo "API Base URL: $API_BASE_URL"
    echo "Failed Checks: $failed_checks"
    
    if [ $failed_checks -eq 0 ]; then
        echo "🎉 All health checks passed!"
        exit 0
    else
        echo "💥 $failed_checks health check(s) failed!"
        exit 1
    fi
}

# Check if required tools are installed
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo "❌ Missing required dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Run dependency check and main function
check_dependencies
main