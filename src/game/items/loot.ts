/** Generación de botín a partir de tablas (data/loot_tables). */
import { ITEMS, LOOT_TABLES, RARITIES } from '@/data/registry';
import type { ItemDef, LootEntry, LootPool, Rarity } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { goldDifficulty, goldLevelScale } from '../economy/curve';
import { createItem, type ItemInstance } from './items';

/** Elige rareza: a más nivel, más probables las rarezas altas. `min` fija un suelo (jefes, mercado negro). */
export function rollRarity(rng: Rng, level: number, luck = 0, min?: Rarity): Rarity {
  const minIdx = min ? RARITIES.findIndex((r) => r.id === min) : 0;
  const allowed = RARITIES.filter((r, i) => (r.minLevel <= level || i <= minIdx) && i >= minIdx);
  return rng.weighted(allowed, (r) => {
    const tierIndex = RARITIES.indexOf(r);
    // Cada nivel por encima del mínimo multiplica las rarezas altas un poco.
    return r.weight * (1 + (tierIndex * (level - 1 + luck)) / 10);
  }).id;
}

const GEAR = ['arma', 'armadura', 'secundaria', 'accesorio'];
const POOLS: Record<LootPool, (d: ItemDef) => boolean> = {
  equipo: (d) => GEAR.includes(d.kind) && !d.plain && !d.unique,
  armas: (d) => d.kind === 'arma' && !d.unique,
  armaduras: (d) => (d.kind === 'armadura' || d.kind === 'secundaria') && !d.unique && !d.set,
  accesorios: (d) => d.kind === 'accesorio' && !d.unique,
  consumibles: (d) => d.kind === 'consumible' && !d.use?.outOfCombatOnly,
  magia: (d) => !d.unique && (d.classes?.includes('mago') === true || d.classes?.includes('clerigo') === true || d.weapon?.stat === 'INT' || d.id.startsWith('pergamino') || d.id.startsWith('pocion_mana') || d.id.startsWith('grimorio')),
  sets: (d) => !!d.set && !d.unique,
};

export interface LootCtx {
  /** Nivel del jugador (ajusta el oro). */
  playerLevel?: number;
  boss?: boolean;
  /** Bioma: añade una tirada en la tabla `drop_<bioma>`. */
  biome?: string;
  /** Clase del jugador: favorece el equipo que puede usar. */
  classId?: string;
  luck?: number;
  /** Rareza mínima del equipo (jefes: raro). */
  minRarity?: Rarity;
}

/** Objeto de equipo aleatorio de nivel <= nivel del botín + 1 (nivel de zona ±1). */
export function randomEquipment(rng: Rng, pool: LootPool, level: number, ctx: LootCtx = {}): ItemInstance | null {
  const candidates = [...ITEMS.values()].filter((d) => POOLS[pool](d) && d.level <= level + 1);
  if (candidates.length === 0) return null;
  // Más probable cuanto más cerca del nivel del botín; favorece la clase del jugador.
  const def = rng.weighted(candidates, (d) => {
    let w = 1 + Math.max(0, 4 - Math.abs(level - d.level));
    if (ctx.classId && d.classes) w *= d.classes.includes(ctx.classId) ? 2 : 0.25;
    return w;
  });
  const consumable = def.kind === 'consumible';
  return createItem(def.id, consumable ? 'comun' : rollRarity(rng, level, ctx.luck, ctx.minRarity), rng, { level, ...(consumable ? { qty: rng.int(1, 2) } : {}) });
}

export interface LootResult {
  items: ItemInstance[];
  gold: number;
}

export function rollLoot(rng: Rng, tableId: string | undefined, level: number, ctx: LootCtx = {}): LootResult {
  const out: LootResult = { items: [], gold: 0 };
  const table = tableId ? LOOT_TABLES.get(tableId) : undefined;
  if (!table) return out;
  const minRarity = ctx.minRarity ?? (ctx.boss ? 'raro' : undefined);
  const pctx: LootCtx = { ...ctx, ...(minRarity ? { minRarity } : {}) };
  if (table.gold && rng.chance(table.goldChance ?? 1)) {
    out.gold = Math.round(rng.int(table.gold[0], table.gold[1]) * goldLevelScale(level) * goldDifficulty(level, ctx.playerLevel));
  }
  const roll = (t: typeof table, rolls: number) => {
    for (let i = 0; i < rolls; i++) {
      const e: LootEntry = rng.weighted(t.entries, (x) => x.weight);
      if ('nothing' in e) continue;
      if ('pool' in e) {
        const it = randomEquipment(rng, e.pool, level, pctx);
        if (it) out.items.push(it);
        continue;
      }
      if (!ITEMS.has(e.item)) {
        console.warn(`[botín] objeto desconocido en ${t.id}: ${e.item}`);
        continue;
      }
      out.items.push(createItem(e.item, 'comun', rng, { qty: rng.int(e.min ?? 1, e.max ?? 1), level }));
    }
  };
  roll(table, rng.int(table.rolls[0], table.rolls[1]));
  // Tirada extra de materiales del bioma.
  const bt = ctx.biome ? LOOT_TABLES.get(`drop_${ctx.biome}`) : undefined;
  if (bt && rng.chance(0.45)) roll(bt, 1);
  return out;
}
