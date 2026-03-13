---
name: nstbrowser-ai-agent
description: Browser automation CLI with Nstbrowser integration for AI agents. Use when the user needs advanced browser fingerprinting, profile management, proxy configuration, batch operations on multiple browser profiles, or cursor-based pagination for large datasets. Triggers include requests to "use NST profile", "configure proxy for profile", "manage browser profiles", "batch update profiles", "start multiple browsers", "list profiles with pagination", or any task requiring Nstbrowser's anti-detection features.
allowed-tools: Bash(npx nstbrowser-ai-agent:*), Bash(nstbrowser-ai-agent:*)
---

# nstbrowser-ai-agent - Quick Reference

## Prerequisites

**Required**: Nstbrowser desktop client must be installed and running
- Download: https://www.nstbrowser.io/
- Start the desktop application
- Obtain API key from dashboard

## Quick Setup

```bash
# 1. Configure API key (required)
nstbrowser-ai-agent config set key YOUR_API_KEY

# 2. Verify connection
nstbrowser-ai-agent profile list

# 3. Ready to use!
```

## Core Commands

### Configuration
```bash
nstbrowser-ai-agent config set key YOUR_KEY    # Set API key
nstbrowser-ai-agent config show                # Show current config
```

### Diagnostics & Troubleshooting
```bash
nstbrowser-ai-agent diagnose                   # Run comprehensive environment check
nstbrowser-ai-agent verify [--profile <name-or-id>]  # Test browser functionality
nstbrowser-ai-agent repair                     # Attempt automatic fixes
```

### Profile Management (NST)
```bash
nstbrowser-ai-agent profile list               # List all profiles
nstbrowser-ai-agent profile create <name>      # Create new profile
nstbrowser-ai-agent profile delete <id>        # Delete profile
nstbrowser-ai-agent profile proxy update <id>  # Update proxy settings
nstbrowser-ai-agent profile tags create <id> <tag> # Add tags to profile
nstbrowser-ai-agent profile cache clear <id>   # Clear profile cache
```

### Browser Control (NST)
```bash
nstbrowser-ai-agent browser start-once         # Start temporary browser
nstbrowser-ai-agent browser list               # List running browsers
nstbrowser-ai-agent browser stop <id>          # Stop browser
nstbrowser-ai-agent browser start <profile-id> # Start browser for profile
nstbrowser-ai-agent browser stop-all           # Stop all browsers
```

### Page Interaction
All browser action commands support `[--profile <name-or-id>]` to specify which profile to use.

```bash
nstbrowser-ai-agent open <url> [--profile <name-or-id>]               # Navigate to URL
nstbrowser-ai-agent snapshot -i [--profile <name-or-id>]              # Get interactive elements with refs
nstbrowser-ai-agent click @e1 [--profile <name-or-id>]                # Click element by ref
nstbrowser-ai-agent click @e1 --new-tab [--profile <name-or-id>]      # Click and open in new tab
nstbrowser-ai-agent fill @e2 "text" [--profile <name-or-id>]          # Fill input field
nstbrowser-ai-agent type @e2 "text" [--profile <name-or-id>]          # Type into element
nstbrowser-ai-agent hover @e3 [--profile <name-or-id>]                # Hover over element
nstbrowser-ai-agent focus @e4 [--profile <name-or-id>]                # Focus element
nstbrowser-ai-agent check @e5 [--profile <name-or-id>]                # Check checkbox
nstbrowser-ai-agent uncheck @e6 [--profile <name-or-id>]              # Uncheck checkbox
nstbrowser-ai-agent select @e7 "value" [--profile <name-or-id>]       # Select dropdown option
nstbrowser-ai-agent drag @e8 @e9 [--profile <name-or-id>]             # Drag and drop
nstbrowser-ai-agent upload @e10 ./file.pdf [--profile <name-or-id>]   # Upload files
nstbrowser-ai-agent download @e11 ./file.pdf [--profile <name-or-id>] # Download file
```

### Navigation & Waiting
```bash
nstbrowser-ai-agent back [--profile <name-or-id>]                     # Go back
nstbrowser-ai-agent forward [--profile <name-or-id>]                  # Go forward
nstbrowser-ai-agent reload [--profile <name-or-id>]                   # Reload page
nstbrowser-ai-agent wait @e1 [--profile <name-or-id>]                 # Wait for element
nstbrowser-ai-agent wait 2000 [--profile <name-or-id>]                # Wait milliseconds
nstbrowser-ai-agent wait --load networkidle [--profile <name-or-id>]  # Wait for load state
nstbrowser-ai-agent wait --url "**/dashboard" [--profile <name-or-id>]  # Wait for URL pattern
nstbrowser-ai-agent wait --text "Welcome" [--profile <name-or-id>]    # Wait for text
nstbrowser-ai-agent wait --download ./file.pdf [--profile <name-or-id>]  # Wait for download
```

### Keyboard & Mouse
```bash
nstbrowser-ai-agent press Enter [--profile <name-or-id>]              # Press key
nstbrowser-ai-agent press Control+a [--profile <name-or-id>]          # Key combination
nstbrowser-ai-agent keyboard type "Hello" [--profile <name-or-id>]    # Type without selector
nstbrowser-ai-agent keyboard inserttext "text" [--profile <name-or-id>]  # Insert text
nstbrowser-ai-agent mouse move 100 200 [--profile <name-or-id>]       # Move mouse
nstbrowser-ai-agent mouse click [--profile <name-or-id>]              # Mouse click
nstbrowser-ai-agent scroll down 500 [--profile <name-or-id>]          # Scroll page
nstbrowser-ai-agent scrollintoview @e1 [--profile <name-or-id>]       # Scroll element into view
```

### Data Extraction
```bash
nstbrowser-ai-agent get title [--profile <name-or-id>]                # Get page title
nstbrowser-ai-agent get url [--profile <name-or-id>]                  # Get current URL
nstbrowser-ai-agent get text @e1 [--profile <name-or-id>]             # Get element text
nstbrowser-ai-agent get html @e2 [--profile <name-or-id>]             # Get element HTML
nstbrowser-ai-agent get value @e3 [--profile <name-or-id>]            # Get input value
nstbrowser-ai-agent get attr @e4 href [--profile <name-or-id>]        # Get attribute
nstbrowser-ai-agent get count "li.item" [--profile <name-or-id>]      # Count elements
nstbrowser-ai-agent get box @e5 [--profile <name-or-id>]              # Get bounding box
nstbrowser-ai-agent get styles @e6 [--profile <name-or-id>]           # Get computed styles
nstbrowser-ai-agent eval "document.title" [--profile <name-or-id>]    # Execute JavaScript
```

### Element State Checking
```bash
nstbrowser-ai-agent is visible @e1 [--profile <name-or-id>]           # Check if visible
nstbrowser-ai-agent is enabled @e2 [--profile <name-or-id>]           # Check if enabled
nstbrowser-ai-agent is checked @e3 [--profile <name-or-id>]           # Check if checked
```

### Semantic Element Finding
```bash
nstbrowser-ai-agent find role button click --name Submit
nstbrowser-ai-agent find text "Sign In" click
nstbrowser-ai-agent find label "Email" fill "user@example.com"
nstbrowser-ai-agent find placeholder "Search..." type "query"
nstbrowser-ai-agent find testid "login-form" click
nstbrowser-ai-agent find first "li.item" click
nstbrowser-ai-agent find nth 2 ".card" hover
```

### Screenshots & Recording
```bash
nstbrowser-ai-agent screenshot [path]          # Take screenshot
nstbrowser-ai-agent screenshot --full          # Full page screenshot
nstbrowser-ai-agent screenshot --annotate      # Annotated with element refs
nstbrowser-ai-agent pdf ./page.pdf             # Save as PDF
nstbrowser-ai-agent record start ./demo.webm   # Start video recording
nstbrowser-ai-agent record stop                # Stop recording
```

## Quick Start Workflows

### Workflow 1: Temporary Browser (No Profile)
```bash
# Start temporary browser and navigate
nstbrowser-ai-agent browser start-once
nstbrowser-ai-agent open https://example.com
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent click @e1
nstbrowser-ai-agent close
```

### Workflow 2: Profile-based Session (Recommended)
```bash
# All browser commands can use --profile parameter
nstbrowser-ai-agent --profile my-profile open https://example.com
nstbrowser-ai-agent --profile my-profile snapshot -i
nstbrowser-ai-agent --profile my-profile fill @e1 "user@example.com"
nstbrowser-ai-agent --profile my-profile fill @e2 "password"
nstbrowser-ai-agent --profile my-profile click @e3
nstbrowser-ai-agent --profile my-profile close

# Or use UUID format (auto-detected)
nstbrowser-ai-agent --profile "527e7b55-ca19-4422-89e4-88af4cf0f543" open https://example.com
```

### Workflow 3: Data Extraction with Profile
```bash
# Extract information from page using specific profile
nstbrowser-ai-agent --profile data-scraper open https://example.com
nstbrowser-ai-agent --profile data-scraper wait --load networkidle
nstbrowser-ai-agent --profile data-scraper snapshot -i
nstbrowser-ai-agent --profile data-scraper get text @e1
nstbrowser-ai-agent --profile data-scraper eval "document.querySelectorAll('h2').length"
nstbrowser-ai-agent --profile data-scraper screenshot --annotate page.png
```

### Workflow 4: Advanced Automation with State Management
```bash
# Save authentication state for reuse
nstbrowser-ai-agent --profile auth-profile open https://app.example.com/login
nstbrowser-ai-agent --profile auth-profile fill @e1 "user@example.com"
nstbrowser-ai-agent --profile auth-profile fill @e2 "password"
nstbrowser-ai-agent --profile auth-profile click @e3
nstbrowser-ai-agent --profile auth-profile wait --text "Dashboard"
nstbrowser-ai-agent --profile auth-profile state save ./auth-state.json

# Later, restore state and continue
nstbrowser-ai-agent --profile auth-profile state load ./auth-state.json
nstbrowser-ai-agent --profile auth-profile open https://app.example.com/dashboard
nstbrowser-ai-agent --profile auth-profile snapshot -i
```

### Workflow 5: Multi-tab Operations
```bash
# Work with multiple tabs using same profile
nstbrowser-ai-agent --profile multi-tab open https://example.com
nstbrowser-ai-agent --profile multi-tab tab new https://another-site.com
nstbrowser-ai-agent --profile multi-tab tab 1  # Switch to second tab
nstbrowser-ai-agent --profile multi-tab click @e1
nstbrowser-ai-agent --profile multi-tab tab 0  # Switch back to first tab
nstbrowser-ai-agent --profile multi-tab screenshot
```

### Storage & Cookies Management
```bash
nstbrowser-ai-agent cookies                    # Get all cookies
nstbrowser-ai-agent cookies set name "value"   # Set cookie
nstbrowser-ai-agent cookies set auth "token" --domain example.com --httpOnly --secure
nstbrowser-ai-agent cookies clear              # Clear all cookies
nstbrowser-ai-agent storage local              # Get localStorage
nstbrowser-ai-agent storage local set key "value" # Set localStorage
nstbrowser-ai-agent storage session get key    # Get sessionStorage
nstbrowser-ai-agent storage local clear        # Clear localStorage
```

### Network & Debugging
```bash
nstbrowser-ai-agent network route "**/api/*" --abort # Block API requests
nstbrowser-ai-agent network route "**/data.json" --body '{"mock": true}'
nstbrowser-ai-agent network requests           # List captured requests
nstbrowser-ai-agent network requests --clear   # Clear request log
nstbrowser-ai-agent console                    # View console logs
nstbrowser-ai-agent errors                     # View page errors
nstbrowser-ai-agent trace start                # Start Playwright trace
nstbrowser-ai-agent trace stop ./trace.zip     # Stop and save trace
nstbrowser-ai-agent profiler start             # Start Chrome DevTools profiling
nstbrowser-ai-agent profiler stop ./profile.json # Stop and save profile
```

### Tab & Window Management
```bash
nstbrowser-ai-agent tab                        # List all tabs
nstbrowser-ai-agent tab new https://example.com # Open new tab
nstbrowser-ai-agent tab 2                      # Switch to tab 2
nstbrowser-ai-agent tab close                  # Close current tab
nstbrowser-ai-agent tab close 1                # Close tab 1
nstbrowser-ai-agent window new                 # Open new window
nstbrowser-ai-agent frame "#iframe"            # Switch to iframe
nstbrowser-ai-agent frame main                 # Switch back to main frame
```

### Browser Settings & Emulation
```bash
nstbrowser-ai-agent set viewport 1920 1080     # Set viewport size
nstbrowser-ai-agent set device "iPhone 12"     # Emulate device
nstbrowser-ai-agent set geo 37.7749 -122.4194  # Set geolocation
nstbrowser-ai-agent set offline on             # Enable offline mode
nstbrowser-ai-agent set headers '{"X-Custom": "value"}' # Set HTTP headers
nstbrowser-ai-agent set credentials admin pass # Set HTTP auth
nstbrowser-ai-agent set media dark             # Set color scheme
```

### State Management
```bash
nstbrowser-ai-agent state save ./auth-state.json # Save browser state
nstbrowser-ai-agent state load ./auth-state.json # Load browser state
nstbrowser-ai-agent state list                 # List saved states
nstbrowser-ai-agent state show filename.json   # Show state summary
nstbrowser-ai-agent state clear --all          # Clear all states
```

### Comparison & Diffing
```bash
nstbrowser-ai-agent diff snapshot              # Compare current vs last snapshot
nstbrowser-ai-agent diff snapshot --baseline before.txt # Compare vs saved snapshot
nstbrowser-ai-agent diff screenshot --baseline before.png # Visual diff
nstbrowser-ai-agent diff url https://v1.com https://v2.com # Compare two pages
nstbrowser-ai-agent diff url https://staging.com https://prod.com --screenshot
```

### Dialog Handling
```bash
nstbrowser-ai-agent dialog accept              # Accept alert/confirm
nstbrowser-ai-agent dialog accept "input text" # Accept prompt with text
nstbrowser-ai-agent dialog dismiss             # Dismiss/cancel dialog
```

## Global Options (Apply to ALL commands)

### Profile Selection
```bash
--profile <name-or-id>     # Use specific NST profile (name or UUID)
                          # Examples: --profile "my-profile" or --profile "527e7b55-ca19-4422-89e4-88af4cf0f543"
```

### Session Management  
```bash
--session <name>          # Use isolated session
--session-name <name>     # Auto-save/restore state across restarts
```

### Output Control
```bash
--json                    # JSON output for all commands
--content-boundaries      # Wrap page content in boundary markers
--max-output <chars>      # Truncate output to N characters
```

### Browser Configuration
```bash
--headers <json>          # HTTP headers (scoped to origin)
--user-agent <ua>         # Custom User-Agent
--proxy <server>          # Proxy server (http://user:pass@host:port)
--proxy-bypass <hosts>    # Bypass proxy for hosts
--color-scheme <scheme>   # dark, light, no-preference
--download-path <path>    # Default download directory
```

## Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "HTTP 400: Bad Request" | Start Nstbrowser desktop client and verify API key |
| "Profile not found" | Use `profile list` to see available profiles, or check profile name/ID |
| "Element not found" | Run `snapshot -i` to refresh element refs after page changes |
| "@e1 not working" | Element refs change after navigation - get fresh snapshot |
| "Browser not running" | Use `browser start <profile-id>` or `browser start-once` |
| "Command timeout" | Use appropriate wait strategies: `wait --load networkidle` |
| "Stale element reference" | Re-run `snapshot -i` after DOM changes |
| "Profile ID vs name confusion" | Both work - UUID format auto-detected as ID, others as name |
| "Headers not working" | Headers are scoped to origin - use `--headers` with `open` command |
| "Download not saving" | Specify full path: `download @e1 ./downloads/file.pdf` |
| "Screenshot annotation missing" | Use `--annotate` flag: `screenshot --annotate` |
| "State not persisting" | Use `--session-name` for auto-persistence or manual `state save/load` |

## Advanced Features

- **Proxy Configuration**: `profile proxy update <id> --host proxy.com --port 8080`
- **Batch Operations**: `profile delete id1 id2 id3`
- **Tab Management**: `tab new <url>`, `tab 0`, `tab close`
- **Wait Strategies**: `wait 3000`, `wait --load networkidle`

## Best Practices

1. **Always Use Profile Parameters**: Specify `--profile <name-or-id>` for all browser operations to ensure consistent fingerprinting and session management
2. **Profile ID vs Name**: Use profile IDs (UUID format) for reliability, names for readability - both are auto-detected
3. **Refresh Element References**: Run `snapshot -i` after tab switches, page changes, or navigation to get fresh @e references
4. **Use JSON Output for Integration**: Add `--json` to any command for machine-readable output in AI agent workflows
5. **Handle Async Operations**: Use appropriate wait strategies (`--load networkidle`, `wait --text`, `wait @element`) for dynamic content
6. **State Persistence**: Use `--session-name` for automatic state persistence across browser restarts
7. **Error Handling**: Check command output and retry with fresh snapshots if element references become stale
8. **Security**: Use `--content-boundaries` to safely parse page content and avoid injection attacks
9. **Performance**: Use `--max-output` to limit large page content, `snapshot --compact` to reduce noise
10. **Debugging**: Use `--annotate` screenshots for visual debugging, `trace start/stop` for detailed analysis

## Profile Parameter Usage

**All browser action commands support the `--profile` parameter:**

```bash
# Navigation commands
nstbrowser-ai-agent --profile my-profile open <url>
nstbrowser-ai-agent --profile my-profile back
nstbrowser-ai-agent --profile my-profile forward
nstbrowser-ai-agent --profile my-profile reload

# Interaction commands  
nstbrowser-ai-agent --profile my-profile click @e1
nstbrowser-ai-agent --profile my-profile fill @e2 "text"
nstbrowser-ai-agent --profile my-profile type @e3 "text"
nstbrowser-ai-agent --profile my-profile hover @e4
nstbrowser-ai-agent --profile my-profile drag @e5 @e6

# Data extraction commands
nstbrowser-ai-agent --profile my-profile snapshot -i
nstbrowser-ai-agent --profile my-profile get text @e1
nstbrowser-ai-agent --profile my-profile screenshot
nstbrowser-ai-agent --profile my-profile eval "code"

# State and storage commands
nstbrowser-ai-agent --profile my-profile cookies set name "value"
nstbrowser-ai-agent --profile my-profile storage local set key "value"
nstbrowser-ai-agent --profile my-profile state save ./state.json

# All other browser commands...
```

**Profile Resolution Priority:**
1. Check running browsers (by ID or name, use earliest if multiple)
2. Start browser if profile exists but not running  
3. Create new profile if name doesn't exist
4. Error if ID doesn't exist
5. Use temporary browser if no profile specified

## Full Documentation

Complete documentation: https://github.com/nstbrowser/nstbrowser-ai-agent#readme

## Notes

- All browser operations use Nstbrowser profiles for advanced fingerprinting
- Temporary browsers (`browser start-once`) don't save session state
- Profile sessions persist cookies, localStorage, and login state
- Element refs (@e1, @e2) are generated by `snapshot -i` command