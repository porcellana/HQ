/**
 * Genera los iconos PNG del juego (PWA y Android) a partir de pixel art en
 * texto, sin dependencias externas. Uso: node scripts/gen-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ART = [
  '................',
  '......kkkk......',
  '.....khhhhk.....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....kskssksk....',
  '....kssssssk....',
  '.....kssssk.....',
  '...kkCCCCCCkk...',
  '..kCCCDCCDCCCk..',
  '..ksCCCCCCCCsk..',
  '...kkBBgBBBkk...',
  '....kPPkkPPk....',
  '....kPPkkPPk....',
  '....kbbkkbbk....',
  '....kkk..kkk....',
];
const COLORS = {
  k: [11, 10, 16], h: [58, 36, 24], s: [217, 166, 122], C: [90, 47, 74], D: [61, 31, 51],
  B: [58, 38, 24], g: [216, 176, 80], P: [61, 47, 34], b: [58, 38, 24],
};
const BG_IN = [42, 29, 42];
const BG_OUT = [11, 10, 16];
const GOLD = [216, 176, 80];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Icono: fondo degradado radial, marco dorado y héroe centrado. `pad` = margen del héroe (0..1). */
function icon(size, pad = 0.2, border = true) {
  const cell = Math.floor((size * (1 - pad * 2)) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  return png(size, (x, y) => {
    const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
    const ch = ART[gy]?.[gx];
    if (x >= off && y >= off && ch && ch !== '.') return [...COLORS[ch], 255];
    const bw = Math.max(2, Math.round(size / 40));
    if (border && (x < bw || y < bw || x >= size - bw || y >= size - bw)) return [...GOLD, 255];
    const d = Math.min(1, Math.hypot(x - size / 2, y - size * 0.4) / (size * 0.7));
    return [0, 1, 2].map((i) => Math.round(BG_IN[i] * (1 - d) + BG_OUT[i] * d)).concat(255);
  });
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icon(192));
writeFileSync('public/icons/icon-512.png', icon(512));
writeFileSync('public/icons/icon-maskable-512.png', icon(512, 0.28, false));
// Iconos Android (se copian en CI tras `cap add android`).
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
mkdirSync('resources/android', { recursive: true });
for (const [d, s] of Object.entries(densities)) writeFileSync(`resources/android/ic_launcher-${d}.png`, icon(s, 0.18));
// Pantalla de inicio de Android: el héroe sobre fondo transparente (el fondo
// oscuro lo pone splash.xml), centrado por prepare-android.mjs.
const splash = (size) => {
  const cell = Math.floor(size / 16);
  return png(size, (x, y) => {
    const ch = ART[Math.floor(y / cell)]?.[Math.floor(x / cell)];
    return ch && ch !== '.' ? [...COLORS[ch], 255] : [0, 0, 0, 0];
  });
};
writeFileSync('resources/android/splash_icon.png', splash(192));
console.log('Iconos generados.');
