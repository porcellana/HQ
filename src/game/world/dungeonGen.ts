/**
 * GENERADOR DE PISOS DE MAZMORRA (puro y determinista)
 * ----------------------------------------------------
 * Con la misma semilla produce siempre el mismo piso. Algoritmo:
 *   1. Salas rectangulares colocadas al azar sin solaparse.
 *   2. Cada sala se une a la anterior con un pasillo en L (todas conectadas)
 *      y se añaden un par de pasillos extra para que haya rutas alternativas.
 *   3. Escaleras de subida ('1') en la primera sala y de bajada ('2') en la
 *      sala más lejana a pie.
 *   4. Cofres y vetas de mineral en esquinas de salas (sin cortar el paso:
 *      se comprueba la conectividad tras cada uno) y trampas dentro de salas.
 * Devuelve un mapa ASCII ('#' muro, '.' suelo, '1'/'2' escaleras) que el motor
 * convierte en una Zone normal.
 */
import type { Rng } from '@/engine/rng';
import type { Point } from '@/engine/pathfinding';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GenOptions {
  width: number;
  height: number;
  rooms: [number, number];
  chests: [number, number];
  traps: [number, number];
  ores: [number, number];
  /** ¿Hay escaleras de bajada? (siempre sí: el último piso baja a la sala del jefe). */
  down: boolean;
}

export interface GenResult {
  map: string[];
  rooms: Room[];
  up: Point;
  down: Point | null;
  chests: Point[];
  traps: Point[];
  ores: Point[];
}

const center = (r: Room): Point => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

export function generateFloor(rng: Rng, o: GenOptions): GenResult {
  const W = o.width;
  const H = o.height;
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '#'));
  const rooms: Room[] = [];
  const target = rng.int(o.rooms[0], o.rooms[1]);

  // 1. Salas
  for (let attempt = 0; attempt < 400 && rooms.length < target; attempt++) {
    const w = rng.int(4, 8);
    const h = rng.int(4, 7);
    const x = rng.int(1, W - w - 2);
    const y = rng.int(1, H - h - 2);
    const r = { x, y, w, h };
    const overlaps = rooms.some((q) => x - 1 <= q.x + q.w && x + w + 1 >= q.x && y - 1 <= q.y + q.h && y + h + 1 >= q.y);
    if (overlaps) continue;
    rooms.push(r);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy]![xx] = '.';
  }
  if (rooms.length < 2) throw new Error('No se pudieron colocar salas: el piso es demasiado pequeño');

  // 2. Pasillos
  const carve = (a: Point, b: Point) => {
    const horizontalFirst = rng.chance(0.5);
    const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    for (const [p, q] of [[a, corner], [corner, b]] as const) {
      const dx = Math.sign(q.x - p.x);
      const dy = Math.sign(q.y - p.y);
      let x = p.x;
      let y = p.y;
      grid[y]![x] = '.';
      while (x !== q.x || y !== q.y) {
        x += dx;
        y += dy;
        grid[y]![x] = '.';
      }
    }
  };
  for (let i = 1; i < rooms.length; i++) carve(center(rooms[i - 1]!), center(rooms[i]!));
  for (let i = 0; i < 2; i++) carve(center(rng.pick(rooms)), center(rng.pick(rooms)));

  // 3. Escaleras
  const up = center(rooms[0]!);
  const dist = bfs(grid, up, new Set());
  let down: Point | null = null;
  if (o.down) {
    let best = -1;
    for (const r of rooms.slice(1)) {
      const c = center(r);
      const d = dist.get(c.y * W + c.x) ?? -1;
      if (d > best) {
        best = d;
        down = c;
      }
    }
  }
  grid[up.y]![up.x] = '1';
  if (down) grid[down.y]![down.x] = '2';

  // 4. Elementos
  const blocked = new Set<number>();
  const used = new Set<number>([up.y * W + up.x, ...(down ? [down.y * W + down.x] : [])]);
  const walkableCount = () => {
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y]![x] !== '#' && !blocked.has(y * W + x)) n++;
    return n;
  };
  const corners: Point[] = [];
  for (const r of rooms.slice(1)) {
    corners.push({ x: r.x, y: r.y }, { x: r.x + r.w - 1, y: r.y }, { x: r.x, y: r.y + r.h - 1 }, { x: r.x + r.w - 1, y: r.y + r.h - 1 });
  }
  /** Coloca un elemento que bloquea el paso sólo si no deja zonas aisladas. */
  const placeBlocking = (count: number): Point[] => {
    const out: Point[] = [];
    const pool = shuffle(rng, corners.filter((p) => !used.has(p.y * W + p.x)));
    for (const p of pool) {
      if (out.length >= count) break;
      const k = p.y * W + p.x;
      if (used.has(k) || grid[p.y]![p.x] !== '.') continue;
      blocked.add(k);
      const reach = bfs(grid, up, blocked).size;
      if (reach !== walkableCount()) {
        blocked.delete(k);
        continue;
      }
      used.add(k);
      out.push(p);
    }
    return out;
  };
  const chests = placeBlocking(rng.int(o.chests[0], o.chests[1]));
  const ores = placeBlocking(rng.int(o.ores[0], o.ores[1]));

  const traps: Point[] = [];
  const wantTraps = rng.int(o.traps[0], o.traps[1]);
  const trapRooms = rooms.slice(1);
  for (let i = 0; i < 80 && traps.length < wantTraps && trapRooms.length; i++) {
    const r = rng.pick(trapRooms);
    const p = { x: rng.int(r.x + 1, r.x + r.w - 2), y: rng.int(r.y + 1, r.y + r.h - 2) };
    const k = p.y * W + p.x;
    if (used.has(k) || grid[p.y]![p.x] !== '.') continue;
    if (Math.max(Math.abs(p.x - up.x), Math.abs(p.y - up.y)) < 4) continue;
    used.add(k);
    traps.push(p);
  }

  return { map: grid.map((row) => row.join('')), rooms, up, down, chests, traps, ores };
}

/** Distancias a pie desde `from` (4 direcciones), sin pasar por `blocked`. */
export function bfs(grid: string[][] | string[], from: Point, blocked: Set<number>): Map<number, number> {
  const H = grid.length;
  const W = grid[0]!.length;
  const at = (x: number, y: number) => (typeof grid[y] === 'string' ? (grid[y] as string)[x] : (grid[y] as string[])[x]);
  const out = new Map<number, number>();
  const start = from.y * W + from.x;
  out.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift()!;
    const x = k % W;
    const y = (k - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (out.has(nk) || blocked.has(nk) || at(nx, ny) === '#') continue;
      out.set(nk, out.get(k)! + 1);
      queue.push(nk);
    }
  }
  return out;
}

function shuffle<T>(rng: Rng, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
