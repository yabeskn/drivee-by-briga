/**
 * generate-icons.js — Generate PNG icons from SVG for PWA
 * Run: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Minimal PNG encoder ──────────────────────────────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function makePNG(width, height, drawFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const i = rowStart + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon drawing ─────────────────────────────────────────────
function drawIcon(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const scale = w / 512;

  // Background: black with rounded corners
  const r = 128 * scale;
  const inRoundedRect = roundedRectContains(x, y, w, h, r);
  if (!inRoundedRect) return [0, 0, 0, 0];

  // Outer circle
  const outerR = 200 * scale;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  if (dist > outerR) return [0, 0, 0, 0];

  // Circle fill (#052e16)
  let color = [5, 46, 22, 255];

  // Circle stroke (#10b981, width 12)
  const strokeW = 12 * scale;
  if (dist > outerR - strokeW) {
    color = [16, 185, 129, 255];
  }

  // Lightning bolt path (simplified polygon)
  const bolt = [
    [280, 120], [190, 280], [270, 280], [230, 400],
    [350, 240], [270, 240], [280, 120],
  ].map(([px, py]) => [px * scale, py * scale]);

  if (pointInPolygon(x, y, bolt)) {
    color = [52, 211, 153, 255];
  }

  return color;
}

function roundedRectContains(x, y, w, h, r) {
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const cx = w / 2, cy = h / 2;
  const dx = Math.abs(x - cx) + rx - w / 2;
  const dy = Math.abs(y - cy) + ry - h / 2;
  if (dx > 0 && dy > 0) return dx * dx + dy * dy <= rx * rx;
  return dx <= 0 && dy <= 0;
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Generate ─────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  const png = makePNG(size, size, (x, y, w, h) => drawIcon(x, y, w, h));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`  Generated ${name} (${size}x${size})`);
}

console.log('Done!');
