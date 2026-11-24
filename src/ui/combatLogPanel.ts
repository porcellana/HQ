/**
 * Panel del registro de combate: durante el combate muestra las últimas ~6
 * líneas, coloreadas por tipo, sin desvanecerse. Al tocarlo se abre el
 * historial completo (desplazable).
 */
import { CombatLog, LOG_VISIBLE } from '@/game/combat/combatLog';
import type { MsgCat } from '@/game/combat/presentation';
import { h } from './dom';

const LABEL: Record<MsgCat, string> = {
  'dmg-out': 'out', 'dmg-in': 'in', heal: 'heal', status: 'status', miss: 'miss', neutral: 'neutral',
};

export class CombatLogPanel {
  readonly el: HTMLDivElement;
  readonly model = new CombatLog();
  private active = false;
  private overlay: HTMLDivElement | null = null;

  constructor(private readonly root: HTMLElement) {
    this.el = h('div', { class: 'combat-log', attrs: { role: 'log', 'aria-label': 'Registro de combate' } });
    this.el.style.display = 'none';
    this.el.addEventListener('click', () => this.openFull());
  }

  /** El panel solo se ve mientras dura el combate. */
  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.el.style.display = on ? '' : 'none';
    if (!on) this.closeFull();
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Empieza un combate nuevo: se vacía el registro. */
  reset(): void {
    this.model.clear();
    this.render();
  }

  push(text: string, kind: 'info' | 'warn' | 'good' | 'combat' | undefined, cat?: MsgCat): void {
    this.model.push(text, kind, cat);
    this.render();
    if (this.overlay) this.renderFull();
  }

  private render(): void {
    const recent = this.model.recent(LOG_VISIBLE);
    this.el.replaceChildren(
      ...(recent.length ? [] : [h('div', { class: 'log-line neutral', text: '…' })]),
      ...recent.map((l, i) => h('div', { class: `log-line ${LABEL[l.cat]}${i === recent.length - 1 ? ' latest' : ''}`, text: l.text })),
      h('small', { class: 'log-hint', text: '▲ toca para ver todo' }),
    );
  }

  private openFull(): void {
    if (this.overlay || !this.model.lines.length) return;
    this.overlay = h('div', { class: 'log-overlay' });
    this.root.append(this.overlay);
    this.renderFull();
  }

  private renderFull(): void {
    const ov = this.overlay;
    if (!ov) return;
    ov.replaceChildren(
      h('div', { class: 'log-full' }, [
        h('h3', { text: 'Registro del combate' }),
        h('div', { class: 'log-scroll' }, this.model.lines.map((l) => h('div', { class: `log-line ${LABEL[l.cat]}`, text: l.text }))),
        h('button', { class: 'primary', text: 'Cerrar', onClick: () => this.closeFull() }),
      ]),
    );
    const sc = ov.querySelector('.log-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  private closeFull(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
