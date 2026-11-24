/**
 * TARJETA DE DUELO (estilo Baldur's Gate 3)
 * Para cada ataque o hechizo muestra: retratos de atacante y objetivo, el
 * nombre de la acción, el d20 rodando con su cálculo («14 + 5 = 19 vs CA 16»),
 * la etiqueta Impacto / Fallo / ¡Crítico! / ¡Pifia! y el daño con su tipo.
 * Una acción con varios objetivos (torbellino, bola de fuego) es UNA tarjeta
 * con una fila por objetivo.
 *
 * Tiempos (ritmo en data/config/combat_pacing.ts):
 *   0 ─ el d20 rueda ─► lead ─ revela resultado y daño ─► hold ─ se cierra
 * En «paso a paso» se queda hasta que se pulsa «Siguiente» (o 8 s).
 */
import type { DamageType } from '@/data/schema';
import { PACING, type SpeedKey } from '@/data/config/combat_pacing';
import { DuelBook, type DuelEntry, type DuelRow, type Resolver } from '@/game/combat/duelBook';
import type { CombatFxEvent } from '@/game/combat/presentation';
import type { DiceEvent } from '@/game/game';
import { h } from './dom';
import { spriteElement } from './actorSprite';

const OUTCOME: Record<string, { text: string; cls: string }> = {
  crit: { text: '¡CRÍTICO!', cls: 'crit' },
  hit: { text: 'Impacto', cls: 'hit' },
  auto: { text: 'Impacto', cls: 'hit' },
  miss: { text: 'Fallo', cls: 'miss' },
  fumble: { text: '¡PIFIA!', cls: 'fumble' },
  success: { text: 'Resiste', cls: 'miss' },
  fail: { text: 'Falla la salvación', cls: 'hit' },
  pending: { text: '…', cls: 'hit' },
};

export const TYPE_ICON: Record<DamageType, string> = {
  cortante: '🗡', perforante: '🏹', contundente: '🔨', fuego: '🔥', frio: '❄', rayo: '⚡', veneno: '☠', sagrado: '✨', necrotico: '💀', arcano: '🔮',
};

export class DuelCard {
  readonly el: HTMLDivElement;
  readonly book: DuelBook<HTMLCanvasElement>;
  /** Cuando se revela una fila (para el sonido y la cinemática). */
  onReveal: ((entry: DuelEntry<HTMLCanvasElement>) => void) | null = null;
  private current: DuelEntry<HTMLCanvasElement> | null = null;
  private timers: number[] = [];
  private spin = 0;
  private revealed = false;
  private revealedAt = 0;
  /** Tiempo mínimo (ms) que una tarjeta revelada se queda aunque haya otra esperando. */
  private static readonly MIN_SHOW_MS = 1000;

  constructor(resolver: Resolver<HTMLCanvasElement>, private readonly speed: () => SpeedKey) {
    this.book = new DuelBook<HTMLCanvasElement>(resolver);
    this.el = h('div', { class: 'duel-card passthrough' });
  }

  // ----------------------------------------------------------------- entrada
  onDice(ev: DiceEvent): void {
    if (this.book.onDice(ev)) this.afterEvent();
  }

  onCfx(ev: CombatFxEvent): void {
    const e = ev.type === 'hit' ? this.book.onHit(ev) : ev.type === 'miss' ? this.book.onMiss(ev) : null;
    if (e) this.afterEvent();
  }

  /** ¿Se creó una tarjeta para la acción que acaba de resolverse? */
  takeFresh(): boolean {
    return this.book.takeFresh();
  }

  private afterEvent(): void {
    // Todos los eventos de una acción llegan en la misma ejecución síncrona.
    queueMicrotask(() => {
      this.book.closeBatch();
      this.pump();
    });
  }

  // ------------------------------------------------------------- reproducción
  private pump(): void {
    if (this.current) {
      // Si hay más tarjetas esperando, la actual no se queda para siempre: tras
      // un mínimo legible cede el sitio a la siguiente.
      if (this.revealed && this.book.queue.length) {
        const left = DuelCard.MIN_SHOW_MS - (performance.now() - this.revealedAt);
        if (left <= 0) this.finish();
        else this.timers.push(window.setTimeout(() => this.pump(), left + 20));
      }
      return;
    }
    const e = this.book.next();
    if (!e) return;
    this.play(e);
  }

  /** No hay nada en cola y la tarjeta actual (si la hay) lleva `ms` revelada: se puede cerrar el combate. */
  idleFor(ms: number): boolean {
    if (this.book.queue.length) return false;
    if (!this.current) return true;
    return this.revealed && performance.now() - this.revealedAt >= ms;
  }

  /** Cierra la tarjeta actual (al pulsar «Siguiente» o al empezar otra acción). */
  dismiss(): void {
    if (this.current && this.revealed) this.finish();
  }

  /** Descarta todo (saltar ronda, fin de combate). */
  flush(): void {
    this.book.clear();
    this.clearTimers();
    this.current = null;
    this.el.classList.remove('show');
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    window.clearInterval(this.spin);
  }

  private play(e: DuelEntry<HTMLCanvasElement>): void {
    this.current = e;
    this.revealed = false;
    const lead = Math.max(0.35, e.lead || 0.5) * 1000;
    const hold = PACING[this.speed()].cardHoldMs;
    this.render(e, false);
    this.el.classList.add('show');
    // El d20 rueda hasta que se revela el resultado.
    this.spin = window.setInterval(() => {
      this.el.querySelectorAll('.d20.rolling').forEach((d) => (d.textContent = String(1 + Math.floor(Math.random() * 20))));
    }, 55);
    this.timers.push(window.setTimeout(() => this.reveal(e), lead));
    this.timers.push(window.setTimeout(() => this.finish(), lead + hold));
  }

  private reveal(e: DuelEntry<HTMLCanvasElement>): void {
    if (this.current !== e) return;
    this.revealed = true;
    this.revealedAt = performance.now();
    window.clearInterval(this.spin);
    this.render(e, true);
    this.onReveal?.(e);
  }

  private finish(): void {
    this.clearTimers();
    this.el.classList.remove('show');
    const e = this.current;
    this.current = null;
    // La siguiente tarjeta entra tras el fundido.
    if (e && this.book.queue.length) this.timers.push(window.setTimeout(() => this.pump(), 180));
  }

  // ------------------------------------------------------------------- dibujo
  private render(e: DuelEntry<HTMLCanvasElement>, revealed: boolean): void {
    const single = e.rows.length === 1;
    const first = e.rows[0];
    const worst = e.rows.find((r) => r.outcome === 'crit') ? 'crit' : e.rows.find((r) => r.outcome === 'fumble') ? 'fumble' : '';
    this.el.className = `duel-card passthrough show${single ? ' single' : ' multi'}${revealed && worst ? ` ${worst}` : ''}${this.revealed ? ' revealed' : ''}`;
    // Un solo objetivo: tarjeta compacta de DOS líneas (retratos a la izquierda).
    //   [A] ⚔ [B]  Proyectil mágico · Perla → Goblin
    //              🎲14 + 5 = 19 vs CA 16 · Impacto · −9 🔮 arcano
    if (single && first) {
      const head = h('div', { class: 'duel-head' }, [
        spriteElement(e.attackerSprite, 'duel-portrait'),
        h('span', { class: 'duel-vs', text: '⚔' }),
        spriteElement(first.defenderSprite, 'duel-portrait foe'),
      ]);
      const title = h('div', { class: 'duel-title' }, [
        h('b', { text: e.action }),
        h('small', { text: ` ${e.attackerName} → ${first.defenderName}` }),
      ]);
      this.el.replaceChildren(h('div', { class: 'duel-main' }, [head, h('div', { class: 'duel-col' }, [title, this.resultLine(first, revealed)])]));
      return;
    }
    // Varios objetivos: cabecera pequeña y una fila por objetivo.
    const header = h('div', { class: 'duel-head multi-head' }, [
      spriteElement(e.attackerSprite, 'duel-portrait'),
      h('div', { class: 'duel-title' }, [h('b', { text: e.action }), h('small', { text: ` ${e.attackerName}` })]),
    ]);
    this.el.replaceChildren(header, ...e.rows.map((r) => this.smallRow(r, revealed)));
  }

  /** Línea de resultado de un solo objetivo: d20, cuenta, resultado y daño. */
  private resultLine(r: DuelRow<HTMLCanvasElement>, revealed: boolean): HTMLElement {
    const o = OUTCOME[r.outcome] ?? OUTCOME['hit']!;
    const parts: Array<HTMLElement | string> = [];
    if (r.roll) {
      const sign = r.roll.bonus >= 0 ? '+' : '−';
      parts.push(h('span', { class: `d20 mini${revealed ? ` ${o.cls}` : ' rolling'}`, text: revealed ? String(r.roll.natural) : '?' }));
      // Cuenta compacta: «14+5=19 vs CA 16».
      const calc = revealed
        ? `${r.roll.natural}${sign}${Math.abs(r.roll.bonus)}=${r.roll.total}${r.roll.target !== null ? ` vs ${r.roll.targetLabel} ${r.roll.target}` : ''}`
        : 'Tirando…';
      parts.push(h('span', { class: 'duel-calc', text: calc }));
    } else if (!revealed) {
      parts.push(h('span', { class: 'duel-cast', text: '· · ·' }));
    }
    if (revealed) {
      parts.push(h('span', { class: `duel-outcome ${o.cls}`, text: o.text }));
      if (r.damage) parts.push(this.damageLine(r, true));
    }
    return h('div', { class: 'duel-line' }, parts);
  }

  /** Fila compacta (varios objetivos). */
  private smallRow(r: DuelRow<HTMLCanvasElement>, revealed: boolean): HTMLElement {
    const o = OUTCOME[r.outcome] ?? OUTCOME['hit']!;
    const bits: Array<HTMLElement | string> = [spriteElement(r.defenderSprite, 'duel-mini'), h('span', { class: 'duel-name', text: r.defenderName })];
    if (!revealed) bits.push(h('span', { class: 'd20 mini rolling', text: '?' }));
    else {
      if (r.roll) bits.push(h('span', { class: `d20 mini ${o.cls}`, text: String(r.roll.natural) }));
      bits.push(h('span', { class: `duel-outcome-sm ${o.cls}`, text: o.text }));
      if (r.damage) bits.push(this.damageLine(r, true));
    }
    return h('div', { class: 'duel-row' }, bits);
  }

  private damageLine(r: DuelRow<HTMLCanvasElement>, small = false): HTMLElement {
    const d = r.damage!;
    const note = d.note === 'vulnerable' ? ' ¡vulnerable!' : d.note === 'resiste' ? ' resiste' : '';
    return h('div', { class: `duel-damage${d.crit ? ' crit' : ''}${small ? ' sm' : ''}` }, [
      h('b', { text: `−${d.amount}` }),
      d.hits && d.hits > 1 ? h('small', { text: ` ×${d.hits}` }) : null,
      h('span', { text: ` ${d.type ? TYPE_ICON[d.type] : ''}` }),
      // El nombre del tipo sólo se ve donde hay sitio (la tarjeta compacta lo oculta).
      h('span', { class: 'tword', text: d.type ? ` ${d.type}` : '' }),
      note ? h('small', { class: d.note === 'vulnerable' ? 'vuln' : 'resist', text: note }) : null,
      d.killed ? h('small', { class: 'kill', text: ' ☠' }) : null,
    ]);
  }
}
