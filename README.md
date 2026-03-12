# nstbrowser-ai-agent

Headless browser automation CLI for AI agents. Fast Rust CLI with Node.js fallback.

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
  curl http://127.0.0.1:8848/api/v2/profiles
  ```
- Expected response: JSON with profile data or empty list

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

**Disable automatic checks:**
```bash
export NSTBROWSER_AI_AGENT_NO_UPDATE_CHECK=1
```

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

## Quick Start Examples

### Using Temporary Browser (Fastest)

For quick tests or one-time tasks:

```bash
# Start temporary browser
nstbrowser-ai-agent browser start-once

# Open a website
nstbrowser-ai-agent open https://example.com

# Take a snapshot
nstbrowser-ai-agent snapshot -i

# Close browser (auto-cleanup)
nstbrowser-ai-agent close
```

**Note:** Temporary browsers don't save session state.

### Using Profile (Recommended)

For tasks requiring persistent sessions:

```bash
# List available profiles
nstbrowser-ai-agent profile list

# Create a new profile (if needed)
nstbrowser-ai-agent profile create my-profile

# Set default profile
export NST_PROFILE="my-profile"

# Open browser (auto-starts with profile)
nstbrowser-ai-agent open https://example.com

# Interact with page
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent click @e1

# Close browser (session saved to profile)
nstbrowser-ai-agent close
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

# Later commands automatically connect to the same running browser
nstbrowser-ai-agent click "#button" --profile "my-profile"
# No restart needed - uses existing browser!
```

## Default Provider

By default, nstbrowser-ai-agent uses **Nstbrowser** as the browser provider. This means you don't need to specify `-p nst` every time - it's automatic.

### Using Nstbrowser (Default)

```bash
# Set your API key (required for Nstbrowser)
export NST_API_KEY="your-api-key"

# Launch browser (uses Nstbrowser by default)
nstbrowser-ai-agent open example.com
nstbrowser-ai-agent snapshot                    # Get accessibility tree with refs
nstbrowser-ai-agent click @e2                   # Click by ref from snapshot
nstbrowser-ai-agent fill @e3 "test@example.com" # Fill by ref
nstbrowser-ai-agent get text @e1                # Get text by ref
nstbrowser-ai-agent screenshot page.png
nstbrowser-ai-agent close

# Nstbrowser management (no 'nst' prefix needed with default provider)
nstbrowser-ai-agent profile list               # List profiles
nstbrowser-ai-agent profile create my-profile  # Create profile
nstbrowser-ai-agent browser list               # List running browsers
nstbrowser-ai-agent browser start profile-id   # Start browser with profile
```


### Traditional Selectors (also supported)

```bash
nstbrowser-ai-agent click "#submit"
nstbrowser-ai-agent fill "#email" "test@example.com"
nstbrowser-ai-agent find role button click --name "Submit"
```

## Commands

### Core Commands

```bash
nstbrowser-ai-agent open <url>              # Navigate to URL (aliases: goto, navigate)
nstbrowser-ai-agent click <sel>             # Click element (--new-tab to open in new tab)
nstbrowser-ai-agent dblclick <sel>          # Double-click element
nstbrowser-ai-agent focus <sel>             # Focus element
nstbrowser-ai-agent type <sel> <text>       # Type into element
nstbrowser-ai-agent fill <sel> <text>       # Clear and fill
nstbrowser-ai-agent press <key>             # Press key (Enter, Tab, Control+a) (alias: key)
nstbrowser-ai-agent keyboard type <text>    # Type with real keystrokes (no selector, current focus)
nstbrowser-ai-agent keyboard inserttext <text>  # Insert text without key events (no selector)
nstbrowser-ai-agent keydown <key>           # Hold key down
nstbrowser-ai-agent keyup <key>             # Release key
nstbrowser-ai-agent hover <sel>             # Hover element
nstbrowser-ai-agent select <sel> <val>      # Select dropdown option
nstbrowser-ai-agent check <sel>             # Check checkbox
nstbrowser-ai-agent uncheck <sel>           # Uncheck checkbox
nstbrowser-ai-agent scroll <dir> [px]       # Scroll (up/down/left/right, --selector <sel>)
nstbrowser-ai-agent scrollintoview <sel>    # Scroll element into view (alias: scrollinto)
nstbrowser-ai-agent drag <src> <tgt>        # Drag and drop
nstbrowser-ai-agent upload <sel> <files>    # Upload files
nstbrowser-ai-agent screenshot [path]       # Take screenshot (--full for full page, saves to a temporary directory if no path)
nstbrowser-ai-agent screenshot --annotate   # Annotated screenshot with numbered element labels
nstbrowser-ai-agent pdf <path>              # Save as PDF
nstbrowser-ai-agent snapshot                # Accessibility tree with refs (best for AI)
nstbrowser-ai-agent eval <js>               # Run JavaScript (-b for base64, --stdin for piped input)
nstbrowser-ai-agent close                   # Close browser (aliases: quit, exit)
```

### Get Info

```bash
nstbrowser-ai-agent get text <sel>          # Get text content
nstbrowser-ai-agent get html <sel>          # Get innerHTML
nstbrowser-ai-agent get value <sel>         # Get input value
nstbrowser-ai-agent get attr <sel> <attr>   # Get attribute
nstbrowser-ai-agent get title               # Get page title
nstbrowser-ai-agent get url                 # Get current URL
nstbrowser-ai-agent get count <sel>         # Count matching elements
nstbrowser-ai-agent get box <sel>           # Get bounding box
nstbrowser-ai-agent get styles <sel>        # Get computed styles
```

### Check State

```bash
nstbrowser-ai-agent is visible <sel>        # Check if visible
nstbrowser-ai-agent is enabled <sel>        # Check if enabled
nstbrowser-ai-agent is checked <sel>        # Check if checked
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

**Actions:** `click`, `fill`, `type`, `hover`, `focus`, `check`, `uncheck`, `text`

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
nstbrowser-ai-agent wait <selector>         # Wait for element to be visible
nstbrowser-ai-agent wait <ms>               # Wait for time (milliseconds)
nstbrowser-ai-agent wait --text "Welcome"   # Wait for text to appear
nstbrowser-ai-agent wait --url "**/dash"    # Wait for URL pattern
nstbrowser-ai-agent wait --load networkidle # Wait for load state
nstbrowser-ai-agent wait --fn "window.ready === true"  # Wait for JS condition
```

**Load states:** `load`, `domcontentloaded`, `networkidle`

### Mouse Control

```bash
nstbrowser-ai-agent mouse move <x> <y>      # Move mouse
nstbrowser-ai-agent mouse down [button]     # Press button (left/right/middle)
nstbrowser-ai-agent mouse up [button]       # Release button
nstbrowser-ai-agent mouse wheel <dy> [dx]   # Scroll wheel
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

# Or via environment variable
NSTBROWSER_AI_AGENT_SESSION=agent1 nstbrowser-ai-agent click "#btn"

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

Configuration is stored in `~/.nst-ai-agent/config.json` and takes priority over environment variables.

**Priority order:** Config file > Environment variables > Defaults

### Check NST Agent Status

Verify that NST agent is running and responsive:

```bash
# Check NST agent status
nstbrowser-ai-agent nst status

# JSON output
nstbrowser-ai-agent nst status --json
```

This command uses the `/api/agent/agent/info` endpoint to verify the NST service is accessible.

## Persistent Profiles

By default, browser state (cookies, localStorage, login sessions) is ephemeral and lost when the browser closes. Use `--profile` to persist state across browser restarts:

```bash
# Use a persistent profile directory
nstbrowser-ai-agent --profile ~/.myapp-profile open myapp.com

# Login once, then reuse the authenticated session
nstbrowser-ai-agent --profile ~/.myapp-profile open myapp.com/dashboard

# Or via environment variable
NSTBROWSER_AI_AGENT_PROFILE=~/.myapp-profile nstbrowser-ai-agent open myapp.com
```

The profile directory stores:
- Cookies and localStorage
- IndexedDB data
- Service workers
- Browser cache
- Login sessions

**Tip**: Use different profile paths for different projects to keep their browser state isolated.

## Session Persistence

Alternatively, use `--session-name` to automatically save and restore cookies and localStorage across browser restarts:

```bash
# Auto-save/load state for "twitter" session
nstbrowser-ai-agent --session-name twitter open twitter.com

# Login once, then state persists automatically
# State files stored in ~/.nstbrowser-ai-agent/sessions/

# Or via environment variable
export NSTBROWSER_AI_AGENT_SESSION_NAME=twitter
nstbrowser-ai-agent open twitter.com
```

### State Encryption

Encrypt saved session data at rest with AES-256-GCM:

```bash
# Generate key: openssl rand -hex 32
export NSTBROWSER_AI_AGENT_ENCRYPTION_KEY=<64-char-hex-key>

# State files are now encrypted automatically
nstbrowser-ai-agent --session-name secure open example.com
```

| Variable | Description |
|----------|-------------|
| `NSTBROWSER_AI_AGENT_SESSION_NAME` | Auto-save/load state persistence name |
| `NSTBROWSER_AI_AGENT_ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM encryption |
| `NSTBROWSER_AI_AGENT_STATE_EXPIRE_DAYS` | Auto-delete states older than N days (default: 30) |
| `NSTBROWSER_AI_AGENT_PROVIDER` | Browser provider (default: nst) |
| `NST_API_KEY` | Nstbrowser API key (required for nst provider, default provider) |
| `NST_HOST` | Nstbrowser API host (default: localhost) |
| `NST_PORT` | Nstbrowser API port (default: 8848) |

## Security

nstbrowser-ai-agent includes security features for safe AI agent deployments. All features are opt-in -- existing workflows are unaffected until you explicitly enable a feature:

- **Authentication Vault** -- Store credentials locally (always encrypted), reference by name. The LLM never sees passwords. A key is auto-generated at `~/.nstbrowser-ai-agent/.encryption-key` if `NSTBROWSER_AI_AGENT_ENCRYPTION_KEY` is not set: `echo "pass" | nstbrowser-ai-agent auth save github --url https://github.com/login --username user --password-stdin` then `nstbrowser-ai-agent auth login github`
- **Content Boundary Markers** -- Wrap page output in delimiters so LLMs can distinguish tool output from untrusted content: `--content-boundaries`
- **Domain Allowlist** -- Restrict navigation to trusted domains (wildcards like `*.example.com` also match the bare domain): `--allowed-domains "example.com,*.example.com"`. Sub-resource requests (scripts, images, fetch) and WebSocket/EventSource connections to non-allowed domains are also blocked. Include any CDN domains your target pages depend on (e.g., `*.cdn.example.com`).
- **Action Policy** -- Gate destructive actions with a static policy file: `--action-policy ./policy.json`
- **Action Confirmation** -- Require explicit approval for sensitive action categories: `--confirm-actions eval,download`
- **Output Length Limits** -- Prevent context flooding: `--max-output 50000`

| Variable | Description |
|----------|-------------|
| `NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES` | Wrap page output in boundary markers |
| `NSTBROWSER_AI_AGENT_MAX_OUTPUT` | Max characters for page output |
| `NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS` | Comma-separated allowed domain patterns |
| `NSTBROWSER_AI_AGENT_ACTION_POLICY` | Path to action policy JSON file |
| `NSTBROWSER_AI_AGENT_CONFIRM_ACTIONS` | Action categories requiring confirmation |
| `NSTBROWSER_AI_AGENT_CONFIRM_INTERACTIVE` | Enable interactive confirmation prompts |
| `NSTBROWSER_AI_AGENT_PROVIDER` | Browser provider (default: nst) |
| `NST_API_KEY` | Nstbrowser API key (required for nst provider, default provider) |
| `NST_HOST` | Nstbrowser API host (default: localhost) |
| `NST_PORT` | Nstbrowser API port (default: 8848) |

See the Security section below for details on environment variable handling.

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

This is useful for multimodal AI models that can reason about visual layout, unlabeled icon buttons, canvas elements, or visual state that the text accessibility tree cannot capture.

## Options

| Option | Description                                                                                                      |
|--------|------------------------------------------------------------------------------------------------------------------|
| `--session <name>` | Use isolated session (or `NSTBROWSER_AI_AGENT_SESSION` env)                                                            |
| `--session-name <name>` | Auto-save/restore session state (or `NSTBROWSER_AI_AGENT_SESSION_NAME` env)                                            |
| `--profile <path>` | Persistent browser profile directory (or `NSTBROWSER_AI_AGENT_PROFILE` env)                                            |
| `--state <path>` | Load storage state from JSON file (or `NSTBROWSER_AI_AGENT_STATE` env)                                                 |
| `--headers <json>` | Set HTTP headers scoped to the URL's origin                                                                      |
| `--executable-path <path>` | Custom browser executable (or `NSTBROWSER_AI_AGENT_EXECUTABLE_PATH` env)                                               |
| `--extension <path>` | Load browser extension (repeatable; or `NSTBROWSER_AI_AGENT_EXTENSIONS` env)                                           |
| `--args <args>` | Browser launch args, comma or newline separated (or `NSTBROWSER_AI_AGENT_ARGS` env)                                    |
| `--user-agent <ua>` | Custom User-Agent string (or `NSTBROWSER_AI_AGENT_USER_AGENT` env)                                                     |
| `--proxy <url>` | Proxy server URL with optional auth (or `NSTBROWSER_AI_AGENT_PROXY` env)                                               |
| `--proxy-bypass <hosts>` | Hosts to bypass proxy (or `NSTBROWSER_AI_AGENT_PROXY_BYPASS` env)                                                      |
| `--ignore-https-errors` | Ignore HTTPS certificate errors (useful for self-signed certs)                                                   |
| `--allow-file-access` | Allow file:// URLs to access local files (Chromium only)                                                         |
| `-p, --provider <name>` | Browser provider: `nst` (default), `local` (or `NSTBROWSER_AI_AGENT_PROVIDER` env)   |
| `--json` | JSON output (for agents)                                                                                         |
| `--full, -f` | Full page screenshot                                                                                             |
| `--annotate` | Annotated screenshot with numbered element labels (or `NSTBROWSER_AI_AGENT_ANNOTATE` env)                              |
| `--color-scheme <scheme>` | Color scheme: `dark`, `light`, `no-preference` (or `NSTBROWSER_AI_AGENT_COLOR_SCHEME` env)                             |
| `--download-path <path>` | Default download directory (or `NSTBROWSER_AI_AGENT_DOWNLOAD_PATH` env)                                                |
| `--content-boundaries` | Wrap page output in boundary markers for LLM safety (or `NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES` env)                  |
| `--max-output <chars>` | Truncate page output to N characters (or `NSTBROWSER_AI_AGENT_MAX_OUTPUT` env)                                         |
| `--allowed-domains <list>` | Comma-separated allowed domain patterns (or `NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS` env)                                 |
| `--action-policy <path>` | Path to action policy JSON file (or `NSTBROWSER_AI_AGENT_ACTION_POLICY` env)                                           |
| `--confirm-actions <list>` | Action categories requiring confirmation (or `NSTBROWSER_AI_AGENT_CONFIRM_ACTIONS` env)                                |
| `--confirm-interactive` | Interactive confirmation prompts; auto-denies if stdin is not a TTY (or `NSTBROWSER_AI_AGENT_CONFIRM_INTERACTIVE` env) |
| `--native` | [Experimental] Use native Rust daemon instead of Node.js (or `NSTBROWSER_AI_AGENT_NATIVE` env)                         |
| `--config <path>` | Use a custom config file (or `NSTBROWSER_AI_AGENT_CONFIG` env)                                                         |
| `--debug` | Debug output                                                                                                     |

## Configuration

### Configuration Files

Create an `nstbrowser-ai-agent.json` file to set persistent defaults instead of repeating flags on every command.

**Locations (lowest to highest priority):**

1. `~/.nstbrowser-ai-agent/config.json` -- user-level defaults
2. `./nstbrowser-ai-agent.json` -- project-level overrides (in working directory)
3. `NSTBROWSER_AI_AGENT_*` environment variables override config file values
4. CLI flags override everything

**Example `nstbrowser-ai-agent.json`:**

```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "./browser-data",
  "userAgent": "my-agent/1.0",
  "ignoreHttpsErrors": true
}
```

Use `--config <path>` or `NSTBROWSER_AI_AGENT_CONFIG` to load a specific config file instead of the defaults:

```bash
nstbrowser-ai-agent --config ./ci-config.json open example.com
NSTBROWSER_AI_AGENT_CONFIG=./ci-config.json nstbrowser-ai-agent open example.com
```

All options from the table above can be set in the config file using camelCase keys (e.g., `--executable-path` becomes `"executablePath"`, `--proxy-bypass` becomes `"proxyBypass"`). Unknown keys are ignored for forward compatibility.

Boolean flags accept an optional `true`/`false` value to override config settings. For example, `--headed false` disables `"headed": true` from config. A bare `--headed` is equivalent to `--headed true`.

Auto-discovered config files that are missing are silently ignored. If `--config <path>` points to a missing or invalid file, nstbrowser-ai-agent exits with an error. Extensions from user and project configs are merged (concatenated), not replaced.

> **Tip:** If your project-level `nstbrowser-ai-agent.json` contains environment-specific values (paths, proxies), consider adding it to `.gitignore`.

### Environment Variables via .env Files

You can store environment variables in `.env` files for easier configuration management:

**Supported files (in priority order):**

1. `.nstbrowser-ai-agent.env` -- project-specific configuration (highest priority)
2. `.env` -- standard environment file

**Example `.nstbrowser-ai-agent.env`:**

```bash
# Nstbrowser configuration
NST_API_KEY=your-api-key-here
NST_HOST=api.nstbrowser.io
NST_PORT=443

# Agent configuration
NSTBROWSER_AI_AGENT_DEBUG=1
NSTBROWSER_AI_AGENT_DEFAULT_TIMEOUT=30000
```

The `.env` files are loaded automatically when you run any command. Variables set in `.nstbrowser-ai-agent.env` take priority over `.env`.

> **Security Note:** Never commit `.env` files containing API keys to version control. Add them to `.gitignore`.

**Example `.gitignore`:**

```
.env
.nstbrowser-ai-agent.env
nstbrowser-ai-agent.json
```

## Default Timeout

The default Playwright timeout for standard operations (clicks, waits, fills, etc.) is 25 seconds. This is intentionally below the CLI's 30-second IPC read timeout so that Playwright returns a proper error instead of the CLI timing out with EAGAIN.

Override the default timeout via environment variable:

```bash
# Set a longer timeout for slow pages (in milliseconds)
export NSTBROWSER_AI_AGENT_DEFAULT_TIMEOUT=45000
```

> **Note:** Setting this above 30000 (30s) may cause EAGAIN errors on slow operations because the CLI's read timeout will expire before Playwright responds. The CLI retries transient errors automatically, but response times will increase.

| Variable | Description |
|----------|-------------|
| `NSTBROWSER_AI_AGENT_DEFAULT_TIMEOUT` | Default Playwright timeout in ms (default: 25000) |

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
nstbrowser-ai-agent open example.com
nstbrowser-ai-agent snapshot -i --json   # AI parses tree and refs

# 2. AI identifies target refs from snapshot
# 3. Execute actions using refs
nstbrowser-ai-agent click @e2
nstbrowser-ai-agent fill @e3 "input text"

# 4. Get new snapshot if page changed
nstbrowser-ai-agent snapshot -i --json
```

### Command Chaining

Commands can be chained with `&&` in a single shell invocation. The browser persists via a background daemon, so chaining is safe and more efficient:

```bash
# Open, wait for load, and snapshot in one call
nstbrowser-ai-agent open example.com && nstbrowser-ai-agent wait --load networkidle && nstbrowser-ai-agent snapshot -i

# Chain multiple interactions
nstbrowser-ai-agent fill @e1 "user@example.com" && nstbrowser-ai-agent fill @e2 "pass" && nstbrowser-ai-agent click @e3

# Navigate and screenshot
nstbrowser-ai-agent open example.com && nstbrowser-ai-agent wait --load networkidle && nstbrowser-ai-agent screenshot page.png
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

## Custom Browser Executable

Use a custom browser executable instead of the bundled Chromium. This is useful for:
- **Serverless deployment**: Use lightweight Chromium builds like `@sparticuz/chromium` (~50MB vs ~684MB)
- **System browsers**: Use an existing Chrome/Chromium installation
- **Custom builds**: Use modified browser builds

### CLI Usage

```bash
# Via flag
nstbrowser-ai-agent --executable-path /path/to/chromium open example.com

# Via environment variable
NSTBROWSER_AI_AGENT_EXECUTABLE_PATH=/path/to/chromium nstbrowser-ai-agent open example.com
```

### Serverless Example (AWS Lambda)

```typescript
import chromium from '@sparticuz/chromium';
import { BrowserManager } from 'nstbrowser-ai-agent';

export async function handler() {
  const browser = new BrowserManager();
  await browser.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  // ... use browser
}
```

## Local Files

Open and interact with local files (PDFs, HTML, etc.) using `file://` URLs:

```bash
# Enable file access (required for JavaScript to access local files)
nstbrowser-ai-agent --allow-file-access open file:///path/to/document.pdf
nstbrowser-ai-agent --allow-file-access open file:///path/to/page.html

# Take screenshot of a local PDF
nstbrowser-ai-agent --allow-file-access open file:///Users/me/report.pdf
nstbrowser-ai-agent screenshot report.png
```

The `--allow-file-access` flag adds Chromium flags (`--allow-file-access-from-files`, `--allow-file-access`) that allow `file://` URLs to:
- Load and render local files
- Access other local files via JavaScript (XHR, fetch)
- Load local resources (images, scripts, stylesheets)

**Note:** This flag only works with Chromium. For security, it's disabled by default.


Stream the browser viewport via WebSocket for live preview or "pair browsing" where a human can watch and interact alongside an AI agent.

### Enable Streaming

Set the `NSTBROWSER_AI_AGENT_STREAM_PORT` environment variable:

```bash
NSTBROWSER_AI_AGENT_STREAM_PORT=9223 nstbrowser-ai-agent open example.com
```

This starts a WebSocket server on the specified port that streams the browser viewport and accepts input events.

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
# Via flag
nstbrowser-ai-agent --native open example.com

# Via environment variable (recommended for persistent use)
export NSTBROWSER_AI_AGENT_NATIVE=1
nstbrowser-ai-agent open example.com
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

### Just ask the agent

The simplest approach -- just tell your agent to use it:

```
Use nstbrowser-ai-agent to test the login flow. Run nstbrowser-ai-agent --help to see available commands.
```

The `--help` output is comprehensive and most agents can figure it out from there.

### AI Coding Assistants (recommended)

Add the skill to your AI coding assistant for richer context:

```bash
npx skills add nstbrowser/nstbrowser-ai-agent
```

This works with Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Goose, OpenCode, and Windsurf. The skill is fetched from the repository, so it stays up to date automatically -- do not copy `SKILL.md` from `node_modules` as it will become stale.

### Claude Code

Install as a Claude Code skill:

```bash
npx skills add nstbrowser/nstbrowser-ai-agent
```

This adds the skill to `.claude/skills/nstbrowser-ai-agent/SKILL.md` in your project. The skill teaches Claude Code the full nstbrowser-ai-agent workflow, including the snapshot-ref interaction pattern, session management, and timeout handling.

### AGENTS.md / CLAUDE.md

For more consistent results, add to your project or global instructions file:

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

## Nstbrowser Integration

[Nstbrowser](https://www.nstbrowser.io) provides advanced browser fingerprinting and anti-detection capabilities for web automation. It offers local browser instances with customizable fingerprints, proxy management, and profile persistence.

**Nstbrowser is the default provider** - you don't need to specify `-p nst` unless you want to be explicit.

**Setup:**

1. Download and install the Nstbrowser client from [nstbrowser.io](https://www.nstbrowser.io)
2. Start the Nstbrowser client application
3. Get your API key from the Nstbrowser dashboard

**Usage:**

```bash
# Set environment variables
export NST_API_KEY="your-api-key"
export NST_HOST="localhost"  # Optional, default: localhost
export NST_PORT="8848"       # Optional, default: 8848

# Launch browser (uses Nstbrowser by default)
nstbrowser-ai-agent open https://example.com

# Or use a named profile
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com

# Or be explicit with -p nst
nstbrowser-ai-agent -p nst open https://example.com
```

Or use environment variables for persistent configuration:

```bash
export NSTBROWSER_AI_AGENT_PROVIDER=nst  # Optional, nst is default
export NST_API_KEY="your-api-key"
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com
```

**Profile Management:**

```bash
# With default NST provider (NST_API_KEY set), no 'nst' prefix needed:
nstbrowser-ai-agent profile list                    # List all profiles
nstbrowser-ai-agent profile create myprofile \      # Create new profile
  --proxy-host 127.0.0.1 --proxy-port 1080 --proxy-enabled

# Traditional explicit syntax still works:
nstbrowser-ai-agent nst profile list
nstbrowser-ai-agent nst profile create myprofile \
  --proxy-host 127.0.0.1 --proxy-port 1080 --proxy-enabled

# Update proxy settings
nstbrowser-ai-agent profile proxy update profile-123 \
  --host 127.0.0.1 --port 1080 --type http

# Manage tags
nstbrowser-ai-agent profile tags create profile-123 "production"
nstbrowser-ai-agent profile tags list

# Manage groups
nstbrowser-ai-agent profile groups list
nstbrowser-ai-agent profile groups change group-id profile-123

# List profiles with cursor pagination (for large datasets)
nstbrowser-ai-agent profile list-cursor --page-size 50
nstbrowser-ai-agent profile list-cursor --cursor "token" --page-size 50

# Clear cache and cookies
nstbrowser-ai-agent profile cache clear profile-123
nstbrowser-ai-agent profile cookies clear profile-123

# Delete profiles (supports batch operations)
nstbrowser-ai-agent profile delete profile-1 profile-2 profile-3
```

**Profile Selection (Name or ID):**

The `--profile` flag accepts either a profile name or profile ID (UUID). The system automatically detects UUID patterns:

```bash
# By profile name
nstbrowser-ai-agent --profile my-profile open example.com
nstbrowser-ai-agent browser start proxy_ph

# By profile ID (UUID format auto-detected)
nstbrowser-ai-agent --profile ef2b083a-8f77-4a7f-8441-a8d56bbd832b open example.com
nstbrowser-ai-agent browser start ef2b083a-8f77-4a7f-8441-a8d56bbd832b

# Both work the same way - no need to remember which flag to use
# The system automatically detects if you're using a UUID or a name
```

You can still use `--profile-id` for explicit ID specification if preferred, but `--profile` now handles both formats automatically.

**Browser Instance Management:**

```bash
# With default NST provider (NST_API_KEY set), no 'nst' prefix needed:
nstbrowser-ai-agent browser list                    # List running instances
nstbrowser-ai-agent browser start profile-123       # Start browser for profile
nstbrowser-ai-agent browser start-once              # Start temporary browser
nstbrowser-ai-agent browser stop profile-123        # Stop browser instance
nstbrowser-ai-agent browser stop-all                # Stop all instances
nstbrowser-ai-agent browser pages profile-123       # Get browser pages/tabs
nstbrowser-ai-agent browser debugger profile-123    # Get debugger URL
nstbrowser-ai-agent browser cdp-url profile-123     # Get CDP WebSocket URL
nstbrowser-ai-agent browser cdp-url-once            # Get CDP URL for temp browser
nstbrowser-ai-agent browser connect profile-123     # Connect and get CDP URL
nstbrowser-ai-agent browser connect-once            # Connect to temp browser

# Traditional explicit syntax still works:
nstbrowser-ai-agent nst browser list
nstbrowser-ai-agent nst browser start profile-123
nstbrowser-ai-agent nst browser stop profile-123
nstbrowser-ai-agent nst browser stop-all
```

**Environment Variables:**

<table>
<thead>
<tr>
<th>Variable</th>
<th>Description</th>
<th>Default</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>NST_API_KEY</code></td>
<td>Nstbrowser API key (required)</td>
<td>(none)</td>
</tr>
<tr>
<td><code>NST_HOST</code></td>
<td>Nstbrowser API host</td>
<td><code>localhost</code></td>
</tr>
<tr>
<td><code>NST_PORT</code></td>
<td>Nstbrowser API port</td>
<td><code>8848</code></td>
</tr>

</tbody>
</table>

**Features:**

- **Advanced Fingerprinting**: Customize browser fingerprints to avoid detection
- **Profile Management**: Create and manage multiple browser profiles with different configurations
- **Proxy Support**: Configure proxies per profile with authentication
- **Tag System**: Organize profiles with tags for easy management
- **Group Management**: Organize profiles into groups
- **Local Execution**: Runs locally on your machine, no cloud dependency
- **Batch Operations**: Perform operations on multiple profiles simultaneously

**Requirements:**

- Nstbrowser client must be installed and running
- API key from Nstbrowser dashboard
- Local network access to Nstbrowser API (default: localhost:8848)

When enabled, nstbrowser-ai-agent connects to your local Nstbrowser instance via CDP. All standard nstbrowser-ai-agent commands work identically, with the added benefit of Nstbrowser's anti-detection features.

## License

Apache-2.0
