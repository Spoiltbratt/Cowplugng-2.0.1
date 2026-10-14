import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const iconsDir = path.resolve('public/icons');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Standard CowPlug NG Icon SVG (Used for regular 192, 512, SVG icons)
const standardSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065f46" />
      <stop offset="50%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="50%" stop-color="#EAB308" />
      <stop offset="100%" stop-color="#CA8A04" />
    </linearGradient>
    <linearGradient id="hornGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="104" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.4"/>

  <!-- Subtle glow in center -->
  <circle cx="256" cy="220" r="160" fill="#10b981" opacity="0.15" filter="blur(30px)"/>

  <!-- Bull / Livestock Emblem -->
  <g filter="url(#shadow)" transform="translate(256, 215) scale(1.15)">
    <!-- Horn Left -->
    <path d="M -50 -45 C -95 -105, -135 -100, -145 -70 C -135 -60, -110 -65, -80 -40 C -60 -25, -45 -15, -40 -10 Z" fill="url(#hornGrad)"/>
    <!-- Horn Right -->
    <path d="M 50 -45 C 95 -105, 135 -100, 145 -70 C 135 -60, 110 -65, 80 -40 C 60 -25, 45 -15, 40 -10 Z" fill="url(#hornGrad)"/>

    <!-- Crown / Top Head Ridge -->
    <path d="M -55 -40 Q 0 -65 55 -40 L 45 -10 Q 0 -25 -45 -10 Z" fill="#ffffff"/>

    <!-- Head Main Shape -->
    <path d="M -55 -35 C -65 10, -50 65, -35 90 C -25 108, -15 115, 0 115 C 15 115, 25 108, 35 90 C 50 65, 65 10, 55 -35 Q 0 -50 -55 -35 Z" fill="#ffffff"/>

    <!-- Ear Left -->
    <path d="M -55 -15 C -85 -10, -110 5, -115 20 C -105 25, -85 20, -55 5 Z" fill="#E2E8F0"/>
    <!-- Ear Right -->
    <path d="M 55 -15 C 85 -10, 110 5, 115 20 C 105 25, 85 20, 55 5 Z" fill="#E2E8F0"/>

    <!-- Forehead Gold Star/Shield Feature -->
    <path d="M 0 -15 L 12 5 L -12 5 Z" fill="url(#goldGrad)"/>

    <!-- Snout / Muzzle -->
    <path d="M -32 60 C -35 85, -25 105, 0 105 C 25 105, 35 85, 32 60 Q 0 52 -32 60 Z" fill="url(#goldGrad)"/>

    <!-- Nostrils -->
    <ellipse cx="-12" cy="85" rx="5" ry="4" fill="#78350F"/>
    <ellipse cx="12" cy="85" rx="5" ry="4" fill="#78350F"/>

    <!-- Eyes -->
    <ellipse cx="-32" cy="8" rx="6" ry="4" transform="rotate(-10 -32 8)" fill="#064e3b"/>
    <ellipse cx="32" cy="8" rx="6" ry="4" transform="rotate(10 32 8)" fill="#064e3b"/>
    <circle cx="-31" cy="7" r="1.5" fill="#ffffff"/>
    <circle cx="31" cy="7" r="1.5" fill="#ffffff"/>
  </g>

  <!-- Typography Brand Mark at bottom -->
  <text x="256" y="405" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="42" fill="#ffffff" letter-spacing="1">
    CowPlug <tspan fill="#34d399">NG</tspan>
  </text>
  <text x="256" y="440" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14" fill="#FDE047" letter-spacing="5">
    SMART AGRICULTURE
  </text>
</svg>
`;

// 2. Maskable Icon SVG (Has safe padding around central 80% circle)
const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065f46" />
      <stop offset="50%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="goldGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="50%" stop-color="#EAB308" />
      <stop offset="100%" stop-color="#CA8A04" />
    </linearGradient>
    <linearGradient id="hornGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="shadowMask" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Full bleed background for adaptive masks -->
  <rect width="512" height="512" fill="url(#bgGradMask)"/>

  <!-- Center glow -->
  <circle cx="256" cy="235" r="140" fill="#10b981" opacity="0.18" filter="blur(25px)"/>

  <!-- Scaled livestock emblem safely within 80% circle -->
  <g filter="url(#shadowMask)" transform="translate(256, 230) scale(0.92)">
    <!-- Horn Left -->
    <path d="M -50 -45 C -95 -105, -135 -100, -145 -70 C -135 -60, -110 -65, -80 -40 C -60 -25, -45 -15, -40 -10 Z" fill="url(#hornGradMask)"/>
    <!-- Horn Right -->
    <path d="M 50 -45 C 95 -105, 135 -100, 145 -70 C 135 -60, 110 -65, 80 -40 C 60 -25, 45 -15, 40 -10 Z" fill="url(#hornGradMask)"/>

    <!-- Crown / Top Head Ridge -->
    <path d="M -55 -40 Q 0 -65 55 -40 L 45 -10 Q 0 -25 -45 -10 Z" fill="#ffffff"/>

    <!-- Head Main Shape -->
    <path d="M -55 -35 C -65 10, -50 65, -35 90 C -25 108, -15 115, 0 115 C 15 115, 25 108, 35 90 C 50 65, 65 10, 55 -35 Q 0 -50 -55 -35 Z" fill="#ffffff"/>

    <!-- Ear Left -->
    <path d="M -55 -15 C -85 -10, -110 5, -115 20 C -105 25, -85 20, -55 5 Z" fill="#E2E8F0"/>
    <!-- Ear Right -->
    <path d="M 55 -15 C 85 -10, 110 5, 115 20 C 105 25, 85 20, 55 5 Z" fill="#E2E8F0"/>

    <!-- Forehead Gold Star/Shield Feature -->
    <path d="M 0 -15 L 12 5 L -12 5 Z" fill="url(#goldGradMask)"/>

    <!-- Snout / Muzzle -->
    <path d="M -32 60 C -35 85, -25 105, 0 105 C 25 105, 35 85, 32 60 Q 0 52 -32 60 Z" fill="url(#goldGradMask)"/>

    <!-- Nostrils -->
    <ellipse cx="-12" cy="85" rx="5" ry="4" fill="#78350F"/>
    <ellipse cx="12" cy="85" rx="5" ry="4" fill="#78350F"/>

    <!-- Eyes -->
    <ellipse cx="-32" cy="8" rx="6" ry="4" transform="rotate(-10 -32 8)" fill="#064e3b"/>
    <ellipse cx="32" cy="8" rx="6" ry="4" transform="rotate(10 32 8)" fill="#064e3b"/>
    <circle cx="-31" cy="7" r="1.5" fill="#ffffff"/>
    <circle cx="31" cy="7" r="1.5" fill="#ffffff"/>
  </g>

  <!-- Typography Brand Mark in Safe Zone -->
  <text x="256" y="385" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="34" fill="#ffffff" letter-spacing="1">
    CowPlug <tspan fill="#34d399">NG</tspan>
  </text>
  <text x="256" y="415" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="12" fill="#FDE047" letter-spacing="4">
    SMART AGRICULTURE
  </text>
</svg>
`;

async function generateAssets() {
  console.log('Generating PWA icons and assets...');
  
  // Write SVGs
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), standardSvg);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), maskableSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg);

  // Generate PNG 512x512 standard
  await sharp(Buffer.from(standardSvg))
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(iconsDir, 'icon-512x512.png'));

  // Generate PNG 192x192 standard
  await sharp(Buffer.from(standardSvg))
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(iconsDir, 'icon-192x192.png'));

  // Generate PNG 512x512 maskable
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));

  // Generate PNG 192x192 maskable
  await sharp(Buffer.from(maskableSvg))
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));

  // Generate Apple Touch Icon 180x180
  await sharp(Buffer.from(standardSvg))
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  // Also place apple-touch-icon in public root for iOS legacy scrapers
  fs.copyFileSync(
    path.join(iconsDir, 'apple-touch-icon.png'),
    path.join(publicDir, 'apple-touch-icon.png')
  );

  // Generate Favicon 32x32 / 48x48
  await sharp(Buffer.from(standardSvg))
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('PWA assets generated successfully!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
