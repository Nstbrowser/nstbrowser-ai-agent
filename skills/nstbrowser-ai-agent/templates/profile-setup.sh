#!/bin/bash
# Template: Profile Setup and Configuration
# Purpose: Create and configure a new Nstbrowser profile
# Usage: ./profile-setup.sh <profile-name> [proxy-host] [proxy-port]
#
# This template demonstrates:
# 1. Creating a new profile
# 2. Configuring proxy settings
# 3. Verifying the setup
# 4. Testing the profile

set -euo pipefail

PROFILE_NAME="${1:?Usage: $0 <profile-name> [proxy-host] [proxy-port]}"
PROXY_HOST="${2:-}"
PROXY_PORT="${3:-}"

echo "=========================================="
echo "Profile Setup: $PROFILE_NAME"
echo "=========================================="
echo ""

# Step 1: Check if profile already exists
echo "Checking if profile exists..."
if nstbrowser-ai-agent profile show "$PROFILE_NAME" --json >/dev/null 2>&1; then
    echo "✓ Profile '$PROFILE_NAME' already exists"
    PROFILE_ID=$(nstbrowser-ai-agent profile show "$PROFILE_NAME" --json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)
    echo "  Profile ID: $PROFILE_ID"
else
    # Step 2: Create new profile
    echo "Creating new profile..."
    CREATE_OUTPUT=$(nstbrowser-ai-agent profile create "$PROFILE_NAME" --json)
    PROFILE_ID=$(echo "$CREATE_OUTPUT" | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)
    echo "✓ Profile created"
    echo "  Profile ID: $PROFILE_ID"
fi

echo ""

# Step 3: Configure proxy if provided
if [ -n "$PROXY_HOST" ] && [ -n "$PROXY_PORT" ]; then
    echo "Configuring proxy..."
    nstbrowser-ai-agent profile proxy update "$PROFILE_ID" \
        --host "$PROXY_HOST" \
        --port "$PROXY_PORT" \
        --type http
    echo "✓ Proxy configured"
    echo "  Host: $PROXY_HOST"
    echo "  Port: $PROXY_PORT"
    echo ""
fi

# Step 4: Display profile details
echo "Profile Details:"
nstbrowser-ai-agent profile show "$PROFILE_ID" --json | head -20

echo ""

# Step 5: Test profile
echo "Testing profile..."
export NST_PROFILE_ID="$PROFILE_ID"
nstbrowser-ai-agent open https://example.com
sleep 2
TITLE=$(nstbrowser-ai-agent get title)
echo "✓ Profile test successful"
echo "  Page title: $TITLE"

# Step 6: Clean up
nstbrowser-ai-agent close
echo ""
echo "=========================================="
echo "Profile setup complete!"
echo "=========================================="
echo ""
echo "To use this profile:"
echo "  export NST_PROFILE=\"$PROFILE_NAME\""
echo "  nstbrowser-ai-agent open https://example.com"
echo ""
echo "Or:"
echo "  export NST_PROFILE_ID=\"$PROFILE_ID\""
echo "  nstbrowser-ai-agent open https://example.com"
