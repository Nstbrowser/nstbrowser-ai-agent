# Profile Name/ID Resolution

Complete guide to how the CLI resolves profile names to IDs.

**Related**: [profile-management.md](profile-management.md) for profile basics, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Resolution Priority](#resolution-priority)
- [Name Resolution Logic](#name-resolution-logic)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Resolution Priority

The CLI resolves profiles in this order (highest to lowest priority):

1. **`--profile-id` flag**: Explicit profile ID on command line
2. **`--profile` flag**: Explicit profile name on command line
3. **`NST_PROFILE_ID` env var**: Profile ID from environment
4. **`NST_PROFILE` env var**: Profile name from environment
5. **Once browser**: Temporary browser (if no profile specified)

## Name Resolution Logic

When you provide a profile name (not ID), the CLI:

1. **Checks running browsers**: If a browser with that name is already running, uses it
2. **Queries API**: If not running, searches for profiles with matching name
3. **Uses first match**: If multiple profiles have the same name, uses the first one
4. **Errors if not found**: Throws error if no profile matches

## Examples

### Using Environment Variables
```bash
# By name
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://example.com

# By ID
export NST_PROFILE_ID="86581051-fb0d-4c4a-b1e3-ebc1abd17174"
nstbrowser-ai-agent open https://example.com
```

### Using Command-Line Flags
```bash
# By name
nstbrowser-ai-agent --profile my-profile open https://example.com

# By ID
nstbrowser-ai-agent --profile-id 86581051-fb0d-4c4a-b1e3-ebc1abd17174 open https://example.com
```

### Priority Override
```bash
# --profile-id has highest priority
export NST_PROFILE="profile-a"
nstbrowser-ai-agent --profile-id <id-for-profile-b> open https://example.com
# Uses profile-b, not profile-a
```

## Best Practices

### 1. Use Unique Profile Names
```bash
# Good: Unique names
nstbrowser-ai-agent profile create project-a-prod
nstbrowser-ai-agent profile create project-a-dev
nstbrowser-ai-agent profile create project-b-prod

# Avoid: Duplicate names
nstbrowser-ai-agent profile create my-profile  # First one
nstbrowser-ai-agent profile create my-profile  # Second one - confusing!
```

### 2. Store IDs for Production Scripts
```bash
#!/bin/bash
# Production script - use IDs for reliability

PROFILE_ID="86581051-fb0d-4c4a-b1e3-ebc1abd17174"
export NST_PROFILE_ID="$PROFILE_ID"

nstbrowser-ai-agent open https://example.com
```

### 3. Use Names for Development
```bash
# Development - names are easier
export NST_PROFILE="dev-profile"
nstbrowser-ai-agent open https://example.com
```

## Troubleshooting

### Profile Not Found
```bash
# List all profiles
nstbrowser-ai-agent profile list

# Verify profile exists
nstbrowser-ai-agent profile show my-profile --json
```

### Multiple Profiles with Same Name
```bash
# Find all profiles with name
nstbrowser-ai-agent profile list --json | grep "my-profile"

# Use ID instead
nstbrowser-ai-agent --profile-id <correct-id> open https://example.com
```

### Wrong Profile Used
```bash
# Check resolution priority
echo "NST_PROFILE: $NST_PROFILE"
echo "NST_PROFILE_ID: $NST_PROFILE_ID"

# Unset variables to test
unset NST_PROFILE
unset NST_PROFILE_ID
```

## See Also

- [profile-management.md](profile-management.md) - Profile basics
- [SKILL.md](../SKILL.md) - Quick start guide
