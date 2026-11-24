/**
 * Banners del combate: «⚔ ¡COMBATE!» al empezar (con la lista de enemigos) y
 * (Desde v0.5.3 ya no hay banner de «¡VICTORIA!»: la experiencia sale pequeña
 * flotando sobre el personaje.) Se puede saltar tocándolo.
 */
import { h } from './dom';

export class CombatBanner {
  readonly el: HTMLDivElement;
  private timer = 0;
  private onClose: (() => void) | null = null;

  constructor() {
    this.el = h('div', { class: 'combat-banner' });
    this.el.addEventListener('click', () => this.close());
  }

  get active(): boolean {
    return this.el.classList.contains('show');
  }

  /** «⚔ ¡COMBATE!» con los enemigos agrupados («Goblin ×2 · Lobo»). */
  showStart(names: string[]): void {
    const counts = new Map<string, number>();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    const list = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
    this.open('start', [h('b', { text: '⚔ ¡COMBATE!' }), h('small', { text: list })], 1900);
  }

  private open(kind: 'start', children: HTMLElement[], ms: number, done?: () => void): void {
    this.close(false);
    this.onClose = done ?? null;
    this.el.className = `combat-banner ${kind}`;
    this.el.replaceChildren(...children);
    // Reinicia la animación CSS.
    void this.el.offsetWidth;
    this.el.classList.add('show');
    this.timer = window.setTimeout(() => this.close(), ms);
  }

  close(callback = true): void {
    window.clearTimeout(this.timer);
    const was = this.active;
    this.el.classList.remove('show');
    const cb = this.onClose;
    this.onClose = null;
    if (callback && was) cb?.();
  }
}
