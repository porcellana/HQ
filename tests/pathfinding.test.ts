import { describe, expect, it } from 'vitest';
import { findPath } from '@/engine/pathfinding';

const grid = (rows: string[]) => ({
  w: rows[0]!.length,
  h: rows.length,
  ok: (x: number, y: number) => rows[y]?.[x] === '.',
});

describe('A*', () => {
  it('encuentra el camino rodeando muros', () => {
    const g = grid(['.....', '.###.', '...#.', '.#...']);
    const path = findPath(g.w, g.h, { x: 0, y: 0 }, { x: 2, y: 2 }, g.ok)!;
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
    for (const p of path) expect(g.ok(p.x, p.y)).toBe(true);
  });

  it('no corta esquinas en diagonal', () => {
    const g = grid(['.#', '#.']);
    expect(findPath(g.w, g.h, { x: 0, y: 0 }, { x: 1, y: 1 }, g.ok)).toBeNull();
  });

  it('con destino bloqueado se queda al lado si se permite', () => {
    const g = grid(['....', '..#.', '....']);
    const path = findPath(g.w, g.h, { x: 0, y: 1 }, { x: 2, y: 1 }, g.ok, { allowGoalBlocked: true })!;
    const end = path[path.length - 1]!;
    expect(Math.max(Math.abs(end.x - 2), Math.abs(end.y - 1))).toBe(1);
    expect(findPath(g.w, g.h, { x: 0, y: 1 }, { x: 2, y: 1 }, g.ok)).toBeNull();
  });
});
