/** Joystick virtual opcional: devuelve una dirección de 8 vías mientras se mantiene. */
import { h } from './dom';

export class Joystick {
  readonly el: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointer: number | null = null;
  private last: string = '';

  constructor(private readonly onDir: (dir: { dx: number; dy: number } | null) => void) {
    this.knob = h('div', { class: 'knob' });
    this.el = h('div', { class: 'joystick' }, [this.knob]);
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pointer = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.move(e);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointer) this.move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.knob.style.transform = '';
      this.emit(null);
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  private move(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2 - 20;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (len < 14) return this.emit(null);
    // 8 sectores de 45º
    const ang = Math.atan2(dy, dx);
    const sector = Math.round(ang / (Math.PI / 4));
    const dirs: Array<[number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const [ddx, ddy] = dirs[(sector + 8) % 8]!;
    this.emit({ dx: ddx, dy: ddy });
  }

  private emit(dir: { dx: number; dy: number } | null): void {
    const key = dir ? `${dir.dx},${dir.dy}` : '';
    if (key === this.last) return;
    this.last = key;
    this.onDir(dir);
  }

  setSide(side: 'derecha' | 'izquierda'): void {
    this.el.classList.toggle('derecha', side === 'derecha');
    this.el.classList.toggle('izquierda', side === 'izquierda');
  }
}
