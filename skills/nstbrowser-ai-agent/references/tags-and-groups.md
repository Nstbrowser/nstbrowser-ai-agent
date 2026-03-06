# Tags and Groups Management

Complete guide to organizing profiles with tags and groups.

**Related**: [profile-management.md](profile-management.md) for profile basics, [batch-operations.md](batch-operations.md) for bulk operations, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Profile Groups](#profile-groups)
- [Profile Tags](#profile-tags)
- [Best Practices](#best-practices)

## Profile Groups

Groups are containers for organizing profiles. Each profile belongs to one group.

### List All Groups
```bash
nstbrowser-ai-agent profile groups list --json
```

Output:
```json
{
  "groups": [
    {
      "groupId": "default-group-id",
      "name": "Default"
    },
    {
      "groupId": "testing-group-id",
      "name": "Testing"
    }
  ]
}
```

### Change Profile Group
```bash
# Move single profile to group
nstbrowser-ai-agent profile group change <group-id> <profile-id>
```

### Batch Change Group
```bash
# Move multiple profiles to group
nstbrowser-ai-agent profile group batch-change <group-id> \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Organize profiles by project, client, or purpose.

## Profile Tags

Tags are labels for categorizing profiles. Each profile can have multiple tags.

### List All Tags
```bash
nstbrowser-ai-agent profile tags list --json
```

Output:
```json
{
  "tags": [
    {"name": "production"},
    {"name": "testing"},
    {"name": "development"}
  ]
}
```

### Create Tags
```bash
# Create tag for single profile
nstbrowser-ai-agent profile tags create <profile-id> "my-tag"
```

### Batch Create Tags
```bash
# Create tags for multiple profiles
nstbrowser-ai-agent profile tags batch-create \
  <profile-id-1> <profile-id-2> <profile-id-3> \
  --tags "tag1" "tag2"
```

### Clear Tags
```bash
# Clear tags from single profile
nstbrowser-ai-agent profile tags clear <profile-id>
```

### Batch Clear Tags
```bash
# Clear tags from multiple profiles
nstbrowser-ai-agent profile tags batch-clear \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

## Best Practices

### 1. Use Groups for High-Level Organization
```bash
# Organize by project
# Group: "Project A" - all profiles for project A
# Group: "Project B" - all profiles for project B
```

### 2. Use Tags for Cross-Cutting Concerns
```bash
# Tag profiles by status: "active", "archived"
# Tag profiles by environment: "production", "staging", "development"
# Tag profiles by region: "us", "eu", "asia"
```

### 3. Combine Groups and Tags
```bash
# Group: "E-commerce"
# Tags: "production", "us", "high-priority"
```

## See Also

- [profile-management.md](profile-management.md) - Profile basics
- [batch-operations.md](batch-operations.md) - Bulk operations
