/**
 * Animación de movimiento por casillas: cuando una unidad recorre varias
 * casillas en un turno, su posición lógica cambia al instante pero la visual
 * (rx, ry) avanza casilla a casilla siguiendo el `trail`.
 */
import type { Point } from '@/engine/pathfinding';

export interface Walker {
  x: number;
  y: number;
  rx: number;
  ry: number;
  trail?: Point[];
}

/** Casillas por segundo al animar un recorrido. */
const WALK_SPEED = 7;

/** Apunta un paso para animarlo. */
export function pushStep(w: Walker, p: Point): void {
  (w.trail ??= []).push({ x: p.x, y: p.y });
}

/** Avanza la posición visual. */
export function advanceWalker(w: Walker, dt: number): void {
  let budget = WALK_SPEED * dt;
  while (w.trail && w.trail.length && budget > 0) {
    const t = w.trail[0]!;
    const dx = t.x - w.rx;
    const dy = t.y - w.ry;
    const d = Math.hypot(dx, dy);
    if (d <= budget) {
      w.rx = t.x;
      w.ry = t.y;
      w.trail.shift();
      budget -= d;
    } else {
      w.rx += (dx / d) * budget;
      w.ry += (dy / d) * budget;
      budget = 0;
    }
  }
  if (!w.trail?.length) {
    const k = Math.min(1, dt * 14);
    w.rx += (w.x - w.rx) * k;
    w.ry += (w.y - w.ry) * k;
  }
}
