/**
 * A* sobre una rejilla de casillas, 8 direcciones sin "cortar esquinas"
 * (no se puede pasar en diagonal entre dos muros).
 */
export interface Point {
  x: number;
  y: number;
}

export type WalkableFn = (x: number, y: number) => boolean;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Distancia octile (coste 1 recto, ~1.41 diagonal). */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/** Cola de prioridad binaria mínima muy simple. */
class MinHeap {
  private items: { key: number; f: number }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(key: number, f: number): void {
    const a = this.items;
    a.push({ key, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top.key;
  }
}

/**
 * Devuelve la ruta desde `start` (excluido) hasta `goal` (incluido), o null.
 * Si `allowGoalBlocked` es true, el destino puede ser no transitable
 * (útil para acercarse a un PNJ, cofre o enemigo): la ruta termina al lado.
 */
export function findPath(
  width: number,
  height: number,
  start: Point,
  goal: Point,
  walkable: WalkableFn,
  opts: { allowGoalBlocked?: boolean; maxNodes?: number } = {},
): Point[] | null {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  if (!inside(goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];
  const goalBlocked = !walkable(goal.x, goal.y);
  if (goalBlocked && !opts.allowGoalBlocked) return null;

  const maxNodes = opts.maxNodes ?? width * height;
  const idx = (x: number, y: number) => y * width + x;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  const s = idx(start.x, start.y);
  const goalKey = idx(goal.x, goal.y);
  g.set(s, 0);
  open.push(s, heuristic(start.x, start.y, goal.x, goal.y));
  let expanded = 0;

  while (open.size > 0) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % width;
    const cy = (cur - cx) / width;

    // Llegada: al destino, o adyacente si el destino está bloqueado.
    const adjacentToGoal = Math.max(Math.abs(cx - goal.x), Math.abs(cy - goal.y)) === 1;
    if (cur === goalKey || (goalBlocked && adjacentToGoal)) {
      const path: Point[] = [];
      let k: number | undefined = cur;
      while (k !== undefined && k !== s) {
        const x = k % width;
        path.push({ x, y: (k - x) / width });
        k = came.get(k);
      }
      return path.reverse();
    }
    if (++expanded > maxNodes) break;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(nx, ny) || !walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const nk = idx(nx, ny);
      if (closed.has(nk)) continue;
      const ng = (g.get(cur) ?? 0) + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur);
        open.push(nk, ng + heuristic(nx, ny, goal.x, goal.y));
      }
    }
  }
  return null;
}
