/* Generates ZLife app icons as PNG files with zero dependencies.
   Renders a white "Z" letterform on a solid indigo background.

   Run: node scripts/generate-icons.js
*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- "Z" letterform ----------
// Z polyline in normalized [0..1] coordinates (with some stroke weight).
const Z_POINTS = [
  [0.30, 0.30],
  [0.70, 0.30],
  [0.70, 0.385],
  [0.385, 0.615],
  [0.70, 0.615],
  [0.70, 0.70],
  [0.30, 0.70],
  [0.30, 0.615],
  [0.615, 0.385],
  [0.30, 0.385],
];
const STROKE = 0.115; // stroke thickness in normalized units

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function zCoverage(nx, ny) {
  let min = Infinity;
  for (let i = 0; i < Z_POINTS.length; i++) {
    const a = Z_POINTS[i];
    const b = Z_POINTS[(i + 1) % Z_POINTS.length];
    min = Math.min(min, distToSegment(nx, ny, a[0], a[1], b[0], b[1]));
  }
  return min;
}

// ---------- Render ----------
const BG = [79, 70, 229, 255]; // indigo-600 #4F46E5
const FG = [255, 255, 255, 255]; // white

function renderIcon(size) {
  const SS = 3; // supersampling factor
  const W = size * SS;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x * SS + sx + 0.5) / W;
          const ny = (y * SS + sy + 0.5) / W;
          if (zCoverage(nx, ny) <= STROKE / 2) cover += 1;
        }
      }
      const a = cover / (SS * SS);
      const idx = (y * size + x) * 4;
      pixels[idx] = Math.round(BG[0] + (FG[0] - BG[0]) * a);
      pixels[idx + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
      pixels[idx + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
      pixels[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, pixels);
}

// Maskable variant: letterform scaled into the central safe zone (~66% of canvas).
function renderMaskable(size) {
  const SS = 3;
  const W = size * SS;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = 0.66;
  const offset = (1 - scale) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = offset + ((x * SS + sx + 0.5) / W) * scale;
          const ny = offset + ((y * SS + sy + 0.5) / W) * scale;
          if (zCoverage(nx, ny) <= (STROKE / 2) * scale) cover += 1;
        }
      }
      const a = cover / (SS * SS);
      const idx = (y * size + x) * 4;
      pixels[idx] = Math.round(BG[0] + (FG[0] - BG[0]) * a);
      pixels[idx + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
      pixels[idx + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
      pixels[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, pixels);
}

const OUT_DIR = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  ['maskable-192.png', renderMaskable(192)],
  ['maskable-512.png', renderMaskable(512)],
  ['apple-touch-icon.png', renderIcon(180)],
  ['favicon-32.png', renderIcon(32)],
];

for (const [name, buf] of targets) {
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log('Wrote icons/' + name + ' (' + buf.length + ' bytes)');
}