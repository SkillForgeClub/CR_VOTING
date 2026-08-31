import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 180" width="620" height="180">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800;900&amp;display=swap');
      .vignan-title {
        font-family: 'Plus Jakarta Sans', 'Arial Black', 'Impact', sans-serif;
        font-weight: 900;
        fill: #E31E24;
        font-size: 68px;
        letter-spacing: -0.5px;
      }
      .vignan-line1 {
        font-family: 'Plus Jakarta Sans', 'Arial Black', sans-serif;
        font-weight: 900;
        fill: #000000;
        font-size: 15.5px;
        letter-spacing: 0.5px;
      }
      .vignan-line2 {
        font-family: 'Plus Jakarta Sans', 'Arial Black', sans-serif;
        font-weight: 900;
        fill: #000000;
        font-size: 14.5px;
        letter-spacing: 0.8px;
      }
      .vignan-line3 {
        font-family: 'Plus Jakarta Sans', 'Arial Black', sans-serif;
        font-weight: 900;
        fill: #000000;
        font-size: 14px;
        letter-spacing: 1px;
      }
    </style>
    <!-- 5-pointed star symbol -->
    <g id="star">
      <polygon points="0,-9.5 2.8,-2.9 9,-2.9 4,1.1 5.9,7.6 0,3.6 -5.9,7.6 -4,1.1 -9,-2.9 -2.8,-2.9" fill="#0072BC" />
    </g>
  </defs>

  <!-- Left Emblem Group (Center: 80, 90) -->
  <g transform="translate(82, 90)">
    <!-- Base background for circle -->
    <circle cx="0" cy="0" r="66" fill="#FFFFFF" />

    <!-- 5 Lavender / Lilac Wedges -->
    <!-- Wedges sit between spoke angles: 90, 18, 306 (-54), 234 (-126), 162 -->
    <!-- Wedge 1: between 18 deg and 90 deg (Bottom Right) -->
    <path d="M 0 0 L 59.8 19.4 A 63 63 0 0 1 0 63 Z" fill="#9B94BF" />
    <!-- Wedge 2: between 90 deg and 162 deg (Bottom Left) -->
    <path d="M 0 0 L 0 63 A 63 63 0 0 1 -59.8 19.4 Z" fill="#9B94BF" />
    <!-- Wedge 3: between 162 deg and 234 deg (Mid-Left) -->
    <path d="M 0 0 L -59.8 19.4 A 63 63 0 0 1 -37.0 -50.9 Z" fill="#9B94BF" />
    <!-- Wedge 4: between 234 deg and 306 deg (Top V-section) -->
    <path d="M 0 0 L -37.0 -50.9 A 63 63 0 0 1 37.0 -50.9 Z" fill="#9B94BF" />
    <!-- Wedge 5: between 306 deg and 18 deg (Mid-Right) -->
    <path d="M 0 0 L 37.0 -50.9 A 63 63 0 0 1 59.8 19.4 Z" fill="#9B94BF" />

    <!-- Outer rim -->
    <circle cx="0" cy="0" r="64" fill="none" stroke="#FFFFFF" stroke-width="2" />
    <circle cx="0" cy="0" r="65.5" fill="none" stroke="#0072BC" stroke-width="1.5" />

    <!-- 5 Blue Spokes radiating outwards from center -->
    <!-- Spoke 1: 90 deg (Straight Down) -->
    <g transform="rotate(90)">
      <rect x="0" y="-7.5" width="65" height="15" fill="#0072BC" stroke="#FFFFFF" stroke-width="1" />
    </g>
    <!-- Spoke 2: 18 deg -->
    <g transform="rotate(18)">
      <rect x="0" y="-7.5" width="65" height="15" fill="#0072BC" stroke="#FFFFFF" stroke-width="1" />
    </g>
    <!-- Spoke 3: 306 deg (-54 deg) -->
    <g transform="rotate(-54)">
      <rect x="0" y="-7.5" width="65" height="15" fill="#0072BC" stroke="#FFFFFF" stroke-width="1" />
    </g>
    <!-- Spoke 4: 234 deg (-126 deg) -->
    <g transform="rotate(-126)">
      <rect x="0" y="-7.5" width="65" height="15" fill="#0072BC" stroke="#FFFFFF" stroke-width="1" />
    </g>
    <!-- Spoke 5: 162 deg -->
    <g transform="rotate(162)">
      <rect x="0" y="-7.5" width="65" height="15" fill="#0072BC" stroke="#FFFFFF" stroke-width="1" />
    </g>

    <!-- Center Hub Ring & Star -->
    <circle cx="0" cy="0" r="23" fill="#0072BC" />
    <circle cx="0" cy="0" r="19" fill="#FFFFFF" stroke="#0072BC" stroke-width="2" />
    <use href="#star" x="0" y="0" />
  </g>

  <!-- Divider Line -->
  <line x1="168" y1="20" x2="168" y2="160" stroke="#E2E8F0" stroke-width="2" />

  <!-- Right Typography Section -->
  <g transform="translate(180, 0)">
    <!-- VIGNAN'S Header -->
    <text x="0" y="72" class="vignan-title">VIGNAN’S</text>

    <!-- Subtitle 3 Lines -->
    <g transform="translate(2, 0)">
      <text x="195" y="104" text-anchor="middle" class="vignan-line1">INSTITUTE OF INFORMATION TECHNOLOGY</text>
      <text x="195" y="126" text-anchor="middle" class="vignan-line2">(AUTONOMOUS)</text>
      <text x="195" y="148" text-anchor="middle" class="vignan-line3">DUVVADA, VISAKHAPATNAM</text>
    </g>
  </g>
</svg>`;

const publicAssetsDir = path.join(process.cwd(), 'public', 'assets');
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

// 1. Write SVG
const svgPath = path.join(publicAssetsDir, 'college-logo.svg');
fs.writeFileSync(svgPath, svgContent);
console.log('Saved SVG to:', svgPath);

// 2. Generate PNG via sharp
const pngPath = path.join(publicAssetsDir, 'college-logo.png');
await sharp(Buffer.from(svgContent))
  .png({ quality: 100 })
  .toFile(pngPath);
console.log('Saved PNG to:', pngPath);
