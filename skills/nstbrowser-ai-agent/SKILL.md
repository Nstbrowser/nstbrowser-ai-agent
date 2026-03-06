---
name: nstbrowser-ai-agent
description: Headless browser automation CLI with Nstbrowser cloud integration. Supports profile management, fingerprinting, proxy configuration, and advanced browser automation for AI agents. Use for web scraping, testing, form automation, and any browser task requiring session persistence or anti-detection.
allowed-tools: Bash(npx nstbrowser-ai-agent:*), Bash(nstbrowser-ai-agent:*)
---

# nstbrowser-ai-agent Skill

Headless browser automation CLI for AI agents with Nstbrowser integration.

## Overview

This skill enables AI agents to control browsers using the nstbrowser-ai-agent CLI. It supports:
- **Local browser mode**: Uses local Chromium for testing and development
- **Nstbrowser cloud mode**: Advanced fingerprinting, profile management, and anti-detection

## Installation

Check if the CLI is installed:
```bash
nstbrowser-ai-agent --version  # Should show 0.16.1 or higher
```

If not installed:
```bash
npm install -g nstbrowser-ai-agent
```

## Core Concepts

### Providers
- **nst (default)**: Uses Nstbrowser with profiles and fingerprinting
- **local**: Uses local Chromium browser (for testing)

### Profiles
Nstbrowser profiles store:
- Browser fingerprints (canvas, WebGL, fonts, etc.)
- Cookies and localStorage
- Login sessions
- Proxy settings
- Browser configuration

### Refs
Elements are identified by refs (e.g., @e1, @e2) from snapshots, making automation more reliable than CSS selectors.

## Environment Setup

### Nstbrowser Mode (Default)
```bash
export NST_API_KEY="your-api-key"
export NST_HOST="localhost"  # Optional, default: localhost
export NST_PORT="8848"       # Optional, default: 8848
```

### Local Mode
```bash
# Use --local flag for each command
nstbrowser-ai-agent --local open https://example.com

# Or set environment variable
export NSTBROWSER_AI_AGENT_LOCAL=1
```

## Profile Name/ID Resolution

**IMPORTANT**: All profile-related commands support both profile NAME and profile ID.

### Resolution Priority
1. Explicit `--profile-id` flag (highest priority)
2. Explicit `--profile` flag (profile name)
3. `NST_PROFILE_ID` environment variable
4. `NST_PROFILE` environment variable
5. Once/temporary browser (if no profile specified)

### Name Resolution Logic
When using a profile name:
1. Check running browsers for matching name (use earliest if multiple)
2. If not running, query profile API for matching name
3. Use first matching profile if found
4. Throw error if not found

### Examples
```bash
# Using profile ID
export NST_PROFILE_ID="86581051-fb0d-4c4a-b1e3-ebc1abd17174"
nstbrowser-ai-agent open https://example.com

# Using profile name (more user-friendly)
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com

# Using command-line flags
nstbrowser-ai-agent --profile my-profile open https://example.com
nstbrowser-ai-agent --profile-id 86581051-fb0d-4c4a-b1e3-ebc1abd17174 open https://example.com
```

## Profile Management Commands

### List Profiles
```bash
# List all profiles
nstbrowser-ai-agent profile list

# List with JSON output
nstbrowser-ai-agent profile list --json
```

Returns list of profiles with IDs, names, groups, proxy settings, and more.

### Create Profile
```bash
# Create basic profile
nstbrowser-ai-agent profile create my-profile

# Create with proxy
nstbrowser-ai-agent profile create my-profile \
  --proxy-host 127.0.0.1 \
  --proxy-port 1080 \
  --proxy-type http \
  --proxy-enabled
```

### Show Profile Details
```bash
# Show by profile ID
nstbrowser-ai-agent profile show <profile-id> --json

# Show by profile name
nstbrowser-ai-agent profile show <profile-name> --json
```

Returns complete profile information including name, ID, platform, fingerprint, and configuration.

### Delete Profile
```bash
# Delete single profile
nstbrowser-ai-agent profile delete <profile-id>

# Delete multiple profiles
nstbrowser-ai-agent profile delete <id1> <id2> <id3>
```

### Show Proxy Configuration
```bash
# Show by profile ID
nstbrowser-ai-agent profile proxy show <profile-id> --json

# Show by profile name
nstbrowser-ai-agent profile proxy show <profile-name> --json
```

Returns proxy configuration and connection status.

## Profile Groups Management

### List Groups
```bash
nstbrowser-ai-agent profile groups list --json
```

Returns all profile groups with IDs and names.

### Change Profile Group
```bash
# Move single profile to group
nstbrowser-ai-agent profile group change <group-id> <profile-id>

# Move multiple profiles to group (batch)
nstbrowser-ai-agent profile group batch-change <group-id> <id1> <id2> <id3>
```

## Proxy Management

### Update Proxy
```bash
# Update single profile proxy
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host 127.0.0.1 \
  --port 1080 \
  --type http

# Batch update multiple profiles
nstbrowser-ai-agent profile proxy batch-update <id1> <id2> <id3> \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

### Reset Proxy
```bash
# Reset single profile proxy
nstbrowser-ai-agent profile proxy reset <profile-id>

# Batch reset multiple profiles
nstbrowser-ai-agent profile proxy batch-reset <id1> <id2> <id3>
```

## Browser Instance Management

### List Running Browsers
```bash
nstbrowser-ai-agent browser list --json
```

Returns list of running browser instances with profile IDs and status.

### Start Browser
```bash
# Start browser for profile
nstbrowser-ai-agent browser start <profile-id>

# Start with custom config
nstbrowser-ai-agent browser start <profile-id> \
  --headless \
  --remote-debugging-port 9222
```

### Stop Browser
```bash
# Stop single browser
nstbrowser-ai-agent browser stop <profile-id>

# Stop all browsers
nstbrowser-ai-agent browser stop-all
```

### Get Browser Pages
```bash
nstbrowser-ai-agent browser pages <profile-id> --json
```

Returns list of open pages/tabs in the browser.

### Get Debugger URL
```bash
nstbrowser-ai-agent browser debugger <profile-id> --json
```

Returns Chrome DevTools debugger WebSocket URL.

## Tag Management

### List Tags
```bash
nstbrowser-ai-agent profile tags list --json
```

### Create Tags
```bash
# Create tag for single profile
nstbrowser-ai-agent profile tags create <profile-id> "tag-name"

# Batch create tags for multiple profiles
nstbrowser-ai-agent profile tags batch-create <id1> <id2> <id3> \
  --tags "tag1" "tag2"
```

### Clear Tags
```bash
# Clear tags from single profile
nstbrowser-ai-agent profile tags clear <profile-id>

# Batch clear tags from multiple profiles
nstbrowser-ai-agent profile tags batch-clear <id1> <id2> <id3>
```

## Browser Automation Commands

### Navigation
```bash
# Open URL (auto-launches browser if not running)
nstbrowser-ai-agent open <url>

# Navigate back/forward
nstbrowser-ai-agent back
nstbrowser-ai-agent forward
nstbrowser-ai-agent reload
```

### Page Inspection
```bash
# Get accessibility snapshot with refs (best for AI)
nstbrowser-ai-agent snapshot -i

# Get page title
nstbrowser-ai-agent get title

# Get current URL
nstbrowser-ai-agent get url

# Take screenshot
nstbrowser-ai-agent screenshot <path>
```

### Element Interaction
```bash
# Click element by ref
nstbrowser-ai-agent click @e1

# Fill input by ref
nstbrowser-ai-agent fill @e2 "text"

# Type into element
nstbrowser-ai-agent type @e3 "text"

# Get element text
nstbrowser-ai-agent get text @e4
```

### JavaScript Execution
```bash
# Execute JavaScript
nstbrowser-ai-agent eval "document.title"

# Execute with stdin
echo "document.querySelectorAll('a').length" | nstbrowser-ai-agent eval --stdin
```

### Wait Commands
```bash
# Wait for element
nstbrowser-ai-agent wait <selector>

# Wait for time (milliseconds)
nstbrowser-ai-agent wait 3000

# Wait for page load
nstbrowser-ai-agent wait --load networkidle
```

### Cookies and Storage
```bash
# Get cookies
nstbrowser-ai-agent cookies get --json

# Set cookie
nstbrowser-ai-agent cookies set name value

# Clear cookies
nstbrowser-ai-agent cookies clear

# Execute JavaScript for storage
nstbrowser-ai-agent eval "localStorage.setItem('key', 'value')"
nstbrowser-ai-agent eval "localStorage.getItem('key')"
```

### State Management
```bash
# Save browser state (cookies, localStorage, etc.)
nstbrowser-ai-agent state save <path>

# List saved states
nstbrowser-ai-agent state list
```

### Close Browser
```bash
nstbrowser-ai-agent close
```

## Workflow Patterns

### Pattern 1: Profile-based Automation
```bash
# 1. Set API key
export NST_API_KEY="your-key"

# 2. List profiles to find target
nstbrowser-ai-agent profile list

# 3. Set profile (by name or ID)
export NST_PROFILE="my-profile"

# 4. Open browser (auto-uses profile)
nstbrowser-ai-agent open https://example.com

# 5. Get snapshot
nstbrowser-ai-agent snapshot -i

# 6. Interact with page
nstbrowser-ai-agent click @e1
nstbrowser-ai-agent fill @e2 "data"

# 7. Close (session saved to profile)
nstbrowser-ai-agent close
```

### Pattern 2: Login and Scrape
```bash
# 1. Open login page
nstbrowser-ai-agent open https://site.com/login

# 2. Get form elements
nstbrowser-ai-agent snapshot -i

# 3. Fill and submit
nstbrowser-ai-agent fill @e1 "username"
nstbrowser-ai-agent fill @e2 "password"
nstbrowser-ai-agent click @e3

# 4. Wait for navigation
nstbrowser-ai-agent wait --load networkidle

# 5. Navigate to target page
nstbrowser-ai-agent open https://site.com/data

# 6. Extract data
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent eval "document.querySelector('.info')?.textContent"

# 7. Close
nstbrowser-ai-agent close
```

### Pattern 3: Local Testing
```bash
# Use local browser for quick testing
nstbrowser-ai-agent --local open https://example.com
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent get title
nstbrowser-ai-agent close
```

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
nstbrowser-ai-agent profile list --json
nstbrowser-ai-agent snapshot -i --json
nstbrowser-ai-agent browser list --json
```

## Error Handling

### Common Issues

**"NST_API_KEY is required"**
- Set: `export NST_API_KEY="your-key"`

**"Failed to connect to Nstbrowser"**
- Ensure Nstbrowser client is running
- Check: `curl http://localhost:8848/api/v2/profiles`

**"Profile not found"**
- List profiles: `nstbrowser-ai-agent profile list`
- Verify profile name/ID

**"Element not found"**
- Get fresh snapshot: `nstbrowser-ai-agent snapshot -i`
- Use updated refs

## Best Practices

1. **Always use snapshots**: Get fresh snapshot before interacting with elements
2. **Prefer refs over selectors**: Refs are more reliable and AI-friendly
3. **Wait appropriately**: Use `wait --load networkidle` after navigation
4. **Use profiles for persistence**: Profiles save login state across sessions
5. **Close cleanly**: Always close browser to save session state
6. **Handle errors**: Check command output and retry with fresh snapshot

## Command Reference

### Profile Commands
- `profile list` - List all profiles
- `profile create <name>` - Create new profile
- `profile delete <id>` - Delete profile
- `profile show <name-or-id>` - Show profile details
- `profile proxy show <name-or-id>` - Show proxy config
- `profile proxy update <id>` - Update proxy settings
- `profile proxy reset <id>` - Reset proxy
- `profile proxy batch-update <ids>` - Batch update proxy
- `profile proxy batch-reset <ids>` - Batch reset proxy
- `profile groups list` - List all groups
- `profile group change <group-id> <profile-id>` - Move profile to group
- `profile group batch-change <group-id> <ids>` - Batch move profiles
- `profile tags list` - List all tags
- `profile tags create <id> <tag>` - Create tag
- `profile tags clear <id>` - Clear tags
- `profile tags batch-create <ids>` - Batch create tags
- `profile tags batch-clear <ids>` - Batch clear tags

### Browser Commands
- `browser list` - List running browsers
- `browser start <profile-id>` - Start browser
- `browser stop <profile-id>` - Stop browser
- `browser stop-all` - Stop all browsers
- `browser pages <profile-id>` - Get browser pages
- `browser debugger <profile-id>` - Get debugger URL

### Navigation Commands
- `open <url>` - Navigate to URL
- `back` - Go back
- `forward` - Go forward
- `reload` - Reload page

### Inspection Commands
- `snapshot [-i]` - Get page snapshot
- `get title` - Get page title
- `get url` - Get current URL
- `get text <sel>` - Get element text
- `screenshot [path]` - Take screenshot

### Interaction Commands
- `click <sel>` - Click element
- `fill <sel> <text>` - Fill input
- `type <sel> <text>` - Type into element
- `wait <sel|ms>` - Wait for element or time
- `wait --load <state>` - Wait for load state

### Utility Commands
- `eval <js>` - Execute JavaScript
- `cookies get` - Get cookies
- `cookies set <name> <value>` - Set cookie
- `cookies clear` - Clear cookies
- `state save <path>` - Save state
- `state list` - List saved states
- `close` - Close browser

## Notes

- Nstbrowser is the **default provider** (no `-p nst` flag needed)
- Profiles are managed by Nstbrowser client, not the CLI
- Daemon auto-starts on first command and persists between commands
- Use `--local` flag for local browser mode (no Nstbrowser required)
- All commands work with both profile names and profile IDs
