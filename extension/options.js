// Load config.json defaults if present, then overlay chrome.storage settings
async function loadSettings() {
  let defaults = {
    receiverUrl: 'http://localhost:3333/api/cookies',
    bearerToken: ''
  };

  // Check for baked-in config.json
  try {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    if (resp.ok) {
      const cfg = await resp.json();
      defaults.receiverUrl = cfg.receiverUrl || defaults.receiverUrl;
      defaults.bearerToken = cfg.token || defaults.bearerToken;
    }
  } catch (e) {
    // config.json not present, use defaults
  }

  const settings = await chrome.storage.sync.get(defaults);

  document.getElementById('receiverUrl').value = settings.receiverUrl;
  document.getElementById('bearerToken').value = settings.bearerToken;
}

// Save settings
async function saveSettings(e) {
  e.preventDefault();
  
  const receiverUrl = document.getElementById('receiverUrl').value;
  const bearerToken = document.getElementById('bearerToken').value;
  
  await chrome.storage.sync.set({
    receiverUrl,
    bearerToken
  });
  
  showStatus('✅ Settings saved successfully');
}

function showStatus(message) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status success show';
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// Event listeners
document.getElementById('settingsForm').addEventListener('submit', saveSettings);

// Load settings on page load
loadSettings();
