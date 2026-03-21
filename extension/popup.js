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
    
    // Remove duplicates
    const seen = new Set();
    cookies = cookies.filter(cookie => {
      const key = `${cookie.name}:${cookie.domain}:${cookie.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    document.getElementById('cookieCount').textContent = cookies.length;
    
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
    // Get settings
    const settings = await chrome.storage.sync.get({
      receiverUrl: 'http://ziggy:3333/api/cookies',
      bearerToken: ''
    });
    
    if (!settings.bearerToken) {
      showStatus('⚠️ No auth token configured. Please set it in Settings.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send to Ziggy';
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
    showStatus(`✅ Sent ${cookies.length} cookies to Ziggy`, 'success');
    
  } catch (error) {
    console.error('Send error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send to Ziggy';
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
