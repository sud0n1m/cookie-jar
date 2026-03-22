const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set auth token before importing server
process.env.COOKIE_JAR_TOKEN = 'test-token-12345';

const { app, convertCookies, COOKIES_DIR, EXTENSION_DIR } = require('../server');

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

  it('writes cookie files with restricted permissions (0600)', async () => {
    const res = await request(app)
      .post('/api/cookies')
      .set('Authorization', AUTH_HEADER)
      .send({ domain: 'test-domain.com', cookies: SAMPLE_COOKIES });
    assert.equal(res.status, 200);

    const filepath = path.join(COOKIES_DIR, 'test-domain.com.json');
    const stats = fs.statSync(filepath);
    const mode = stats.mode & 0o777;
    assert.equal(mode, 0o600, `Expected file mode 0600 but got 0${mode.toString(8)}`);
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

// ─── www-prefix fallback ─────────────────────────────────────────

describe('GET /api/cookies/:domain www-prefix fallback', () => {
  before(() => {
    // Save cookies under www.example-www.com
    fs.writeFileSync(
      path.join(COOKIES_DIR, 'www.example-www.com.json'),
      JSON.stringify({ domain: 'www.example-www.com', cookies: SAMPLE_COOKIES }, null, 2)
    );
    // Save cookies under example-bare.com (no www)
    fs.writeFileSync(
      path.join(COOKIES_DIR, 'example-bare.com.json'),
      JSON.stringify({ domain: 'example-bare.com', cookies: SAMPLE_COOKIES }, null, 2)
    );
  });

  after(() => {
    cleanupCookies('www.example-www.com');
    cleanupCookies('example-bare.com');
  });

  it('retrieves www.example-www.com cookies via example-www.com', async () => {
    const res = await request(app)
      .get('/api/cookies/example-www.com')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.domain, 'www.example-www.com');
    assert.equal(res.body.count, 2);
  });

  it('retrieves example-bare.com cookies via www.example-bare.com', async () => {
    const res = await request(app)
      .get('/api/cookies/www.example-bare.com')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.domain, 'example-bare.com');
    assert.equal(res.body.count, 2);
  });

  it('exact match takes priority over fallback', async () => {
    // Create both exact and alternate files
    fs.writeFileSync(
      path.join(COOKIES_DIR, 'exact-test.com.json'),
      JSON.stringify({ domain: 'exact-test.com', cookies: [SAMPLE_COOKIES[0]] }, null, 2)
    );
    fs.writeFileSync(
      path.join(COOKIES_DIR, 'www.exact-test.com.json'),
      JSON.stringify({ domain: 'www.exact-test.com', cookies: SAMPLE_COOKIES }, null, 2)
    );

    const res = await request(app)
      .get('/api/cookies/exact-test.com')
      .set('Authorization', AUTH_HEADER);
    assert.equal(res.status, 200);
    assert.equal(res.body.domain, 'exact-test.com');
    assert.equal(res.body.count, 1); // exact match has 1 cookie, not 2

    cleanupCookies('exact-test.com');
    cleanupCookies('www.exact-test.com');
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

// ─── Setup Endpoints ────────────────────────────────────────────

const AdmZip = require('adm-zip');

// Helper: get zip response as a buffer
function getZipBuffer(req) {
  return req
    .buffer(true)
    .parse((res, cb) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

describe('GET /setup', () => {
  it('returns HTML with status 200', async () => {
    const res = await request(app).get('/setup');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /html/);
    assert.match(res.text, /Cookie Jar/);
    assert.match(res.text, /Download Extension/);
    assert.match(res.text, /chrome:\/\/extensions/);
  });
});

describe('GET /setup/extension.zip', () => {
  it('returns a zip with correct content-type', async () => {
    const res = await getZipBuffer(request(app).get('/setup/extension.zip'));
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/zip/);
    assert.equal(res.headers['content-disposition'], 'attachment; filename="cookie-jar-extension.zip"');
    // Verify it's a valid zip (starts with PK signature)
    assert.equal(res.body[0], 0x50); // 'P'
    assert.equal(res.body[1], 0x4B); // 'K'
  });

  it('zip contains config.json with correct receiver URL and token', async () => {
    const res = await getZipBuffer(
      request(app)
        .get('/setup/extension.zip')
        .set('Host', 'myhost.example.com:3333')
    );
    assert.equal(res.status, 200);

    const zip = new AdmZip(res.body);
    const configEntry = zip.getEntry('config.json');
    assert.ok(configEntry, 'zip should contain config.json');

    const config = JSON.parse(configEntry.getData().toString('utf8'));
    assert.equal(config.receiverUrl, 'http://myhost.example.com:3333/api/cookies');
    assert.equal(config.token, 'test-token-12345');
  });

  it('zip contains expected extension files', async () => {
    const res = await getZipBuffer(request(app).get('/setup/extension.zip'));
    assert.equal(res.status, 200);

    const zip = new AdmZip(res.body);
    const entryNames = zip.getEntries().map(e => e.entryName);

    assert.ok(entryNames.includes('manifest.json'), 'zip should contain manifest.json');
    assert.ok(entryNames.includes('popup.html'), 'zip should contain popup.html');
    assert.ok(entryNames.includes('popup.js'), 'zip should contain popup.js');
    assert.ok(entryNames.includes('options.html'), 'zip should contain options.html');
    assert.ok(entryNames.includes('options.js'), 'zip should contain options.js');
    assert.ok(entryNames.includes('config.json'), 'zip should contain config.json');
  });

  it('returns 500 when COOKIE_JAR_TOKEN is not set', async () => {
    const original = process.env.COOKIE_JAR_TOKEN;
    delete process.env.COOKIE_JAR_TOKEN;

    const res = await request(app).get('/setup/extension.zip');
    assert.equal(res.status, 500);
    assert.match(res.body.error, /COOKIE_JAR_TOKEN not set/);

    process.env.COOKIE_JAR_TOKEN = original;
  });
});
