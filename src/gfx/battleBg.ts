/**
 * FONDOS DE BATALLA (pixel art por código, vista lateral clásica).
 * Cielo/pared al fondo y suelo con perspectiva (bandas que crecen hacia el
 * jugador, líneas de fuga). Se dibuja en una resolución baja y se amplía sin
 * suavizar, igual que el resto del juego.
 */
import type { Biome } from '@/game/battle/biome';
import { PAL } from './palette';

export const BG_BLOCK = 4;
/** Posición del horizonte como fracción de la altura. */
export const HORIZON = 0.4;

function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function mix(c1: string, c2: string, t: number): string {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1);
  const b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(',')})`;
}

interface Theme {
  skyTop: string;
  skyBot: string;
  groundA: string;
  groundB: string;
  line: string;
  fog: string;
}

const THEMES: Record<Biome, Theme> = {
  pradera: { skyTop: '#5f8fbf', skyBot: '#cfdcc4', groundA: PAL.grass, groundB: PAL.grassL, line: PAL.grassD, fog: '#cfdcc4' },
  bosque: { skyTop: '#2c4a44', skyBot: '#7a9a78', groundA: PAL.grassD, groundB: PAL.grass, line: PAL.leafD, fog: '#4a6a50' },
  montana: { skyTop: '#6a7690', skyBot: '#c0c4cc', groundA: PAL.stoneD, groundB: PAL.stone, line: PAL.shadow, fog: '#b0b4bc' },
  cueva: { skyTop: '#0e0c12', skyBot: '#2a2420', groundA: PAL.dirtD, groundB: PAL.dirt, line: PAL.black, fog: '#2a2018' },
  cripta: { skyTop: '#0a0a16', skyBot: '#2a2440', groundA: PAL.slateD, groundB: PAL.slate, line: PAL.black, fog: '#2a2440' },
  galerias: { skyTop: '#0c1410', skyBot: '#2a3a2a', groundA: PAL.leafD, groundB: PAL.stoneD, line: PAL.black, fog: '#2a3a2a' },
  puerto: { skyTop: '#d08a5a', skyBot: '#f0c890', groundA: PAL.woodD, groundB: PAL.wood, line: PAL.black, fog: '#f0c890' },
  aldea: { skyTop: '#6f9acb', skyBot: '#e0dcc0', groundA: PAL.dirt, groundB: PAL.dirtL, line: PAL.dirtD, fog: '#e0dcc0' },
  interior: { skyTop: PAL.woodD, skyBot: PAL.wood, groundA: PAL.woodD, groundB: PAL.wood, line: PAL.black, fog: PAL.wood },
};

/** Dibuja el fondo en un canvas aparte (bloques de BG_BLOCK px) y lo devuelve ya ampliado. */
export function makeBattleBackground(w: number, h: number, biome: Biome, seed = 1): HTMLCanvasElement {
  const B = BG_BLOCK;
  const lw = Math.max(8, Math.ceil(w / B));
  const lh = Math.max(8, Math.ceil(h / B));
  const small = document.createElement('canvas');
  small.width = lw;
  small.height = lh;
  const c = small.getContext('2d')!;
  const th = THEMES[biome];
  const hz = Math.round(lh * HORIZON);
  const rect = (x: number, y: number, ww: number, hh: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh)));
  };
  // Cielo / pared de fondo en bandas
  const bands = 10;
  for (let i = 0; i < bands; i++) rect(0, (hz * i) / bands, lw, hz / bands + 1, mix(th.skyTop, th.skyBot, i / (bands - 1)));
  drawBackdrop(c, biome, lw, lh, hz, th, seed, rect);
  // Suelo: bandas con perspectiva (altura creciente)
  rect(0, hz, lw, lh - hz, th.groundA);
  let y = hz;
  let band = 1;
  let i = 0;
  while (y < lh) {
    const bh = band;
    if (i % 2 === 0) rect(0, y, lw, bh, mix(th.groundA, th.groundB, 0.35 + 0.4 * ((y - hz) / (lh - hz))));
    // Veteado aleatorio por banda
    for (let k = 0; k < lw / 4; k++) {
      const hx = hash(k + i * 31, seed);
      if (hx > 0.5) rect(hx * lw * 2 % lw, y + hash(k, i + seed) * bh, 1 + Math.floor(hx * 2), 1, th.line);
    }
    y += bh;
    band = Math.min(8, band + (i % 2 ? 1 : 0) + 0.0);
    i++;
  }
  // Líneas de fuga
  c.globalAlpha = 0.18;
  for (let k = -6; k <= 6; k++) {
    const x0 = lw / 2 + k * 2;
    const x1 = lw / 2 + k * (lw / 5);
    c.strokeStyle = th.line;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0 + 0.5, hz);
    c.lineTo(x1 + 0.5, lh);
    c.stroke();
  }
  c.globalAlpha = 1;
  // Línea de horizonte suave (neblina)
  for (let k = 0; k < 3; k++) {
    c.globalAlpha = 0.35 - k * 0.1;
    rect(0, hz - 1 + k, lw, 1, th.fog);
  }
  c.globalAlpha = 1;
  // Viñeta ligera
  const out = document.createElement('canvas');
  out.width = lw * B;
  out.height = lh * B;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.drawImage(small, 0, 0, out.width, out.height);
  const g = o.createRadialGradient(out.width / 2, out.height * 0.55, out.height * 0.3, out.width / 2, out.height * 0.55, out.height * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  o.fillStyle = g;
  o.fillRect(0, 0, out.width, out.height);
  return out;
}

type RectFn = (x: number, y: number, w: number, h: number, col: string) => void;

function drawBackdrop(c: CanvasRenderingContext2D, biome: Biome, lw: number, _lh: number, hz: number, th: Theme, seed: number, rect: RectFn): void {
  const tri = (cx: number, base: number, w: number, hh: number, col: string) => {
    for (let r = 0; r < hh; r++) rect(cx - (w * (r + 1)) / (2 * hh), base - r - 1, (w * (r + 1)) / hh, 1, col);
  };
  switch (biome) {
    case 'pradera':
    case 'aldea': {
      // Nubes y colinas lejanas
      for (let k = 0; k < 4; k++) {
        const cx = hash(k, seed) * lw;
        const cy = hz * (0.15 + 0.3 * hash(k + 9, seed));
        rect(cx, cy, 12, 2, 'rgba(255,255,255,0.6)');
        rect(cx + 3, cy - 1, 7, 1, 'rgba(255,255,255,0.6)');
      }
      for (let x = 0; x < lw; x++) rect(x, hz - 3 - Math.sin(x / 9 + seed) * 2.2 - Math.sin(x / 4) * 0.8, 1, 8, mix(PAL.grassD, '#6a8aa0', 0.5));
      for (let x = 0; x < lw; x++) rect(x, hz - 1 - Math.sin(x / 6 + 2 + seed) * 1.8, 1, 6, PAL.grassD);
      if (biome === 'aldea') {
        for (let k = 0; k < 5; k++) {
          const x = 4 + k * (lw / 5) + hash(k, seed) * 4;
          rect(x, hz - 9, 9, 7, PAL.stoneD);
          tri(x + 4.5, hz - 9, 12, 5, PAL.roofD);
          rect(x + 3, hz - 5, 2, 3, '#f0c060');
        }
      }
      break;
    }
    case 'bosque': {
      for (let layer = 0; layer < 2; layer++) {
        const col = layer === 0 ? PAL.leafD : PAL.black;
        for (let k = 0; k < lw / 5; k++) {
          const x = k * 5 + hash(k, seed + layer) * 4;
          const hh = 12 + hash(k + 3, seed) * 10 - layer * 3;
          rect(x, hz - hh * 0.5, 2, hh * 0.5 + 3, layer === 0 ? PAL.woodD : PAL.black);
          tri(x + 1, hz - hh * 0.3, 9, hh * 0.7, col);
        }
      }
      break;
    }
    case 'montana': {
      for (let k = 0; k < 4; k++) {
        const x = (k + 0.5) * (lw / 4) + (hash(k, seed) - 0.5) * 8;
        const hh = 14 + hash(k + 1, seed) * 10;
        tri(x, hz + 1, hh * 1.7, hh, PAL.stoneD);
        tri(x, hz - hh + 5, hh * 0.6, 5, '#d8dce4');
      }
      break;
    }
    case 'cueva':
    case 'galerias': {
      for (let x = 0; x < lw; x += 1) {
        const n = hash(x >> 1, seed);
        if (n > 0.55) rect(x, 0, 1, 2 + n * 9, th.skyTop === '#0c1410' ? '#06100a' : '#080608');
      }
      for (let k = 0; k < 6; k++) {
        const x = hash(k, seed + 5) * lw;
        const y = hz * (0.4 + 0.4 * hash(k, seed + 2));
        rect(x, y, 3, 2, 'rgba(255,255,255,0.05)');
      }
      if (biome === 'galerias') {
        c.strokeStyle = 'rgba(230,230,230,0.35)';
        c.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const x = (k + 0.3) * (lw / 4);
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x + 6, hz * 0.7);
          c.lineTo(x - 5, hz * 0.55);
          c.lineTo(x + 3, hz * 0.3);
          c.stroke();
        }
      }
      // Antorchas
      for (const fx of [lw * 0.12, lw * 0.88]) {
        rect(fx, hz * 0.45, 1, 5, PAL.woodL);
        rect(fx - 1, hz * 0.45 - 3, 3, 3, '#f0a030');
        rect(fx, hz * 0.45 - 4, 1, 2, '#ffe080');
      }
      break;
    }
    case 'cripta': {
      for (let k = 0; k < 5; k++) {
        const x = (k + 0.5) * (lw / 5);
        rect(x - 2, 0, 4, hz, PAL.stoneD);
        rect(x - 3, hz - 3, 6, 3, PAL.stone);
        rect(x - 3, 0, 6, 3, PAL.stone);
        rect(x - 6, hz * 0.2, 4, 1, 'rgba(120,100,200,0.25)');
      }
      for (const fx of [lw * 0.2, lw * 0.5, lw * 0.8]) {
        rect(fx, hz * 0.5, 1, 4, PAL.stoneL);
        rect(fx - 1, hz * 0.5 - 3, 3, 3, '#7a60d0');
      }
      break;
    }
    case 'puerto': {
      rect(0, hz - 6, lw, 6, PAL.water);
      for (let x = 0; x < lw; x += 3) rect(x + hash(x, seed) * 2, hz - 5 + (x % 2) * 2, 2, 1, PAL.waterL);
      for (let k = 0; k < 3; k++) {
        const x = lw * (0.15 + k * 0.3);
        rect(x, hz - 18, 1, 14, PAL.woodD);
        tri(x + 1, hz - 8, 10, 9, '#d8d0b0');
      }
      rect(lw * 0.75, hz - 4, 14, 3, PAL.woodD);
      break;
    }
    case 'interior': {
      for (let x = 0; x < lw; x += 6) rect(x, 0, 1, hz, PAL.black);
      rect(lw * 0.4, hz * 0.2, 10, 12, PAL.black);
      rect(lw * 0.4 + 1, hz * 0.2 + 1, 8, 10, '#f0c060');
      break;
    }
  }
}

/** Motas flotantes del ambiente (se dibujan encima en cada fotograma). */
export function ambientColor(biome: Biome): string {
  switch (biome) {
    case 'cueva': case 'galerias': return 'rgba(255,200,120,0.5)';
    case 'cripta': return 'rgba(160,140,255,0.5)';
    case 'bosque': return 'rgba(200,255,160,0.45)';
    default: return 'rgba(255,255,255,0.4)';
  }
}
