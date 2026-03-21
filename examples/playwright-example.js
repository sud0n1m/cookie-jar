#!/usr/bin/env node

/**
 * Playwright Example - Load cookies and access authenticated content
 * 
 * Prerequisites:
 *   npm install playwright
 * 
 * Usage:
 *   node playwright-example.js www.ft.com
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RECEIVER_URL = process.env.RECEIVER_URL || 'http://localhost:3333';
const AUTH_TOKEN = process.env.COOKIE_JAR_TOKEN;

async function main() {
  const domain = process.argv[2];
  
  if (!domain) {
    console.error('Usage: node playwright-example.js <domain>');
    console.error('Example: node playwright-example.js www.ft.com');
    process.exit(1);
  }
  
  if (!AUTH_TOKEN) {
    console.error('Error: COOKIE_JAR_TOKEN environment variable not set');
    console.error('Set it to your receiver auth token:');
    console.error('  export COOKIE_JAR_TOKEN="your-token-here"');
    process.exit(1);
  }
  
  console.log(`🍪 Loading cookies for ${domain}...`);
  
  // Fetch cookies from receiver in Playwright format
  const response = await fetch(`${RECEIVER_URL}/api/cookies/${domain}?format=playwright`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  
  if (!response.ok) {
    console.error(`Error: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }
  
  const { cookies, count } = await response.json();
  console.log(`✓ Loaded ${count} cookies`);
  
  // Launch browser and add cookies
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  await context.addCookies(cookies);
  console.log('✓ Cookies added to browser context');
  
  // Navigate to the site
  const page = await context.newPage();
  console.log(`📄 Navigating to https://${domain}...`);
  await page.goto(`https://${domain}`);
  
  // Take a screenshot
  const screenshotPath = path.join(__dirname, `${domain.replace(/\./g, '-')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);
  
  console.log('✅ Success! Browser is now authenticated.');
  console.log('Press Ctrl+C to exit.');
  
  // Keep browser open for inspection
  await page.waitForTimeout(60000); // Wait 60 seconds
  await browser.close();
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
