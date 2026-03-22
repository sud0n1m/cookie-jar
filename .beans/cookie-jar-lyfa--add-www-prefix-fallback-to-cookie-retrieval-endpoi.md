---
# cookie-jar-lyfa
title: Add www-prefix fallback to cookie retrieval endpoint
status: in-progress
type: bug
created_at: 2026-03-22T00:36:03Z
updated_at: 2026-03-22T00:36:03Z
---

When cookies saved as www.ft.com.json but requested via GET /api/cookies/ft.com, returns 404. Need fallback to try alternate www/non-www form before returning 404.

- [ ] Create branch fix/www-domain-fallback
- [ ] Add www-prefix fallback in GET handler in receiver/server.js
- [ ] Add tests in receiver/test/server.test.js
- [ ] Run tests
- [ ] Commit, push, create PR, merge
