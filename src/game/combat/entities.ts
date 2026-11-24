/** Enemigos en tiempo de ejecución (no se guardan: las zonas se repueblan al entrar). */
import type { EnemyDef } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { roll } from '../rules/dice';
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

export function createEnemy(def: EnemyDef, x: number, y: number, rng: Rng): Enemy {
  const maxHp = Math.max(1, roll(rng, def.hp).total);
  return {
    uid: nextUid++, def, x, y, rx: x, ry: y, hp: maxHp, maxHp, statuses: [], alerted: false, cooldowns: {},
    phase: 0, toHitBonus: 0, damageBonus: 0, facing: 'left', bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0, skipNext: false,
  };
}

/** Bonificador de salvación de un enemigo. */
export function enemySave(e: Enemy, stat: keyof NonNullable<EnemyDef['saves']>): number {
  return e.def.saves?.[stat] ?? Math.floor(e.def.level / 2);
}
