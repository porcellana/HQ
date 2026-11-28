/**
 * SEÑALIZACIÓN DIEGÉTICA: cristales y runas flotantes en el propio mundo (nada de flechas ni
 * etiquetas planas). Color según el tipo: misión, entrega, tienda, peligro, destino y salida.
 * Todo puro (modelos y cálculos) salvo el dibujo, que hace el renderizador.
 */
import type { NpcDef } from '@/data/schema';
import type { Point } from '@/engine/pathfinding';
import { MeshBuilder, STRIDE, hexRgb } from './mesh';
import { torus } from './models';

export type SignalKind = 'quest' | 'turnin' | 'shop' | 'danger' | 'goal' | 'exit' | 'chest' | 'ore';

export const SIGNAL_COLOR: Record<SignalKind, string> = {
  quest: '#ffd35a', turnin: '#7cf0a4', shop: '#6cc8ff', danger: '#ff6b5e', goal: '#b49cff', exit: '#bfe9ff', chest: '#ffe28a', ore: '#9ff0ff',
};

const hasShopCache = new WeakMap<NpcDef, boolean>();
/** ¿Este PNJ vende cosas? (algún nodo de su diálogo abre una tienda). */
export function npcHasShop(n: NpcDef): boolean {
  let r = hasShopCache.get(n);
  if (r === undefined) {
    r = JSON.stringify(n.dialog).includes('"type":"shop"');
    hasShopCache.set(n, r);
  }
  return r;
}

/** Señal que corresponde a un PNJ: misión nueva, entrega, tienda o ninguna. */
export function npcSignal(marker: '!' | '?' | null, shop: boolean): SignalKind | null {
  if (marker === '!') return 'quest';
  if (marker === '?') return 'turnin';
  return shop ? 'shop' : null;
}

const EMIS = 2;
const emis = (a: Float32Array): Float32Array => {
  for (let i = 9; i < a.length; i += STRIDE) a[i] = EMIS;
  return a;
};

/** Gema suave de doble punta (misión, entrega, destino) o moneda facetada redondeada (tienda). */
export function gemModel(kind: SignalKind): Float32Array {
  const m = new MeshBuilder();
  const col = hexRgb(SIGNAL_COLOR[kind]);
  if (kind === 'shop') {
    m.lathe(0, 0, [[0, -0.05], [0.12, -0.045], [0.16, 0], [0.12, 0.045], [0, 0.05]], col, { seg: 14, lo: 0.95, hi: 1.12 });
    m.rotate(0, Math.PI / 2, 0, 0, 0, 0, 0, 0.2, 0);
  } else if (kind === 'danger') {
    m.lathe(0, 0, [[0, 0], [0.09, 0.05], [0.14, 0.17], [0.1, 0.3], [0.03, 0.4], [0, 0.44]], col, { seg: 6, lo: 0.9, hi: 1.2 });
  } else {
    m.lathe(0, 0, [[0, 0], [0.07, 0.07], [0.125, 0.18], [0.12, 0.26], [0.06, 0.38], [0, 0.46]], col, { seg: 8, lo: 0.92, hi: 1.2 });
  }
  return emis(m.toArray());
}

/** Círculo de runas plano en el suelo: dos anillos y seis nodos redondeados. */
export function runeRingModel(kind: SignalKind): Float32Array {
  const m = new MeshBuilder();
  const col = hexRgb(SIGNAL_COLOR[kind]);
  torus(m, 0, 0.035, 0, 0.5, 0.014, col, 28);
  torus(m, 0, 0.035, 0, 0.38, 0.008, col, 24);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.ball(Math.cos(a) * 0.44, 0.04, Math.sin(a) * 0.44, 0.04, 0.025, 0.04, col, { seg: 6, ring: 4, lo: 1, hi: 1.1 });
  }
  return emis(m.toArray());
}

/** Posiciones a lo largo de un camino de casillas: `n` puntos desde `ahead` casillas por delante. */
export function pathAhead(path: readonly Point[], start: Point, ahead: number, n: number, step = 0.8): Array<{ x: number; z: number; k: number }> {
  if (path.length === 0) return [];
  // Punto del camino más cercano al jugador.
  let bi = 0, bd = Infinity;
  path.forEach((p, i) => {
    const d = Math.hypot(p.x - start.x, p.y - start.y);
    if (d < bd - 1e-6) { bd = d; bi = i; }
  });
  const out: Array<{ x: number; z: number; k: number }> = [];
  let dist = ahead;
  for (let i = 0; i < n; i++) {
    const idx = Math.min(path.length - 1, bi + Math.round(dist));
    const p = path[idx]!;
    out.push({ x: p.x + 0.5, z: p.y + 0.5, k: i / Math.max(1, n - 1) });
    dist += step * 2;
  }
  return out;
}

/** Parpadeo/flotación de un cristal (altura relativa y giro) en el instante t. */
export function crystalMotion(t: number, phase = 0): { y: number; yaw: number; glow: number } {
  return { y: Math.sin(t * 2 + phase) * 0.06, yaw: t * 1.4 + phase, glow: 0.75 + 0.25 * Math.sin(t * 3.1 + phase) };
}
