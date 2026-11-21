/** Inventario por huecos (no por peso: más claro en móvil) y equipo. */
import { EQUIP_SLOTS, type EquipSlot } from '@/data/schema';
import { itemDef, slotsFor, type ItemInstance } from './items';

/** Huecos de la mochila. Una pila de consumibles ocupa un hueco. */
export const INVENTORY_SLOTS = 24;

export type Equipment = Partial<Record<EquipSlot, ItemInstance>>;

export interface Carrier {
  inventory: ItemInstance[];
  equipment: Equipment;
}

/** Huecos libres. */
export function freeSlots(c: Carrier): number {
  return INVENTORY_SLOTS - c.inventory.length;
}

/**
 * Añade un objeto apilando si se puede. Devuelve la cantidad que NO cupo
 * (0 si entró todo).
 */
export function addItem(c: Carrier, it: ItemInstance): number {
  const def = itemDef(it);
  let left = it.qty;
  if (def.stackable) {
    const max = def.maxStack ?? 99;
    for (const s of c.inventory) {
      if (left <= 0) break;
      if (s.id !== it.id || s.qty >= max) continue;
      const add = Math.min(max - s.qty, left);
      s.qty += add;
      left -= add;
    }
    while (left > 0 && c.inventory.length < INVENTORY_SLOTS) {
      const add = Math.min(max, left);
      c.inventory.push({ ...it, uid: `${it.uid}${c.inventory.length}`, qty: add, affixes: [] });
      left -= add;
    }
    return left;
  }
  if (c.inventory.length >= INVENTORY_SLOTS) return it.qty;
  c.inventory.push(it);
  return 0;
}

/** Cuenta unidades de un objeto en la mochila. */
export function countItem(c: Carrier, id: string): number {
  return c.inventory.filter((s) => s.id === id).reduce((a, s) => a + s.qty, 0);
}

/** Quita `qty` unidades de una pila concreta. */
export function removeQty(c: Carrier, uid: string, qty = 1): boolean {
  const i = c.inventory.findIndex((s) => s.uid === uid);
  const s = c.inventory[i];
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) c.inventory.splice(i, 1);
  return true;
}

/**
 * Equipa un objeto de la mochila. Lo que estuviera en esa ranura vuelve a la
 * mochila. Un arma a dos manos libera la mano secundaria y viceversa.
 * Devuelve un mensaje de error o null.
 */
export function equip(c: Carrier, uid: string, preferred?: EquipSlot): string | null {
  const idx = c.inventory.findIndex((s) => s.uid === uid);
  const it = c.inventory[idx];
  if (!it) return 'Ese objeto no está en tu mochila.';
  const def = itemDef(it);
  const slots = slotsFor(def);
  if (slots.length === 0) return 'Eso no se puede equipar.';
  const slot = preferred && slots.includes(preferred) ? preferred : (slots.find((s) => !c.equipment[s]) ?? slots[0]!);

  // Qué hay que quitar para ponerse esto
  const toRemove: EquipSlot[] = [];
  if (c.equipment[slot]) toRemove.push(slot);
  if (slot === 'arma' && def.weapon?.twoHanded && c.equipment.secundaria) toRemove.push('secundaria');
  if (slot === 'secundaria' && c.equipment.arma && itemDef(c.equipment.arma).weapon?.twoHanded) toRemove.push('arma');
  // Al sacar el objeto de la mochila se libera un hueco
  if (toRemove.length - 1 > freeSlots(c)) return 'No tienes sitio en la mochila para lo que te quitas.';

  c.inventory.splice(idx, 1);
  for (const s of toRemove) {
    c.inventory.push(c.equipment[s]!);
    delete c.equipment[s];
  }
  c.equipment[slot] = it;
  return null;
}

/** Quita un objeto equipado y lo guarda en la mochila. */
export function unequip(c: Carrier, slot: EquipSlot): string | null {
  const it = c.equipment[slot];
  if (!it) return null;
  if (freeSlots(c) <= 0) return 'La mochila está llena.';
  delete c.equipment[slot];
  c.inventory.push(it);
  return null;
}

export function equippedItems(c: Carrier): ItemInstance[] {
  return EQUIP_SLOTS.map((s) => c.equipment[s]).filter((x): x is ItemInstance => !!x);
}
