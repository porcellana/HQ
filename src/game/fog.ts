/**
 * Niebla de exploración (lógica pura, sin DOM): radio de visión, línea de
 * visión sencilla y (de)serialización compacta de las casillas exploradas.
 */
import type { ZoneKind } from '@/data/schema';

/** ¿Esta zona se explora con niebla? (aldeas e interiores se ven enteros, salvo `fog` explícito). */
export function fogApplies(kind: ZoneKind, fogFlag?: boolean): boolean {
  return !!fogFlag || kind === 'wild' || kind === 'dungeon' || kind === 'world';
}

export interface VisionCtx {
  classId: string;
  kind: ZoneKind;
  /** 0 = día, 1 = noche cerrada (solo exteriores). */
  night: number;
  /** Oscuridad de la zona (0..1). */
  darkness: number;
}

/** Radio de visión en casillas: clase, hora del día y antorcha (en cuevas y mazmorras se lleva luz propia). */
export function visionRadius(c: VisionCtx): number {
  const bonus = c.classId === 'explorador' ? 2 : c.classId === 'picaro' ? 1 : 0;
  const enclosed = c.kind === 'dungeon';
  let r = (enclosed ? 6 : 8) + bonus;
  if (!enclosed) r *= 1 - 0.38 * Math.max(0, Math.min(1, c.night));
  r *= 1 - 0.3 * Math.max(0, Math.min(1, c.darkness));
  return Math.max(4, Math.round(r));
}

/** Línea de visión (Bresenham): las casillas intermedias no deben bloquear. */
export function lineClear(x0: number, y0: number, x1: number, y1: number, blocks: (x: number, y: number) => boolean): boolean {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    if ((x !== x0 || y !== y0) && blocks(x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return true;
}

/**
 * Casillas visibles desde (px,py): disco de `radius`; con `blocks` además se exige línea de visión
 * (el muro que bloquea sí se ve, lo que hay detrás no).
 */
export function computeVisible(w: number, h: number, px: number, py: number, radius: number, blocks: ((x: number, y: number) => boolean) | null, out?: Uint8Array): Uint8Array {
  const v = out && out.length === w * h ? out.fill(0) : new Uint8Array(w * h);
  const r2 = (radius + 0.5) * (radius + 0.5);
  for (let y = Math.max(0, py - radius); y <= Math.min(h - 1, py + radius); y++) {
    for (let x = Math.max(0, px - radius); x <= Math.min(w - 1, px + radius); x++) {
      if ((x - px) ** 2 + (y - py) ** 2 > r2) continue;
      if (blocks && !lineClear(px, py, x, y, blocks)) continue;
      v[y * w + x] = 1;
    }
  }
  return v;
}

/** Empaqueta 1 bit por casilla en base64. */
export function encodeExplored(m: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(m.length / 8));
  for (let i = 0; i < m.length; i++) if (m[i]) bytes[i >> 3]! |= 1 << (i & 7);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeExplored(s: string, n: number): Uint8Array {
  const m = new Uint8Array(n);
  try {
    const bin = atob(s);
    for (let i = 0; i < n; i++) m[i] = ((bin.charCodeAt(i >> 3) || 0) >> (i & 7)) & 1;
  } catch {
    /* dato corrupto: zona sin explorar */
  }
  return m;
}
