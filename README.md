# 🍪 Cookie Jar

A Chrome extension + receiver service for sending site-scoped cookies from your laptop to a remote Mac Mini, enabling headless browser access to paywalled sites (Financial Times, Washington Post, etc.) using your authenticated cookies.

## Architecture

```
┌─────────────────────┐
│  Chrome Extension   │
│   (Your Laptop)     │
└──────────┬──────────┘
           │ HTTP POST
           │ (cookies JSON + Bearer token)
           ▼
┌─────────────────────┐
│  Receiver Service   │
│   (Mac Mini)        │
│   Port 3333         │
└──────────┬──────────┘
           │ Save to file
           │ Import to browser-use
           ▼
┌─────────────────────┐
│  browser-use CLI    │
│  (Headless Chrome)  │
└─────────────────────┘
```

## How It Works

1. **Visit a paywalled site** in Chrome on your laptop (while logged in)
2. **Click the Cookie Jar extension icon** — it grabs all cookies for that domain
3. **Click "Send to Ziggy"** — cookies are sent to the Mac Mini receiver service
4. **Receiver saves and imports** the cookies into browser-use
5. **browser-use can now access** the paywalled site using your authenticated session

## Setup

### Part 1: Receiver Service (Mac Mini)

```bash
cd receiver
./install.sh
```

This will:
- Install npm dependencies (`express`, `cors`)
- Generate a random Bearer token and save to `.env`
- Create and load a launchd service (`com.ziggy.cookie-jar`)
- Start the receiver on port 3333

**Copy the auth token** shown during setup — you'll need it for the extension.

Check status:
```bash
launchctl list | grep cookie-jar
tail -f receiver/logs/stdout.log
```

### Part 2: Chrome Extension (Laptop)

1. **Install canvas dependency** (for icon generation):
   ```bash
   cd extension
   npm install canvas
   node generate-icons.js
   ```

2. **Load the extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension/` folder

3. **Configure the extension**:
   - Click the Cookie Jar icon in Chrome toolbar
   - Click "⚙️ Settings"
   - Enter your receiver URL: `http://ziggy:3333/api/cookies`
   - Paste the Bearer token from the receiver setup
   - Click "Save Settings"

## Usage

1. **Visit a paywalled site** (e.g., ft.com, washingtonpost.com) and log in normally
2. **Click the Cookie Jar extension icon** 🍪
3. Review the domain and cookie count
4. **Click "Send to Ziggy"**
5. Wait for the ✅ success message

The cookies are now available on the Mac Mini for browser-use.

## Extension Features

- **Site-scoped cookies only** — only grabs cookies for the current tab's domain (not all cookies)
- **Dark theme UI** — clean, minimal popup interface
- **Configurable receiver** — set custom URL and auth token in options
- **Real-time feedback** — ✅/❌ status messages after sending
- **Cookie count display** — see how many cookies were found
- **Manifest V3** — uses latest Chrome extension standards

## Receiver API

### POST /api/cookies

Receive and save cookies from the extension.

**Auth:** Bearer token (required)

**Request:**
```json
{
  "domain": "www.ft.com",
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123...",
      "domain": ".ft.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "sameSite": "lax"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "domain": "www.ft.com",
  "cookieCount": 12,
  "savedTo": "www.ft.com.json"
}
```

After saving, automatically runs:
```bash
source ~/.browser-use-env/bin/activate && browser-use cookies import ./cookies/{domain}.json
```

### GET /api/cookies/:domain

Retrieve saved cookies for a domain (debugging).

**Auth:** Bearer token (required)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://ziggy:3333/api/cookies/www.ft.com
```

### GET /api/status

Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "service": "cookie-jar-receiver",
  "cookiesDir": "/path/to/cookies",
  "timestamp": "2026-03-21T23:30:00.000Z"
}
```

## Files Structure

```
cookie-jar/
├── extension/              # Chrome extension
│   ├── manifest.json       # Extension manifest (V3)
│   ├── popup.html          # Popup UI
│   ├── popup.js            # Popup logic
│   ├── options.html        # Settings page
│   ├── options.js          # Settings logic
│   ├── generate-icons.js   # Icon generation script
│   └── icons/              # Generated PNG icons (16, 48, 128px)
│
├── receiver/               # Node.js receiver service
│   ├── server.js           # Express server
│   ├── package.json        # Dependencies
│   ├── install.sh          # Setup script
│   ├── .env                # Auth token (auto-generated)
│   ├── cookies/            # Saved cookie files
│   └── logs/               # Service logs
│
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Security Notes

- **Bearer token** is generated randomly during setup and stored in `.env`
- **Cookies are sensitive** — never commit `cookies/*.json` or `.env` to git
- **HTTPS recommended** for production use (currently HTTP over Tailscale)
- **CORS is enabled** for the extension — receiver only accepts requests with valid Bearer token
- **Cookies are stored as files** in `receiver/cookies/` for debugging/inspection

## Troubleshooting

### Extension can't send cookies

1. Check that the receiver service is running:
   ```bash
   launchctl list | grep cookie-jar
   ```

2. Verify the receiver URL is correct in extension settings (should be `http://ziggy:3333/api/cookies`)

3. Check logs for errors:
   ```bash
   tail -f receiver/logs/stdout.log
   tail -f receiver/logs/stderr.log
   ```

### browser-use import fails

The receiver will still save cookies to `cookies/{domain}.json` even if the browser-use import fails. You can manually import:

```bash
source ~/.browser-use-env/bin/activate
browser-use cookies import receiver/cookies/www.ft.com.json
```

### Wrong domain cookies

The extension only sends cookies for the **current tab's domain**. Make sure you're on the correct site when clicking the extension icon.

## Development

The extension uses plain JavaScript (no TypeScript, no build tools) for simplicity.

To modify the extension:
1. Edit files in `extension/`
2. Reload the extension in `chrome://extensions/`
3. Test with a paywalled site

To modify the receiver:
1. Edit `receiver/server.js`
2. Reload the service:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.ziggy.cookie-jar.plist
   launchctl load ~/Library/LaunchAgents/com.ziggy.cookie-jar.plist
   ```

## License

MIT
