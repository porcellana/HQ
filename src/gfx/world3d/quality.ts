/** Calidad gráfica 3D: resolución, distancia de dibujado, densidad de decorado y partículas. Puro. */
export type Quality = 'baja' | 'media' | 'alta';
export interface QualityCfg {
  /** Fracción de la resolución nativa (devicePixelRatio ya limitado). */
  scale: number;
  /** Radio de dibujado en casillas. */
  radius: number;
  /** Densidad del decorado menor (hierba, flores...). */
  density: number;
  particles: number;
  lights: number;
  /** Mapa de sombras con PCF (sólo calidad alta). */
  shadows: boolean;
  /** Resolución del mapa de sombras. */
  shadowRes: number;
  /** Se permite el bloom a pantalla completa. */
  bloom: boolean;
  /** Distancia máxima del decorado diminuto y de los objetos medianos (casillas). */
  decorDist: number;
  instDist: number;
}
export const QUALITY: Record<Quality, QualityCfg> = {
  baja: { scale: 0.7, radius: 16, density: 0.3, particles: 40, lights: 4, shadows: false, shadowRes: 0, bloom: false, decorDist: 7, instDist: 12 },
  media: { scale: 0.9, radius: 22, density: 0.7, particles: 90, lights: 7, shadows: false, shadowRes: 0, bloom: false, decorDist: 11, instDist: 18 },
  alta: { scale: 1, radius: 30, density: 1, particles: 180, lights: 10, shadows: true, shadowRes: 1536, bloom: true, decorDist: 16, instDist: 26 },
};
const ORDER: Quality[] = ['baja', 'media', 'alta'];
export const raiseQuality = (q: Quality): Quality => ORDER[Math.min(2, ORDER.indexOf(q) + 1)]!;
export const qualityRank = (q: Quality): number => ORDER.indexOf(q);
export const lowerQuality = (q: Quality): Quality => (q === 'alta' ? 'media' : 'baja');

/** Detector de caída de fps: avisa cuando el promedio baja de `minFps` durante `window` fotogramas. */
export class FpsGuard {
  private n = 0;
  private sum = 0;
  constructor(private readonly minFps = 34, private readonly window = 120, private readonly warmup = 90) {}
  private seen = 0;
  /** true si hay que bajar la calidad. */
  push(dt: number): boolean {
    if (dt <= 0 || dt > 0.5) return false; // pausas y saltos no cuentan
    if (this.seen++ < this.warmup) return false;
    this.sum += dt;
    if (++this.n < this.window) return false;
    const fps = this.n / this.sum;
    this.n = 0;
    this.sum = 0;
    return fps < this.minFps;
  }
  reset(): void {
    this.n = 0;
    this.sum = 0;
    this.seen = 0;
  }
}

export interface AdaptStep {
  /** Nuevo nivel de calidad (si cambia). */
  level?: Quality;
  /** Nuevo multiplicador de resolución (si cambia). */
  scaleMul?: number;
}

/**
 * Calidad adaptativa con histéresis. Mide los fps por ventanas: si bajan, reduce primero la
 * resolución dinámica y luego el nivel; si se mantienen altos durante varias ventanas, los
 * recupera, sin pasar nunca del nivel que eligió el jugador. Cada bajada tras una subida
 * reciente endurece la espera para volver a subir (evita oscilar).
 */
export class AdaptiveQuality {
  level: Quality;
  scaleMul = 1;
  private max: Quality;
  private n = 0;
  private sum = 0;
  private seen = 0;
  private low = 0;
  private high = 0;
  private backoff = 0;
  private sinceRaise = 99;
  constructor(level: Quality, readonly opts = { window: 90, warmup: 90, lowFps: 44, highFps: 57, minScale: 0.75, step: 0.125, raiseWindows: 4 }) {
    this.level = level;
    this.max = level;
  }
  /** El jugador elige un nivel: es el máximo al que se puede volver. */
  setUser(q: Quality): void {
    this.max = q;
    this.level = q;
    this.scaleMul = 1;
    this.reset();
  }
  reset(): void {
    this.n = 0;
    this.sum = 0;
    this.seen = 0;
    this.low = 0;
    this.high = 0;
  }
  /** Fps medios de la ventana en curso (0 si aún no hay). */
  push(dt: number): AdaptStep | null {
    if (dt <= 0 || dt > 0.5) return null;
    if (this.seen++ < this.opts.warmup) return null;
    this.sum += dt;
    if (++this.n < this.opts.window) return null;
    const fps = this.n / this.sum;
    this.n = 0;
    this.sum = 0;
    this.sinceRaise++;
    const o = this.opts;
    if (fps < o.lowFps) {
      this.high = 0;
      if (++this.low >= 2 || fps < 30) {
        this.low = 0;
        if (this.sinceRaise <= 3) this.backoff = Math.min(3, this.backoff + 1);
        if (this.scaleMul > o.minScale + 1e-6) {
          this.scaleMul = Math.max(o.minScale, this.scaleMul - o.step);
          this.seen = o.warmup / 2;
          return { scaleMul: this.scaleMul };
        }
        if (this.level !== 'baja') {
          this.level = lowerQuality(this.level);
          this.scaleMul = 1;
          this.seen = o.warmup / 2;
          return { level: this.level, scaleMul: 1 };
        }
      }
      return null;
    }
    this.low = 0;
    if (fps >= o.highFps) {
      if (++this.high >= o.raiseWindows * 2 ** this.backoff) {
        this.high = 0;
        if (this.scaleMul < 1 - 1e-6) {
          this.scaleMul = Math.min(1, this.scaleMul + o.step);
          return { scaleMul: this.scaleMul };
        }
        if (qualityRank(this.level) < qualityRank(this.max)) {
          this.level = raiseQuality(this.level);
          this.sinceRaise = 0;
          this.seen = o.warmup / 2;
          return { level: this.level };
        }
      }
    } else this.high = 0;
    return null;
  }
}

/** Distancias de cámara por nivel de zoom (paso 0 = índice central). */
export const CAM_DISTANCES = [11, 15, 20, 27, 36];
export function camDistance(step: number): number {
  const i = Math.max(0, Math.min(CAM_DISTANCES.length - 1, 2 - step));
  return CAM_DISTANCES[i]!;
}

/** Convierte una dirección de pantalla (8 vías) a la del mundo según el giro de la cámara. */
export function remapDir(d: { dx: number; dy: number }, yaw: number): { dx: number; dy: number } {
  const wx = Math.cos(yaw) * d.dx + Math.sin(yaw) * d.dy;
  const wz = -Math.sin(yaw) * d.dx + Math.cos(yaw) * d.dy;
  const a = Math.atan2(wz, wx);
  const s = Math.round(a / (Math.PI / 4));
  const dirs: Array<[number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const r = dirs[(s + 8) % 8]!;
  return { dx: r[0], dy: r[1] };
}
