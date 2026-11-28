/**
 * Gestos de cámara con dos dedos (lógica pura, sin DOM):
 * pellizco = zoom continuo, torcer = girar, arrastrar arriba/abajo = inclinar.
 * Cada componente solo se «desbloquea» tras un pequeño recorrido acumulado para que
 * un pellizco no gire sin querer (y viceversa); una vez desbloqueado sigue 1:1.
 */
export interface Pt { x: number; y: number }

export interface TwoFingerDelta {
  /** Cambio del zoom en octavas (log2 de la razón de distancias); >0 = dedos separándose. */
  zoom: number;
  /** Giro de la línea entre los dedos en radianes; >0 = sentido horario en pantalla. */
  twist: number;
  /** Desplazamiento del punto medio en px CSS. */
  dx: number;
  dy: number;
  /** Segundos desde la muestra anterior. */
  dt: number;
}

const UNLOCK = { zoom: 0.05, twist: 0.07, pan: 10 };

const wrap = (a: number): number => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);

export class TwoFingerTracker {
  private a: Pt = { x: 0, y: 0 };
  private b: Pt = { x: 0, y: 0 };
  private t = 0;
  private acc = { zoom: 0, twist: 0, pan: 0 };
  private open = { zoom: false, twist: false, pan: false };
  /** Recorrido total (para distinguir un toque con dos dedos de un gesto). */
  moved = 0;

  start(a: Pt, b: Pt, now = 0): void {
    this.a = { ...a };
    this.b = { ...b };
    this.t = now;
    this.acc = { zoom: 0, twist: 0, pan: 0 };
    this.open = { zoom: false, twist: false, pan: false };
    this.moved = 0;
  }

  update(a: Pt, b: Pt, now = 0): TwoFingerDelta | null {
    const d0 = Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y);
    const d1 = Math.hypot(b.x - a.x, b.y - a.y);
    if (d0 < 4 || d1 < 4) return null;
    const zoomRaw = Math.log2(d1 / d0);
    const twistRaw = wrap(Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x));
    const dx = (a.x + b.x) / 2 - (this.a.x + this.b.x) / 2;
    const dy = (a.y + b.y) / 2 - (this.a.y + this.b.y) / 2;
    const dt = Math.max(0.001, Math.min(0.2, now - this.t));
    this.a = { ...a };
    this.b = { ...b };
    this.t = now;
    this.moved += Math.hypot(dx, dy) + Math.abs(d1 - d0);
    this.acc.zoom += Math.abs(zoomRaw);
    this.acc.twist += Math.abs(twistRaw);
    // Con el punto medio se mide el recorrido en vertical (inclinación).
    this.acc.pan += Math.abs(dy);
    for (const k of ['zoom', 'twist', 'pan'] as const) if (!this.open[k] && this.acc[k] > UNLOCK[k]) this.open[k] = true;
    return {
      zoom: this.open.zoom ? zoomRaw : 0,
      twist: this.open.twist ? twistRaw : 0,
      dx: 0,
      dy: this.open.pan ? dy : 0,
      dt,
    };
  }
}

export const PITCH_MIN = 0.5;
export const PITCH_MAX = 1.32;
/** Pasos de zoom por octava de pellizco (separar los dedos al doble = 2 pasos más cerca). */
export const ZOOM_PER_OCTAVE = 2;
export const ZOOM_STEP_MIN = -2;
export const ZOOM_STEP_MAX = 2;

export type CameraSens = 'baja' | 'media' | 'alta';
export const SENS_FACTOR: Record<CameraSens, number> = { baja: 0.6, media: 1, alta: 1.6 };

export interface CamState { yaw: number; pitch: number; zoom: number }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Aplica un incremento de gesto a la cámara. El mundo gira siguiendo los dedos (giro horario = yaw+). */
export function applyTwoFinger(cam: CamState, d: TwoFingerDelta, o: { sens: number; invert: boolean }): CamState {
  return {
    yaw: cam.yaw + d.twist * o.sens * (o.invert ? -1 : 1),
    // Arrastrar hacia arriba tumba la cámara (más horizonte); hacia abajo la levanta.
    pitch: clamp(cam.pitch + d.dy * 0.006 * o.sens, PITCH_MIN, PITCH_MAX),
    zoom: clamp(cam.zoom + d.zoom * ZOOM_PER_OCTAVE, ZOOM_STEP_MIN, ZOOM_STEP_MAX),
  };
}

/** Velocidad de giro para la inercia al soltar (rad/s, suavizada). */
export class Momentum {
  v = 0;
  private last = -1;
  sample(delta: number, dt: number, now: number): void {
    if (dt <= 0) return;
    this.v = this.v * 0.55 + (delta / dt) * 0.45;
    this.last = now;
  }
  /** Devuelve la velocidad inicial de la inercia (0 si el gesto llevaba parado un rato). */
  release(now: number): number {
    const fresh = this.last >= 0 && now - this.last < 0.12;
    const r = fresh ? clamp(this.v, -5, 5) : 0;
    this.v = 0;
    this.last = -1;
    return Math.abs(r) < 0.25 ? 0 : r;
  }
}

/** Frena la inercia (exponencial). */
export function decayVelocity(v: number, dt: number): number {
  const r = v * Math.exp(-dt * 4.2);
  return Math.abs(r) < 0.02 ? 0 : r;
}

/** Doble toque con dos dedos (recentrar la cámara). */
export class TwoFingerDoubleTap {
  private lastTap = -10;
  /** Llamar al terminar un gesto de dos dedos. Devuelve true en el segundo toque seguido. */
  end(startedAt: number, now: number, moved: number): boolean {
    const isTap = now - startedAt < 0.3 && moved < 14;
    if (!isTap) {
      this.lastTap = -10;
      return false;
    }
    const dbl = now - this.lastTap < 0.5;
    this.lastTap = dbl ? -10 : now;
    return dbl;
  }
}
