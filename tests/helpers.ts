import { getClass } from '@/data/registry';
import { createNewGame, type GameState } from '@/game/state';

/** Estado de partida nuevo para tests. */
export function testState(classId = 'guerrero', seed = 1): GameState {
  return createNewGame({ name: 'Prueba', classId, portrait: 0, seed, stats: { ...getClass(classId).baseStats } });
}
