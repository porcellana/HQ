/**
 * Resumen compacto del botín al acabar una batalla: fichas con icono, color de rareza y destello.
 * Uso (en la escena de batalla): `lines.push(...lootSummary(res, xp))` en lugar del texto plano.
 */
import { RARITY, getItem } from '@/data/registry';
import type { Rarity } from '@/data/schema';
import type { BattleResult } from '@/game/battle/battle';
import { itemIconElement } from '@/gfx/items';
import { h } from './dom';

export function lootSummary(res: BattleResult, xp: number): HTMLElement[] {
  const out: HTMLElement[] = [h('p', { text: `+${xp} XP${res.gold ? ` · +${res.gold} ●` : ''}` })];
  if (!res.items.length) return out;
  const merged = new Map<string, { name: string; qty: number; rarity: string; id: string }>();
  for (const i of res.items) {
    const k = `${i.id}|${i.name}`;
    const cur = merged.get(k);
    if (cur) cur.qty += i.qty;
    else merged.set(k, { ...i });
  }
  const chips = [...merged.values()].map((i) => {
    const color = RARITY.get(i.rarity as Rarity)?.color ?? '#d8d4cc';
    const high = ['raro', 'epico', 'legendario'].includes(i.rarity);
    const def = getItem(i.id);
    return h('span', { class: `loot-chip${high ? ' glow' : ''}`, attrs: { style: `border-color:${color};color:${color};--rc:${color}` } }, [
      def ? itemIconElement(def.icon, 'item-icon') : null,
      `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`,
    ]);
  });
  out.push(h('div', { class: 'b-loot', attrs: { style: 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center' } }, chips));
  return out;
}
