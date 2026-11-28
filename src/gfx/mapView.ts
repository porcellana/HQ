/** Interfaz común de los renderizadores del mapa (2D clásico y 3D): el motor no sabe cuál se usa. */
import type { Game } from '@/game/game';
import type { Point } from '@/engine/pathfinding';
import type { HumanoidColors } from './sprites';
import type { RenderOptions } from './renderer';

export interface MapView {
  heroColors: HumanoidColors;
  readonly pixelRatio: number;
  readonly zoomStep: number;
  readonly zoomLimits: { min: number; max: number };
  resize(): void;
  setInsets(topPx: number, bottomPx: number): void;
  setZoomStep(step: number): number;
  zoomBy(delta: number): number;
  resetZoom(): number;
  screenToTile(sx: number, sy: number): Point;
  render(game: Game, dt: number, opts: RenderOptions): void;
}
