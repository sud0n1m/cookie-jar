const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3333;
const COOKIES_DIR = path.join(__dirname, 'cookies');

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
    
    fs.writeFileSync(filepath, JSON.stringify({ domain, cookies }, null, 2));
    
    console.log(`[${new Date().toISOString()}] Saved ${cookies.length} cookies for ${domain}`);
    
    // Import cookies into browser-use
    try {
      const cmd = `source ~/.browser-use-env/bin/activate && browser-use cookies import "${filepath}"`;
      execSync(cmd, { 
        shell: '/bin/bash',
        stdio: 'inherit'
      });
      console.log(`[${new Date().toISOString()}] Imported cookies into browser-use for ${domain}`);
    } catch (importError) {
      console.error(`[${new Date().toISOString()}] Failed to import cookies into browser-use:`, importError.message);
      // Don't fail the request if import fails - cookies are still saved
    }
    
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cookie Jar receiver listening on port ${PORT}`);
  console.log(`Cookies will be saved to: ${COOKIES_DIR}`);
  console.log(`Auth token configured: ${!!process.env.COOKIE_JAR_TOKEN}`);
});
