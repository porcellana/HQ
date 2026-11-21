/** Animación breve de la tirada de d20 (no bloquea el juego). */
import type { DiceEvent } from '@/game/game';
import { h } from './dom';

const OUTCOME: Record<DiceEvent['outcome'], { text: string; cls: string }> = {
  crit: { text: '¡CRÍTICO!', cls: 'crit' },
  hit: { text: 'Impacto', cls: 'hit' },
  miss: { text: 'Fallo', cls: 'miss' },
  fumble: { text: '¡PIFIA!', cls: 'fumble' },
  success: { text: 'Éxito', cls: 'hit' },
  fail: { text: 'Fracaso', cls: 'miss' },
};

export class DiceRoller {
  readonly el: HTMLDivElement;
  private readonly die: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private timer = 0;
  private spin = 0;

  constructor() {
    this.die = h('div', { class: 'd20' });
    this.info = h('div', { class: 'dice-info' });
    this.el = h('div', { class: 'dice-roller passthrough' }, [this.die, this.info]);
  }

  show(ev: DiceEvent): void {
    window.clearInterval(this.spin);
    window.clearTimeout(this.timer);
    this.el.className = 'dice-roller passthrough show';
    this.info.textContent = ev.label;
    let n = 0;
    this.spin = window.setInterval(() => {
      this.die.textContent = String(1 + Math.floor(Math.random() * 20));
      if (++n >= 7) {
        window.clearInterval(this.spin);
        const o = OUTCOME[ev.outcome];
        this.die.textContent = String(ev.natural);
        this.el.classList.add(o.cls);
        const sign = ev.bonus >= 0 ? '+' : '−';
        const vs = ev.target !== null ? ` vs ${ev.targetLabel} ${ev.target}` : '';
        this.info.replaceChildren(h('b', { text: o.text }), h('small', { text: `${ev.label}: ${ev.natural} ${sign} ${Math.abs(ev.bonus)} = ${ev.total}${vs}` }));
        this.timer = window.setTimeout(() => this.el.classList.remove('show'), 1400);
      }
    }, 45);
  }
}
