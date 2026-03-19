# nstbrowser-ai-agent

Browser automation CLI for Nstbrowser workflows. Fast Rust CLI with a Node.js daemon backend.

## Fast Start

If you only need the shortest path to a working setup:

```bash
npm install -g nstbrowser-ai-agent
nstbrowser-ai-agent config set key YOUR_API_KEY
nstbrowser-ai-agent nst status
nstbrowser-ai-agent profile list
nstbrowser-ai-agent verify --profile YOUR_PROFILE
nstbrowser-ai-agent --profile YOUR_PROFILE open https://example.com
nstbrowser-ai-agent --profile YOUR_PROFILE snapshot -i
```

Important:
- Start the Nstbrowser desktop client first.
- Generate refs with `snapshot` or `screenshot --annotate` before using `@e1`, `@e2`, and similar refs.
- Keep ref-based commands in the same browser context.
- If you are not using `--session`, repeat the same `--profile` on every related browser command.
- If you are using `--session`, changing `--profile` in that same session switches the daemon to the newly requested profile.

## Installation

## Prerequisites

Before using nstbrowser-ai-agent, ensure you have the following:

### 1. Nstbrowser Client

**Nstbrowser client must be installed and running.**

- Download from: https://www.nstbrowser.io/
- Install the client application
- Launch the Nstbrowser client

### 2. Nstbrowser Service

The Nstbrowser API service must be accessible:

- Default endpoint: `http://127.0.0.1:8848`
- Verify service is running:
  ```bash
  nstbrowser-ai-agent nst status
  ```
- Expected output: "NST agent is running and responsive"

### 3. API Key

Obtain your API key from the Nstbrowser dashboard and configure it:

**Method 1: Config File (Recommended)**
```bash
nstbrowser-ai-agent config set key YOUR_API_KEY
```

**Method 2: Environment Variable**
```bash
export NST_API_KEY="YOUR_API_KEY"
```

### 4. Verify Setup

Test your configuration:

```bash
# Check if NST agent is running
nstbrowser-ai-agent nst status

# Check CLI version
nstbrowser-ai-agent --version

# List profiles (verifies API connection)
nstbrowser-ai-agent profile list
```

If you see your profiles or an empty list, your environment is configured correctly.


### npm (Recommended)

Install globally via npm to get the native Rust binary for maximum performance:

```bash
npm install -g nstbrowser-ai-agent
```

This installs the pre-compiled native binary for your platform (Linux, macOS, Windows).

### Quick Start (no install)

Run directly with `npx` if you want to try it without installing globally:

```bash
npx nstbrowser-ai-agent open example.com
```

> **Note:** `npx` routes through Node.js before reaching the Rust CLI, so it is noticeably slower than a global install. For regular use, install globally.

### Project Installation (local dependency)

For projects that want to pin the version in `package.json`:

```bash
npm install nstbrowser-ai-agent
```

Then use via `npx` or `package.json` scripts:

```bash
npx nstbrowser-ai-agent open example.com
```

### Download from GitHub Releases

You can also download pre-built binaries directly from [GitHub Releases](https://github.com/nstbrowser/nstbrowser-ai-agent/releases):

1. Download the binary for your platform:
   - `nstbrowser-ai-agent-linux-x64` (Linux x64)
   - `nstbrowser-ai-agent-linux-arm64` (Linux ARM64)
   - `nstbrowser-ai-agent-darwin-x64` (macOS Intel)
   - `nstbrowser-ai-agent-darwin-arm64` (macOS Apple Silicon)
   - `nstbrowser-ai-agent-win32-x64.exe` (Windows x64)

2. Make it executable (Linux/macOS):
   ```bash
   chmod +x nstbrowser-ai-agent-*
   ```

3. Move to a directory in your PATH:
   ```bash
   sudo mv nstbrowser-ai-agent-* /usr/local/bin/nstbrowser-ai-agent
   ```

### From Source

```bash
git clone https://github.com/nstbrowser/nstbrowser-ai-agent
cd nstbrowser-ai-agent
pnpm install
pnpm build
pnpm build:native   # Requires Rust (https://rustup.rs)
pnpm link --global  # Makes nstbrowser-ai-agent available globally
```

## Updates

### Automatic Update Checks

The CLI automatically checks for updates once every 24 hours and notifies you when a new version is available.

### Manual Update Check

Check for updates manually:

```bash
# Human-readable output
nstbrowser-ai-agent update check

# JSON output
nstbrowser-ai-agent update check --json
```

### Updating

When an update is available:

```bash
# If installed globally
npm install -g nstbrowser-ai-agent@latest

# If using npx
npx nstbrowser-ai-agent@latest

# If installed locally in project
npm install nstbrowser-ai-agent@latest
```

### Linux Dependencies

The tool uses Nstbrowser by default, which handles browser management automatically. No additional dependencies are required.

## Common Workflows

### Using Temporary Browser (Fastest)

Use this only for throwaway work that does not need profile persistence:

```bash
# Start temporary browser
nstbrowser-ai-agent browser start-once

# Open a website
nstbrowser-ai-agent open https://example.com

# Take a snapshot
nstbrowser-ai-agent snapshot -i

# Stop the temporary browser
nstbrowser-ai-agent browser stop-all
```

**Note:** Temporary browsers don't save session state.

### Using Profile (Recommended)

For tasks requiring persistent sessions:

```bash
# List available profiles
nstbrowser-ai-agent profile list

# Create a new profile (if needed)
nstbrowser-ai-agent profile create my-profile

# Verify that the profile is healthy
nstbrowser-ai-agent verify --profile my-profile

# Open browser (auto-starts with profile)
nstbrowser-ai-agent --profile my-profile open https://example.com

# Interact with page
nstbrowser-ai-agent --profile my-profile snapshot -i
nstbrowser-ai-agent --profile my-profile click @e1

# Stop browser for that profile
nstbrowser-ai-agent browser stop my-profile
```

### Profile Specification for Browser Actions

**All browser actions** (open, click, fill, type, etc.) support specifying a profile name or ID. The CLI will automatically handle profile resolution and browser startup.

#### Profile Resolution Priority

When you specify a profile for a browser action, the system follows these rules:

1. **Check running browsers** - First, it looks for a browser already running with the specified name or ID
   - If multiple browsers match a name, the earliest started browser is used
   - Profile IDs always uniquely match a single browser

2. **Start browser if not running** - If the profile exists but isn't running, the browser is automatically started

3. **Create profile if name doesn't exist** - If you specify a profile **name** that doesn't exist, a new profile is automatically created
   - This makes it easy to create profiles on-the-fly

4. **Error if ID doesn't exist** - If you specify a profile **ID** that doesn't exist, an error is thrown
   - Profile IDs are expected to be exact matches

5. **Use once browser if no profile specified** - If no profile is specified:
   - Uses an existing "once" (temporary) browser if one is running
   - Otherwise creates a new temporary browser
   - Temporary browsers don't persist session data

#### UUID Format Auto-Detection

**Important:** The system automatically detects UUID format in profile names and treats them as profile IDs.

```bash
# UUID format is automatically detected and treated as profile ID:
nstbrowser-ai-agent open https://example.com --profile "ef2b083a-8f77-4a7f-8441-a8d56bbd832b"
```

This means:
- You can use `--profile` with either names or IDs
- UUID format (8-4-4-4-12 hex digits) is automatically recognized
- Case-insensitive: both lowercase and uppercase UUIDs work
- Prevents accidental profile creation when you meant to use an ID

#### Specifying Profiles

Use the `--profile` flag to specify which profile to use:

```bash
# By profile name
nstbrowser-ai-agent open https://example.com --profile "my-profile"
nstbrowser-ai-agent click "#button" --profile "my-profile"

# By profile ID (UUID format auto-detected)
nstbrowser-ai-agent open https://example.com --profile "ef2b083a-8f77-4a7f-8441-a8d56bbd832b"
nstbrowser-ai-agent fill "#email" "test@test.com" --profile "abc-123-def-456"
```

#### Examples

**Auto-create profile on first use:**
```bash
# This will create "test-profile" if it doesn't exist
nstbrowser-ai-agent open https://example.com --profile "test-profile"
nstbrowser-ai-agent click "#login" --profile "test-profile"
```

**Use existing profile by ID:**
```bash
# List profiles to find ID
nstbrowser-ai-agent profile list

# Use specific profile ID (UUID format auto-detected)
nstbrowser-ai-agent open https://example.com --profile "abc-123-def-456-789"
```

**Reuse running browser:**
```bash
# Start a browser with a profile
nstbrowser-ai-agent open https://example.com --profile "my-profile"

# Later commands should keep using the same profile value
nstbrowser-ai-agent click "#button" --profile "my-profile"
# Reuse is automatic when the command stays on the same profile
```

## Nstbrowser Workflow

nstbrowser-ai-agent is designed around **Nstbrowser**. In normal usage, you just point it at your Nstbrowser profiles and run commands.

```bash
# Set your API key (required for Nstbrowser)
export NST_API_KEY="your-api-key"

# Verify a healthy profile first
nstbrowser-ai-agent profile list
nstbrowser-ai-agent verify --profile my-profile

# Launch browser through Nstbrowser
nstbrowser-ai-agent --profile my-profile open example.com
nstbrowser-ai-agent --profile my-profile snapshot -i
nstbrowser-ai-agent --profile my-profile click @e1
nstbrowser-ai-agent --profile my-profile get text @e1
nstbrowser-ai-agent --profile my-profile screenshot page.png
nstbrowser-ai-agent browser stop my-profile

# Nstbrowser management
nstbrowser-ai-agent profile list               # List profiles
nstbrowser-ai-agent profile create my-profile  # Create profile
nstbrowser-ai-agent browser list               # List running browsers
nstbrowser-ai-agent browser start my-profile   # Start browser with profile
```


### Traditional Selectors (also supported)

```bash
nstbrowser-ai-agent click "#submit"
nstbrowser-ai-agent fill "#email" "test@example.com"
nstbrowser-ai-agent find role button click --name "Submit"
```

## Commands

### Core Commands

All browser action commands support `--profile <name-or-id>` to specify which profile to use:

```bash
nstbrowser-ai-agent open <url> [--profile <name-or-id>]           # Navigate to URL (aliases: goto, navigate)
nstbrowser-ai-agent click <sel> [--profile <name-or-id>]          # Click element (--new-tab to open in new tab)
nstbrowser-ai-agent dblclick <sel> [--profile <name-or-id>]       # Double-click element
nstbrowser-ai-agent focus <sel> [--profile <name-or-id>]          # Focus element
nstbrowser-ai-agent type <sel> <text> [--profile <name-or-id>]    # Type into element
nstbrowser-ai-agent fill <sel> <text> [--profile <name-or-id>]    # Clear and fill
nstbrowser-ai-agent press <key> [--profile <name-or-id>]          # Press key (Enter, Tab, Control+a) (alias: key)
nstbrowser-ai-agent keyboard type <text> [--profile <name-or-id>] # Type with real keystrokes (no selector, current focus)
nstbrowser-ai-agent keyboard inserttext <text> [--profile <name-or-id>]  # Insert text without key events (no selector)
nstbrowser-ai-agent keydown <key> [--profile <name-or-id>]        # Hold key down
nstbrowser-ai-agent keyup <key> [--profile <name-or-id>]          # Release key
nstbrowser-ai-agent hover <sel> [--profile <name-or-id>]          # Hover element
nstbrowser-ai-agent select <sel> <val> [--profile <name-or-id>]   # Select dropdown option
nstbrowser-ai-agent check <sel> [--profile <name-or-id>]          # Check checkbox
nstbrowser-ai-agent uncheck <sel> [--profile <name-or-id>]        # Uncheck checkbox
nstbrowser-ai-agent scroll <dir> [px] [--profile <name-or-id>]    # Scroll (up/down/left/right, --selector <sel>)
nstbrowser-ai-agent scrollintoview <sel> [--profile <name-or-id>] # Scroll element into view (alias: scrollinto)
nstbrowser-ai-agent drag <src> <tgt> [--profile <name-or-id>]     # Drag and drop
nstbrowser-ai-agent upload <sel> <files> [--profile <name-or-id>] # Upload files
nstbrowser-ai-agent screenshot [path] [--profile <name-or-id>]    # Take screenshot (--full for full page, saves to a temporary directory if no path)
nstbrowser-ai-agent screenshot --annotate [--profile <name-or-id>]  # Annotated screenshot with numbered element labels
nstbrowser-ai-agent pdf <path> [--profile <name-or-id>]           # Save as PDF
nstbrowser-ai-agent snapshot [--profile <name-or-id>]             # Accessibility tree with refs (best for AI)
nstbrowser-ai-agent eval <js> [--profile <name-or-id>]            # Run JavaScript (-b for base64, --stdin for piped input)
nstbrowser-ai-agent close [--profile <name-or-id>]                # Close browser (aliases: quit, exit)
```

### Get Info

```bash
nstbrowser-ai-agent get text <sel> [--profile <name-or-id>]       # Get text content
nstbrowser-ai-agent get html <sel> [--profile <name-or-id>]       # Get innerHTML
nstbrowser-ai-agent get value <sel> [--profile <name-or-id>]      # Get input value
nstbrowser-ai-agent get attr <sel> <attr> [--profile <name-or-id>]  # Get attribute
nstbrowser-ai-agent get title [--profile <name-or-id>]            # Get page title
nstbrowser-ai-agent get url [--profile <name-or-id>]              # Get current URL
nstbrowser-ai-agent get count <sel> [--profile <name-or-id>]      # Count matching elements
nstbrowser-ai-agent get box <sel> [--profile <name-or-id>]        # Get bounding box
nstbrowser-ai-agent get styles <sel> [--profile <name-or-id>]     # Get computed styles
```

### Check State

```bash
nstbrowser-ai-agent is visible <sel> [--profile <name-or-id>]     # Check if visible
nstbrowser-ai-agent is enabled <sel> [--profile <name-or-id>]     # Check if enabled
nstbrowser-ai-agent is checked <sel> [--profile <name-or-id>]     # Check if checked
```

### Find Elements (Semantic Locators)

```bash
nstbrowser-ai-agent find role <role> <action> [value]       # By ARIA role
nstbrowser-ai-agent find text <text> <action>               # By text content
nstbrowser-ai-agent find label <label> <action> [value]     # By label
nstbrowser-ai-agent find placeholder <ph> <action> [value]  # By placeholder
nstbrowser-ai-agent find alt <text> <action>                # By alt text
nstbrowser-ai-agent find title <text> <action>              # By title attr
nstbrowser-ai-agent find testid <id> <action> [value]       # By data-testid
nstbrowser-ai-agent find first <sel> <action> [value]       # First match
nstbrowser-ai-agent find last <sel> <action> [value]        # Last match
nstbrowser-ai-agent find nth <n> <sel> <action> [value]     # Nth match
```

**Common actions:** `click`, `fill`, `check`, `hover`, `text`

Action support depends on locator type:
- `role`, `text`, `alt`, `title`: `click`, `hover`
- `label`, `placeholder`: `click`, `fill`, `check`
- `testid`: `click`, `fill`, `check`, `hover`
- `first`, `last`, `nth`: `click`, `fill`, `check`, `hover`, `text`

**Options:** `--name <name>` (filter role by accessible name), `--exact` (require exact text match)

**Examples:**
```bash
nstbrowser-ai-agent find role button click --name "Submit"
nstbrowser-ai-agent find text "Sign In" click
nstbrowser-ai-agent find label "Email" fill "test@test.com"
nstbrowser-ai-agent find first ".item" click
nstbrowser-ai-agent find nth 2 "a" text
```

### Wait

```bash
nstbrowser-ai-agent wait <selector> [--profile <name-or-id>]       # Wait for element to be visible
nstbrowser-ai-agent wait <ms> [--profile <name-or-id>]             # Wait for time (milliseconds)
nstbrowser-ai-agent wait --text "Welcome" [--profile <name-or-id>] # Wait for text to appear
nstbrowser-ai-agent wait --url "**/dash" [--profile <name-or-id>]  # Wait for URL pattern
nstbrowser-ai-agent wait --load networkidle [--profile <name-or-id>]  # Wait for load state
nstbrowser-ai-agent wait --fn "window.ready === true" [--profile <name-or-id>]  # Wait for JS condition
```

**Load states:** `load`, `domcontentloaded`, `networkidle`

### Mouse Control

```bash
nstbrowser-ai-agent mouse move <x> <y> [--profile <name-or-id>]    # Move mouse
nstbrowser-ai-agent mouse down [button] [--profile <name-or-id>]   # Press button (left/right/middle)
nstbrowser-ai-agent mouse up [button] [--profile <name-or-id>]     # Release button
nstbrowser-ai-agent mouse wheel <dy> [dx] [--profile <name-or-id>] # Scroll wheel
```

### Browser Settings

```bash
nstbrowser-ai-agent set viewport <w> <h>    # Set viewport size
nstbrowser-ai-agent set device <name>       # Emulate device ("iPhone 14")
nstbrowser-ai-agent set geo <lat> <lng>     # Set geolocation
nstbrowser-ai-agent set offline [on|off]    # Toggle offline mode
nstbrowser-ai-agent set headers <json>      # Extra HTTP headers
nstbrowser-ai-agent set credentials <u> <p> # HTTP basic auth
nstbrowser-ai-agent set media [dark|light]  # Emulate color scheme
```

### Cookies & Storage

```bash
nstbrowser-ai-agent cookies                 # Get all cookies
nstbrowser-ai-agent cookies set <name> <val> # Set cookie
nstbrowser-ai-agent cookies clear           # Clear cookies

nstbrowser-ai-agent storage local           # Get all localStorage
nstbrowser-ai-agent storage local <key>     # Get specific key
nstbrowser-ai-agent storage local set <k> <v>  # Set value
nstbrowser-ai-agent storage local clear     # Clear all

nstbrowser-ai-agent storage session         # Same for sessionStorage
```

### Network

```bash
nstbrowser-ai-agent network route <url>              # Intercept requests
nstbrowser-ai-agent network route <url> --abort      # Block requests
nstbrowser-ai-agent network route <url> --body <json>  # Mock response
nstbrowser-ai-agent network unroute [url]            # Remove routes
nstbrowser-ai-agent network requests                 # View tracked requests
nstbrowser-ai-agent network requests --filter api    # Filter requests
```

### Tabs & Windows

```bash
nstbrowser-ai-agent tab                     # List tabs
nstbrowser-ai-agent tab new [url]           # New tab (optionally with URL)
nstbrowser-ai-agent tab <n>                 # Switch to tab n
nstbrowser-ai-agent tab close [n]           # Close tab
nstbrowser-ai-agent window new              # New window
```

### Frames

```bash
nstbrowser-ai-agent frame <sel>             # Switch to iframe
nstbrowser-ai-agent frame main              # Back to main frame
```

### Dialogs

```bash
nstbrowser-ai-agent dialog accept [text]    # Accept (with optional prompt text)
nstbrowser-ai-agent dialog dismiss          # Dismiss
```

### Diff

```bash
nstbrowser-ai-agent diff snapshot                              # Compare current vs last snapshot
nstbrowser-ai-agent diff snapshot --baseline before.txt        # Compare current vs saved snapshot file
nstbrowser-ai-agent diff snapshot --selector "#main" --compact # Scoped snapshot diff
nstbrowser-ai-agent diff screenshot --baseline before.png      # Visual pixel diff against baseline
nstbrowser-ai-agent diff screenshot --baseline b.png -o d.png  # Save diff image to custom path
nstbrowser-ai-agent diff screenshot --baseline b.png -t 0.2    # Adjust color threshold (0-1)
nstbrowser-ai-agent diff url https://v1.com https://v2.com     # Compare two URLs (snapshot diff)
nstbrowser-ai-agent diff url https://v1.com https://v2.com --screenshot  # Also visual diff
nstbrowser-ai-agent diff url https://v1.com https://v2.com --wait-until networkidle  # Custom wait strategy
nstbrowser-ai-agent diff url https://v1.com https://v2.com --selector "#main"  # Scope to element
```

### Debug

```bash
nstbrowser-ai-agent trace start [path]      # Start recording trace
nstbrowser-ai-agent trace stop [path]       # Stop and save trace
nstbrowser-ai-agent profiler start          # Start Chrome DevTools profiling
nstbrowser-ai-agent profiler stop [path]    # Stop and save profile (.json)
nstbrowser-ai-agent console                 # View console messages (log, error, warn, info)
nstbrowser-ai-agent console --clear         # Clear console
nstbrowser-ai-agent errors                  # View page errors (uncaught JavaScript exceptions)
nstbrowser-ai-agent errors --clear          # Clear errors
nstbrowser-ai-agent highlight <sel>         # Highlight element
nstbrowser-ai-agent state save <path>       # Save auth state
nstbrowser-ai-agent state load <path>       # Load auth state
nstbrowser-ai-agent state list              # List saved state files
nstbrowser-ai-agent state show <file>       # Show state summary
nstbrowser-ai-agent state rename <old> <new> # Rename state file
nstbrowser-ai-agent state clear [name]      # Clear states for session
nstbrowser-ai-agent state clear --all       # Clear all saved states
nstbrowser-ai-agent state clean --older-than <days>  # Delete old states
```

### Navigation

```bash
nstbrowser-ai-agent back                    # Go back
nstbrowser-ai-agent forward                 # Go forward
nstbrowser-ai-agent reload                  # Reload page
```

## Sessions

Run multiple isolated browser instances:

```bash
# Different sessions
nstbrowser-ai-agent --session agent1 open site-a.com
nstbrowser-ai-agent --session agent2 open site-b.com

# List active sessions
nstbrowser-ai-agent session list
# Output:
# Active sessions:
# -> default
#    agent1

# Show current session
nstbrowser-ai-agent session
```

Each session has its own:
- Browser instance
- Cookies and storage
- Navigation history
- Authentication state

## Configuration

Configure NST API credentials once and use forever:

```bash
# Set API key (required)
nstbrowser-ai-agent config set key <your-api-key>

# Set custom host (optional, default: 127.0.0.1)
nstbrowser-ai-agent config set host api.example.com

# Set custom port (optional, default: 8848)
nstbrowser-ai-agent config set port 9000

# View current configuration
nstbrowser-ai-agent config show

# Get specific value
nstbrowser-ai-agent config get key

# Remove configuration
nstbrowser-ai-agent config unset key
```

Configuration is stored in `~/.nst-ai-agent/config.json`.

### Check NST Agent Status

Verify that NST agent is running and responsive:

```bash
# Check NST agent status
nstbrowser-ai-agent nst status

# JSON output
nstbrowser-ai-agent nst status --json
```

This command uses the `/api/agent/agent/info` endpoint to verify the NST service is accessible.

## Session Persistence

Use `--session-name` to automatically save and restore cookies and storage across browser restarts while continuing to use Nstbrowser:

```bash
# Auto-save/load state for one persistent profile workflow
nstbrowser-ai-agent --session-name myapp --profile my-profile open https://example.com

# Login once, then state persists automatically
# State files stored in ~/.nstbrowser-ai-agent/sessions/
```

| Variable | Description |
|----------|-------------|
| `NST_API_KEY` | Nstbrowser API key |
| `NST_HOST` | Nstbrowser API host (default: localhost) |
| `NST_PORT` | Nstbrowser API port (default: 8848) |

## Security

nstbrowser-ai-agent includes security features for safe AI agent deployments. All features are opt-in -- existing workflows are unaffected until you explicitly enable a feature:

- **Authentication Vault** -- Store credentials locally (always encrypted), reference by name. The LLM never sees passwords: `echo "pass" | nstbrowser-ai-agent auth save github --url https://github.com/login --username user --password-stdin` then `nstbrowser-ai-agent auth login github`
- **Content Boundary Markers** -- Wrap page output in delimiters so LLMs can distinguish tool output from untrusted content: `--content-boundaries`
- **Domain Allowlist** -- Restrict navigation to trusted domains (wildcards like `*.example.com` also match the bare domain): `--allowed-domains "example.com,*.example.com"`. Sub-resource requests (scripts, images, fetch) and WebSocket/EventSource connections to non-allowed domains are also blocked. Include any CDN domains your target pages depend on (e.g., `*.cdn.example.com`).
- **Action Policy** -- Gate destructive actions with a static policy file: `--action-policy ./policy.json`
- **Action Confirmation** -- Require explicit approval for sensitive action categories: `--confirm-actions eval,download`
- **Output Length Limits** -- Prevent context flooding: `--max-output 50000`

| Variable | Description |
|----------|-------------|
| `NST_API_KEY` | Nstbrowser API key |
| `NST_HOST` | Nstbrowser API host (default: localhost) |
| `NST_PORT` | Nstbrowser API port (default: 8848) |

## Snapshot Options

The `snapshot` command supports filtering to reduce output size:

```bash
nstbrowser-ai-agent snapshot                    # Full accessibility tree
nstbrowser-ai-agent snapshot -i                 # Interactive elements only (buttons, inputs, links)
nstbrowser-ai-agent snapshot -i -C              # Include cursor-interactive elements (divs with onclick, etc.)
nstbrowser-ai-agent snapshot -c                 # Compact (remove empty structural elements)
nstbrowser-ai-agent snapshot -d 3               # Limit depth to 3 levels
nstbrowser-ai-agent snapshot -s "#main"         # Scope to CSS selector
nstbrowser-ai-agent snapshot -i -c -d 5         # Combine options
```

| Option | Description |
|--------|-------------|
| `-i, --interactive` | Only show interactive elements (buttons, links, inputs) |
| `-C, --cursor` | Include cursor-interactive elements (cursor:pointer, onclick, tabindex) |
| `-c, --compact` | Remove empty structural elements |
| `-d, --depth <n>` | Limit tree depth |
| `-s, --selector <sel>` | Scope to CSS selector |

The `-C` flag is useful for modern web apps that use custom clickable elements (divs, spans) instead of standard buttons/links.

## Annotated Screenshots

The `--annotate` flag overlays numbered labels on interactive elements in the screenshot. Each label `[N]` corresponds to ref `@eN`, so the same refs work for both visual and text-based workflows.

```bash
nstbrowser-ai-agent screenshot --annotate
# -> Screenshot saved to /tmp/screenshot-2026-02-17T12-00-00-abc123.png
#    [1] @e1 button "Submit"
#    [2] @e2 link "Home"
#    [3] @e3 textbox "Email"
```

After an annotated screenshot, refs are cached so you can immediately interact with elements:

```bash
nstbrowser-ai-agent screenshot --annotate ./page.png
nstbrowser-ai-agent click @e2     # Click the "Home" link labeled [2]
```

Important: refs are session-scoped and order-dependent. Generate them with `snapshot` or `screenshot --annotate`, then use them in later commands within the same session.

This is useful for multimodal AI models that can reason about visual layout, unlabeled icon buttons, canvas elements, or visual state that the text accessibility tree cannot capture.

## Options

| Option | Description                                                                                                      |
|--------|------------------------------------------------------------------------------------------------------------------|
| `--session <name>` | Use isolated session |
| `--session-name <name>` | Auto-save/restore session state |
| `--profile <name-or-id>` | Select NSTBrowser profile by name or UUID |
| `--state <path>` | Load storage state from JSON file |
| `--headers <json>` | Set HTTP headers scoped to the URL's origin                                                                      |
| `--extension <path>` | Load browser extension (repeatable) |
| `--args <args>` | Browser launch args, comma or newline separated |
| `--user-agent <ua>` | Custom User-Agent string |
| `--proxy <url>` | Proxy server URL with optional auth |
| `--proxy-bypass <hosts>` | Hosts to bypass proxy |
| `--ignore-https-errors` | Ignore HTTPS certificate errors (useful for self-signed certs)                                                   |
| `--json` | JSON output (for agents)                                                                                         |
| `--full, -f` | Full page screenshot                                                                                             |
| `--annotate` | Annotated screenshot with numbered element labels |
| `--color-scheme <scheme>` | Color scheme: `dark`, `light`, `no-preference` |
| `--download-path <path>` | Default download directory |
| `--content-boundaries` | Wrap page output in boundary markers for LLM safety |
| `--max-output <chars>` | Truncate page output to N characters |
| `--allowed-domains <list>` | Comma-separated allowed domain patterns |
| `--action-policy <path>` | Path to action policy JSON file |
| `--confirm-actions <list>` | Action categories requiring confirmation |
| `--confirm-interactive` | Interactive confirmation prompts; auto-denies if stdin is not a TTY |
| `--native` | [Experimental] Use native Rust daemon instead of Node.js |
| `--config <path>` | Use a custom config file |
| `--debug` | Debug output                                                                                                     |

## Configuration

### Configuration Files

Create an `nstbrowser-ai-agent.json` file to set persistent defaults instead of repeating flags on every command.

**Locations (lowest to highest priority):**

1. `~/.nstbrowser-ai-agent/config.json` -- user-level defaults
2. `./nstbrowser-ai-agent.json` -- project-level overrides (in working directory)
3. CLI flags override everything

**Example `nstbrowser-ai-agent.json`:**

```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "twitter",
  "userAgent": "my-agent/1.0",
  "ignoreHttpsErrors": true
}
```

Use `--config <path>` to load a specific config file instead of the defaults:

```bash
nstbrowser-ai-agent --config ./ci-config.json open example.com
```

All options from the table above can be set in the config file using camelCase keys (for example, `--proxy-bypass` becomes `"proxyBypass"`). Unknown keys are ignored for forward compatibility.

Boolean flags accept an optional `true`/`false` value to override config settings. For example, `--headed false` disables `"headed": true` from config. A bare `--headed` is equivalent to `--headed true`.

Auto-discovered config files that are missing are silently ignored. If `--config <path>` points to a missing or invalid file, nstbrowser-ai-agent exits with an error. Extensions from user and project configs are merged (concatenated), not replaced.

> **Tip:** If your project-level `nstbrowser-ai-agent.json` contains environment-specific values (paths, proxies), consider adding it to `.gitignore`.

## Default Timeout

The default Playwright timeout for standard operations (clicks, waits, fills, etc.) is 25 seconds. This is intentionally below the CLI's 30-second IPC read timeout so that Playwright returns a proper error instead of the CLI timing out with EAGAIN.

> **Note:** Setting this above 30000 (30s) may cause EAGAIN errors on slow operations because the CLI's read timeout will expire before Playwright responds. The CLI retries transient errors automatically, but response times will increase.

## Selectors

### Refs (Recommended for AI)

Refs provide deterministic element selection from snapshots:

```bash
# 1. Get snapshot with refs
nstbrowser-ai-agent snapshot
# Output:
# - heading "Example Domain" [ref=e1] [level=1]
# - button "Submit" [ref=e2]
# - textbox "Email" [ref=e3]
# - link "Learn more" [ref=e4]

# 2. Use refs to interact
nstbrowser-ai-agent click @e2                   # Click the button
nstbrowser-ai-agent fill @e3 "test@example.com" # Fill the textbox
nstbrowser-ai-agent get text @e1                # Get heading text
nstbrowser-ai-agent hover @e4                   # Hover the link
```

**Why use refs?**
- **Deterministic**: Ref points to exact element from snapshot
- **Fast**: No DOM re-query needed
- **AI-friendly**: Snapshot + ref workflow is optimal for LLMs

### CSS Selectors

```bash
nstbrowser-ai-agent click "#id"
nstbrowser-ai-agent click ".class"
nstbrowser-ai-agent click "div > button"
```

### Text & XPath

```bash
nstbrowser-ai-agent click "text=Submit"
nstbrowser-ai-agent click "xpath=//button"
```

### Semantic Locators

```bash
nstbrowser-ai-agent find role button click --name "Submit"
nstbrowser-ai-agent find label "Email" fill "test@test.com"
```

## Agent Mode

Use `--json` for machine-readable output:

```bash
nstbrowser-ai-agent snapshot --json
# Returns: {"success":true,"data":{"snapshot":"...","refs":{"e1":{"role":"heading","name":"Title"},...}}}

nstbrowser-ai-agent get text @e1 --json
nstbrowser-ai-agent is visible @e2 --json
```

### Optimal AI Workflow

```bash
# 1. Navigate and get snapshot
nstbrowser-ai-agent --profile my-profile open example.com
nstbrowser-ai-agent --profile my-profile snapshot -i --json

# 2. AI identifies target refs from snapshot
# 3. Execute actions using refs
nstbrowser-ai-agent --profile my-profile click @e2
nstbrowser-ai-agent --profile my-profile fill @e3 "input text"

# 4. Get new snapshot if page changed
nstbrowser-ai-agent --profile my-profile snapshot -i --json
```

### Command Chaining

Commands can be chained with `&&` when every command stays on the same browser context. In practice, that usually means repeating the same `--profile`:

```bash
# Open, wait for load, and snapshot in one call
nstbrowser-ai-agent --profile my-profile open example.com && nstbrowser-ai-agent --profile my-profile wait --load networkidle && nstbrowser-ai-agent --profile my-profile snapshot -i

# Chain multiple interactions
nstbrowser-ai-agent --profile my-profile fill @e1 "user@example.com" && nstbrowser-ai-agent --profile my-profile fill @e2 "pass" && nstbrowser-ai-agent --profile my-profile click @e3

# Navigate and screenshot
nstbrowser-ai-agent --profile my-profile open example.com && nstbrowser-ai-agent --profile my-profile wait --load networkidle && nstbrowser-ai-agent --profile my-profile screenshot page.png
```

Use `&&` when you don't need intermediate output. Run commands separately when you need to parse output first (e.g., snapshot to discover refs before interacting).

## Headed Mode

Show the browser window for debugging:

```bash
nstbrowser-ai-agent open example.com --headed
```

This opens a visible browser window instead of running headless.

## Authenticated Sessions

Use `--headers` to set HTTP headers for a specific origin, enabling authentication without login flows:

```bash
# Headers are scoped to api.example.com only
nstbrowser-ai-agent open api.example.com --headers '{"Authorization": "Bearer <token>"}'

# Requests to api.example.com include the auth header
nstbrowser-ai-agent snapshot -i --json
nstbrowser-ai-agent click @e2

# Navigate to another domain - headers are NOT sent (safe!)
nstbrowser-ai-agent open other-site.com
```

This is useful for:
- **Skipping login flows** - Authenticate via headers instead of UI
- **Switching users** - Start new sessions with different auth tokens
- **API testing** - Access protected endpoints directly
- **Security** - Headers are scoped to the origin, not leaked to other domains

To set headers for multiple origins, use `--headers` with each `open` command:

```bash
nstbrowser-ai-agent open api.example.com --headers '{"Authorization": "Bearer token1"}'
nstbrowser-ai-agent open api.acme.com --headers '{"Authorization": "Bearer token2"}'
```

For global headers (all domains), use `set headers`:

```bash
nstbrowser-ai-agent set headers '{"X-Custom-Header": "value"}'
```

Stream the browser viewport via WebSocket for live preview or "pair browsing" where a human can watch and interact alongside an AI agent.

### Enable Streaming

Start the CLI with streaming enabled by your deployment configuration. This starts a WebSocket server that streams the browser viewport and accepts input events.

### WebSocket Protocol

Connect to `ws://localhost:9223` to receive frames and send input:

**Receive frames:**
```json
{
  "type": "frame",
  "data": "<base64-encoded-jpeg>",
  "metadata": {
    "deviceWidth": 1280,
    "deviceHeight": 720,
    "pageScaleFactor": 1,
    "offsetTop": 0,
    "scrollOffsetX": 0,
    "scrollOffsetY": 0
  }
}
```

**Send mouse events:**
```json
{
  "type": "input_mouse",
  "eventType": "mousePressed",
  "x": 100,
  "y": 200,
  "button": "left",
  "clickCount": 1
}
```

**Send keyboard events:**
```json
{
  "type": "input_keyboard",
  "eventType": "keyDown",
  "key": "Enter",
  "code": "Enter"
}
```

**Send touch events:**
```json
{
  "type": "input_touch",
  "eventType": "touchStart",
  "touchPoints": [{ "x": 100, "y": 200 }]
}
```

### Programmatic API

For advanced use, control streaming directly via the protocol:

```typescript
import { BrowserManager } from 'nstbrowser-ai-agent';

const browser = new BrowserManager();
await browser.launch({ headless: true });
await browser.navigate('https://example.com');

// Start screencast
await browser.startScreencast((frame) => {
  // frame.data is base64-encoded image
  // frame.metadata contains viewport info
  console.log('Frame received:', frame.metadata.deviceWidth, 'x', frame.metadata.deviceHeight);
}, {
  format: 'jpeg',
  quality: 80,
  maxWidth: 1280,
  maxHeight: 720,
});

// Inject mouse events
await browser.injectMouseEvent({
  type: 'mousePressed',
  x: 100,
  y: 200,
  button: 'left',
});

// Inject keyboard events
await browser.injectKeyboardEvent({
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter',
});

// Stop when done
await browser.stopScreencast();
```

## Architecture

nstbrowser-ai-agent uses a client-daemon architecture:

1. **Rust CLI** (fast native binary) - Parses commands, communicates with daemon
2. **Node.js Daemon** (default) - Manages Playwright browser instance
3. **Native Daemon** (experimental, `--native`) - Pure Rust daemon using direct CDP, no Node.js required
4. **Fallback** - If native binary unavailable, uses Node.js directly

The daemon starts automatically on first command and persists between commands for fast subsequent operations.

**Browser Engine:** Uses Chromium by default. The default Node.js daemon also supports Firefox and WebKit via Playwright. The experimental native daemon speaks Chrome DevTools Protocol (CDP) directly and supports Chromium-based browsers and Safari (via WebDriver).

## Experimental: Native Mode

The native daemon is a pure Rust implementation that communicates with Chrome directly via CDP, eliminating the Node.js and Playwright dependencies. It is currently **experimental** and opt-in.

### Enabling Native Mode

```bash
nstbrowser-ai-agent --native open example.com
```

Or add to your config file (`nstbrowser-ai-agent.json`):

```json
{"native": true}
```

### What's Different

| | Default (Node.js) | Native (`--native`) |
|---|---|---|
| **Runtime** | Node.js + Playwright | Pure Rust binary |
| **Protocol** | Playwright protocol | Direct CDP / WebDriver |
| **Install size** | Larger (Node.js + npm deps) | Smaller (single binary) |
| **Browser support** | Chromium, Firefox, WebKit | Chromium, Safari (via WebDriver) |
| **Stability** | Stable | Experimental |

### Known Limitations

- Firefox and WebKit are not yet supported (Chromium and Safari only)
- Some Playwright-specific features (tracing format, HAR export) are not available
- The native daemon and Node.js daemon share the same session socket, so you cannot run both simultaneously for the same session. Use `nstbrowser-ai-agent close` before switching modes.

## Platforms

| Platform | Binary | Fallback |
|----------|--------|----------|
| macOS ARM64 | Native Rust | Node.js |
| macOS x64 | Native Rust | Node.js |
| Linux ARM64 | Native Rust | Node.js |
| Linux x64 | Native Rust | Node.js |
| Windows x64 | Native Rust | Node.js |

## Usage with AI Agents

For coding assistants and terminal agents, install the skill:

```bash
npx skills add nstbrowser/nstbrowser-ai-agent
```

This works with Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Goose, OpenCode, and Windsurf. The skill is fetched from the repository, so it stays up to date automatically.

For more consistent results, add guidance like this to `AGENTS.md` or `CLAUDE.md`:

```markdown
## Browser Automation

Use `nstbrowser-ai-agent` for web automation. Run `nstbrowser-ai-agent --help` for all commands.

Core workflow:
1. Use profile: `--profile "my-profile"` or use `browser start-once` for temporary browser
2. `nstbrowser-ai-agent open <url>` - Navigate to page
3. `nstbrowser-ai-agent snapshot -i` - Get interactive elements with refs (@e1, @e2)
4. `nstbrowser-ai-agent click @e1` / `fill @e2 "text"` - Interact using refs
5. Re-snapshot after page changes
```

## Nstbrowser Reference

Use these as the main Nstbrowser-specific management commands. When you want the
full CLI reference for a category, run:

```bash
nstbrowser-ai-agent profile --help
nstbrowser-ai-agent browser --help
nstbrowser-ai-agent verify --help
nstbrowser-ai-agent repair --help
```

### Profile Commands

- `profile list`
  Best for: picking a profile name before browser automation.
  Parameters: none by default, or `--verbose` for the full NST profile object.
  Result: human-readable mode prints profile name, short ID, platform, proxy IP, group, and tags when available.

- `profile list-cursor --page-size <size> [--cursor <token>] [--direction next|prev]`
  Best for: large profile collections where `profile list` is too broad.
  Parameters:
  `--page-size` controls how many profiles come back in one page.
  `--cursor` continues from a cursor returned by the previous page.
  `--direction` chooses whether that cursor is used as the next page or previous page anchor.
  Result: human-readable mode prints `Profiles page (N):` plus `Next cursor` / `Prev cursor` when available.

- `profile show <name-or-id>`
  Best for: confirming one profile's group, proxy, tags, platform, and last launch info before using it.

- `profile create <name> [--platform <Windows|macOS|Linux>] [--kernel <version>] [--group-id <id>]`
  Best for: creating a clean profile for a new task.
  `--kernel` requests a preferred kernel milestone; NST may normalize it to a currently supported version.
  Extra proxy parameters:
  `--proxy-host <host>`, `--proxy-port <port>`, `--proxy-type <http|https|socks5>`, `--proxy-username <user>`, `--proxy-password <pass>`.
  Result: returns the created profile and its `profileId`.

- `profile proxy show <name-or-id>`
  Best for: checking saved proxy configuration and the most recent proxy result.

- `profile proxy update <name-or-id> --host <host> --port <port> [--type <type>] [--username <user>] [--password <pass>]`
  Best for: changing proxy settings without recreating the profile.

- `profile proxy reset <name-or-id> [name-or-id...]`
  Best for: removing custom proxy settings and returning to local/default routing.

- `profile tags list`, `profile tags create`, `profile tags update`, `profile tags clear`
  Best for: organizing profiles for agent workflows such as `qa`, `smoke`, `proxy`, or `signup`.
  `profile tags create` automatically assigns a default tag color so you only need to provide the tag name.

- `profile groups list`, `profile groups change <group-id> <name-or-id> [name-or-id...]`
  Best for: finding valid group IDs and moving profiles into the right NST group.

### Browser Commands

- `browser list`
  Best for: seeing which profile browsers or temporary browsers are already running.

- `browser start <name-or-id> [--headless] [--auto-close]`
  Best for: starting a known profile explicitly before automation.
  `--headless` requests headless launch.
  `--auto-close` asks NST to close that browser automatically when the owner exits.

- `browser pages <name-or-id>`
  Best for: listing debuggable pages for one running browser.

- `browser debugger <name-or-id>`
  Best for: getting the debugger port and browser WebSocket endpoint.

- `browser cdp-url <name-or-id>`
  Best for: fetching only the browser-level CDP WebSocket URL.

- `browser connect <name-or-id>`
  Best for: starting a browser if needed and immediately returning connection details.

- `browser start-once [--platform <platform>] [--kernel <kernel>] [--headless] [--auto-close]`
  Best for: throwaway work that should not reuse a saved profile.

- `browser cdp-url-once`
  Best for: getting the temporary browser CDP WebSocket URL without first naming a profile.

- `browser connect-once [--platform <platform>] [--kernel <kernel>]`
  Best for: one command that creates a temporary browser and returns connection details.

- `browser stop <name-or-id>` and `browser stop-all`
  Best for: cleanup when a profile browser or once browser should be stopped.

### Environment and Repair Commands

- `nst status`
  Best for: checking whether the local Nstbrowser service is reachable at all.

- `verify <name-or-id>` or `verify --profile <name-or-id>`
  Best for: smoke-testing one profile before a real task.
  Result: verifies NST reachability, profile resolution, browser start, and a simple navigation path.

- `repair`
  Best for: recovering from stale or inconsistent NST state.
  Result: runs automatic cleanup and returns a task-by-task result map.

Important:
- `--profile` accepts either a profile name or UUID.
- A new profile name can be auto-created on first browser use.
- Only `NST_API_KEY`, `NST_HOST`, and `NST_PORT` are documented for NST connectivity.

## Troubleshooting

If you encounter issues:

**Quick Diagnostic Commands:**
```bash
# Check NST desktop connection
nstbrowser-ai-agent nst status

# Confirm profile access
nstbrowser-ai-agent profile list

# Test browser functionality
nstbrowser-ai-agent verify [name-or-id]
# Also supported:
nstbrowser-ai-agent verify --profile <name-or-id>

# Attempt automatic fixes
nstbrowser-ai-agent repair
```

**Common Issues:**
- [Browser connection errors](TROUBLESHOOTING.md#browsercontextnewpage-target-page-context-or-browser-has-been-closed)
- [API key issues](TROUBLESHOOTING.md#api-key-issues)
- [Browser won't start](TROUBLESHOOTING.md#browser-wont-start)
- [Profile not found](TROUBLESHOOTING.md#profile-not-found)
- [Connection refused](TROUBLESHOOTING.md#connection-refused--cannot-connect-to-nstbrowser)

**Full Guide**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions to common problems.

## License

Apache-2.0
