/**
 * Panel del registro de combate: durante el combate muestra las últimas ~6
 * líneas, coloreadas por tipo, sin desvanecerse. Al tocarlo se abre el
 * historial completo (desplazable).
 */
import { LOG_FADE_S } from '@/data/config/combat_pacing';
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
  private fadeTimer = 0;

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

  /**
   * Muestra solo las líneas recientes y las desvanece con una animación CSS.
   * Al re-renderizar, `animation-delay` negativo = la edad de la línea, así
   * las antiguas no reinician su desvanecimiento. Cuando todas se apagan, el
   * panel queda reducido a un pequeño «registro» tocable (sin fondo).
   */
  private render(): void {
    window.clearTimeout(this.fadeTimer);
    const t = performance.now() / 1000;
    const fresh = this.model.fresh(LOG_FADE_S, LOG_VISIBLE);
    this.el.classList.toggle('idle', fresh.length === 0);
    this.el.replaceChildren(
      ...fresh.map((l, i) => {
        const age = Math.max(0, t - l.t);
        const el = h('div', { class: `log-line ${LABEL[l.cat]}${i === fresh.length - 1 ? ' latest' : ''}`, text: l.text });
        el.style.animation = i === fresh.length - 1 ? `logpop 0.35s, clogfade ${LOG_FADE_S}s linear forwards` : `clogfade ${LOG_FADE_S}s linear forwards`;
        el.style.animationDelay = i === fresh.length - 1 ? `0s, ${-age}s` : `${-age}s`;
        return el;
      }),
      h('small', { class: 'log-hint', text: this.model.lines.length ? '📜 registro' : '' }),
    );
    // Cuando se apague la más reciente, se vuelve a dibujar el panel en reposo.
    if (fresh.length) this.fadeTimer = window.setTimeout(() => this.render(), (LOG_FADE_S - (t - fresh[fresh.length - 1]!.t)) * 1000 + 100);
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
