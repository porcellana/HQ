/** Cofres de las mazmorras. El nivel del botín es el del piso. */
import type { LootTableDef } from '../schema';

export default [
  {
    id: 'cofre', rolls: [2, 3], gold: [4, 9], goldChance: 0.9,
    entries: [
      { pool: 'equipo', weight: 30 },
      { pool: 'accesorios', weight: 12 },
      { item: 'pocion_curacion', weight: 15, min: 1, max: 2 },
      { item: 'pocion_curacion_mayor', weight: 6 },
      { item: 'pocion_mana', weight: 10, min: 1, max: 2 },
      { item: 'antidoto', weight: 6 },
      { item: 'elixir_fuerza', weight: 4 },
      { item: 'gema_bruta', weight: 4 },
      { nothing: true, weight: 8 },
    ],
  },
] satisfies LootTableDef[];
