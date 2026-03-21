const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set auth token before importing server
process.env.COOKIE_JAR_TOKEN = 'test-token-12345';

const { app, convertCookies, COOKIES_DIR } = require('../server');

const AUTH_HEADER = 'Bearer test-token-12345';

const SAMPLE_COOKIES = [
  {
    name: 'session_id',
    value: 'abc123',
    domain: '.example.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    expirationDate: 1700000000
  },
  {
    name: 'prefs',
    value: 'dark_mode=1',
    domain: 'example.com',
    path: '/settings',
    secure: false,
    httpOnly: false,
    sameSite: 'Lax',
    expirationDate: 1800000000
  }
];

// Clean up test cookie files
function cleanupCookies(domain) {
  const filepath = path.join(COOKIES_DIR, `${domain}.json`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

// ─── Status Endpoint ─────────────────────────────────────────────

describe('GET /api/status', () => {
  it('returns status without auth', async () => {
    const res = await request(app).get('/api/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'cookie-jar-receiver');
    assert.ok(res.body.timestamp);
    assert.ok(res.body.cookiesDir);
  });
});

// ─── Authentication ──────────────────────────────────────────────

describe('Authentication', () => {
  it('rejects requests without auth header', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .send({ domain: 'example.com', cookies: [] });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Missing or invalid Authorization/);
  });

  it('rejects requests with wrong token', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', 'Bearer wrong-token')
      .send({ domain: 'example.com', cookies: [] });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Invalid token/);
  });

  it('rejects non-Bearer auth schemes', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .send({ domain: 'example.com', cookies: [] });
    assert.equal(res.status, 401);
  });

  it('returns 500 when COOKIE_JAR_TOKEN is not set', async () => {
    const original = process.env.COOKIE_JAR_TOKEN;
    delete process.env.COOKIE_JAR_TOKEN;

    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'example.com', cookies: [] });
    assert.equal(res.status, 500);
    assert.match(res.body.error, /COOKIE_JAR_TOKEN not set/);

    process.env.COOKIE_JAR_TOKEN = original;
  });
});

// ─── POST /api/cookies ──────────────────────────────────────────

describe('POST /api/cookies', () => {
  afterEach(() => cleanupCookies('test-domain.com'));

  it('saves cookies and returns success', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'test-domain.com', cookies: SAMPLE_COOKIES });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.domain, 'test-domain.com');
    assert.equal(res.body.cookieCount, 2);
    assert.equal(res.body.savedTo, 'test-domain.com.json');

    // Verify file was written
    const filepath = path.join(COOKIES_DIR, 'test-domain.com.json');
    assert.ok(fs.existsSync(filepath));
    const saved = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    assert.equal(saved.domain, 'test-domain.com');
    assert.equal(saved.cookies.length, 2);
  });

  it('rejects missing domain', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ cookies: SAMPLE_COOKIES });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing domain or cookies/);
  });

  it('rejects missing cookies', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'example.com' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Missing domain or cookies/);
  });

  it('rejects non-array cookies', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'example.com', cookies: 'not-an-array' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /cookies must be an array/);
  });

  it('handles empty cookies array', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'test-domain.com', cookies: [] });
    assert.equal(res.status, 200);
    assert.equal(res.body.cookieCount, 0);
  });
});

// ─── GET /api/cookies/:domain ───────────────────────────────────

describe('GET /api/cookies/:domain', () => {
  before(() => {
    // Seed a cookie file for retrieval tests
    const filepath = path.join(COOKIES_DIR, 'get-test.com.json');
    fs.writeFileSync(filepath, JSON.stringify({
      domain: 'get-test.com',
      cookies: SAMPLE_COOKIES
    }, null, 2));
  });

  after(() => cleanupCookies('get-test.com'));

  it('returns raw cookies by default', async () => {
    const res = await request(app)
      .get('/api/cookies/get-test.com')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.domain, 'get-test.com');
    assert.equal(res.body.format, 'raw');
    assert.equal(res.body.count, 2);
    assert.equal(res.body.cookies.length, 2);
    assert.equal(res.body.cookies[0].name, 'session_id');
  });

  it('returns 404 for unknown domain', async () => {
    const res = await request(app)
      .get('/api/cookies/nonexistent.com')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 404);
    assert.match(res.body.error, /No cookies found/);
  });

  it('returns playwright format', async () => {
    const res = await request(app)
      .get('/api/cookies/get-test.com?format=playwright')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.format, 'playwright');
    const cookie = res.body.cookies[0];
    assert.equal(cookie.name, 'session_id');
    assert.equal(cookie.expires, 1700000000);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    // Should not have expirationDate (Chrome field)
    assert.equal(cookie.expirationDate, undefined);
  });

  it('returns puppeteer format', async () => {
    const res = await request(app)
      .get('/api/cookies/get-test.com?format=puppeteer')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.format, 'puppeteer');
    const cookie = res.body.cookies[0];
    assert.equal(cookie.expires, 1700000000);
    assert.equal(cookie.expirationDate, undefined);
  });

  it('returns browser-use format with url field', async () => {
    const res = await request(app)
      .get('/api/cookies/get-test.com?format=browser-use')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.format, 'browser-use');
    const cookie = res.body.cookies[0];
    assert.equal(cookie.name, 'session_id');
    assert.equal(cookie.url, 'https://example.com/');
    assert.equal(cookie.expires, 1700000000);

    // Non-secure cookie should get http:// url
    const prefsCookie = res.body.cookies[1];
    assert.equal(prefsCookie.url, 'http://example.com/settings');
  });

  it('returns netscape format as text/plain', async () => {
    const res = await request(app)
      .get('/api/cookies/get-test.com?format=netscape')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);
    assert.match(res.text, /# Netscape HTTP Cookie File/);
    assert.match(res.text, /\.example\.com\tTRUE\t\/\tTRUE\t1700000000\tsession_id\tabc123/);
    assert.match(res.text, /example\.com\tFALSE\t\/settings\tFALSE\t1800000000\tprefs\tdark_mode=1/);
  });
});

// ─── Cookie Format Conversion (unit tests) ──────────────────────

describe('convertCookies', () => {
  it('playwright: maps expirationDate to expires', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'playwright', 'example.com');
    assert.equal(result[0].expires, 1700000000);
    assert.equal(result[0].expirationDate, undefined);
    assert.equal(result[0].sameSite, 'lax');
  });

  it('playwright: uses -1 for missing expirationDate', () => {
    const cookies = [{ name: 'a', value: 'b', domain: '.x.com', path: '/' }];
    const result = convertCookies(cookies, 'playwright', 'x.com');
    assert.equal(result[0].expires, -1);
  });

  it('puppeteer: maps expirationDate to expires', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'puppeteer', 'example.com');
    assert.equal(result[0].expires, 1700000000);
  });

  it('netscape: produces tab-separated lines', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'netscape', 'example.com');
    const lines = result.split('\n');
    assert.match(lines[0], /# Netscape HTTP Cookie File/);
    // Data starts at line 3 (after header + blank line)
    assert.equal(lines[3].split('\t').length, 7);
  });

  it('netscape: handles missing expirationDate as 0', () => {
    const cookies = [{ name: 'a', value: 'b', domain: '.x.com', path: '/' }];
    const result = convertCookies(cookies, 'netscape', 'x.com');
    assert.match(result, /\t0\ta\tb/);
  });

  it('browser-use: adds url field based on secure flag', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'browser-use', 'example.com');
    assert.equal(result[0].url, 'https://example.com/');
    assert.equal(result[1].url, 'http://example.com/settings');
  });

  it('raw: returns cookies unchanged', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'raw', 'example.com');
    assert.deepEqual(result, SAMPLE_COOKIES);
  });

  it('unknown format: returns cookies unchanged (defaults to raw)', () => {
    const result = convertCookies(SAMPLE_COOKIES, 'unknown-format', 'example.com');
    assert.deepEqual(result, SAMPLE_COOKIES);
  });
});
