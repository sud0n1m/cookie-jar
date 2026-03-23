// Load config from baked-in config.json, falling back to chrome.storage
let _configCache = null;
async function getConfig() {
  if (_configCache) return _configCache;
  try {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    if (resp.ok) {
      const cfg = await resp.json();
      _configCache = {
        receiverUrl: cfg.receiverUrl || 'http://localhost:3333/api/cookies',
        bearerToken: cfg.token || '',
        fromConfig: true
      };
      return _configCache;
    }
  } catch (e) {
    // config.json not present, fall back to storage
  }
  const settings = await chrome.storage.sync.get({
    receiverUrl: 'http://localhost:3333/api/cookies',
    bearerToken: ''
  });
  _configCache = { ...settings, fromConfig: false };
  return _configCache;
}

// Get current tab and load cookies
let currentDomain = '';
let cookies = [];

async function init() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      showStatus('No active tab found', 'error');
      return;
    }
    
    // Extract domain from URL
    const url = new URL(tab.url);
    currentDomain = url.hostname;
    
    // Update UI
    document.getElementById('domain').textContent = currentDomain;
    
    // Get all cookies for this domain
    cookies = await chrome.cookies.getAll({ domain: currentDomain });
    
    // Also try without leading dot
    if (currentDomain.startsWith('.')) {
      const noDotCookies = await chrome.cookies.getAll({ 
        domain: currentDomain.substring(1) 
      });
      cookies = [...cookies, ...noDotCookies];
    } else {
      // Try with leading dot too
      const dotCookies = await chrome.cookies.getAll({ 
        domain: '.' + currentDomain 
      });
      cookies = [...cookies, ...dotCookies];
    }

    // Also fetch parent domain cookies (e.g. .ft.com when on www.ft.com)
    const parts = currentDomain.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(1).join('.');
      const parentCookies = await chrome.cookies.getAll({ domain: parentDomain });
      const parentDotCookies = await chrome.cookies.getAll({ domain: '.' + parentDomain });
      cookies = [...cookies, ...parentCookies, ...parentDotCookies];
    }
    
    // Remove duplicates
    const seen = new Set();
    cookies = cookies.filter(cookie => {
      const key = `${cookie.name}:${cookie.domain}:${cookie.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    document.getElementById('cookieCount').textContent = cookies.length;

    // Show configured badge if using config.json
    const config = await getConfig();
    if (config.fromConfig) {
      const badge = document.getElementById('configBadge');
      if (badge) badge.style.display = 'inline-block';
    }

    // Enable button if we have cookies
    if (cookies.length === 0) {
      document.getElementById('sendBtn').disabled = true;
      showStatus('No cookies found for this domain', 'error');
    }
  } catch (error) {
    console.error('Init error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// Send cookies to receiver
async function sendCookies() {
  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    // Get settings (config.json takes priority over chrome.storage)
    const settings = await getConfig();

    if (!settings.bearerToken) {
      showStatus('⚠️ No auth token configured. Please set it in Settings.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Cookies';
      return;
    }
    
    // Prepare payload
    const payload = {
      domain: currentDomain,
      cookies: cookies
    };
    
    // Send to receiver
    const response = await fetch(settings.receiverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.bearerToken}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    showStatus(`✅ Sent ${cookies.length} cookies successfully`, 'success');
    
  } catch (error) {
    console.error('Send error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Cookies';
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type} show`;
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.remove('show');
    }, 3000);
  }
}

// Event listeners
document.getElementById('sendBtn').addEventListener('click', sendCookies);

// Initialize on load
init();
