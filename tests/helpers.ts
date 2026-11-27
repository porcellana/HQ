import { getClass } from '@/data/registry';
import type { BattleResult } from '@/game/battle/battle';
import type { Enemy } from '@/game/combat/entities';
import type { Game } from '@/game/game';
import { createNewGame, type GameState } from '@/game/state';

/** Estado de partida nuevo para tests. */
export function testState(classId = 'guerrero', seed = 1): GameState {
  return createNewGame({ name: 'Prueba', classId, portrait: 0, seed, stats: { ...getClass(classId).baseStats } });
}

/** Derrota a los enemigos dados en una batalla instantánea y aplica el resultado (XP, botín, jefe...). */
export function defeat(g: Game, ...enemies: Enemy[]): BattleResult {
  const b = g.beginBattle(enemies);
  for (const e of enemies) b.damage(b.get(`e${e.uid}`)!, 99999, 'sagrado', { src: b.player, ctx: 'weapon' });
  return g.finishBattle()!;
}
