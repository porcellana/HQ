/** Enemigos en tiempo de ejecución (no se guardan: las zonas se repueblan al entrar). */
import type { EnemyDef } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { formatDice, parseDice, roll } from '../rules/dice';
import type { StatusInstance } from './status';

export interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  /** Posición visual interpolada. */
  rx: number;
  ry: number;
  hp: number;
  maxHp: number;
  statuses: StatusInstance[];
  /** Ha visto al jugador y le persigue. */
  alerted: boolean;
  cooldowns: Record<string, number>;
  /** Fases de jefe ya activadas. */
  phase: number;
  toHitBonus: number;
  damageBonus: number;
  facing: 'left' | 'right';
  /** Animaciones: embestida y destello al recibir daño. */
  bumpT: number;
  bumpDx: number;
  bumpDy: number;
  flashT: number;
  /** Para enemigos lentos/ralentizados: alterna turnos. */
  skipNext: boolean;
  /** Vida mostrada en la barra mientras la tarjeta de duelo aún no ha revelado el golpe. */
  shownHp?: number;
  /** Casillas pendientes de animar (movimiento de varias casillas por turno). */
  trail?: Array<{ x: number; y: number }>;
}

let nextUid = 1;

export function createEnemy(def: EnemyDef, x: number, y: number, rng: Rng, hpMul = 1): Enemy {
  const maxHp = Math.max(1, Math.round(roll(rng, def.hp).total * hpMul));
  return {
    uid: nextUid++, def, x, y, rx: x, ry: y, hp: maxHp, maxHp, statuses: [], alerted: false, cooldowns: {},
    phase: 0, toHitBonus: 0, damageBonus: 0, facing: 'left', bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0, skipNext: false,
  };
}

/** Bonificador de salvación de un enemigo. */
export function enemySave(e: Enemy, stat: keyof NonNullable<EnemyDef['saves']>): number {
  return e.def.saves?.[stat] ?? Math.floor(e.def.level / 2);
}

/**
 * Escala un enemigo al nivel `level` (los encuentros salen a tu nivel ±1).
 * Por cada nivel de diferencia: ±20 % de vida, ±1 al ataque y al daño cada 2, ±1 a la CA cada 3.
 * Los jefes y las criaturas con ficha especial no se escalan.
 */
export function scaleEnemyDef(def: EnemyDef, level: number): { def: EnemyDef; hpMul: number } {
  const d = level - def.level;
  if (d === 0 || def.boss || def.pet) return { def, hpMul: 1 };
  const half = Math.trunc(d / 2);
  const dmg = parseDice(def.attack.dice);
  const attack = { ...def.attack, toHit: def.attack.toHit + half, dice: formatDice({ ...dmg, modifier: dmg.modifier + half }) };
  return { def: { ...def, level, ac: def.ac + Math.trunc(d / 3), attack }, hpMul: Math.max(0.4, 1 + 0.2 * d) };
}
