const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const crypto = require('crypto');
const archiver = require('archiver');

const app = express();
const PORT = 3333;
const COOKIES_DIR = path.join(__dirname, 'cookies');

const TS_DOMAIN = 'ziggy.tail7f7a2.ts.net';
const CERTS_DIR = path.join(__dirname, 'certs');
const CERT_PATH = path.join(CERTS_DIR, `${TS_DOMAIN}.crt`);
const KEY_PATH = path.join(CERTS_DIR, `${TS_DOMAIN}.key`);

// Ensure cookies directory exists
if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.COOKIE_JAR_TOKEN;
  
  if (!expectedToken) {
    return res.status(500).json({ 
      error: 'Server misconfigured: COOKIE_JAR_TOKEN not set' 
    });
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid Authorization header' 
    });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== expectedToken) {
    return res.status(403).json({ 
      error: 'Invalid token' 
    });
  }
  
  next();
}

// Health check endpoint (no auth required)
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'cookie-jar-receiver',
    cookiesDir: COOKIES_DIR,
    timestamp: new Date().toISOString()
  });
});

// POST /api/cookies - Receive and save cookies
app.post('/api/cookies', authenticate, async (req, res) => {
  try {
    const { domain, cookies } = req.body;
    
    if (!domain || !cookies) {
      return res.status(400).json({ 
        error: 'Missing domain or cookies in request body' 
      });
    }
    
    if (!Array.isArray(cookies)) {
      return res.status(400).json({ 
        error: 'cookies must be an array' 
      });
    }
    
    // Save cookies to file
    const filename = `${domain}.json`;
    const filepath = path.join(COOKIES_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({ domain, cookies }, null, 2), { mode: 0o600 });
    // Ensure restricted permissions even if file already existed
    fs.chmodSync(filepath, 0o600);
    
    console.log(`[${new Date().toISOString()}] Saved ${cookies.length} cookies for ${domain}`);
    
    res.json({ 
      success: true, 
      domain,
      cookieCount: cookies.length,
      savedTo: filename
    });
    
  } catch (error) {
    console.error('Error handling cookie upload:', error);
    res.status(500).json({ 
      error: 'Failed to save cookies',
      message: error.message 
    });
  }
});

// Convert Chrome cookies to different formats
function convertCookies(cookies, format, domain) {
  switch (format) {
    case 'playwright':
      // Playwright format - ready for context.addCookies()
      return cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expirationDate ? c.expirationDate : -1,
        httpOnly: c.httpOnly || false,
        secure: c.secure || false,
        sameSite: c.sameSite || 'Lax'
      }));
      
    case 'puppeteer':
      // Puppeteer format - ready for page.setCookie()
      return cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expirationDate || -1,
        httpOnly: c.httpOnly || false,
        secure: c.secure || false,
        sameSite: c.sameSite || 'Lax'
      }));
      
    case 'netscape':
      // Netscape cookies.txt format (for curl)
      const lines = ['# Netscape HTTP Cookie File', '# This is a generated file!  Do not edit.', ''];
      cookies.forEach(c => {
        const domain_flag = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const path = c.path || '/';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expiration = c.expirationDate ? Math.floor(c.expirationDate) : 0;
        const name = c.name;
        const value = c.value;
        
        lines.push(`${c.domain}\t${domain_flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`);
      });
      return lines.join('\n');
      
    case 'browser-use':
      // browser-use format - Chrome native with url field added
      return cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure || false,
        httpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'Lax',
        expires: c.expirationDate || -1,
        url: `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path || '/'}`
      }));

    case 'raw':
    default:
      // Raw Chrome cookie format
      return cookies;
  }
}

// GET /api/cookies/:domain - Retrieve saved cookies with format conversion
app.get('/api/cookies/:domain', authenticate, (req, res) => {
  try {
    const { domain } = req.params;
    const { format = 'raw' } = req.query;
    const filename = `${domain}.json`;
    const filepath = path.join(COOKIES_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ 
        error: `No cookies found for domain: ${domain}` 
      });
    }
    
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // For netscape format, return as text/plain
    if (format === 'netscape') {
      const cookiesTxt = convertCookies(data.cookies, 'netscape', domain);
      res.setHeader('Content-Type', 'text/plain');
      return res.send(cookiesTxt);
    }
    
    // For other formats, return JSON
    const converted = convertCookies(data.cookies, format, domain);
    res.json({
      domain: data.domain,
      cookies: converted,
      format: format,
      count: data.cookies.length
    });
    
  } catch (error) {
    console.error('Error retrieving cookies:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve cookies',
      message: error.message 
    });
  }
});

// ─── Setup Endpoints ────────────────────────────────────────────

const EXTENSION_DIR = path.join(__dirname, '..', 'extension');

// GET /setup - Serve setup page with download link and instructions
app.get('/setup', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cookie Jar Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      padding: 60px 20px;
    }
    .container { max-width: 520px; width: 100%; }
    h1 { font-size: 32px; color: #fff; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 15px; margin-bottom: 40px; }
    .download-btn {
      display: inline-block;
      padding: 14px 28px;
      background: #4a9eff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 40px;
    }
    .download-btn:hover { background: #3a8eef; }
    h2 { font-size: 18px; color: #fff; margin-bottom: 16px; }
    ol { padding-left: 20px; line-height: 2; color: #ccc; font-size: 14px; }
    code {
      background: #252525;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: #4a9eff;
    }
    .note {
      margin-top: 32px;
      padding: 16px;
      background: #1a4d2e;
      border: 1px solid #22c55e;
      border-radius: 8px;
      font-size: 13px;
      color: #4ade80;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍪 Cookie Jar</h1>
    <div class="subtitle">Self-configuring Chrome extension</div>

    <a class="download-btn" href="/setup/extension.zip">⬇ Download Extension</a>

    <h2>Install Instructions</h2>
    <ol>
      <li>Download the extension zip above</li>
      <li>Unzip the downloaded file</li>
      <li>Open Chrome and go to <code>chrome://extensions</code></li>
      <li>Enable <strong>Developer mode</strong> (top-right toggle)</li>
      <li>Click <strong>Load unpacked</strong> and select the unzipped folder</li>
    </ol>

    <div class="note">
      ✅ This extension is pre-configured with your receiver URL and auth token. No manual setup needed!
    </div>
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

// GET /setup/extension.zip - Download pre-configured extension
app.get('/setup/extension.zip', (req, res) => {
  const token = process.env.COOKIE_JAR_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured: COOKIE_JAR_TOKEN not set' });
  }

  // Auto-detect receiver URL from Host header
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.headers.host;
  const receiverUrl = `${protocol}://${host}/api/cookies`;

  const config = JSON.stringify({ receiverUrl, token }, null, 2);

  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="cookie-jar-extension.zip"'
  });

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create extension zip' });
    }
  });
  archive.pipe(res);

  // Add all extension files
  archive.directory(EXTENSION_DIR, false);

  // Add baked-in config.json (overrides any existing one)
  archive.append(config, { name: 'config.json' });

  archive.finalize();
});

// Check if TLS cert expires within the given number of days
function certExpiresWithinDays(certPath, days) {
  try {
    const pem = fs.readFileSync(certPath, 'utf8');
    const cert = new crypto.X509Certificate(pem);
    const expiryDate = new Date(cert.validTo);
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return expiryDate < threshold;
  } catch (err) {
    console.warn(`[TLS] Could not check cert expiry: ${err.message}`);
    return true; // treat unreadable cert as needing renewal
  }
}

// Attempt to renew Tailscale cert if missing or expiring soon
function renewCertIfNeeded() {
  const certsExist = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

  if (certsExist && !certExpiresWithinDays(CERT_PATH, 14)) {
    return; // cert is present and valid for >14 days
  }

  const reason = certsExist ? 'cert expires within 14 days' : 'certs not found';
  console.log(`[TLS] Renewing Tailscale cert (${reason})...`);

  try {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
    execSync(`tailscale cert --cert-file "${CERT_PATH}" --key-file "${KEY_PATH}" "${TS_DOMAIN}"`, {
      timeout: 30000,
      stdio: 'pipe'
    });
    console.log('[TLS] Tailscale cert renewed successfully');
  } catch (err) {
    console.warn(`[TLS] Failed to renew cert: ${err.message}`);
  }
}

// Start server (only when run directly, not when imported for tests)
if (require.main === module) {
  // Try to renew certs before starting
  renewCertIfNeeded();

  const certsExist = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

  if (certsExist) {
    const tlsOptions = {
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH)
    };
    https.createServer(tlsOptions, app).listen(PORT, '0.0.0.0', () => {
      console.log(`[HTTPS] Cookie Jar receiver listening on https://${TS_DOMAIN}:${PORT}`);
      console.log(`Cookies will be saved to: ${COOKIES_DIR}`);
      console.log(`Auth token configured: ${!!process.env.COOKIE_JAR_TOKEN}`);
    });
  } else {
    console.warn('[WARNING] TLS certs not found — falling back to plain HTTP');
    console.warn(`[WARNING] Expected certs at: ${CERT_PATH}`);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[HTTP] Cookie Jar receiver listening on http://0.0.0.0:${PORT}`);
      console.log(`Cookies will be saved to: ${COOKIES_DIR}`);
      console.log(`Auth token configured: ${!!process.env.COOKIE_JAR_TOKEN}`);
    });
  }
}

module.exports = { app, convertCookies, COOKIES_DIR, EXTENSION_DIR };
