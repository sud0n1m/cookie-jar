---
# cookie-jar-we2l
title: 'Integrate with OpenClaw: maintain per-site access strategies (Issue #5)'
status: completed
type: feature
priority: normal
created_at: 2026-03-23T02:53:49Z
updated_at: 2026-03-23T02:57:13Z
---

Add site registry system to auto-test and record access methods for each domain. Implements GitHub Issue #5.

## Summary of Changes

Implemented per-site access strategy registry system:

- Created `sites/` directory with JSON config files for each domain
- Added `testSiteAccess()` function to test sites with curl + cookies
- Added `saveSiteRegistry()` and `loadSiteRegistry()` functions
- Created three new API endpoints:
  - `GET /api/sites` - List all site registry entries
  - `GET /api/sites/:domain` - Get specific site entry
  - `POST /api/sites/:domain/test` - Manually test a site
- Modified `POST /api/cookies` to auto-test sites after receiving cookies
- Seeded known findings for www.ft.com and www.oregonlive.com
- Wrote comprehensive tests for all new endpoints (all passing)
- Exported new functions and SITES_DIR in module.exports
