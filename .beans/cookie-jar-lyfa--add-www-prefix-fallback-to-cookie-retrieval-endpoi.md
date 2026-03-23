---
# cookie-jar-lyfa
title: Add www-prefix fallback to cookie retrieval endpoint
status: completed
type: bug
priority: normal
created_at: 2026-03-22T00:36:03Z
updated_at: 2026-03-22T00:37:14Z
---

When cookies saved as www.ft.com.json but requested via GET /api/cookies/ft.com, returns 404. Need fallback to try alternate www/non-www form before returning 404.

- [ ] Create branch fix/www-domain-fallback
- [ ] Add www-prefix fallback in GET handler in receiver/server.js
- [ ] Add tests in receiver/test/server.test.js
- [ ] Run tests
- [ ] Commit, push, create PR, merge


## Summary of Changes
- Added www-prefix fallback to `GET /api/cookies/:domain` in `receiver/server.js`
- When exact domain file not found, tries alternate www/non-www form before returning 404
- Added 3 tests covering both fallback directions and exact-match priority
- PR: https://github.com/sud0n1m-ziggy/cookie-jar/pull/4 (merged)
