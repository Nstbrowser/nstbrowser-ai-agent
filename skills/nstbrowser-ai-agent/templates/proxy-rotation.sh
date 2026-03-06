#!/bin/bash
# Template: Proxy Rotation
# Purpose: Rotate proxies across multiple profiles
# Usage: ./proxy-rotation.sh
#
# This template demonstrates:
# 1. Managing proxy pool
# 2. Assigning proxies to profiles
# 3. Testing proxy connections

set -euo pipefail

echo "=========================================="
echo "Proxy Rotation Setup"
echo "=========================================="
echo ""

# Define proxy pool (customize these)
PROXY_POOL=(
    "127.0.0.1:1080"
    "127.0.0.1:1081"
    "127.0.0.1:1082"
)

echo "Proxy Pool:"
for proxy in "${PROXY_POOL[@]}"; do
    echo "  - $proxy"
done
echo ""

# Get profiles
echo "Fetching profiles..."
PROFILE_IDS=$(nstbrowser-ai-agent profile list --json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PROFILE_IDS" ]; then
    echo "No profiles found. Create profiles first."
    exit 1
fi

PROFILE_ARRAY=($PROFILE_IDS)
echo "Found ${#PROFILE_ARRAY[@]} profiles"
echo ""

# Assign proxies to profiles
echo "Assigning proxies..."
INDEX=0
for profile_id in "${PROFILE_ARRAY[@]}"; do
    # Get proxy from pool (round-robin)
    PROXY="${PROXY_POOL[$((INDEX % ${#PROXY_POOL[@]}))]}"
    HOST="${PROXY%:*}"
    PORT="${PROXY#*:}"
    
    echo "Profile: $profile_id"
    echo "  Proxy: $HOST:$PORT"
    
    # Update proxy
    nstbrowser-ai-agent profile proxy update "$profile_id" \
        --host "$HOST" \
        --port "$PORT" \
        --type http
    
    echo "  ✓ Proxy assigned"
    echo ""
    
    INDEX=$((INDEX + 1))
done

echo "=========================================="
echo "Proxy rotation complete!"
echo "=========================================="
echo ""
echo "Verify with:"
echo "  nstbrowser-ai-agent profile proxy show <profile-id> --json"
