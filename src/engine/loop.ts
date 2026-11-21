/** Bucle principal con requestAnimationFrame y delta acotado. */
export class GameLoop {
  private rafId = 0;
  private last = 0;
  private running = false;

  constructor(private readonly tick: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      // Acotamos dt para que una pestaña en segundo plano no "teletransporte" nada.
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
