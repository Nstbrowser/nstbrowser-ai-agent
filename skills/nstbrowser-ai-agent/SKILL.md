---
name: nstbrowser-ai-agent
description: Browser automation CLI for Nstbrowser profiles. Use when the user needs Nstbrowser profile management, temporary browsers, proxy-aware automation, or browser actions that must run through the Nstbrowser desktop client.
allowed-tools: Bash(npx nstbrowser-ai-agent:*), Bash(nstbrowser-ai-agent:*)
---

# nstbrowser-ai-agent

This skill is for the **Nstbrowser** workflow.

## Default Operating Mode

Use a **known-good Nstbrowser profile** and repeat the same `--profile <name-or-id>` on every browser command.

- This is the safest default for AI agents.
- Only introduce `--session` when the task truly needs an isolated multi-step workflow.
- In one daemon session, `--profile twitter1` must switch to `twitter1`; do not assume the previous profile remains active.
- Do not assume refs such as `@e1` will keep working after navigation or across a different session.

## Prerequisites

- Nstbrowser desktop client is installed and running
- API key is configured with `nstbrowser-ai-agent config set key YOUR_API_KEY` or `NST_API_KEY`
- NST service is reachable at `http://127.0.0.1:8848` unless the user configured a different host/port

## First Checks

Run these first when the environment may be unconfigured:

```bash
nstbrowser-ai-agent nst status
nstbrowser-ai-agent profile list
nstbrowser-ai-agent --version
```

## Fast Path

Use this path unless the user explicitly asks for something more specialized:

```bash
nstbrowser-ai-agent nst status
nstbrowser-ai-agent profile list
nstbrowser-ai-agent verify --profile YOUR_PROFILE
nstbrowser-ai-agent --profile YOUR_PROFILE open https://example.com
nstbrowser-ai-agent --profile YOUR_PROFILE snapshot -i
nstbrowser-ai-agent --profile YOUR_PROFILE click @e1
nstbrowser-ai-agent --profile YOUR_PROFILE get url
nstbrowser-ai-agent --profile YOUR_PROFILE screenshot --annotate /tmp/page.png
```

Replace `YOUR_PROFILE` with a profile from `profile list`.

If you do not have a clean profile yet:

```bash
nstbrowser-ai-agent profile create task-profile
nstbrowser-ai-agent --profile task-profile open https://example.com
```

## Core NST Commands

### Configuration

```bash
nstbrowser-ai-agent config set key YOUR_API_KEY
nstbrowser-ai-agent config show
nstbrowser-ai-agent config get key
```

### Diagnostics

Use only the forms below:

```bash
nstbrowser-ai-agent nst status
nstbrowser-ai-agent profile list
nstbrowser-ai-agent verify YOUR_PROFILE
nstbrowser-ai-agent verify --profile YOUR_PROFILE
nstbrowser-ai-agent repair
```

### Profile Management

- `profile list`
  Use when you need a fast human-readable list of candidate profiles.
  Important parameter: `--verbose` returns the full NST profile object instead of the shorter summary.

- `profile list-cursor --page-size <size> [--cursor <token>] [--direction next|prev]`
  Use when there are many profiles and you want deterministic paging.
  `--page-size` limits one page.
  `--cursor` continues from a previously returned cursor.
  `--direction` tells NST whether that cursor is for the next page or previous page.

- `profile show <name-or-id>`
  Use when you need one profile's exact group, proxy, tags, platform, or last launch info.

- `profile create <name> [--platform <Windows|macOS|Linux>] [--kernel <version>] [--group-id <id>]`
  Use when you need a clean profile for a new task.
  `--kernel` requests a preferred kernel milestone; NST may normalize it to a currently supported version.
  Optional proxy parameters:
  `--proxy-host <host>`, `--proxy-port <port>`, `--proxy-type <http|https|socks5>`, `--proxy-username <user>`, `--proxy-password <pass>`.

- `profile proxy show <name-or-id>`
  Use when proxy behavior looks suspicious and you want to inspect the saved proxy config and last proxy check result.

- `profile proxy update <name-or-id> --host <host> --port <port> [--type <type>] [--username <user>] [--password <pass>]`
  Use when a profile should keep the same cookies/history but change to a different proxy.

- `profile proxy reset <name-or-id> [name-or-id...]`
  Use when a profile should go back to local/default routing.

- `profile tags list`, `profile tags create`, `profile tags update`, `profile tags clear`
  Use when you need to organize profiles for repeated agent workflows.
  `profile tags create` only needs a tag name; the CLI fills in a default tag color.

- `profile groups list`, `profile groups change <group-id> <name-or-id> [name-or-id...]`
  Use when you need to discover valid NST group IDs or move profiles into a specific group.

### Browser Management

- `browser list`
  Use when you need to see which profile browsers or temporary browsers are already running.

- `browser start <name-or-id> [--headless] [--auto-close]`
  Use when you want the browser running before the first `open`.
  `--headless` requests headless launch.
  `--auto-close` asks NST to close that browser when its owner exits.

- `browser pages <name-or-id>`
  Use when you need the current debuggable pages in one running browser.

- `browser debugger <name-or-id>`
  Use when you need the debugger port and browser-level WebSocket endpoint.

- `browser cdp-url <name-or-id>`
  Use when you only need the browser-level CDP WebSocket URL.

- `browser connect <name-or-id>`
  Use when you want NST to start the browser if needed and immediately return connection info.

- `browser start-once [--platform <platform>] [--kernel <kernel>] [--headless] [--auto-close]`
  Use only for throwaway work that should not persist in a saved profile.

- `browser cdp-url-once`
  Use when a temporary browser is enough and you only need its CDP URL.

- `browser connect-once [--platform <platform>] [--kernel <kernel>]`
  Use when one command should both create a temporary browser and return CDP connection info.

- `browser stop <name-or-id>` and `browser stop-all`
  Use for cleanup after the task or when stale browsers should be cleared.

### When to Use Which NST Command

- Use `nst status` first when the environment itself may be broken.
- Use `profile list` when you only need a profile name to start work quickly.
- Use `profile list-cursor` when the workspace has too many profiles for one list.
- Use `profile show` when the question is about one specific profile's configuration.
- Use `verify` before real work when the profile may be stale or untrusted.
- Use `repair` after `verify` reports stale browser state or repeated attach failures.
- Use `browser start` when you want explicit control over browser launch.
- Use `--profile <name-or-id>` directly on browser actions when the goal is task execution, not management.

## Browser Actions

All browser actions can use `--profile <name-or-id>`. The value may be a profile name or UUID.

### Recommended Workflow

Prefer this workflow over temporary browsers:

```bash
nstbrowser-ai-agent --profile YOUR_PROFILE open https://example.com
nstbrowser-ai-agent --profile YOUR_PROFILE snapshot -i
nstbrowser-ai-agent --profile YOUR_PROFILE click @e1
nstbrowser-ai-agent --profile YOUR_PROFILE get url
nstbrowser-ai-agent --profile YOUR_PROFILE screenshot --annotate /tmp/page.png
nstbrowser-ai-agent browser stop YOUR_PROFILE
```

### Session Workflow

Use this only when the user explicitly needs isolation or a longer daemon-backed run. Keep the same `--session` and `--profile` on every related command.

If the task intentionally changes to a different Nstbrowser profile inside the same `--session`, repeat the new `--profile` explicitly on the switching command.

```bash
nstbrowser-ai-agent --session task-run --profile YOUR_PROFILE open https://example.com
nstbrowser-ai-agent --session task-run --profile YOUR_PROFILE snapshot -i
nstbrowser-ai-agent --session task-run --profile YOUR_PROFILE click @e1
nstbrowser-ai-agent --session task-run --profile YOUR_PROFILE tab new https://iana.org
nstbrowser-ai-agent --session task-run --profile YOUR_PROFILE get url
```

### Temporary Browser Workflow

Use `browser start-once` only when the user wants a throwaway browser and does not need profile persistence:

```bash
nstbrowser-ai-agent browser start-once
nstbrowser-ai-agent open https://example.com
nstbrowser-ai-agent snapshot -i
```

## Useful Global Options

```bash
--profile <name-or-id>   Use a specific Nstbrowser profile
--session <name>         Use an isolated daemon session
--session-name <name>    Auto-save and restore browser state
--json                   Machine-readable output
--headers <json>         Scoped HTTP headers for the opened origin
--proxy <server>         Override proxy for the launched browser session
--proxy-bypass <hosts>   Bypass proxy for specific hosts
--annotate               Add numbered labels to screenshot output
--full                   Full-page screenshot
```

## Recommended Patterns

1. Start with `nst status` and `profile list` if anything about the environment is unclear.
2. Prefer `snapshot -i` before `click` or `fill` so refs are fresh.
3. Repeat the same `--profile` on every browser command unless you are intentionally using a dedicated `--session`.
4. Use `--session` only when you need an isolated workflow, and then keep both `--session` and `--profile` consistent across the whole run.
5. Use `repair` before retrying if NST reports stale browser state or multiple stuck instances.
6. Prefer a clean or newly created profile if an existing profile has broken proxy or network settings.

## Common Failure Recovery

- `Profile not found`: run `profile list` and use the exact profile name or UUID.
- `@e1 not working`: run `snapshot -i` again because refs change after navigation.
- Refs are order-dependent: generate them first, then use them later in the same session.
- `@e1` is treated like CSS: you probably changed profile or session context, or forgot to pass the same `--profile` again.
- `Browser not running`: run `browser start <name-or-id>` or re-run `open`.
- `NST agent not responding`: start the Nstbrowser desktop client, then run `nst status`.
- `Command appears stale`: use a new `--session` name or run `browser stop <name-or-id>` / `browser stop-all`.
- `open https://example.com` lands on a Chrome error page: switch to a clean profile or create a new one because the current profile may have a broken proxy.

## Notes

- `browser start-once` creates a temporary Nstbrowser-managed browser.
- Profile-backed sessions persist cookies and site storage in the Nstbrowser profile itself.
- `--profile` is for Nstbrowser profile selection only.
