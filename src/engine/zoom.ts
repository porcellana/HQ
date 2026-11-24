/**
 * ZOOM DEL MAPA CONTROLADO POR EL JUGADOR
 * ---------------------------------------
 * El pixel art solo se ve nítido con zoom ENTERO (cada píxel del sprite = N
 * píxeles de pantalla), así que los niveles son enteros calculados a partir
 * del ancho real del canvas: de «muy cerca» (~8 casillas de ancho) a «muy
 * lejos» (~30). Entre niveles el renderizador anima el cambio y fija el
 * entero al terminar.
 *
 * Convención de «paso» (step): 0 = nivel por defecto del dispositivo,
 * +1 = un nivel más cerca, −1 = un nivel más lejos.
 */
export const ZOOM_MIN_TILES = 8;
export const ZOOM_MAX_TILES = 30;
export const ZOOM_DEFAULT_TILES = 12;
/** Máximo de niveles que se ofrecen (si caben más enteros se reparten). */
export const ZOOM_MAX_LEVELS = 7;

/** Zoom entero por defecto: ~12 casillas de ancho. */
export function defaultZoom(across: number, tile = 16): number {
  return Math.max(1, Math.round(across / (tile * ZOOM_DEFAULT_TILES)));
}

/**
 * Niveles de zoom posibles, ordenados de más cerca (zoom grande) a más lejos.
 * Siempre incluye el nivel por defecto. En pantallas pequeñas puede haber
 * menos de 5 niveles porque no existen más enteros útiles.
 */
export function zoomLevels(across: number, tile = 16): number[] {
  const def = defaultZoom(across, tile);
  const lo = Math.max(1, Math.ceil(across / (tile * ZOOM_MAX_TILES)));
  const hi = Math.max(def, Math.floor(across / (tile * ZOOM_MIN_TILES)));
  const all: number[] = [];
  for (let z = hi; z >= Math.min(lo, def); z--) all.push(z);
  if (all.length <= ZOOM_MAX_LEVELS) return all;
  // Demasiados enteros (pantallas muy densas): se reparten uniformemente conservando extremos y defecto.
  const picked = new Set<number>();
  for (let i = 0; i < ZOOM_MAX_LEVELS; i++) picked.add(all[Math.round((i * (all.length - 1)) / (ZOOM_MAX_LEVELS - 1))]!);
  if (!picked.has(def)) {
    // Sustituye el elegido más cercano al defecto (sin tocar los extremos).
    const inner = [...picked].filter((z) => z !== all[0] && z !== all[all.length - 1]);
    const nearest = inner.sort((a, b) => Math.abs(a - def) - Math.abs(b - def))[0];
    if (nearest !== undefined) picked.delete(nearest);
    picked.add(def);
  }
  return [...picked].sort((a, b) => b - a);
}

/** Pasos mínimo (más lejos, ≤ 0) y máximo (más cerca, ≥ 0) disponibles respecto al nivel por defecto. */
export function stepLimits(levels: readonly number[], def: number): { min: number; max: number } {
  const i = Math.max(0, levels.indexOf(def));
  return { min: -(levels.length - 1 - i), max: i };
}

/** Limita un paso al rango disponible. */
export function clampStep(levels: readonly number[], def: number, step: number): number {
  const { min, max } = stepLimits(levels, def);
  return Math.max(min, Math.min(max, Math.round(step)));
}

/** Zoom entero que corresponde a un paso (ya limitado). */
export function zoomForStep(levels: readonly number[], def: number, step: number): number {
  const i = Math.max(0, levels.indexOf(def));
  return levels[Math.max(0, Math.min(levels.length - 1, i - clampStep(levels, def, step)))] ?? def;
}

/** Casillas de ancho visibles con un zoom dado. */
export function tilesAcross(across: number, zoom: number, tile = 16): number {
  return across / (tile * zoom);
}

/**
 * Pellizco con dos dedos: convierte el cambio de distancia entre dedos en
 * PASOS de zoom discretos (no continuo). Al separar los dedos un 30 % se
 * acerca un nivel; al juntarlos un 25 %, se aleja uno. Tras cada paso la
 * distancia de referencia se reinicia, así se puede encadenar varios.
 */
export class PinchSteps {
  static readonly IN = 1.3;
  static readonly OUT = 0.75;
  private base = 0;

  start(dist: number): void {
    this.base = dist;
  }

  /** Devuelve +1 (acercar), −1 (alejar) o 0 según la nueva distancia entre dedos. */
  update(dist: number): -1 | 0 | 1 {
    if (this.base <= 0) {
      this.base = dist;
      return 0;
    }
    const ratio = dist / this.base;
    if (ratio >= PinchSteps.IN) {
      this.base = dist;
      return 1;
    }
    if (ratio <= PinchSteps.OUT) {
      this.base = dist;
      return -1;
    }
    return 0;
  }
}
