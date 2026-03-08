---
"nstbrowser-ai-agent": minor
---

Complete NSTBrowser API integration with 100% coverage:

- Added 7 new commands: `browser start-batch`, `browser start-once`, `profile list-cursor`, `browser connect`, `browser connect-once`, `browser cdp-url`, `browser cdp-url-once`
- Implemented all 33 NSTBrowser API v2 endpoints with full TypeScript types
- Added profile name resolution utilities for flexible profile referencing
- Enhanced error handling with retry logic and detailed error messages
- Added comprehensive command validation and integration tests (31 tests)
- Updated all documentation (README, SKILL.md, API reference, guides)
- Added Rust native daemon stubs for all new commands
- Improved batch operations support for profiles, proxies, and tags
- Added CDP endpoint support for external tool integration
