#!/bin/bash
# Template: Multi-Profile Parallel Automation
# Purpose: Run automation tasks across multiple profiles in parallel
# Usage: ./multi-profile-automation.sh <url>
#
# This template demonstrates:
# 1. Managing multiple profiles
# 2. Parallel execution
# 3. Result aggregation

set -euo pipefail

TARGET_URL="${1:?Usage: $0 <url>}"

echo "=========================================="
echo "Multi-Profile Automation"
echo "=========================================="
echo "Target: $TARGET_URL"
echo ""

# Get all profiles
echo "Fetching profiles..."
PROFILES=$(nstbrowser-ai-agent profile list --json | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -3)

if [ -z "$PROFILES" ]; then
    echo "No profiles found. Create profiles first."
    exit 1
fi

echo "Found profiles:"
echo "$PROFILES"
echo ""

# Function to run automation for a single profile
run_automation() {
    local profile_name="$1"
    local url="$2"
    
    echo "[$profile_name] Starting..."
    
    # Set profile
    export NST_PROFILE="$profile_name"
    
    # Open URL
    nstbrowser-ai-agent open "$url" 2>&1 | sed "s/^/[$profile_name] /"
    nstbrowser-ai-agent wait --load networkidle 2>&1 | sed "s/^/[$profile_name] /"
    
    # Get title
    TITLE=$(nstbrowser-ai-agent get title 2>&1)
    echo "[$profile_name] Title: $TITLE"
    
    # Close
    nstbrowser-ai-agent close 2>&1 | sed "s/^/[$profile_name] /"
    
    echo "[$profile_name] Complete"
}

# Export function for parallel execution
export -f run_automation

# Run in parallel (max 3 at a time)
echo "Running automation in parallel..."
echo ""
echo "$PROFILES" | xargs -I {} -P 3 bash -c "run_automation '{}' '$TARGET_URL'"

echo ""
echo "=========================================="
echo "All profiles complete!"
echo "=========================================="
