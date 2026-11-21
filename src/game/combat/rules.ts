/**
 * REGLAS DE COMBATE (puras y testeables, estilo D&D 5e)
 *  - Ataque: d20 + bonificador contra la CA. 20 natural = crítico (siempre impacta,
 *    dados de daño x2). 1 natural = pifia (siempre falla).
 *  - Salvación: d20 + bonificador contra una CD.
 *  - Resistencia = mitad de daño; vulnerabilidad = doble.
 *  - XP por enemigo escalada por la diferencia de nivel (anti-farmeo).
 */
import type { DamageType } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { parseDice, rollD20, type DiceResult } from '../rules/dice';

export type RollMode = 'normal' | 'ventaja' | 'desventaja';

export interface AttackRoll {
  natural: number;
  rolls: number[];
  total: number;
  hit: boolean;
  crit: boolean;
  fumble: boolean;
}

export function attackRoll(rng: Rng, toHit: number, ac: number, mode: RollMode = 'normal', critRange = 20): AttackRoll {
  const d = rollD20(rng, mode);
  const total = d.natural + toHit;
  const crit = d.natural >= critRange;
  const fumble = d.natural === 1;
  return { natural: d.natural, rolls: d.rolls, total, crit, fumble, hit: !fumble && (crit || total >= ac) };
}

/** Tira daño; en crítico se duplican los dados (no el modificador). */
export function damageRoll(rng: Rng, dice: string, extraMod: number, crit: boolean): DiceResult {
  const d = parseDice(dice);
  const count = crit ? d.count * 2 : d.count;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rng.int(1, d.sides));
  const modifier = d.modifier + extraMod;
  return { expr: dice, rolls, modifier, total: Math.max(1, rolls.reduce((a, b) => a + b, 0) + modifier) };
}

export function applyDefenses(
  amount: number,
  type: DamageType,
  def: { resist?: readonly DamageType[]; vulnerable?: readonly DamageType[] },
): { amount: number; note: '' | 'resiste' | 'vulnerable' } {
  if (def.vulnerable?.includes(type)) return { amount: amount * 2, note: 'vulnerable' };
  if (def.resist?.includes(type)) return { amount: Math.max(1, Math.floor(amount / 2)), note: 'resiste' };
  return { amount, note: '' };
}

export interface SaveRoll {
  natural: number;
  total: number;
  success: boolean;
}

export function savingThrow(rng: Rng, bonus: number, dc: number): SaveRoll {
  const natural = rng.int(1, 20);
  const total = natural + bonus;
  return { natural, total, success: natural === 20 || (natural !== 1 && total >= dc) };
}

/**
 * Multiplicador de XP según nivel del enemigo menos nivel del jugador:
 *   +1 → x1.25 … +4 o más → x2 (peligroso pero rentable)
 *   -1 → x0.8, -2 → x0.6, -3 → x0.4, -4 → x0.2, -5 o menos → x0.05
 */
export function xpMultiplier(enemyLevel: number, playerLevel: number): number {
  const diff = enemyLevel - playerLevel;
  if (diff >= 0) return Math.min(2, 1 + 0.25 * diff);
  if (diff <= -5) return 0.05;
  return 1 + 0.2 * diff;
}

export function xpForKill(baseXp: number, enemyLevel: number, playerLevel: number): number {
  return Math.max(1, Math.round(baseXp * xpMultiplier(enemyLevel, playerLevel)));
}

/** Etiqueta de peligro para mostrar al jugador. */
export function dangerLevel(enemyLevel: number, playerLevel: number): 'trivial' | 'facil' | 'normal' | 'dificil' | 'mortal' {
  const d = enemyLevel - playerLevel;
  if (d <= -5) return 'trivial';
  if (d <= -2) return 'facil';
  if (d <= 1) return 'normal';
  if (d <= 3) return 'dificil';
  return 'mortal';
}

/** Distancia de Chebyshev (casillas en 8 direcciones). */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Línea de visión (Bresenham); `blocks` dice si una casilla tapa la vista. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, blocks: (x: number, y: number) => boolean): boolean {
  let x = ax;
  let y = ay;
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === bx && y === by) return true;
    if (!(x === ax && y === ay) && blocks(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
