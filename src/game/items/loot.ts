/** Generación de botín a partir de tablas (data/loot_tables). */
import { ITEMS, LOOT_TABLES, RARITIES } from '@/data/registry';
import type { ItemDef, LootEntry, Rarity } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { createItem, type ItemInstance } from './items';

/** Elige rareza: a más nivel, más probables las rarezas altas. */
export function rollRarity(rng: Rng, level: number, luck = 0): Rarity {
  const allowed = RARITIES.filter((r) => r.minLevel <= level);
  return rng.weighted(allowed, (r) => {
    const tierIndex = RARITIES.indexOf(r);
    // Cada nivel por encima del mínimo multiplica las rarezas altas un poco.
    return r.weight * (1 + (tierIndex * (level - 1 + luck)) / 10);
  }).id;
}

const POOLS: Record<string, (d: ItemDef) => boolean> = {
  equipo: (d) => ['arma', 'armadura', 'secundaria', 'accesorio'].includes(d.kind) && !d.plain,
  armas: (d) => d.kind === 'arma',
  armaduras: (d) => d.kind === 'armadura' || d.kind === 'secundaria',
  accesorios: (d) => d.kind === 'accesorio',
};

/** Objeto de equipo aleatorio de nivel <= nivel del botín + 1. */
export function randomEquipment(rng: Rng, pool: keyof typeof POOLS, level: number): ItemInstance | null {
  const candidates = [...ITEMS.values()].filter((d) => POOLS[pool]!(d) && d.level <= level + 1);
  if (candidates.length === 0) return null;
  // Más probable cuanto más cerca del nivel del botín
  const def = rng.weighted(candidates, (d) => 1 + Math.max(0, 4 - Math.abs(level - d.level)));
  return createItem(def.id, rollRarity(rng, level), rng, { level });
}

export interface LootResult {
  items: ItemInstance[];
  gold: number;
}

export function rollLoot(rng: Rng, tableId: string | undefined, level: number): LootResult {
  const out: LootResult = { items: [], gold: 0 };
  const table = tableId ? LOOT_TABLES.get(tableId) : undefined;
  if (!table) return out;
  if (table.gold && rng.chance(table.goldChance ?? 1)) out.gold = rng.int(table.gold[0], table.gold[1]) * Math.max(1, level);
  const rolls = rng.int(table.rolls[0], table.rolls[1]);
  for (let i = 0; i < rolls; i++) {
    const e: LootEntry = rng.weighted(table.entries, (x) => x.weight);
    if ('nothing' in e) continue;
    if ('pool' in e) {
      const it = randomEquipment(rng, e.pool, level);
      if (it) out.items.push(it);
      continue;
    }
    if (!ITEMS.has(e.item)) {
      console.warn(`[botín] objeto desconocido en ${table.id}: ${e.item}`);
      continue;
    }
    out.items.push(createItem(e.item, 'comun', rng, { qty: rng.int(e.min ?? 1, e.max ?? 1), level }));
  }
  return out;
}
