# Browser Instance Management

Complete guide to starting, stopping, and managing browser instances with Nstbrowser.

**Related**: [profile-management.md](profile-management.md) for profile basics, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Listing Browsers](#listing-browsers)
- [Starting Browsers](#starting-browsers)
- [Stopping Browsers](#stopping-browsers)
- [Browser Pages](#browser-pages)
- [Debugger Access](#debugger-access)
- [Best Practices](#best-practices)

## Listing Browsers

### List All Running Browsers
```bash
nstbrowser-ai-agent browser list
```

Output:
```
Running Browsers:
  Profile ID: 86581051-fb0d-4c4a-b1e3-ebc1abd17174
  Profile Name: my-profile
  Status: running
  
  Profile ID: 7a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p
  Profile Name: test-profile
  Status: running
```

### JSON Output
```bash
nstbrowser-ai-agent browser list --json
```

Output:
```json
{
  "browsers": [
    {
      "profileId": "86581051-fb0d-4c4a-b1e3-ebc1abd17174",
      "name": "my-profile",
      "running": true,
      "pid": 12345
    }
  ]
}
```

## Starting Browsers

### Start Browser for Profile
```bash
nstbrowser-ai-agent browser start <profile-id>
```

This starts a browser instance with the profile's configuration:
- Fingerprint
- Cookies and storage
- Proxy settings
- Extensions

### Start with Custom Config
```bash
nstbrowser-ai-agent browser start <profile-id> \
  --headless \
  --remote-debugging-port 9222
```

### Auto-Start on Navigation
```bash
# Browser auto-starts if not running
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com
```

The CLI automatically starts the browser if it's not already running.

## Stopping Browsers

### Stop Single Browser
```bash
nstbrowser-ai-agent browser stop <profile-id>
```

This:
- Closes all browser windows
- Saves session data (cookies, localStorage)
- Stops the browser process

### Stop All Browsers
```bash
nstbrowser-ai-agent browser stop-all
```

Use this to clean up all running browsers at once.

### Auto-Close on Command
```bash
# Close browser after automation
nstbrowser-ai-agent close
```

## Browser Pages

### List Open Pages/Tabs
```bash
nstbrowser-ai-agent browser pages <profile-id> --json
```

Output:
```json
{
  "pages": [
    {
      "id": "page-1",
      "url": "https://example.com",
      "title": "Example Domain"
    },
    {
      "id": "page-2",
      "url": "https://google.com",
      "title": "Google"
    }
  ]
}
```

Use case: Monitor open tabs, detect popups, manage multiple pages.

## Debugger Access

### Get Debugger URL
```bash
nstbrowser-ai-agent browser debugger <profile-id> --json
```

Output:
```json
{
  "debuggerUrl": "ws://localhost:9222/devtools/browser/abc123",
  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/abc123"
}
```

Use case: Connect Chrome DevTools, use CDP directly, advanced debugging.

### Connect Chrome DevTools
```bash
# 1. Get debugger URL
DEBUGGER_URL=$(nstbrowser-ai-agent browser debugger <profile-id> --json | grep -o '"webSocketDebuggerUrl":"[^"]*"' | cut -d'"' -f4)

# 2. Open in Chrome
# Navigate to: chrome://inspect
# Click "Configure" and add: localhost:9222
# Your browser will appear in the list
```

## Best Practices

### 1. Check Before Starting
```bash
# Check if browser is already running
if nstbrowser-ai-agent browser list --json | grep -q "$PROFILE_ID"; then
    echo "Browser already running"
else
    nstbrowser-ai-agent browser start "$PROFILE_ID"
fi
```

### 2. Always Stop When Done
```bash
# Ensure browser is stopped
trap "nstbrowser-ai-agent browser stop $PROFILE_ID" EXIT

# Your automation code here
nstbrowser-ai-agent open https://example.com
# ...
```

### 3. Monitor Running Browsers
```bash
#!/bin/bash
# Monitor browser health

while true; do
    RUNNING=$(nstbrowser-ai-agent browser list --json | grep -c '"running":true')
    echo "Running browsers: $RUNNING"
    sleep 60
done
```

### 4. Clean Up Orphaned Browsers
```bash
# Stop all browsers before starting new automation
nstbrowser-ai-agent browser stop-all

# Start fresh
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com
```

## See Also

- [profile-management.md](profile-management.md) - Profile basics
- [SKILL.md](../SKILL.md) - Quick start guide
