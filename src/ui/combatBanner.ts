/**
 * Banners del combate: «⚔ ¡COMBATE!» al empezar (con la lista de enemigos) y
 * «¡VICTORIA!» al terminar, con un resumen corto de XP, oro y objetos.
 * Se pueden saltar tocándolos. Al cerrarse avisan, para encadenar la pantalla
 * de subida de nivel sin solaparse.
 */
import { h } from './dom';

export interface VictorySummary {
  xp: number;
  gold: number;
  items: Array<{ name: string; rarity: number }>;
  kills: number;
}

const RARITY_CLASS = ['r0', 'r1', 'r2', 'r3', 'r4'];

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

  /** «¡VICTORIA!» con el resumen; `done` se llama al cerrarse (por tiempo o al tocar). */
  showVictory(s: VictorySummary, done?: () => void): void {
    const lines: HTMLElement[] = [h('b', { text: '¡VICTORIA!' })];
    const bits: string[] = [];
    if (s.xp > 0) bits.push(`+${s.xp} XP`);
    if (s.gold > 0) bits.push(`${s.gold} oro`);
    if (bits.length) lines.push(h('small', { text: bits.join(' · ') }));
    if (s.items.length) {
      lines.push(
        h('div', { class: 'victory-items' }, s.items.slice(0, 6).map((it) => h('span', { class: `vi ${RARITY_CLASS[it.rarity] ?? 'r0'}`, text: it.name }))),
      );
      if (s.items.length > 6) lines.push(h('small', { text: `…y ${s.items.length - 6} más` }));
    }
    this.open('victory', lines, 3300, done);
  }

  private open(kind: 'start' | 'victory', children: HTMLElement[], ms: number, done?: () => void): void {
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
