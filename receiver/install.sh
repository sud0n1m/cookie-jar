#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_LABEL="com.cookie-jar.receiver"
PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

echo "🍪 Cookie Jar Receiver Setup"
echo "=============================="
echo ""

# Install npm dependencies
echo "📦 Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Generate random token if .env doesn't exist
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "🔐 Generating auth token..."
  TOKEN=$(openssl rand -hex 32)
  echo "COOKIE_JAR_TOKEN=$TOKEN" > "$ENV_FILE"
  echo "✓ Generated token and saved to .env"
  echo ""
  echo "⚠️  IMPORTANT: Configure this token in the Chrome extension settings!"
  echo "Token: $TOKEN"
  echo ""
else
  echo "✓ Using existing .env file"
  echo ""
fi

# Create launchd plist
echo "⚙️  Creating launchd service..."

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${SCRIPT_DIR}/server.js</string>
  </array>
  
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  
  <key>EnvironmentVariables</key>
  <dict>
    <key>COOKIE_JAR_TOKEN</key>
    <string>__TOKEN_PLACEHOLDER__</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  
  <key>RunAtLoad</key>
  <true/>
  
  <key>KeepAlive</key>
  <true/>
  
  <key>StandardOutPath</key>
  <string>${SCRIPT_DIR}/logs/stdout.log</string>
  
  <key>StandardErrorPath</key>
  <string>${SCRIPT_DIR}/logs/stderr.log</string>
</dict>
</plist>
EOF

# Read token from .env and inject into plist
TOKEN=$(grep COOKIE_JAR_TOKEN "$ENV_FILE" | cut -d '=' -f2)
sed -i '' "s/__TOKEN_PLACEHOLDER__/$TOKEN/" "$PLIST_FILE"

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

echo "✓ Created plist at $PLIST_FILE"

# Load the service
echo "🚀 Loading service..."
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo "✓ Service loaded and started"
echo ""
echo "=============================="
echo "✅ Setup complete!"
echo ""
echo "Service status: launchctl list | grep cookie-jar"
echo "View logs: tail -f $SCRIPT_DIR/logs/stdout.log"
echo "Reload: launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
echo ""
echo "Next steps:"
echo "1. Load the Chrome extension from: $SCRIPT_DIR/../extension"
echo "2. Configure the auth token in extension settings"
echo "3. Visit a paywalled site and click the Cookie Jar icon"
echo ""
