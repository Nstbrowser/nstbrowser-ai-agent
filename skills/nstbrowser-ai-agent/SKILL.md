---
name: nstbrowser-ai-agent
description: Browser automation CLI with Nstbrowser integration for AI agents. Use when the user needs advanced browser fingerprinting, profile management, proxy configuration, batch operations on multiple browser profiles, CDP connections, or cursor-based pagination for large datasets. Triggers include requests to "use NST profile", "configure proxy for profile", "manage browser profiles", "batch update profiles", "start multiple browsers", "connect to CDP", "list profiles with pagination", or any task requiring Nstbrowser's anti-detection features.
allowed-tools: Bash(npx nstbrowser-ai-agent:*), Bash(nstbrowser-ai-agent:*)
---

# Browser Automation with nstbrowser-ai-agent (Nstbrowser Integration)

## Overview

This skill enables AI agents to control browsers using nstbrowser-ai-agent CLI with Nstbrowser integration. Nstbrowser provides advanced browser fingerprinting, profile management, and anti-detection capabilities for professional browser automation.

**Key Features:**
- Advanced browser fingerprinting and anti-detection
- Profile management with persistent sessions
- Proxy configuration per profile
- Batch operations on multiple profiles
- Tag and group organization
- Local and cloud browser support

## Core Concepts

### Providers

- **nst (default)**: Uses Nstbrowser with profiles and fingerprinting
- **local**: Uses local Chromium browser (for testing without Nstbrowser)

### Profiles

Nstbrowser profiles store:
- Browser fingerprints (canvas, WebGL, fonts, etc.)
- Cookies and localStorage
- Login sessions
- Proxy settings
- Browser configuration

### Profile Name vs ID

All profile commands support both profile NAME and profile ID:

**Resolution Priority:**
1. Explicit `--profile-id` flag (highest priority)
2. Explicit `--profile` flag (profile name)
3. `NST_PROFILE_ID` environment variable
4. `NST_PROFILE` environment variable
5. Temporary browser (if no profile specified)

**When to use:**
- **Profile Name**: More user-friendly, easier to remember
- **Profile ID**: Guaranteed uniqueness, better for scripts

### Sticky Sessions

Once you start a session with a profile, that session "locks" to that browser instance. Subsequent commands automatically reuse the same browser without repeating the `--profile` flag.

```bash
# First command: link session to profile
nstbrowser-ai-agent --profile my-profile open https://example.com

# Subsequent commands: Stays in 'my-profile' automatically
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent click @e1
```

### Refs

Elements are identified by refs (e.g., @e1, @e2) from snapshots, making automation more reliable than CSS selectors.

## Environment Setup

### Configuration (Recommended)

Configure NST API credentials once using config commands:

```bash
# Set API key (required) - stored in ~/.nst-ai-agent/config.json
nstbrowser-ai-agent config set key <your-api-key>

# Optional: Set custom host (default: 127.0.0.1)
nstbrowser-ai-agent config set host api.example.com

# Optional: Set custom port (default: 8848)
nstbrowser-ai-agent config set port 9000

# View configuration
nstbrowser-ai-agent config show

# Get specific value
nstbrowser-ai-agent config get key
```

Configuration persists across sessions and takes priority over environment variables.

### Environment Variables (Alternative)

```bash
# Nstbrowser API credentials (required if not using config)
export NST_API_KEY="your-api-key"

# Optional: Nstbrowser API endpoint
export NST_HOST="localhost"  # Default: 127.0.0.1
export NST_PORT="8848"       # Default: 8848

# Optional: Default profile
export NST_PROFILE="my-profile-name"
# Or use profile ID
export NST_PROFILE_ID="profile-uuid"
```

**Priority:** Config file > Environment variables > Defaults

### Local Mode (No Nstbrowser)

```bash
# Use local browser instead of Nstbrowser
export NSTBROWSER_AI_AGENT_LOCAL=1
# Or use --local flag
nstbrowser-ai-agent --local open https://example.com
```

## Profile Management Commands

### List Profiles

```bash
# List all profiles
nstbrowser-ai-agent profile list

# List with JSON output
nstbrowser-ai-agent profile list --json
```


### List Profiles with Cursor Pagination

```bash
# List profiles with cursor-based pagination (for large datasets)
nstbrowser-ai-agent profile list-cursor --page-size 50

# Navigate to next page using cursor from previous response
nstbrowser-ai-agent profile list-cursor --cursor "next-page-token" --page-size 50

# More efficient than 'profile list' for large datasets (1000+ profiles)
```
### Show Profile Details

```bash
# Show by profile name (recommended)
nstbrowser-ai-agent profile show my-profile --json

# Show by profile ID
nstbrowser-ai-agent profile show 86581051-fb0d-4c4a-b1e3-ebc1abd17174 --json
```

Returns complete profile information including fingerprint, proxy, tags, groups, and launch history.

### Create Profile

```bash
nstbrowser-ai-agent profile create <name> \
  --proxy-host <host> \
  --proxy-port <port> \
  --proxy-type <http|https|socks5> \
  --proxy-username <user> \
  --proxy-password <pass> \
  --platform <Windows|macOS|Linux> \
  --kernel <version> \
  --group-id <group-id>
```

### Delete Profile

```bash
# Delete single profile
nstbrowser-ai-agent profile delete <profile-id>

# Delete multiple profiles (batch)
nstbrowser-ai-agent profile delete <id-1> <id-2> <id-3>
```

### Profile Groups

```bash
# List all groups
nstbrowser-ai-agent profile groups list

# Move profile(s) to group
nstbrowser-ai-agent profile groups change <group-id> <profile-id> [profile-id...]

# Batch move profiles to group
nstbrowser-ai-agent profile groups batch-change <group-id> <id-1> <id-2> <id-3>
```

## Proxy Management Commands

### Show Proxy Configuration

```bash
# Show by profile name or ID
nstbrowser-ai-agent profile proxy show <name-or-id> --json
```

Returns proxy configuration and check result (IP, location, timezone).

### Update Proxy

```bash
# Update proxy for single profile (supports name or ID)
nstbrowser-ai-agent profile proxy update <name-or-id> \
  --host proxy.example.com \
  --port 8080 \
  --type http \
  --username user \
  --password pass
```

### Reset Proxy

```bash
# Reset single profile
nstbrowser-ai-agent profile proxy reset <profile-id>

# Reset multiple profiles (batch)
nstbrowser-ai-agent profile proxy reset <id-1> <id-2> <id-3>
```

### Batch Proxy Operations

```bash
# Batch update proxy for multiple profiles
nstbrowser-ai-agent profile proxy batch-update \
  <id-1> <id-2> <id-3> \
  --host proxy.example.com \
  --port 8080 \
  --type http \
  --username user \
  --password pass

# Batch reset proxy for multiple profiles
nstbrowser-ai-agent profile proxy batch-reset <id-1> <id-2> <id-3>
```

## Tag Management Commands

### List Tags

```bash
nstbrowser-ai-agent profile tags list
```

### Create Tags

```bash
# Add single tag to profile
nstbrowser-ai-agent profile tags create <profile-id> <tag-name>
```

### Update Tags

```bash
# Update tags with colors (replaces existing tags)
nstbrowser-ai-agent profile tags update <profile-id> \
  production:blue testing:green staging:yellow

# Update tags without colors
nstbrowser-ai-agent profile tags update <profile-id> \
  production testing staging
```

Tag format: `tag-name:color` or just `tag-name`

### Clear Tags

```bash
# Clear single profile
nstbrowser-ai-agent profile tags clear <profile-id>

# Clear multiple profiles (batch)
nstbrowser-ai-agent profile tags clear <id-1> <id-2> <id-3>
```

### Batch Tag Operations

```bash
# Batch create tags for multiple profiles
nstbrowser-ai-agent profile tags batch-create \
  <id-1> <id-2> \
  production:blue automated:green

# Batch update tags (replaces existing)
nstbrowser-ai-agent profile tags batch-update \
  <id-1> <id-2> \
  updated:red verified:green

# Batch clear tags
nstbrowser-ai-agent profile tags batch-clear <id-1> <id-2> <id-3>
```

## Browser Instance Management

### List Running Browsers

```bash
nstbrowser-ai-agent browser list
```

### Start Browser

Profiles can be referenced by name or ID. The system automatically detects UUID patterns:

```bash
# Start by profile name
nstbrowser-ai-agent browser start my-profile
nstbrowser-ai-agent browser start proxy_ph

# Start by profile ID (UUID format auto-detected)
nstbrowser-ai-agent browser start 86581051-fb0d-4c4a-b1e3-ebc1abd17174
nstbrowser-ai-agent browser start ef2b083a-8f77-4a7f-8441-a8d56bbd832b

# Both work the same way - the --profile flag automatically detects the format
# No need to use --profile-id explicitly (though it still works for backward compatibility)

# Start with options
nstbrowser-ai-agent browser start <name-or-id> \
  --headless \
  --auto-close \
  --disable-gpu
```


### Start Multiple Browsers (Batch)

```bash
# Start multiple browsers simultaneously (by name or ID)
nstbrowser-ai-agent browser start-batch profile-1 profile-2 profile-3
nstbrowser-ai-agent browser start-batch proxy_ph ef2b083a-8f77-4a7f-8441-a8d56bbd832b

# Each browser runs independently with its own profile and fingerprint
# Useful for parallel scraping, testing, or automation tasks
```

### Start Temporary Browser

```bash
# Start temporary browser without profile (for one-time use)
nstbrowser-ai-agent browser start-once

# Use for quick tests or disposable sessions
# Browser is automatically cleaned up after use
```

### Stop Browser

```bash
# Stop by profile name or ID
nstbrowser-ai-agent browser stop <name-or-id>

# Stop all browsers
nstbrowser-ai-agent browser stop-all
```

### Get Browser Pages

```bash
# Get list of pages/tabs in running browser
nstbrowser-ai-agent browser pages <name-or-id> --json
```

Returns list of all pages/tabs with URLs and titles.

### Get Debugger URL

```bash
# Get Chrome DevTools debugger URL
nstbrowser-ai-agent browser debugger <name-or-id> --json
```

Returns WebSocket URL for connecting Chrome DevTools.

## Local Data Management

### Clear Cache

```bash
# Clear cache for single profile
nstbrowser-ai-agent profile cache clear <profile-id>

# Clear cache for multiple profiles (batch)
nstbrowser-ai-agent profile cache clear <id-1> <id-2> <id-3>
```

### Clear Cookies

```bash
# Clear cookies for single profile
nstbrowser-ai-agent profile cookies clear <profile-id>

# Clear cookies for multiple profiles (batch)
nstbrowser-ai-agent profile cookies clear <id-1> <id-2> <id-3>
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

# Annotated screenshot with element labels
nstbrowser-ai-agent screenshot --annotate <path>
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

# Check if element is visible
nstbrowser-ai-agent is visible @e5
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

### Close Browser

```bash
nstbrowser-ai-agent close
```

## Workflow Patterns

### Pattern 1: Profile-based Automation (Using Profile Name)

```bash
# 1. Set API key
export NST_API_KEY="your-key"

# 2. List profiles to find target
nstbrowser-ai-agent profile list

# 3. Set profile by name (RECOMMENDED)
export NST_PROFILE="my-profile"

# 4. Open browser (auto-uses profile, auto-starts if not running)
nstbrowser-ai-agent open https://example.com

# 5. Get snapshot
nstbrowser-ai-agent snapshot -i

# 6. Interact with page
nstbrowser-ai-agent click @e1
nstbrowser-ai-agent fill @e2 "data"

# 7. Close (session saved to profile)
nstbrowser-ai-agent close
```

### Pattern 2: Batch Profile Management

```bash
# Get multiple profile IDs
PROFILE_IDS=$(nstbrowser-ai-agent profile list --json | jq -r '.data.profiles[0:3] | map(.profileId) | join(" ")')

# Batch update proxy
nstbrowser-ai-agent profile proxy batch-update $PROFILE_IDS \
  --host proxy.example.com \
  --port 8080 \
  --type http

# Batch add tags
nstbrowser-ai-agent profile tags batch-create $PROFILE_IDS \
  automated:blue batch-updated:green

# Batch move to group
GROUP_ID=$(nstbrowser-ai-agent profile groups list --json | jq -r '.data.groups[0].groupId')
nstbrowser-ai-agent profile groups batch-change $GROUP_ID $PROFILE_IDS
```

### Pattern 3: Parallel Tasks (Isolation)

```bash
# Task 1 in browser A
nstbrowser-ai-agent --session task-a --profile profile-1 open site1.com

# Task 2 in browser B (Parallel)
nstbrowser-ai-agent --session task-b --profile profile-2 open site2.com

# Interact with Task A without affecting Task B
nstbrowser-ai-agent --session task-a click @e1
```

### Pattern 4: Login and Scrape

```bash
# 1. Open login page
nstbrowser-ai-agent open https://site.com/login

# 2. Wait for page to load
nstbrowser-ai-agent wait --load networkidle

# 3. Fill and submit using CSS selectors
nstbrowser-ai-agent fill 'input[placeholder="Email"]' "username"
nstbrowser-ai-agent fill 'input[type="password"]' "password"
nstbrowser-ai-agent click 'button[type="submit"]'

# 4. Wait for navigation
nstbrowser-ai-agent wait --load networkidle

# 5. Navigate to target page
nstbrowser-ai-agent open https://site.com/data

# 6. Extract data
nstbrowser-ai-agent snapshot -i > data.txt
nstbrowser-ai-agent eval "document.querySelector('.info')?.textContent"

# 7. Close (session saved to profile)
nstbrowser-ai-agent close
```

## Best Practices

1. **Use Profile Names**: More readable than IDs for most use cases
2. **Set Environment Variables**: Use `NST_PROFILE` for consistent profile usage
3. **Leverage Sticky Sessions**: No need to repeat `--profile` flag
4. **Use Batch Operations**: More efficient for multiple profiles
5. **Organize with Groups and Tags**: Keep profiles organized
6. **Prefer CSS Selectors for Modern Apps**: Refs may not work with Vue/React/Angular
7. **Wait Appropriately**: Use `wait --load networkidle` after navigation
8. **Close Cleanly**: Always close browser to save session state
9. **Handle Errors**: Check command output and retry if needed
10. **Use Proxies Per Profile**: Configure proxies for geo-targeting or privacy

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
nstbrowser-ai-agent profile list --json
nstbrowser-ai-agent snapshot -i --json
nstbrowser-ai-agent get text @e1 --json
```

## Error Handling

### Common Issues

**"NST_API_KEY is required"**
- Solution: Set `export NST_API_KEY="your-key"`

**"Failed to connect to Nstbrowser"**
- Solution: Ensure Nstbrowser client is running
- Check: `curl http://localhost:8848/api/v2/profiles`

**"Profile not found"**
- Solution: List profiles with `nstbrowser-ai-agent profile list`
- Verify profile name/ID

**"Element not found" or "Action timed out"**
- Solution: Get fresh snapshot with `nstbrowser-ai-agent snapshot -i`
- Try using CSS selectors instead of refs

### Ref System Limitations

The ref system (`@e1`, `@e2`, etc.) may not work reliably with modern web frameworks (Vue.js, React, Angular).

**Workaround - Use CSS Selectors:**

```bash
# 1. Inspect page elements
nstbrowser-ai-agent eval "Array.from(document.querySelectorAll('input')).map(el => ({type: el.type, placeholder: el.placeholder}))"

# 2. Use CSS selectors directly
nstbrowser-ai-agent fill 'input[placeholder="Email"]' "user@example.com"
nstbrowser-ai-agent fill 'input[type="password"]' "password"
nstbrowser-ai-agent click 'button[type="submit"]'
```

## Command Reference

### Profile Commands
- `profile list` - List all profiles
- `profile show <name-or-id>` - Show profile details
- `profile create <name>` - Create new profile
- `profile delete <id> [id...]` - Delete profile(s)
- `profile groups list` - List all groups
- `profile groups change <group-id> <profile-id> [profile-id...]` - Move profile(s) to group
- `profile groups batch-change <group-id> <id> [id...]` - Batch change group

### Proxy Commands
- `profile proxy show <name-or-id>` - Show proxy configuration
- `profile proxy update <name-or-id>` - Update proxy settings
- `profile proxy reset <id> [id...]` - Reset proxy settings
- `profile proxy batch-update <id> [id...] --host --port` - Batch update proxy
- `profile proxy batch-reset <id> [id...]` - Batch reset proxy

### Tag Commands
- `profile tags list` - List all tags
- `profile tags create <id> <tag>` - Add tag to profile
- `profile tags update <id> <tag:color> [tag:color...]` - Update profile tags
- `profile tags clear <id> [id...]` - Clear profile tags
- `profile tags batch-create <id> [id...] <tag:color>` - Batch create tags
- `profile tags batch-update <id> [id...] <tag:color>` - Batch update tags
- `profile tags batch-clear <id> [id...]` - Batch clear tags

### Browser Commands
- `browser list` - List running browsers
- `browser start <name-or-id>` - Start browser
- `browser stop <name-or-id>` - Stop browser
- `browser stop-all` - Stop all browsers
- `browser pages <name-or-id>` - Get browser pages list
- `browser debugger <name-or-id>` - Get debugger URL

### Local Data Commands
- `profile cache clear <id> [id...]` - Clear profile cache
- `profile cookies clear <id> [id...]` - Clear profile cookies

### Navigation Commands
- `open <url>` - Navigate to URL
- `back` - Go back
- `forward` - Go forward
- `reload` - Reload page

### Inspection Commands
- `snapshot [-i] [-c] [-d <depth>]` - Get page snapshot
- `get title` - Get page title
- `get url` - Get current URL
- `get text <sel>` - Get element text
- `screenshot [path]` - Take screenshot

### Interaction Commands
- `click <sel>` - Click element
- `fill <sel> <text>` - Fill input
- `type <sel> <text>` - Type into element
- `press <key>` - Press key
- `wait <sel|ms>` - Wait for element or time

### Utility Commands
- `eval <js>` - Execute JavaScript
- `close` - Close browser
- `session list` - List active sessions

## Deep-Dive Documentation

| Reference | When to Use |
|-----------|-------------|
| [references/nst-api-reference.md](references/nst-api-reference.md) | Complete NST API reference with all commands |
| [references/profile-management.md](references/profile-management.md) | Profile creation, organization, and lifecycle |
| [references/proxy-configuration.md](references/proxy-configuration.md) | Proxy setup, testing, and troubleshooting |
| [references/batch-operations.md](references/batch-operations.md) | Efficient batch operations on multiple profiles |
| [references/troubleshooting.md](references/troubleshooting.md) | Common issues and diagnostic commands |

## Ready-to-Use Templates

| Template | Description |
|----------|-------------|
| [templates/profile-setup.sh](templates/profile-setup.sh) | Profile initialization with proxy and tags |
| [templates/batch-proxy-update.sh](templates/batch-proxy-update.sh) | Batch proxy update for multiple profiles |
| [templates/automated-workflow.sh](templates/automated-workflow.sh) | Complete automation workflow example |

```bash
./templates/profile-setup.sh my-profile --proxy-host proxy.com --proxy-port 8080
./templates/batch-proxy-update.sh "id1 id2 id3" --proxy-host proxy.com --proxy-port 8080
./templates/automated-workflow.sh my-profile https://example.com
```

## Notes

- Nstbrowser is the **default provider** (no `-p nst` flag needed)
- **Profile name/ID support**: All commands accept both names and IDs
- **Auto-start**: Browser automatically starts when using profile name if not running
- **Name resolution**: Profile names are resolved to IDs automatically via API
- **Sticky sessions**: Profile persists across commands in the same session
- Profiles are managed by Nstbrowser client, not the CLI
- Daemon auto-starts on first command and persists between commands
- Use `--local` flag for local browser mode (no Nstbrowser required)
- Session state is automatically saved to profiles when browser closes

### Get CDP WebSocket URL

```bash
# Get CDP URL for existing browser instance
nstbrowser-ai-agent browser cdp-url <name-or-id>

# Get CDP URL for temporary browser
nstbrowser-ai-agent browser cdp-url-once
```

Returns WebSocket URL that can be used to connect Chrome DevTools, Puppeteer, Playwright, or other CDP-compatible tools.

### Connect to Browser and Get CDP URL

```bash
# Connect to browser (starts if not running) and get CDP URL
nstbrowser-ai-agent browser connect <name-or-id>

# Connect to temporary browser and get CDP URL
nstbrowser-ai-agent browser connect-once
```

These commands start the browser if it's not already running, then return the CDP WebSocket URL.

**Use cases:**
- Connect Puppeteer/Playwright to Nstbrowser-managed browsers
- Attach Chrome DevTools for debugging
- Integrate with custom CDP-based automation tools
- Monitor browser activity with external tools
