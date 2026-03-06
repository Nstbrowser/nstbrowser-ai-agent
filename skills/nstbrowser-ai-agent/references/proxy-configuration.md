# Proxy Configuration

Complete guide to configuring and managing proxies for Nstbrowser profiles.

**Related**: [profile-management.md](profile-management.md) for profile basics, [batch-operations.md](batch-operations.md) for bulk proxy updates, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Proxy Types](#proxy-types)
- [Viewing Proxy Configuration](#viewing-proxy-configuration)
- [Updating Proxy](#updating-proxy)
- [Resetting Proxy](#resetting-proxy)
- [Batch Operations](#batch-operations)
- [Proxy Testing](#proxy-testing)
- [Best Practices](#best-practices)

## Proxy Types

Nstbrowser supports three proxy types:

### HTTP Proxy
```bash
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host 127.0.0.1 \
  --port 8080 \
  --type http
```

- Standard HTTP proxy
- Works with HTTP and HTTPS traffic
- Most common proxy type

### HTTPS Proxy
```bash
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host 127.0.0.1 \
  --port 8443 \
  --type https
```

- Encrypted proxy connection
- Better security than HTTP
- Requires HTTPS-capable proxy server

### SOCKS5 Proxy
```bash
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host 127.0.0.1 \
  --port 1080 \
  --type socks5
```

- Most flexible proxy type
- Supports TCP and UDP
- Works with any protocol
- Best for advanced use cases

## Viewing Proxy Configuration

### By Profile ID
```bash
nstbrowser-ai-agent profile proxy show <profile-id> --json
```

### By Profile Name
```bash
nstbrowser-ai-agent profile proxy show my-profile --json
```

Output:
```json
{
  "proxyConfig": {
    "type": "http",
    "host": "127.0.0.1",
    "port": 1080,
    "username": null,
    "password": null,
    "enabled": true
  },
  "proxyResult": {
    "status": "connected",
    "ip": "203.0.113.1",
    "country": "US",
    "city": "New York"
  }
}
```

## Updating Proxy

### Basic Proxy Update
```bash
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

### Proxy with Authentication
```bash
nstbrowser-ai-agent profile proxy update <profile-id> \
  --host proxy.example.com \
  --port 8080 \
  --type http \
  --username myuser \
  --password mypass
```

### Update by Profile Name
```bash
# The CLI resolves name to ID automatically
nstbrowser-ai-agent profile proxy update my-profile \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

## Resetting Proxy

### Reset Single Profile
```bash
nstbrowser-ai-agent profile proxy reset <profile-id>
```

This removes all proxy configuration and the browser will use direct connection.

### Reset by Profile Name
```bash
nstbrowser-ai-agent profile proxy reset my-profile
```

## Batch Operations

### Batch Update Multiple Profiles
```bash
nstbrowser-ai-agent profile proxy batch-update \
  <profile-id-1> <profile-id-2> <profile-id-3> \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

Use case: Apply same proxy to multiple profiles at once.

### Batch Reset Multiple Profiles
```bash
nstbrowser-ai-agent profile proxy batch-reset \
  <profile-id-1> <profile-id-2> <profile-id-3>
```

Use case: Remove proxy from multiple profiles at once.

## Proxy Testing

### Test Proxy Connection
```bash
# 1. Update proxy
nstbrowser-ai-agent profile proxy update my-profile \
  --host 127.0.0.1 \
  --port 1080 \
  --type http

# 2. Start browser
export NST_PROFILE="my-profile"
nstbrowser-ai-agent open https://api.ipify.org

# 3. Check IP
nstbrowser-ai-agent eval "document.body.textContent"

# 4. Close
nstbrowser-ai-agent close
```

### Verify Proxy Configuration
```bash
# Check proxy settings
nstbrowser-ai-agent profile proxy show my-profile --json

# Look for proxyResult.status and proxyResult.ip
```

## Best Practices

### 1. Test Proxy Before Use
```bash
# Always verify proxy works before automation
nstbrowser-ai-agent profile proxy update test-profile \
  --host new-proxy.com \
  --port 8080 \
  --type http

# Test connection
export NST_PROFILE="test-profile"
nstbrowser-ai-agent open https://api.ipify.org
nstbrowser-ai-agent eval "document.body.textContent"
nstbrowser-ai-agent close
```

### 2. Use Batch Operations for Efficiency
```bash
# Instead of updating one by one:
# nstbrowser-ai-agent profile proxy update profile1 ...
# nstbrowser-ai-agent profile proxy update profile2 ...
# nstbrowser-ai-agent profile proxy update profile3 ...

# Use batch update:
nstbrowser-ai-agent profile proxy batch-update \
  profile1 profile2 profile3 \
  --host 127.0.0.1 \
  --port 1080 \
  --type http
```

### 3. Store Proxy Credentials Securely
```bash
# Don't hardcode credentials
# Use environment variables
export PROXY_USER="myuser"
export PROXY_PASS="mypass"

nstbrowser-ai-agent profile proxy update my-profile \
  --host proxy.example.com \
  --port 8080 \
  --type http \
  --username "$PROXY_USER" \
  --password "$PROXY_PASS"
```

### 4. Rotate Proxies for Anti-Detection
```bash
#!/bin/bash
# Proxy rotation script

PROXIES=(
  "proxy1.example.com:8080"
  "proxy2.example.com:8080"
  "proxy3.example.com:8080"
)

PROFILES=(
  "profile1"
  "profile2"
  "profile3"
)

# Assign different proxy to each profile
for i in "${!PROFILES[@]}"; do
  PROXY="${PROXIES[$i]}"
  HOST="${PROXY%:*}"
  PORT="${PROXY#*:}"
  
  nstbrowser-ai-agent profile proxy update "${PROFILES[$i]}" \
    --host "$HOST" \
    --port "$PORT" \
    --type http
done
```

### 5. Monitor Proxy Health
```bash
#!/bin/bash
# Check proxy status for all profiles

for profile in $(nstbrowser-ai-agent profile list --json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4); do
  echo "Checking proxy for profile: $profile"
  nstbrowser-ai-agent profile proxy show "$profile" --json | grep "proxyResult"
done
```

## Common Issues

### Proxy Connection Failed
```bash
# Check proxy configuration
nstbrowser-ai-agent profile proxy show my-profile --json

# Verify proxy is reachable
curl -x http://127.0.0.1:1080 https://api.ipify.org

# Try different proxy type
nstbrowser-ai-agent profile proxy update my-profile \
  --host 127.0.0.1 \
  --port 1080 \
  --type socks5  # Try SOCKS5 instead of HTTP
```

### Authentication Failed
```bash
# Verify credentials are correct
nstbrowser-ai-agent profile proxy update my-profile \
  --host proxy.example.com \
  --port 8080 \
  --type http \
  --username correct-user \
  --password correct-pass

# Check proxy server logs for authentication errors
```

### Slow Connection
```bash
# Test proxy speed
time curl -x http://127.0.0.1:1080 https://example.com

# Try different proxy server
nstbrowser-ai-agent profile proxy update my-profile \
  --host faster-proxy.com \
  --port 8080 \
  --type http
```

## Advanced Usage

### Dynamic Proxy Assignment
```bash
#!/bin/bash
# Assign proxy based on profile group

PROFILE_ID="$1"

# Get profile group
GROUP=$(nstbrowser-ai-agent profile show "$PROFILE_ID" --json | grep -o '"groupName":"[^"]*"' | cut -d'"' -f4)

# Assign proxy based on group
case "$GROUP" in
  "US")
    PROXY_HOST="us-proxy.example.com"
    ;;
  "EU")
    PROXY_HOST="eu-proxy.example.com"
    ;;
  *)
    PROXY_HOST="default-proxy.example.com"
    ;;
esac

nstbrowser-ai-agent profile proxy update "$PROFILE_ID" \
  --host "$PROXY_HOST" \
  --port 8080 \
  --type http
```

### Proxy Pool Management
```bash
#!/bin/bash
# Manage a pool of proxies

PROXY_POOL=(
  "proxy1.example.com:8080:user1:pass1"
  "proxy2.example.com:8080:user2:pass2"
  "proxy3.example.com:8080:user3:pass3"
)

# Get random proxy from pool
RANDOM_PROXY="${PROXY_POOL[$RANDOM % ${#PROXY_POOL[@]}]}"
IFS=':' read -r HOST PORT USER PASS <<< "$RANDOM_PROXY"

# Apply to profile
nstbrowser-ai-agent profile proxy update my-profile \
  --host "$HOST" \
  --port "$PORT" \
  --type http \
  --username "$USER" \
  --password "$PASS"
```

## See Also

- [profile-management.md](profile-management.md) - Profile basics
- [batch-operations.md](batch-operations.md) - Bulk operations
- [browser-instances.md](browser-instances.md) - Browser control
