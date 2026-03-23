---
# cookie-jar-6c1f
title: 'Add OpenClaw usage instructions (Issue #6)'
status: completed
type: task
priority: normal
created_at: 2026-03-23T02:53:52Z
updated_at: 2026-03-23T02:57:21Z
---

Create AGENT.md with comprehensive usage instructions for AI agents. Implements GitHub Issue #6.

## Summary of Changes

Created comprehensive AGENT.md documentation:

- Overview of the Cookie Jar system
- Prerequisites and required tools (jq, curl, Playwright)
- How to read cookies (API endpoint + file path)
- Cookie format options (raw, playwright, puppeteer, netscape, browser-use)
- Step-by-step guide for using cookies with curl (simple sites)
- Step-by-step guide for using Playwright/Puppeteer (bot-protected sites)
- Per-site access strategies documentation
- Detailed troubleshooting section covering:
  - Missing parent domain cookies
  - Bot protection detection
  - Cookie expiry
  - 401/403 errors
  - Service status checks
- Security notes
- Quick reference commands
- Known site strategies list
