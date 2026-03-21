// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    receiverUrl: 'http://localhost:3333/api/cookies',
    bearerToken: ''
  });
  
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
