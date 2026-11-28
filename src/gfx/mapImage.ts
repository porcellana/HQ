/** Imagen de una zona para los mapas de la interfaz: colores suaves por casilla y relieve simple. */
import type { Zone } from '@/game/world/zone';
import { t3 } from './world3d/terrain';

export const MAP_TILE = 12;
const cache = new WeakMap<Zone, HTMLCanvasElement>();

const TREES = new Set(['tree', 'pine', 'snowPine', 'palm', 'bush', 'deadTree']);

export function zoneImage(zone: Zone): HTMLCanvasElement {
  const hit = cache.get(zone);
  if (hit) return hit;
  const W = zone.width, H = zone.height;
  // 1 píxel por casilla (se amplía con suavizado: transiciones blandas entre terrenos).
  const small = document.createElement('canvas');
  small.width = W;
  small.height = H;
  const sx = small.getContext('2d')!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sp = zone.tileAt(x, y)?.sprite ?? 'grass';
      const d = t3(sp);
      sx.fillStyle = d.c === 'ground' && d.obj && TREES.has(sp) ? t3('grass').col : d.col;
      sx.fillRect(x, y, 1, 1);
    }
  const c = document.createElement('canvas');
  c.width = W * MAP_TILE;
  c.height = H * MAP_TILE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, c.width, c.height);
  const T = MAP_TILE;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sp = zone.tileAt(x, y)?.sprite ?? 'grass';
      const d = t3(sp);
      if (d.c === 'wall' || d.c === 'roof') {
        ctx.fillStyle = d.col;
        ctx.beginPath();
        ctx.roundRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x * T + 2, y * T + 2, T - 4, 2);
      } else if (d.c === 'mount') {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.34, 0, Math.PI * 2);
        ctx.fill();
      } else if (TREES.has(sp)) {
        const g = ctx.createRadialGradient(x * T + T * 0.45, y * T + T * 0.4, 1, x * T + T / 2, y * T + T / 2, T * 0.55);
        g.addColorStop(0, sp === 'snowPine' ? '#dfe9f6' : '#6fb85a');
        g.addColorStop(1, sp === 'snowPine' ? '#7fa0b8' : '#2f6a3a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.obj && d.obj !== 'flowers') {
        ctx.fillStyle = 'rgba(40,30,20,0.55)';
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  cache.set(zone, c);
  return c;
}
