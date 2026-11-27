/** Cofres de los biomas del mundo procedural (v0.8): equipo con rareza/afijos según el nivel del cofre. */
import type { LootEntry, LootTableDef } from '../schema';

const table = (id: string, specials: LootEntry[]): LootTableDef => ({
  id, rolls: [2, 3], gold: [4, 9], goldChance: 1,
  entries: [
    { nothing: true, weight: 10 },
    ...specials,
    { item: 'pocion_curacion', weight: 14, min: 1, max: 2 },
    { item: 'pocion_mana', weight: 8 },
    { pool: 'armas', weight: 14 },
    { pool: 'armaduras', weight: 14 },
    { pool: 'accesorios', weight: 8 },
  ],
});

export default [
  table('cofre_nieve', [{ item: 'cristal_hielo', weight: 14 }, { item: 'mineral_plata', weight: 8 }]),
  table('cofre_montana', [{ item: 'pieza_roca', weight: 14 }, { item: 'mineral_hierro', weight: 10, min: 1, max: 2 }]),
  table('cofre_costa', [{ item: 'perla_costa', weight: 14 }, { item: 'gema_bruta', weight: 3 }]),
  table('cofre_desierto', [{ item: 'ambar_desierto', weight: 14 }, { item: 'gema_bruta', weight: 4 }]),
  table('cofre_pantano', [{ item: 'resina_cieno', weight: 14, min: 1, max: 2 }, { item: 'antidoto', weight: 10 }]),
  table('cofre_bosque', [{ item: 'seda_arana', weight: 8 }, { item: 'hierba_pradera', weight: 10, min: 1, max: 3 }]),
  table('cofre_pradera', [{ item: 'hierba_pradera', weight: 12, min: 1, max: 3 }, { item: 'runa_vinculo', weight: 4 }]),
] satisfies LootTableDef[];
