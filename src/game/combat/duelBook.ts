/**
 * LIBRO DE DUELOS (modelo de la tarjeta de duelo, sin DOM)
 * Agrupa los eventos de UNA acción (tirada de d20, daño, fallo) en una
 * «entrada» con una fila por objetivo, para que la tarjeta muestre una sola
 * ficha por acción: «Torbellino: Goblin −5 · Lobo fallo · …».
 * Los eventos de una misma acción llegan en la misma ejecución síncrona; la
 * interfaz cierra el lote con `closeBatch()` (en un microtask).
 */
import type { DamageType } from '@/data/schema';
import type { Actor, DiceEvent } from '../game';
import type { HitFx, MissFx } from './presentation';

export interface DuelRoll {
  label: string;
  natural: number;
  bonus: number;
  total: number;
  target: number | null;
  targetLabel: 'CA' | 'CD' | '';
}

export type DuelOutcome = DiceEvent['outcome'] | 'auto' | 'pending';

export interface DuelRow<S> {
  defender: Actor;
  defenderName: string;
  defenderSprite: S | null;
  roll?: DuelRoll;
  outcome: DuelOutcome;
  damage?: { amount: number; type: DamageType | null; crit: boolean; note: '' | 'resiste' | 'vulnerable'; killed: boolean; /** Golpes automáticos juntados (proyectil mágico ×3). */ hits?: number };
}

export interface DuelEntry<S> {
  id: number;
  attacker: Actor;
  attackerName: string;
  attackerSprite: S | null;
  action: string;
  rows: Array<DuelRow<S>>;
  /** Segundos hasta que se revela el resultado. */
  lead: number;
  /** Se siguen añadiendo filas (misma acción, mismo lote). */
  open: boolean;
}

export interface Resolver<S> {
  name(a: Actor): string;
  sprite(a: Actor): S | null;
}

const sameActor = (a: Actor, b: Actor): boolean => a.kind === b.kind && (a.uid ?? 0) === (b.uid ?? 0);

export class DuelBook<S> {
  /** Entradas pendientes de mostrar, en orden. */
  readonly queue: Array<DuelEntry<S>> = [];
  private nextId = 1;
  private current: DuelEntry<S> | null = null;
  /** Se creó una entrada desde la última lectura (la usa la interfaz para no duplicar el cartel de acción). */
  private fresh = false;

  constructor(private readonly res: Resolver<S>) {}

  /** Entrada abierta de este atacante y acción, o una nueva. */
  private entryFor(attacker: Actor, action: string, lead: number): DuelEntry<S> {
    const cur = this.current;
    if (cur && cur.open && sameActor(cur.attacker, attacker) && cur.action === action) return cur;
    const e: DuelEntry<S> = {
      id: this.nextId++, attacker, attackerName: this.res.name(attacker), attackerSprite: this.res.sprite(attacker), action, rows: [], lead, open: true,
    };
    this.current = e;
    this.queue.push(e);
    this.fresh = true;
    return e;
  }

  private row(e: DuelEntry<S>, defender: Actor): DuelRow<S> {
    const r: DuelRow<S> = { defender, defenderName: this.res.name(defender), defenderSprite: this.res.sprite(defender), outcome: 'pending' };
    e.rows.push(r);
    return r;
  }

  /** Tirada de ataque o salvación con atacante y defensor conocidos. */
  onDice(ev: DiceEvent): DuelEntry<S> | null {
    if (!ev.attacker || !ev.defender) return null;
    const e = this.entryFor(ev.attacker, ev.action ?? ev.label, ev.lead ?? 0);
    const r = this.row(e, ev.defender);
    r.roll = { label: ev.label, natural: ev.natural, bonus: ev.bonus, total: ev.total, target: ev.target, targetLabel: ev.targetLabel };
    r.outcome = ev.outcome;
    return e;
  }

  /** Daño resuelto: se anota en la fila pendiente de ese objetivo o crea una (impacto automático). */
  onHit(ev: HitFx): DuelEntry<S> | null {
    const attacker = ev.attacker;
    if (!attacker) return null; // trampas, estados: sin tarjeta
    const e = this.entryFor(attacker, ev.action, ev.lead);
    // Golpes automáticos repetidos sobre el mismo objetivo (varios dardos): una sola fila acumulada.
    const merge = e.rows.find((x) => sameActor(x.defender, ev.target) && !x.roll && x.damage && x.outcome === 'auto' && !ev.crit);
    if (merge?.damage) {
      merge.damage.amount += ev.amount;
      merge.damage.hits = (merge.damage.hits ?? 1) + 1;
      merge.damage.killed = merge.damage.killed || ev.killed;
      return e;
    }
    let r = e.rows.find((x) => sameActor(x.defender, ev.target) && !x.damage && (x.outcome === 'hit' || x.outcome === 'crit' || x.outcome === 'fail' || x.outcome === 'pending'));
    if (!r) {
      r = this.row(e, ev.target);
      r.outcome = ev.crit ? 'crit' : 'auto';
    }
    r.damage = { amount: ev.amount, type: ev.dmgType, crit: ev.crit, note: ev.note, killed: ev.killed };
    return e;
  }

  onMiss(ev: MissFx): DuelEntry<S> | null {
    if (!ev.attacker) return null;
    const e = this.entryFor(ev.attacker, ev.action, ev.lead);
    this.row(e, ev.target).outcome = 'miss';
    return e;
  }

  /** Cierra el lote actual: lo siguiente es otra acción. */
  closeBatch(): void {
    if (this.current) this.current.open = false;
    this.current = null;
  }

  /** ¿Se creó una tarjeta desde la última vez? (y lo restablece) */
  takeFresh(): boolean {
    const f = this.fresh;
    this.fresh = false;
    return f;
  }

  /** Saca la siguiente entrada a mostrar. */
  next(): DuelEntry<S> | null {
    return this.queue.shift() ?? null;
  }

  clear(): void {
    this.queue.length = 0;
    this.current = null;
    this.fresh = false;
  }
}
