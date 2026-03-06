# Profile Management

Complete guide to managing Nstbrowser profiles for browser automation.

**Related**: [proxy-configuration.md](proxy-configuration.md) for proxy setup, [browser-instances.md](browser-instances.md) for browser control, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [What are Profiles](#what-are-profiles)
- [Listing Profiles](#listing-profiles)
- [Creating Profiles](#creating-profiles)
- [Viewing Profile Details](#viewing-profile-details)
- [Deleting Profiles](#deleting-profiles)
- [Profile Name vs ID](#profile-name-vs-id)
- [Profile Resolution](#profile-resolution)

## What are Profiles

Nstbrowser profiles are persistent browser environments that store:
- **Browser fingerprints**: Canvas, WebGL, fonts, audio context
- **Session data**: Cookies, localStorage, sessionStorage
- **Configuration**: User agent, timezone, language, screen resolution
- **Proxy settings**: HTTP/HTTPS/SOCKS5 proxy configuration
- **Extensions**: Browser extensions and their data

Profiles enable:
- Session persistence across automation runs
- Anti-detection through fingerprint randomization
- Multi-account management
- Proxy rotation and IP management

## Listing Profiles

### Basic List
```bash
nstbrowser-ai-agent profile list
```

Output:
```
Profile List:
  ID: 86581051-fb0d-4c4a-b1e3-ebc1abd17174
  Name: my-profile
  Group: Default
  Platform: Windows
  
  ID: 7a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p
  Name: test-profile
  Group: Testing
  Platform: macOS
```

### JSON Output
```bash
nstbrowser-ai-agent profile list --json
```

Output:
```json
{
  "profiles": [
    {
      "profileId": "86581051-fb0d-4c4a-b1e3-ebc1abd17174",
      "name": "my-profile",
      "groupId": "default-group-id",
      "groupName": "Default",
      "platform": "Windows",
      "kernel": "chromium",
      "proxyConfig": {
        "type": "http",
        "host": "127.0.0.1",
        "port": 1080,
        "enabled": true
      }
    }
  ]
}
```

## Creating Profiles

### Basic Profile
```bash
nstbrowser-ai-agent profile create my-new-profile
```

This creates a profile with:
- Random browser fingerprint
- Default platform (Windows)
- No proxy configured
- Default group

### Profile with Proxy
```bash
nstbrowser-ai-agent profile create my-proxy-profile \
  --proxy-host 127.0.0.1 \
  --proxy-port 1080 \
  --proxy-type http \
  --proxy-enabled
```

### Profile with Custom Platform
```bash
nstbrowser-ai-agent profile create my-mac-profile \
  --platform macOS
```

Supported platforms:
- `Windows` (default)
- `macOS`
- `Linux`

## Viewing Profile Details

### By Profile ID
```bash
nstbrowser-ai-agent profile show 86581051-fb0d-4c4a-b1e3-ebc1abd17174 --json
```

### By Profile Name
```bash
nstbrowser-ai-agent profile show my-profile --json
```

Output:
```json
{
  "profile": {
    "profileId": "86581051-fb0d-4c4a-b1e3-ebc1abd17174",
    "name": "my-profile",
    "groupId": "default-group-id",
    "groupName": "Default",
    "platform": "Windows",
    "kernel": "chromium",
    "fingerprint": {
      "canvas": "...",
      "webgl": "...",
      "fonts": ["Arial", "Times New Roman", ...]
    },
    "proxyConfig": {
      "type": "http",
      "host": "127.0.0.1",
      "port": 1080,
      "enabled": true
    },
    "createdAt": "2024-03-06T10:00:00Z",
    "updatedAt": "2024-03-06T12:00:00Z"
  }
}
```

## Deleting Profiles

### Delete Single Profile
```bash
nstbrowser-ai-agent profile delete 86581051-fb0d-4c4a-b1e3-ebc1abd17174
```

### Delete Multiple Profiles
```bash
nstbrowser-ai-agent profile delete \
  86581051-fb0d-4c4a-b1e3-ebc1abd17174 \
  7a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p
```

**Warning**: Deleting a profile is permanent and cannot be undone. All session data, cookies, and configuration will be lost.

## Profile Name vs ID

### Profile ID
- UUID format: `86581051-fb0d-4c4a-b1e3-ebc1abd17174`
- Unique and immutable
- Used internally by Nstbrowser API
- Guaranteed to be unique

### Profile Name
- Human-readable: `my-profile`
- Can be changed
- May not be unique (multiple profiles can have same name)
- More convenient for users

### When to Use Each

**Use Profile ID when**:
- You need guaranteed uniqueness
- Automating with scripts
- Profile names might change
- Working with API directly

**Use Profile Name when**:
- Interactive use
- Human-readable scripts
- Profile names are unique in your setup
- Easier to remember and type

## Profile Resolution

The CLI automatically resolves profile names to IDs using this logic:

### Resolution Priority
1. Explicit `--profile-id` flag
2. Explicit `--profile` flag (name)
3. `NST_PROFILE_ID` environment variable
4. `NST_PROFILE` environment variable
5. Once/temporary browser (no profile)

### Name Resolution Process
When you provide a profile name:

1. **Check running browsers**: If a browser with that name is already running, use it
2. **Query API**: If not running, search for profiles with matching name
3. **Use first match**: If multiple profiles have the same name, use the first one
4. **Error if not found**: Throw error if no profile matches

### Examples

```bash
# Using environment variable (name)
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com

# Using environment variable (ID)
export NST_PROFILE_ID="86581051-fb0d-4c4a-b1e3-ebc1abd17174"
nstbrowser-ai-agent open https://example.com

# Using command-line flag (name)
nstbrowser-ai-agent --profile my-profile open https://example.com

# Using command-line flag (ID)
nstbrowser-ai-agent --profile-id 86581051-fb0d-4c4a-b1e3-ebc1abd17174 open https://example.com

# Priority: --profile-id overrides everything
export NST_PROFILE="profile-a"
nstbrowser-ai-agent --profile-id <id-for-profile-b> open https://example.com
# Uses profile-b, not profile-a
```

### Best Practices

1. **Use unique names**: Avoid duplicate profile names to prevent confusion
2. **Store IDs for automation**: Use profile IDs in production scripts
3. **Use names for development**: Profile names are easier during development
4. **Check running browsers**: The CLI checks running browsers first for efficiency
5. **Handle errors**: Always check if profile exists before using

### Troubleshooting

**"Profile not found"**
```bash
# List all profiles to find the correct name/ID
nstbrowser-ai-agent profile list

# Verify the profile exists
nstbrowser-ai-agent profile show my-profile --json
```

**Multiple profiles with same name**
```bash
# The CLI will use the first match
# To avoid ambiguity, use profile ID instead
nstbrowser-ai-agent profile list --json | grep "my-profile"
# Find the correct ID and use it
nstbrowser-ai-agent --profile-id <correct-id> open https://example.com
```

## Advanced Usage

### Scripting with Profiles
```bash
#!/bin/bash
# Create profile if it doesn't exist

PROFILE_NAME="automation-profile"

# Check if profile exists
if ! nstbrowser-ai-agent profile show "$PROFILE_NAME" --json >/dev/null 2>&1; then
    echo "Creating profile: $PROFILE_NAME"
    nstbrowser-ai-agent profile create "$PROFILE_NAME" \
        --proxy-host 127.0.0.1 \
        --proxy-port 1080 \
        --proxy-type http \
        --proxy-enabled
fi

# Use the profile
export NST_PROFILE="$PROFILE_NAME"
nstbrowser-ai-agent open https://example.com
```

### Profile Lifecycle Management
```bash
# 1. Create profile
PROFILE_ID=$(nstbrowser-ai-agent profile create temp-profile --json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

# 2. Use profile
export NST_PROFILE_ID="$PROFILE_ID"
nstbrowser-ai-agent open https://example.com
# ... automation tasks ...
nstbrowser-ai-agent close

# 3. Clean up
nstbrowser-ai-agent profile delete "$PROFILE_ID"
```

## See Also

- [proxy-configuration.md](proxy-configuration.md) - Configure proxies for profiles
- [browser-instances.md](browser-instances.md) - Start and manage browser instances
- [tags-and-groups.md](tags-and-groups.md) - Organize profiles with tags and groups
