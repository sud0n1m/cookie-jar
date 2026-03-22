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

# Provision Tailscale TLS certs
TS_DOMAIN="ziggy.tail7f7a2.ts.net"
CERTS_DIR="$SCRIPT_DIR/certs"
mkdir -p "$CERTS_DIR"

echo "🔒 Provisioning Tailscale TLS certificate..."
if command -v tailscale &>/dev/null; then
  if tailscale cert --cert-file "$CERTS_DIR/$TS_DOMAIN.crt" --key-file "$CERTS_DIR/$TS_DOMAIN.key" "$TS_DOMAIN" 2>/dev/null; then
    chmod 600 "$CERTS_DIR/$TS_DOMAIN.key"
    chmod 644 "$CERTS_DIR/$TS_DOMAIN.crt"
    echo "✓ TLS cert provisioned for $TS_DOMAIN"
  else
    echo "⚠️  Failed to provision TLS cert — server will fall back to HTTP"
    echo "   You can manually run: tailscale cert --cert-file $CERTS_DIR/$TS_DOMAIN.crt --key-file $CERTS_DIR/$TS_DOMAIN.key $TS_DOMAIN"
  fi
else
  echo "⚠️  tailscale CLI not found — server will fall back to HTTP"
  echo "   Install Tailscale and run install.sh again for HTTPS support"
fi
echo ""

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
    <string>__NODE_PATH__</string>
    <string>${SCRIPT_DIR}/server.js</string>
  </array>
  
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  
  <key>EnvironmentVariables</key>
  <dict>
    <key>COOKIE_JAR_TOKEN</key>
    <string>__TOKEN_PLACEHOLDER__</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
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

# Inject node path and token into plist
NODE_PATH=$(which node)
sed -i '' "s|__NODE_PATH__|$NODE_PATH|" "$PLIST_FILE"
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
