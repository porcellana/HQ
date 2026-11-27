/**
 * OBJETOS EN PARTIDA
 * Un ItemInstance es lo que se guarda: id del objeto base + rareza + bonos
 * aleatorios + cantidad. Los datos fijos (nombre, dados...) se leen de data/items.
 */
import { RARITY, SETS, getItem } from '@/data/registry';
import { AFFIX_PREFIX, AFFIX_SUFFIX } from '@/data/config/affixnames';
import type { BonusStat, EquipSlot, ItemDef, Rarity } from '@/data/schema';
import type { Rng } from '@/engine/rng';

export interface Affix {
  stat: BonusStat;
  value: number;
}

export interface ItemInstance {
  uid: string;
  id: string;
  rarity: Rarity;
  qty: number;
  affixes: Affix[];
  /** Mejoras del herrero (+1..+3). Sin definir = 0. */
  plus?: number;
}

export const STAT_LABEL: Record<BonusStat, string> = {
  FUE: 'FUE', DES: 'DES', CON: 'CON', INT: 'INT', SAB: 'SAB', CAR: 'CAR',
  ca: 'CA', ataque: 'Ataque', daño: 'Daño', pv: 'PV máx.', recurso: 'Recurso máx.',
};

let uidCounter = 0;
export function newUid(): string {
  return `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Bonos aleatorios favoritos por tipo de objeto. */
const AFFIX_POOLS: Record<string, BonusStat[]> = {
  arma: ['ataque', 'daño', 'daño', 'FUE', 'DES', 'INT', 'SAB'],
  armadura: ['CON', 'pv', 'pv', 'ca', 'DES', 'FUE', 'SAB'],
  secundaria: ['ca', 'pv', 'INT', 'SAB', 'CON', 'recurso'],
  accesorio: ['FUE', 'DES', 'CON', 'INT', 'SAB', 'CAR', 'recurso', 'pv', 'ataque'],
};

function affixValue(stat: BonusStat, level: number, rng: Rng): number {
  const tier = 1 + Math.floor((level - 1) / 4); // 1..5
  switch (stat) {
    case 'pv':
      return rng.int(2, 4) * tier;
    case 'recurso':
      return rng.int(1, 3) * tier;
    case 'ca':
      return Math.max(1, Math.floor(tier / 2));
    case 'ataque':
    case 'daño':
      return rng.int(1, tier);
    default:
      return Math.max(1, Math.min(3, rng.int(Math.ceil(tier / 2), tier)));
  }
}

/** Crea un objeto. `level` es el nivel del botín (escala los bonos). */
export function createItem(id: string, rarity: Rarity, rng: Rng, opts: { qty?: number; level?: number } = {}): ItemInstance {
  const def = getItem(id);
  if (!def) throw new Error(`Objeto desconocido: ${id}`);
  const r: Rarity = def.plain || def.stackable ? 'comun' : def.unique ? 'legendario' : rarity;
  const affixes: Affix[] = [];
  const pool = AFFIX_POOLS[def.kind];
  let n = RARITY.get(r)?.affixes ?? 0;
  if (def.kind === 'accesorio') n = Math.max(1, n);
  const level = Math.max(def.level, opts.level ?? def.level);
  for (let i = 0; pool && i < n; i++) {
    const stat = rng.pick(pool);
    const value = affixValue(stat, level, rng);
    const existing = affixes.find((a) => a.stat === stat);
    if (existing) existing.value += value;
    else affixes.push({ stat, value });
  }
  return { uid: newUid(), id, rarity: r, qty: Math.max(1, opts.qty ?? 1), affixes };
}

export function itemDef(it: ItemInstance): ItemDef {
  const d = getItem(it.id);
  if (!d) throw new Error(`Objeto desconocido: ${it.id}`);
  return d;
}

/** Nombre a mostrar: los raros o mejores llevan afijo ("Espada larga del Oso", "Feroz Hacha de guerra del Oso +2"). */
export function displayName(it: ItemInstance): string {
  const def = itemDef(it);
  let name = def.name;
  if (!def.unique && !def.set && !def.plain && !def.stackable && it.affixes.length) {
    const sorted = [...it.affixes].sort((a, b) => b.value - a.value);
    const idx = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'].indexOf(it.rarity);
    if (idx >= 2) name = `${name} ${AFFIX_SUFFIX[sorted[0]!.stat]}`;
    if (idx >= 3 && sorted[1]) name = `${AFFIX_PREFIX[sorted[1].stat]} ${name}`;
  }
  return it.plus ? `${name} +${it.plus}` : name;
}

/** Por qué este personaje no puede equipar el objeto (null = puede). */
export function equipBlock(def: ItemDef, classId: string, level: number): string | null {
  if (def.classes && !def.classes.includes(classId)) return 'Tu clase no puede usar este objeto.';
  if (def.reqLevel && level < def.reqLevel) return `Necesitas nivel ${def.reqLevel}.`;
  return null;
}

/** Bonos de conjunto activos con las piezas equipadas. */
export function setBonuses(worn: ItemInstance[]): Array<{ set: string; count: number; stats: Partial<Record<BonusStat, number>>; text: string }> {
  const out: Array<{ set: string; count: number; stats: Partial<Record<BonusStat, number>>; text: string }> = [];
  for (const set of SETS.values()) {
    const n = new Set(worn.filter((w) => set.pieces.includes(w.id)).map((w) => w.id)).size;
    for (const b of set.bonuses) if (n >= b.count) out.push({ set: set.name, count: b.count, stats: b.stats, text: b.text });
  }
  return out;
}

export function rarityOf(it: ItemInstance) {
  return RARITY.get(it.rarity) ?? RARITY.get('comun')!;
}

/** Precio de compra base (rareza incluida). La venta será un % de esto (Hito 5). */
export function itemValue(it: ItemInstance): number {
  const def = itemDef(it);
  const bonus = it.affixes.reduce((s, a) => s + a.value, 0) * 3;
  const plus = (it.plus ?? 0) * Math.max(10, def.value * 0.25);
  return Math.round(def.value * rarityOf(it).priceMult + bonus + plus);
}

/** Ranuras donde puede ir un objeto. */
export function slotsFor(def: ItemDef): EquipSlot[] {
  if (!def.slot) return [];
  if (def.slot === 'accesorio') return ['accesorio1', 'accesorio2'];
  return [def.slot];
}

export function isEquippable(def: ItemDef): boolean {
  return slotsFor(def).length > 0;
}

/** Suma de bonos (fijos + aleatorios + poder de rareza) de un objeto. */
export function itemBonuses(it: ItemInstance): Partial<Record<BonusStat, number>> {
  const def = itemDef(it);
  const out: Partial<Record<BonusStat, number>> = { ...(def.stats ?? {}) };
  for (const a of it.affixes) out[a.stat] = (out[a.stat] ?? 0) + a.value;
  if (it.plus) {
    if (def.weapon) out.daño = (out.daño ?? 0) + it.plus;
    else if (def.armor) out.ca = (out.ca ?? 0) + Math.ceil(it.plus / 2);
    else out.ataque = (out.ataque ?? 0) + it.plus;
  }
  return out;
}

/** Texto corto de los bonos de un objeto ("+2 FUE, +1 CA"). */
export function describeBonuses(b: Partial<Record<BonusStat, number>>): string {
  return Object.entries(b)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${STAT_LABEL[k as BonusStat]}`)
    .join(', ');
}
