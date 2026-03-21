#!/usr/bin/env node

/**
 * Puppeteer Example - Load cookies and access authenticated content
 * 
 * Prerequisites:
 *   npm install puppeteer
 * 
 * Usage:
 *   node puppeteer-example.js www.nytimes.com
 */

const puppeteer = require('puppeteer');
const path = require('path');

const RECEIVER_URL = process.env.RECEIVER_URL || 'http://localhost:3333';
const AUTH_TOKEN = process.env.COOKIE_JAR_TOKEN;

async function main() {
  const domain = process.argv[2];
  
  if (!domain) {
    console.error('Usage: node puppeteer-example.js <domain>');
    console.error('Example: node puppeteer-example.js www.nytimes.com');
    process.exit(1);
  }
  
  if (!AUTH_TOKEN) {
    console.error('Error: COOKIE_JAR_TOKEN environment variable not set');
    console.error('Set it to your receiver auth token:');
    console.error('  export COOKIE_JAR_TOKEN="your-token-here"');
    process.exit(1);
  }
  
  console.log(`🍪 Loading cookies for ${domain}...`);
  
  // Fetch cookies from receiver in Puppeteer format
  const response = await fetch(`${RECEIVER_URL}/api/cookies/${domain}?format=puppeteer`, {
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
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  // Set cookies
  await page.setCookie(...cookies);
  console.log('✓ Cookies added to browser');
  
  // Navigate to the site
  console.log(`📄 Navigating to https://${domain}...`);
  await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });
  
  // Take a screenshot
  const screenshotPath = path.join(__dirname, `${domain.replace(/\./g, '-')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);
  
  // Get page title
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);
  
  console.log('✅ Success! Browser is now authenticated.');
  console.log('Press Ctrl+C to exit.');
  
  // Keep browser open for inspection
  await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
  await browser.close();
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
