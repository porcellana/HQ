/**
 * COMERCIO
 *  - Compra: valor del objeto × multiplicador de la tienda, con un pequeño
 *    descuento por carisma (−2 % por punto de modificador, máx. −10 %).
 *  - Venta: porcentaje del precio de compra: 35 % + 3 % por punto de
 *    modificador de CAR (entre 20 % y 50 %).
 *  - El stock se guarda en la partida y se renueva cada `restockTurns` turnos.
 */
import { SHOPS, getItem } from '@/data/registry';
import type { ShopDef } from '@/data/schema';
import { Rng, hashString } from '@/engine/rng';
import { addItem, freeSlots } from '../items/inventory';
import { createItem, itemDef, itemValue, newUid, type ItemInstance } from '../items/items';
import { randomEquipment } from '../items/loot';
import { abilityModifier } from '../rules/dice';

export interface ShopState {
  /** Turno a partir del cual se renueva el stock. */
  restockAt: number;
  items: ItemInstance[];
}

export function getShop(id: string): ShopDef {
  const s = SHOPS.get(id);
  if (!s) throw new Error(`Tienda desconocida: ${id}`);
  return s;
}

export function buyDiscount(cha: number): number {
  return 1 - Math.max(-0.05, Math.min(0.1, 0.02 * abilityModifier(cha)));
}

export function sellRate(cha: number): number {
  return Math.max(0.2, Math.min(0.5, 0.35 + 0.03 * abilityModifier(cha)));
}

/** Precio de compra de UNA unidad. */
export function buyPrice(it: ItemInstance, shop: ShopDef, cha: number): number {
  return Math.max(1, Math.round(itemValue({ ...it, qty: 1 }) * shop.priceMult * buyDiscount(cha)));
}

/** Lo que te pagan por UNA unidad. */
export function sellPrice(it: ItemInstance, shop: ShopDef, cha: number): number {
  return Math.max(1, Math.floor(itemValue({ ...it, qty: 1 }) * shop.priceMult * sellRate(cha)));
}

export function shopBuys(shop: ShopDef, it: ItemInstance): boolean {
  return !shop.buys || shop.buys.includes(itemDef(it).kind);
}

/** Genera el stock de una tienda (determinista por semilla). */
export function generateStock(shop: ShopDef, rng: Rng): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const e of shop.stock) {
    if ('pool' in e) {
      const n = rng.int(e.count[0], e.count[1]);
      for (let i = 0; i < n; i++) {
        const it = randomEquipment(rng, e.pool, Math.max(1, shop.level + rng.int(-1, 0)));
        if (it) out.push(it);
      }
      continue;
    }
    if (!getItem(e.item)) {
      console.warn(`[tienda ${shop.id}] objeto desconocido: ${e.item}`);
      continue;
    }
    if (!rng.chance(e.chance ?? 1)) continue;
    const qty = e.qty ? rng.int(e.qty[0], e.qty[1]) : 1;
    if (qty > 0) out.push(createItem(e.item, 'comun', rng, { qty }));
  }
  return out;
}

export interface Trader {
  turn: number;
  seed: number;
  shops: Record<string, ShopState>;
}

/** Devuelve el stock actual, renovándolo si toca. */
export function ensureStock(t: Trader, shopId: string): ShopState {
  const shop = getShop(shopId);
  const cur = t.shops[shopId];
  if (cur && t.turn < cur.restockAt) return cur;
  const cycle = Math.floor(t.turn / Math.max(1, shop.restockTurns));
  const rng = new Rng(hashString(`${t.seed}:${shopId}:${cycle}`));
  const fresh: ShopState = { restockAt: t.turn + shop.restockTurns, items: generateStock(shop, rng) };
  t.shops[shopId] = fresh;
  return fresh;
}

export interface Customer {
  gold: number;
  stats: { CAR: number };
  inventory: ItemInstance[];
  equipment: Record<string, ItemInstance | undefined>;
}

/** Compra `qty` unidades de un objeto del stock. Devuelve un error o null. */
export function buy(t: Trader, shopId: string, c: Customer, cha: number, uid: string, qty = 1): string | null {
  const shop = getShop(shopId);
  const st = ensureStock(t, shopId);
  const it = st.items.find((x) => x.uid === uid);
  if (!it) return 'Ese objeto ya no está a la venta.';
  const n = Math.min(qty, it.qty);
  const cost = buyPrice(it, shop, cha) * n;
  if (c.gold < cost) return `No tienes suficiente oro (cuesta ${cost}).`;
  if (freeSlots(c) <= 0 && !c.inventory.some((x) => x.id === it.id && itemDef(x).stackable)) return 'Tu mochila está llena.';
  const bought: ItemInstance = { ...it, uid: newUid(), qty: n, affixes: it.affixes.map((a) => ({ ...a })) };
  const left = addItem(c, bought);
  const got = n - left;
  if (got <= 0) return 'Tu mochila está llena.';
  c.gold -= buyPrice(it, shop, cha) * got;
  it.qty -= got;
  if (it.qty <= 0) st.items = st.items.filter((x) => x !== it);
  return null;
}

/** Vende `qty` unidades de una pila de la mochila. Devuelve el oro ganado o un error. */
export function sell(t: Trader, shopId: string, c: Customer, cha: number, uid: string, qty = 1): number | string {
  const shop = getShop(shopId);
  const st = ensureStock(t, shopId);
  const idx = c.inventory.findIndex((x) => x.uid === uid);
  const it = c.inventory[idx];
  if (!it) return 'No tienes ese objeto.';
  if (!shopBuys(shop, it)) return 'Aquí no compran ese tipo de objeto.';
  const n = Math.min(qty, it.qty);
  const gain = sellPrice(it, shop, cha) * n;
  c.gold += gain;
  it.qty -= n;
  if (it.qty <= 0) c.inventory.splice(idx, 1);
  // Lo vendido queda a la venta (puedes recomprarlo).
  st.items.push({ ...it, uid: newUid(), qty: n });
  return gain;
}
