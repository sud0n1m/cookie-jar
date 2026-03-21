# Cookie Jar - Quick Start

## Mac Mini Setup (5 minutes)

```bash
cd ./receiver
./install.sh
```

**Copy the auth token shown** — you'll need it for the Chrome extension.

## Laptop Setup (2 minutes)

1. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension/` folder from this repo

2. **Configure the extension:**
   - Click the Cookie Jar icon 🍪 in Chrome toolbar
   - Click "⚙️ Settings"
   - Receiver URL: `http://YOUR_SERVER:3333/api/cookies`
   - Bearer token: (paste token from Mac Mini setup)
   - Click "Save Settings"

## Usage

1. Visit a paywalled site (e.g., ft.com) and log in
2. Click the Cookie Jar icon 🍪
3. Click "Send to Ziggy"
4. Wait for ✅ success message

Done! The Mac Mini can now access that site using your cookies.

## Test It

```bash
# On Mac Mini - check status
launchctl list | grep cookie-jar

# View logs
tail -f receiver/logs/stdout.log

# Test health endpoint
curl http://localhost:3333/api/status
```

## Troubleshooting

**Can't reach the server?**
- Verify Tailscale is connected on both machines
- Try `ping YOUR_SERVER` from your laptop

**Import fails?**
- Check that browser-use is installed: `~/.browser-use-env/bin/browser-use --version`
- Cookies are still saved to `receiver/cookies/{domain}.json`

**Extension shows error?**
- Check Chrome console (click extension icon → right-click → Inspect popup)
- Verify token matches in `.env` and extension settings
