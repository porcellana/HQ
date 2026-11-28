/** Utilidades de rejilla para construir los mapas ASCII de las zonas generadas. */
import { TILES, TILE_BY_CHAR } from '@/data/registry';
import type { Point } from '@/engine/pathfinding';
import type { Rng } from '@/engine/rng';
import { EXIT_RE } from '../zone';
import { DELTA, DIR_DIGIT, type Dir } from './plan';

export const tch = (id: string): string => {
  const t = TILES.get(id);
  if (!t) throw new Error(`[mundo] tile desconocido: ${id}`);
  return t.char;
};
export const isWalk = (c: string): boolean => EXIT_RE.test(c) || (TILE_BY_CHAR.get(c)?.walkable ?? false);

export class Grid {
  private readonly c: string[];
  constructor(readonly w: number, readonly h: number, fill: string) {
    this.c = new Array<string>(w * h).fill(fill);
  }
  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): string {
    return this.inb(x, y) ? this.c[y * this.w + x]! : '#';
  }
  set(x: number, y: number, ch: string): void {
    if (this.inb(x, y)) this.c[y * this.w + x] = ch;
  }
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.c.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
  k(x: number, y: number): number {
    return y * this.w + x;
  }
}

/** Casillas de salida de un borde (2 de ancho, como las zonas fijas) y la casilla interior contigua. */
export function exitCells(dir: Dir, w: number, h: number): { cells: Point[]; inner: Point } {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  switch (dir) {
    case 'N': return { cells: [{ x: mx - 1, y: 0 }, { x: mx, y: 0 }], inner: { x: mx, y: 1 } };
    case 'S': return { cells: [{ x: mx - 1, y: h - 1 }, { x: mx, y: h - 1 }], inner: { x: mx, y: h - 2 } };
    case 'W': return { cells: [{ x: 0, y: my - 1 }, { x: 0, y: my }], inner: { x: 1, y: my } };
    case 'E': return { cells: [{ x: w - 1, y: my - 1 }, { x: w - 1, y: my }], inner: { x: w - 2, y: my } };
  }
}

/** Distancias a pie (4 direcciones) desde `from`. */
export function reach(g: Grid, from: Point, blocked: ReadonlySet<number> = new Set()): Set<number> {
  const seen = new Set<number>([g.k(from.x, from.y)]);
  const q: Point[] = [from];
  while (q.length) {
    const p = q.pop()!;
    for (const d of Object.values(DELTA)) {
      const x = p.x + d.dx;
      const y = p.y + d.dy;
      if (!g.inb(x, y) || seen.has(g.k(x, y)) || blocked.has(g.k(x, y)) || !isWalk(g.get(x, y))) continue;
      seen.add(g.k(x, y));
      q.push({ x, y });
    }
  }
  return seen;
}

/**
 * Abre un camino de `from` a `to` (en L, o BFS rodeando `avoid`), convirtiendo en `tile`
 * lo que no se pueda pisar. Devuelve las casillas del camino.
 */
export function carve(g: Grid, from: Point, to: Point, avoid: ReadonlySet<number>, tile: string, rng: Rng): Point[] {
  const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < g.w - 1 && y < g.h - 1;
  const lpath = (horizFirst: boolean): Point[] | null => {
    const out: Point[] = [];
    let { x, y } = from;
    const step = (axis: 'x' | 'y') => {
      while ((axis === 'x' ? x : y) !== (axis === 'x' ? to.x : to.y)) {
        if (axis === 'x') x += Math.sign(to.x - x);
        else y += Math.sign(to.y - y);
        out.push({ x, y });
      }
    };
    out.push({ x, y });
    if (horizFirst) { step('x'); step('y'); } else { step('y'); step('x'); }
    return out.every((p) => !avoid.has(g.k(p.x, p.y)) && g.inb(p.x, p.y)) ? out : null;
  };
  let path = lpath(rng.chance(0.5)) ?? lpath(false) ?? lpath(true);
  if (!path) {
    // BFS rodeando lo protegido.
    const prev = new Map<number, number>();
    const q: Point[] = [from];
    prev.set(g.k(from.x, from.y), -1);
    let found = false;
    while (q.length && !found) {
      const p = q.shift()!;
      for (const d of Object.values(DELTA)) {
        const x = p.x + d.dx;
        const y = p.y + d.dy;
        const k = g.k(x, y);
        if (!inside(x, y) || prev.has(k) || avoid.has(k)) continue;
        prev.set(k, g.k(p.x, p.y));
        if (x === to.x && y === to.y) { found = true; break; }
        q.push({ x, y });
      }
    }
    path = [];
    if (found) {
      for (let k = g.k(to.x, to.y); k !== -1; k = prev.get(k)!) path.unshift({ x: k % g.w, y: Math.floor(k / g.w) });
    }
  }
  for (const p of path) {
    const c = g.get(p.x, p.y);
    if (!EXIT_RE.test(c) && inside(p.x, p.y)) g.set(p.x, p.y, tile);
  }
  return path;
}

export const digitFor = (dir: Dir): string => DIR_DIGIT[dir];
