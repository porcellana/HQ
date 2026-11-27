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
import { MAX_PLUS, gamblePrice, upgradeCost } from './curve';

export interface ShopState {
  /** Turno a partir del cual se renueva el stock. */
  restockAt: number;
  items: ItemInstance[];
  /** Lo que has vendido y se puede recomprar (con lo que te pagaron por unidad). */
  buyback?: Array<{ item: ItemInstance; paid: number }>;
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

/** Precio de compra de UNA unidad. `discount` = % ganado en diálogos (0..50). */
export function buyPrice(it: ItemInstance, shop: ShopDef, cha: number, discount = 0): number {
  return Math.max(1, Math.round(itemValue({ ...it, qty: 1 }) * shop.priceMult * buyDiscount(cha) * (1 - Math.min(50, discount) / 100)));
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
        const it = randomEquipment(rng, e.pool, Math.max(1, shop.level + rng.int(-1, 0)), shop.minRarity ? { minRarity: shop.minRarity } : {});
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
export function buy(t: Trader, shopId: string, c: Customer, cha: number, uid: string, qty = 1, discount = 0): string | null {
  const shop = getShop(shopId);
  const st = ensureStock(t, shopId);
  const it = st.items.find((x) => x.uid === uid);
  if (!it) return 'Ese objeto ya no está a la venta.';
  const n = Math.min(qty, it.qty);
  const cost = buyPrice(it, shop, cha, discount) * n;
  if (c.gold < cost) return `No tienes suficiente oro (cuesta ${cost}).`;
  if (freeSlots(c) <= 0 && !c.inventory.some((x) => x.id === it.id && itemDef(x).stackable)) return 'Tu mochila está llena.';
  const bought: ItemInstance = { ...it, uid: newUid(), qty: n, affixes: it.affixes.map((a) => ({ ...a })) };
  const left = addItem(c, bought);
  const got = n - left;
  if (got <= 0) return 'Tu mochila está llena.';
  c.gold -= buyPrice(it, shop, cha, discount) * got;
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
  // Lo vendido se puede recomprar (últimos 12).
  const bb = (st.buyback ??= []);
  bb.push({ item: { ...it, uid: newUid(), qty: n, affixes: it.affixes.map((a) => ({ ...a })) }, paid: sellPrice(it, shop, cha) });
  while (bb.length > 12) bb.shift();
  return gain;
}

/** Precio de recompra de una unidad: lo que te pagaron + 10 %. */
export function buybackPrice(paid: number): number {
  return Math.max(1, Math.ceil(paid * 1.1));
}

/** Recompra lo que vendiste. */
export function buyBack(t: Trader, shopId: string, c: Customer, uid: string, qty = 1): string | null {
  const st = ensureStock(t, shopId);
  const e = st.buyback?.find((x) => x.item.uid === uid);
  if (!e) return 'Ya no lo tienen.';
  const n = Math.min(qty, e.item.qty);
  const cost = buybackPrice(e.paid) * n;
  if (c.gold < cost) return `No tienes suficiente oro (cuesta ${cost}).`;
  const back: ItemInstance = { ...e.item, uid: newUid(), qty: n, affixes: e.item.affixes.map((a) => ({ ...a })) };
  const left = addItem(c, back);
  const got = n - left;
  if (got <= 0) return 'Tu mochila está llena.';
  c.gold -= buybackPrice(e.paid) * got;
  e.item.qty -= got;
  if (e.item.qty <= 0) st.buyback = st.buyback!.filter((x) => x !== e);
  return null;
}

/** ¿Es «basura» vendible en masa? Equipo común sin uso y materiales que ninguna misión pide. */
export function isJunk(it: ItemInstance, needed: ReadonlySet<string>): boolean {
  const d = itemDef(it);
  if (d.quest || needed.has(it.id)) return false;
  if (d.kind === 'material') return true;
  return ['arma', 'armadura', 'secundaria', 'accesorio'].includes(d.kind) && it.rarity === 'comun' && !it.plus;
}

/** Vende toda la basura de la mochila. Devuelve oro y unidades vendidas. */
export function sellJunk(t: Trader, shopId: string, c: Customer, cha: number, needed: ReadonlySet<string>): { gold: number; count: number } {
  const shop = getShop(shopId);
  let gold = 0, count = 0;
  for (const it of [...c.inventory]) {
    if (!isJunk(it, needed) || !shopBuys(shop, it)) continue;
    const q = it.qty;
    const r = sell(t, shopId, c, cha, it.uid, q);
    if (typeof r === 'number') { gold += r; count += q; }
  }
  return { gold, count };
}

/** Mejora un objeto (+1..+3) en un herrero. `it` puede ser de la mochila o del equipo. */
export function upgradeItem(shopId: string, c: Customer, it: ItemInstance): string | null {
  const shop = getShop(shopId);
  if (!shop.upgrades) return 'Aquí no mejoran equipo.';
  const d = itemDef(it);
  if (!['arma', 'armadura', 'secundaria', 'accesorio'].includes(d.kind)) return 'Eso no se puede mejorar.';
  const plus = it.plus ?? 0;
  if (plus >= MAX_PLUS) return 'Ya está al máximo (+3).';
  const cost = upgradeCost(d.value, plus);
  if (c.gold < cost) return `Necesitas ${cost} de oro.`;
  c.gold -= cost;
  it.plus = plus + 1;
  return null;
}

/** Bolsa misteriosa: equipo de la tienda con rareza al menos poco común (o algo de chatarra). */
export function gamble(shopId: string, c: Customer, rng: Rng, classId?: string): ItemInstance | string {
  const shop = getShop(shopId);
  if (!shop.gamble) return 'Aquí no hay apuestas.';
  const price = gamblePrice(shop.level);
  if (c.gold < price) return `La bolsa cuesta ${price} de oro.`;
  if (freeSlots(c) <= 0) return 'Tu mochila está llena.';
  c.gold -= price;
  const it = randomEquipment(rng, 'equipo', shop.level + 1, { minRarity: 'poco_comun', luck: 2, ...(classId ? { classId } : {}) })
    ?? createItem('lingote_hierro', 'comun', rng, { qty: 1 });
  addItem(c, it);
  return it;
}
