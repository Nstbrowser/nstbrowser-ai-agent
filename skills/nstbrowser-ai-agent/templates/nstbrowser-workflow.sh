#!/bin/bash
# Template: Complete Nstbrowser Workflow
# Purpose: Demonstrate full workflow with profile, proxy, and automation
# Usage: ./nstbrowser-workflow.sh <profile-name> <target-url>
#
# This template demonstrates:
# 1. Profile setup and verification
# 2. Browser launch with profile
# 3. Navigation and interaction
# 4. Data extraction
# 5. Clean shutdown

set -euo pipefail

PROFILE_NAME="${1:?Usage: $0 <profile-name> <target-url>}"
TARGET_URL="${2:?Usage: $0 <profile-name> <target-url>}"

echo "=========================================="
echo "Nstbrowser Workflow"
echo "=========================================="
echo "Profile: $PROFILE_NAME"
echo "Target: $TARGET_URL"
echo ""

# Step 1: Verify profile exists
echo "[1/6] Verifying profile..."
if ! nstbrowser-ai-agent profile show "$PROFILE_NAME" --json >/dev/null 2>&1; then
    echo "Error: Profile '$PROFILE_NAME' not found"
    echo "Create it first with: nstbrowser-ai-agent profile create $PROFILE_NAME"
    exit 1
fi
echo "✓ Profile verified"
echo ""

# Step 2: Set profile for session
echo "[2/6] Setting up session..."
export NST_PROFILE="$PROFILE_NAME"
echo "✓ Profile set: $PROFILE_NAME"
echo ""

# Step 3: Navigate to target URL
echo "[3/6] Opening target URL..."
nstbrowser-ai-agent open "$TARGET_URL"
nstbrowser-ai-agent wait --load networkidle
echo "✓ Page loaded"
echo ""

# Step 4: Get page snapshot
echo "[4/6] Analyzing page structure..."
nstbrowser-ai-agent snapshot -i > /tmp/page-snapshot.txt
echo "✓ Snapshot saved to /tmp/page-snapshot.txt"
echo ""

# Step 5: Extract page information
echo "[5/6] Extracting page information..."
TITLE=$(nstbrowser-ai-agent get title)
URL=$(nstbrowser-ai-agent get url)
echo "  Title: $TITLE"
echo "  URL: $URL"
echo ""

# Step 6: Take screenshot
echo "[6/6] Capturing screenshot..."
SCREENSHOT_PATH="/tmp/nstbrowser-screenshot-$(date +%Y%m%d-%H%M%S).png"
nstbrowser-ai-agent screenshot "$SCREENSHOT_PATH"
echo "✓ Screenshot saved: $SCREENSHOT_PATH"
echo ""

# Clean up
echo "Closing browser..."
nstbrowser-ai-agent close
echo "✓ Browser closed"
echo ""

echo "=========================================="
echo "Workflow Complete!"
echo "=========================================="
echo ""
echo "Results:"
echo "  Snapshot: /tmp/page-snapshot.txt"
echo "  Screenshot: $SCREENSHOT_PATH"
echo ""
echo "Session data saved to profile: $PROFILE_NAME"
