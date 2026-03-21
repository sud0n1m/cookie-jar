# Cookie Jar - Quick Start

## Server Setup (5 minutes)

```bash
cd ./receiver
./install.sh
```

**Copy the auth token shown** — you'll need it for the Chrome extension.

## Chrome Extension Setup (2 minutes)

1. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension/` folder from this repo

2. **Configure the extension:**
   - Click the Cookie Jar icon in Chrome toolbar
   - Click "Settings"
   - Receiver URL: `http://localhost:3333/api/cookies` (or your server URL)
   - Bearer token: (paste token from server setup)
   - Click "Save Settings"

## Usage

1. Visit a site (e.g., ft.com) and log in
2. Click the Cookie Jar extension icon
3. Click "Send Cookies"
4. Wait for success message

Done! Your server can now access that site using your cookies.

## Test It

```bash
# Check service status
launchctl list | grep cookie-jar

# View logs
tail -f receiver/logs/stdout.log

# Test health endpoint
curl http://localhost:3333/api/status
```

## Troubleshooting

**Can't reach the server?**
- Make sure the receiver service is running
- Try `curl http://localhost:3333/api/status`

**Extension shows error?**
- Check Chrome console (click extension icon -> right-click -> Inspect popup)
- Verify token matches in `.env` and extension settings
