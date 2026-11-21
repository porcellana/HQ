/** Cámara 2D en píxeles del mundo (1 tile = 16 px "de mundo"). */
export interface Insets {
  top: number;
  bottom: number;
}

export class Camera {
  /** Esquina superior izquierda visible, en píxeles de mundo. */
  x = 0;
  y = 0;
  /** Tamaño de la vista en píxeles de mundo. */
  viewW = 0;
  viewH = 0;
  /** Zonas tapadas por el HUD (px de mundo): el jugador se centra en el hueco libre. */
  insets: Insets = { top: 0, bottom: 0 };

  /** Centra en (cx, cy) sin salirse de un mundo de worldW x worldH. */
  centerOn(cx: number, cy: number, worldW: number, worldH: number): void {
    const { top, bottom } = this.insets;
    this.x = worldW <= this.viewW ? (worldW - this.viewW) / 2 : clamp(cx - this.viewW / 2, 0, worldW - this.viewW);
    const freeH = this.viewH - top - bottom;
    const targetY = cy - top - freeH / 2;
    this.y =
      worldH <= freeH
        ? (worldH - this.viewH) / 2 - (top - bottom) / 2
        : clamp(targetY, -top, worldH - this.viewH + bottom);
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
