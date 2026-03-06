# Batch Operations

Complete guide to performing bulk operations on multiple profiles.

**Related**: [profile-management.md](profile-management.md) for profile basics, [proxy-configuration.md](proxy-configuration.md) for proxy setup, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Batch Proxy Operations](#batch-proxy-operations)
- [Batch Tag Operations](#batch-tag-operations)
- [Batch Group Operations](#batch-group-operations)
- [Batch Profile Deletion](#batch-profile-deletion)
- [Best Practices](#best-practices)

## Batch Proxy Operations

### Batch Update Proxy
```bash
nstbrowser-ai-agent profile proxy batch-update \
  <profile-id-1> <profile-id-2> <profile-id-3> \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

Use case: Apply same proxy to multiple profiles at once.

### Batch Reset Proxy
```bash
nstbrowser-ai-agent profile proxy batch-reset \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Remove proxy from multiple profiles at once.

## Batch Tag Operations

### Batch Create Tags
```bash
nstbrowser-ai-agent profile tags batch-create \
  <profile-id-1> <profile-id-2> <profile-id-3> \
  --tags "tag1" "tag2"
```

Use case: Tag multiple profiles with same labels.

### Batch Clear Tags
```bash
nstbrowser-ai-agent profile tags batch-clear \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Remove all tags from multiple profiles.

## Batch Group Operations

### Batch Change Group
```bash
nstbrowser-ai-agent profile group batch-change <group-id> \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Move multiple profiles to same group.

## Batch Profile Deletion

### Delete Multiple Profiles
```bash
nstbrowser-ai-agent profile delete \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Clean up multiple profiles at once.

## Best Practices

### 1. Use JSON Output for Scripting
```bash
# Get all profile IDs
PROFILE_IDS=$(nstbrowser-ai-agent profile list --json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

# Apply operation to all
nstbrowser-ai-agent profile proxy batch-update $PROFILE_IDS \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

### 2. Filter Profiles Before Batch Operations
```bash
#!/bin/bash
# Update proxy only for profiles in specific group

GROUP_NAME="Production"

# Get profiles in group
PROFILE_IDS=$(nstbrowser-ai-agent profile list --json | \
  jq -r ".profiles[] | select(.groupName==\"$GROUP_NAME\") | .profileId")

# Batch update
nstbrowser-ai-agent profile proxy batch-update $PROFILE_IDS \
  --host production-proxy.com \
  --port 8080 \
  --type http
```

### 3. Verify Before Batch Operations
```bash
# Always verify the list before applying changes
echo "Profiles to update:"
echo "$PROFILE_IDS"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    nstbrowser-ai-agent profile proxy batch-update $PROFILE_IDS \
      --host 127.0.0.1 \
      --port 1080 \
      --type http
fi
```

## See Also

- [profile-management.md](profile-management.md) - Profile basics
- [proxy-configuration.md](proxy-configuration.md) - Proxy setup
- [tags-and-groups.md](tags-and-groups.md) - Organization
