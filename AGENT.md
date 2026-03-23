# AGENT.md - OpenClaw Usage Instructions

This document provides comprehensive instructions for AI agents (OpenClaw or similar) on how to use Cookie Jar to access paywalled content.

## Overview

Cookie Jar is a two-part system:
1. **Chrome Extension** - Captures cookies from authenticated browser sessions
2. **Receiver Service** - Stores cookies and maintains per-site access strategies

When you need to read a paywalled article, Cookie Jar provides the authenticated cookies and tells you the best way to use them (curl vs browser).

## Prerequisites

### Required Tools
- `jq` - JSON processor for parsing cookie files
- `curl` - For simple sites without bot protection
- Playwright or Puppeteer - For bot-protected sites that block curl
- Cookie Jar receiver service must be running

### Check Service Status
```bash
curl https://ziggy.tail7f7a2.ts.net:3333/api/status
```

## Reading Cookies

### Option 1: API Endpoint (Recommended)
```bash
# Get cookies in raw Chrome format
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com

# Get cookies in Playwright format
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com?format=playwright

# Get cookies in Netscape format (for curl --cookie)
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com?format=netscape
```

**Available formats:**
- `raw` (default) - Chrome native format
- `playwright` - Ready for Playwright `context.addCookies()`
- `puppeteer` - Ready for Puppeteer `page.setCookie()`
- `netscape` - curl-compatible cookies.txt format
- `browser-use` - Chrome format with `url` field added

### Option 2: Direct File Access
Cookies are stored as JSON files in `receiver/cookies/<domain>.json`

```bash
cat receiver/cookies/www.ft.com.json
```

## Using Cookies

### Step 1: Check Site Registry
The receiver maintains a registry of tested access methods for each site.

```bash
# List all known sites
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/sites

# Get strategy for specific domain
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/sites/www.ft.com
```

**Response example:**
```json
{
  "domain": "www.ft.com",
  "access_method": "curl",
  "bot_protection": "none",
  "auth_cookies": ["FTSession_s"],
  "last_verified": "2026-03-22T19:46:00Z",
  "notes": "Works with simple curl + cookie header"
}
```

### Step 2A: Simple Sites (access_method: "curl")

For sites with `"access_method": "curl"`, you can fetch content with curl + cookies:

```bash
# Build cookie header from JSON
COOKIE_HEADER=$(curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com | \
  jq -r '.cookies[] | "\(.name)=\(.value)"' | tr '\n' '; ')

# Fetch the article
curl -H "Cookie: $COOKIE_HEADER" \
  https://www.ft.com/content/article-id
```

**Using file path instead of API:**
```bash
COOKIE_HEADER=$(jq -r '.cookies[] | "\(.name)=\(.value)"' \
  receiver/cookies/www.ft.com.json | tr '\n' '; ')
```

**Alternative: Netscape format**
```bash
# Get cookies in Netscape format
curl -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com?format=netscape \
  > /tmp/cookies.txt

# Use with curl
curl --cookie /tmp/cookies.txt \
  https://www.ft.com/content/article-id
```

### Step 2B: Bot-Protected Sites (access_method: "browser")

For sites with `"access_method": "browser"` (DataDome, Cloudflare, etc.), curl will be blocked. Use Playwright or Puppeteer:

#### Playwright Example
```javascript
const { chromium } = require('playwright');

async function fetchWithCookies(url, domain) {
  // Fetch cookies from receiver
  const response = await fetch(
    `https://ziggy.tail7f7a2.ts.net:3333/api/cookies/${domain}?format=playwright`,
    {
      headers: { 'Authorization': `Bearer ${process.env.COOKIE_JAR_TOKEN}` }
    }
  );
  const { cookies } = await response.json();

  // Launch browser and inject cookies
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(cookies);

  // Navigate and extract content
  const page = await context.newPage();
  await page.goto(url);
  const content = await page.content();

  await browser.close();
  return content;
}

// Usage
fetchWithCookies('https://www.oregonlive.com/article-url', 'www.oregonlive.com');
```

#### Puppeteer Example
```javascript
const puppeteer = require('puppeteer');

async function fetchWithCookies(url, domain) {
  const response = await fetch(
    `https://ziggy.tail7f7a2.ts.net:3333/api/cookies/${domain}?format=puppeteer`,
    {
      headers: { 'Authorization': `Bearer ${process.env.COOKIE_JAR_TOKEN}` }
    }
  );
  const { cookies } = await response.json();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setCookie(...cookies);
  await page.goto(url);
  const content = await page.content();

  await browser.close();
  return content;
}
```

See `examples/playwright-example.js` and `examples/puppeteer-example.js` for complete working examples.

## Per-Site Access Strategies

The receiver automatically tests each site after receiving cookies and records:
- Whether curl works or browser is required
- Type of bot protection detected
- Key authentication cookie names
- HTTP response codes
- Last verification timestamp

### Manually Test a Site
```bash
curl -X POST -H "Authorization: Bearer $COOKIE_JAR_TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/sites/www.example.com/test
```

This tests access with curl and updates the registry with results.

## Troubleshooting

### Missing Parent Domain Cookies
Some sites set cookies for both `example.com` and `www.example.com`. The receiver has a built-in fallback:
- Requesting `www.example.com` will also check for `example.com` cookies
- Requesting `example.com` will also check for `www.example.com` cookies

If you get 401/403 errors, check the cookie file and ensure parent domain cookies (`.domain.com`) are present.

### Bot Protection Detection
Signs that a site has bot protection:
- curl returns 403 Forbidden
- Response contains `datadome`, `cloudflare`, or `captcha` keywords
- Cookies work in browser but not curl

**Solution:** Use Playwright/Puppeteer with cookie injection (see Step 2B above).

### Cookie Expiry
Cookies expire. If you get authentication errors:
1. Check `expirationDate` field in cookie JSON
2. Compare to current timestamp (Unix epoch seconds)
3. Ask the user to re-send cookies via the Chrome extension

**Checking expiry:**
```bash
jq -r '.cookies[] | select(.expirationDate) | "\(.name): \(.expirationDate)"' \
  receiver/cookies/www.ft.com.json

# Compare to current time
date +%s
```

### 401/403 Despite Fresh Cookies
Possible causes:
1. Missing parent domain cookies (`.ft.com` vs `www.ft.com`)
2. Bot protection blocking curl (switch to browser)
3. Cookies weren't properly authenticated in source browser
4. Additional headers required (User-Agent, Referer, etc.)

**Debug steps:**
1. Check site registry for known access method
2. Verify all cookies in the JSON are present in your request
3. Try adding standard browser headers:
   ```bash
   curl -H "Cookie: $COOKIE_HEADER" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
        -H "Referer: https://www.ft.com/" \
        https://www.ft.com/content/article-id
   ```
4. If still failing, use browser method (Playwright/Puppeteer)

### Service Not Running
```bash
# Check if receiver is running
curl https://ziggy.tail7f7a2.ts.net:3333/api/status

# If down, SSH to receiver host and start service
ssh ziggy@ziggy.tail7f7a2.ts.net
cd cookie-jar/receiver
npm start

# Or check launchd (if installed as service)
launchctl list | grep cookie-jar
```

## Security Notes

- Auth token is stored in `receiver/.env` as `COOKIE_JAR_TOKEN`
- Cookie files are stored with `0600` permissions (owner read/write only)
- All API endpoints require Bearer token authentication (except `/api/status`)
- Cookies contain session data - treat them as passwords
- Never log or expose cookie values in plain text

## Quick Reference

```bash
# Check what sites have cookies
ls -la receiver/cookies/

# Get site access strategy
curl -H "Authorization: Bearer $TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/sites/www.ft.com

# Fetch article with curl (for simple sites)
COOKIE_HEADER=$(curl -H "Authorization: Bearer $TOKEN" \
  https://ziggy.tail7f7a2.ts.net:3333/api/cookies/www.ft.com | \
  jq -r '.cookies[] | "\(.name)=\(.value)"' | tr '\n' '; ')
curl -H "Cookie: $COOKIE_HEADER" https://www.ft.com/article-url

# For bot-protected sites: use Playwright (see examples/)
node examples/playwright-example.js www.oregonlive.com https://url
```

## Known Site Strategies

See `receiver/sites/` for the full registry. Current known sites:

- **www.ft.com** - curl works, no bot protection, key cookie: `FTSession_s`
- **www.oregonlive.com** - requires browser (DataDome blocks curl)

The registry auto-updates when new cookies are received.
