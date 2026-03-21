#!/bin/bash

##
## curl Example - Use cookies in Netscape format with curl
##
## Prerequisites:
##   curl (usually pre-installed)
##
## Usage:
##   ./curl-example.sh www.washingtonpost.com
##

set -e

RECEIVER_URL="${RECEIVER_URL:-http://localhost:3333}"
AUTH_TOKEN="${COOKIE_JAR_TOKEN}"

if [ -z "$1" ]; then
  echo "Usage: ./curl-example.sh <domain>"
  echo "Example: ./curl-example.sh www.washingtonpost.com"
  exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo "Error: COOKIE_JAR_TOKEN environment variable not set"
  echo "Set it to your receiver auth token:"
  echo "  export COOKIE_JAR_TOKEN=\"your-token-here\""
  exit 1
fi

DOMAIN="$1"
COOKIES_FILE="/tmp/cookie-jar-${DOMAIN}.txt"

echo "🍪 Fetching cookies for ${DOMAIN}..."

# Fetch cookies in Netscape format
curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "${RECEIVER_URL}/api/cookies/${DOMAIN}?format=netscape" \
  -o "${COOKIES_FILE}"

if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch cookies"
  exit 1
fi

echo "✓ Saved cookies to ${COOKIES_FILE}"

# Count cookies (skip comment lines)
COOKIE_COUNT=$(grep -v '^#' "${COOKIES_FILE}" | grep -v '^$' | wc -l | tr -d ' ')
echo "✓ Loaded ${COOKIE_COUNT} cookies"

# Make an authenticated request
echo "🌐 Fetching https://${DOMAIN}/ with cookies..."
echo ""

curl -b "${COOKIES_FILE}" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -L \
  "https://${DOMAIN}/" \
  -o "/tmp/cookie-jar-${DOMAIN}.html"

echo ""
echo "✅ Success! Page saved to /tmp/cookie-jar-${DOMAIN}.html"
echo "📄 Cookie file: ${COOKIES_FILE}"
echo ""
echo "You can now use this cookie file with curl:"
echo "  curl -b ${COOKIES_FILE} https://${DOMAIN}/some-page"
