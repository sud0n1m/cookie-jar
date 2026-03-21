#!/bin/bash

##
## browser-use Example - Import cookies into browser-use CLI
##
## Prerequisites:
##   pip install browser-use
##
## Usage:
##   ./browser-use-example.sh www.ft.com
##

set -e

RECEIVER_URL="${RECEIVER_URL:-http://localhost:3333}"
AUTH_TOKEN="${COOKIE_JAR_TOKEN}"

if [ -z "$1" ]; then
  echo "Usage: ./browser-use-example.sh <domain>"
  echo "Example: ./browser-use-example.sh www.ft.com"
  exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo "Error: COOKIE_JAR_TOKEN environment variable not set"
  echo "Set it to your receiver auth token:"
  echo "  export COOKIE_JAR_TOKEN=\"your-token-here\""
  exit 1
fi

DOMAIN="$1"
COOKIES_FILE="/tmp/cookie-jar-${DOMAIN}.json"

echo "🍪 Fetching cookies for ${DOMAIN}..."

# Fetch cookies in raw format (browser-use expects Chrome format)
curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "${RECEIVER_URL}/api/cookies/${DOMAIN}?format=raw" \
  -o "${COOKIES_FILE}"

if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch cookies"
  exit 1
fi

echo "✓ Saved cookies to ${COOKIES_FILE}"

# Count cookies
COOKIE_COUNT=$(jq '.cookies | length' "${COOKIES_FILE}")
echo "✓ Loaded ${COOKIE_COUNT} cookies"

# Check if browser-use is installed
if ! command -v browser-use &> /dev/null; then
  echo "❌ browser-use not found. Install with: pip install browser-use"
  exit 1
fi

# Import cookies into browser-use
echo "📦 Importing cookies into browser-use..."
browser-use cookies import "${COOKIES_FILE}"

echo ""
echo "✅ Success! Cookies imported into browser-use"
echo ""
echo "You can now use browser-use with authenticated access:"
echo "  browser-use agent \"Read the latest article from ${DOMAIN}\""
echo ""
echo "Or use the cookies file directly with other tools:"
echo "  ${COOKIES_FILE}"
