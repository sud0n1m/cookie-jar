#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function drawCookie(ctx, size) {
  const center = size / 2;
  const radius = size * 0.4;
  
  // Cookie base (tan/brown)
  ctx.fillStyle = '#D2691E';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Add some chocolate chips
  ctx.fillStyle = '#3E2723';
  const chipSize = size * 0.08;
  const chips = [
    [0.3, 0.3],
    [0.6, 0.35],
    [0.4, 0.55],
    [0.65, 0.65],
    [0.35, 0.7]
  ];
  
  chips.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(size * x, size * y, chipSize, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Add highlight for dimension
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(center - radius * 0.3, center - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, size, size);
  
  // Draw cookie
  drawCookie(ctx, size);
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ Generated ${filePath}`);
});

console.log('All icons generated successfully!');
