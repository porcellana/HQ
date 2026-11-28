/** Constantes y utilidades de la vista del mapa (puras). */

/** Radio de visión del jugador (casillas) para ver enemigos. */
export const PLAYER_SIGHT = 10;

export interface RenderOptions {
  grid?: boolean;
  /** Ciclo de día y noche en exteriores. */
  dayNight?: boolean;
  /** Guía hacia la misión (espíritu y runas). */
  questGuide?: boolean;
}

/** Desplazamiento de una embestida según `b` (el motor lo baja de 1,3 a 0). */
export function lungeOffset(b: number): number {
  if (b <= 0) return 0;
  if (b > 1) return -Math.sin(((b - 1) / 0.3) * Math.PI) * 2.2;
  return Math.sin(b * Math.PI) * 4.5;
}

/** Duración de un día completo en turnos. */
export const DAY_LENGTH_TURNS = 600;

/** Oscuridad nocturna 0..1 según el turno (curva suave). */
export function nightAmount(turn: number): number {
  const t = (turn % DAY_LENGTH_TURNS) / DAY_LENGTH_TURNS;
  const c = Math.cos((t - 0.8) * Math.PI * 2);
  return Math.max(0, Math.min(1, (c - 0.2) / 0.8));
}
