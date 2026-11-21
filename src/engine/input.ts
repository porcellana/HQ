/**
 * Entrada: toques/clics sobre el canvas y teclado (para probar en PC).
 * Distingue un "toque" de un arrastre por distancia y duración.
 */
export type Dir = { dx: number; dy: number };

export interface InputHandlers {
  /** Toque en coordenadas de píxel del canvas (ya multiplicadas por devicePixelRatio). */
  onTap(px: number, py: number): void;
  /** Dirección mantenida (teclado); null al soltar. */
  onHeldDir(dir: Dir | null): void;
  /** Teclas de acción sueltas. */
  onKey?(key: string): void;
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: { dx: 0, dy: -1 }, KeyW: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }, KeyS: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 }, KeyA: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 }, KeyD: { dx: 1, dy: 0 },
};

export class Input {
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private keys = new Set<string>();
  private readonly cleanups: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, private readonly h: InputHandlers) {
    const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener, { passive: false });
      this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };

    listen(canvas, 'pointerdown', (e) => {
      e.preventDefault();
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    listen(canvas, 'pointerup', (e) => {
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
    listen(canvas, 'pointercancel', () => (this.down = null));
    listen(canvas, 'contextmenu', (e) => e.preventDefault());

    listen(window, 'keydown', (e) => {
      if (e.repeat) return;
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
