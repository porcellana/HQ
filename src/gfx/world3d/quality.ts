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
  aa: boolean;
  lights: number;
}
export const QUALITY: Record<Quality, QualityCfg> = {
  baja: { scale: 0.6, radius: 16, density: 0.3, particles: 40, aa: false, lights: 4 },
  media: { scale: 0.85, radius: 22, density: 0.7, particles: 90, aa: false, lights: 7 },
  alta: { scale: 1, radius: 30, density: 1, particles: 180, aa: true, lights: 10 },
};
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
