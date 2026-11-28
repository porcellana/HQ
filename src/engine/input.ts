/**
 * Entrada: toques/clics sobre el canvas y teclado (para probar en PC).
 * Distingue un "toque" de un arrastre por distancia y duración. Con DOS
 * dedos es un pellizco de zoom: cancela el toque y la ruta pendientes y no
 * mueve ni ataca al soltar. También rueda del ratón y teclas +/−/0.
 */
import { TwoFingerDoubleTap, TwoFingerTracker, type TwoFingerDelta } from './gestures';

export type Dir = { dx: number; dy: number };

export interface InputHandlers {
  /** Toque en coordenadas de píxel del canvas (ya multiplicadas por devicePixelRatio). */
  onTap(px: number, py: number): void;
  /** Dirección mantenida (teclado); null al soltar. */
  onHeldDir(dir: Dir | null): void;
  /** Teclas de acción sueltas. */
  onKey?(key: string): void;
  /** Cambio de zoom: +1 acercar, −1 alejar, 0 restablecer. */
  onZoom?(dir: -1 | 0 | 1): void;
  /** Han tocado dos dedos: hay que cancelar la ruta y el movimiento en curso. */
  onPinchStart?(): void;
  /** Incremento de un gesto de dos dedos (pellizco, giro, inclinación). */
  onGesture?(d: TwoFingerDelta): void;
  /** Se levantan los dedos tras un gesto de cámara. */
  onGestureEnd?(): void;
  /** Doble toque con dos dedos: recentrar la cámara. */
  onRecenter?(): void;
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: { dx: 0, dy: -1 }, KeyW: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }, KeyS: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 }, KeyA: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 }, KeyD: { dx: 1, dy: 0 },
};

export class Input {
  private down: { x: number; y: number; t: number; id: number } | null = null;
  /** Punteros activos sobre el mapa (para detectar el pellizco). */
  private pointers = new Map<number, { x: number; y: number }>();
  /** Hay (o hubo, hasta soltar todos) un pellizco: ningún toque se interpreta como tap. */
  private pinching = false;
  private readonly tracker = new TwoFingerTracker();
  private readonly dbl = new TwoFingerDoubleTap();
  private gestureT0 = 0;
  private keys = new Set<string>();
  private readonly cleanups: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, private readonly h: InputHandlers) {
    const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener, { passive: false });
      this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };

    const now = () => performance.now() / 1000;
    const two = (): [{ x: number; y: number }, { x: number; y: number }] | null => {
      const [a, b] = [...this.pointers.values()];
      return a && b ? [a, b] : null;
    };
    listen(canvas, 'pointerdown', (e) => {
      e.preventDefault();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        // Segundo dedo: pellizco. Se anula cualquier toque en curso.
        if (!this.pinching) this.h.onPinchStart?.();
        this.pinching = true;
        this.down = null;
        const t = two();
        if (t) this.tracker.start(t[0], t[1], now());
        if (this.pointers.size === 2) this.gestureT0 = now();
        return;
      }
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    listen(canvas, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      const t = two();
      if (this.pinching && t) {
        const d = this.tracker.update(t[0], t[1], now());
        if (d) this.h.onGesture?.(d);
      }
    });
    listen(canvas, 'wheel', (e) => {
      e.preventDefault();
      if (e.deltaY !== 0) this.h.onZoom?.(e.deltaY < 0 ? 1 : -1);
    });
    listen(canvas, 'pointerup', (e) => {
      const hadTwo = this.pointers.size >= 2;
      this.pointers.delete(e.pointerId);
      const wasPinching = this.pinching;
      if (wasPinching && hadTwo) {
        this.h.onGestureEnd?.();
        if (this.dbl.end(this.gestureT0, now(), this.tracker.moved)) this.h.onRecenter?.();
        const t = two();
        if (t) this.tracker.start(t[0], t[1], now());
      }
      if (this.pointers.size === 0) this.pinching = false;
      if (wasPinching) {
        this.down = null;
        return;
      }
      const d = this.down;
      this.down = null;
      if (!d || d.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > 24 || performance.now() - d.t > 700) return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      this.h.onTap((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    });
    listen(canvas, 'pointercancel', (e) => {
      if (this.pinching && this.pointers.size >= 2) this.h.onGestureEnd?.();
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.pinching = false;
      this.down = null;
    });
    listen(canvas, 'contextmenu', (e) => e.preventDefault());

    listen(window, 'keydown', (e) => {
      if (e.repeat) return;
      // Zoom del mapa en PC: + / − y 0 para restablecer.
      if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+') {
        this.h.onZoom?.(1);
        e.preventDefault();
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-') {
        this.h.onZoom?.(-1);
        e.preventDefault();
        return;
      }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        this.h.onZoom?.(0);
        e.preventDefault();
        return;
      }
      if (KEY_DIRS[e.code]) {
        this.keys.add(e.code);
        this.emitHeld();
        e.preventDefault();
      } else this.h.onKey?.(e.code);
    });
    listen(window, 'keyup', (e) => {
      if (this.keys.delete(e.code)) this.emitHeld();
    });
    listen(window, 'blur', () => {
      this.keys.clear();
      this.emitHeld();
    });
  }

  private emitHeld(): void {
    let dx = 0;
    let dy = 0;
    for (const k of this.keys) {
      const d = KEY_DIRS[k];
      if (d) {
        dx += d.dx;
        dy += d.dy;
      }
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    this.h.onHeldDir(dx === 0 && dy === 0 ? null : { dx, dy });
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
  }
}
