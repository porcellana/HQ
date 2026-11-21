/**
 * PANTALLA DE MOCHILA Y EQUIPO
 * Arriba: ranuras de equipo + resumen (CA, ataque, daño). Abajo: mochila.
 * Al tocar un objeto se abre su ficha con la comparación respecto a lo que
 * llevas puesto en esa ranura y los botones Equipar / Usar / Soltar.
 */
import { EQUIP_SLOTS, type EquipSlot } from '@/data/schema';
import type { Game } from '@/game/game';
import { INVENTORY_SLOTS } from '@/game/items/inventory';
import { describeBonuses, itemBonuses, itemDef, itemValue, rarityOf, slotsFor, type ItemInstance } from '@/game/items/items';
import { formatMod } from '@/game/rules/character';
import { averageDice } from '@/game/rules/dice';
import { derive, type Derived } from '@/game/rules/derived';
import { itemIconElement } from '@/gfx/items';
import { h } from './dom';
import type { PlayerState } from '@/game/state';

const SLOT_LABEL: Record<EquipSlot, { name: string; icon: string }> = {
  cabeza: { name: 'Cabeza', icon: 'casco' },
  pecho: { name: 'Pecho', icon: 'pecho' },
  manos: { name: 'Manos', icon: 'guantes' },
  piernas: { name: 'Piernas', icon: 'piernas' },
  pies: { name: 'Pies', icon: 'botas' },
  arma: { name: 'Arma', icon: 'espada' },
  secundaria: { name: 'Mano izq.', icon: 'escudo' },
  herramienta: { name: 'Herramienta', icon: 'pico' },
  accesorio1: { name: 'Accesorio', icon: 'anillo' },
  accesorio2: { name: 'Accesorio', icon: 'amuleto' },
};

const KIND_LABEL: Record<string, string> = {
  arma: 'Arma', armadura: 'Armadura', secundaria: 'Mano secundaria', herramienta: 'Herramienta',
  accesorio: 'Accesorio', consumible: 'Consumible', material: 'Material',
};

export function inventoryScreen(game: Game, onClose: () => void, onChanged: () => void): HTMLElement {
  const root = h('div', { class: 'screen inventory' });
  const p = game.state.player;
  let selected: { it: ItemInstance; slot: EquipSlot | null } | null = null;

  const cell = (it: ItemInstance | undefined, onClick: () => void, label?: string, placeholder?: string) => {
    const r = it ? rarityOf(it) : null;
    const isSel = !!it && selected?.it.uid === it.uid;
    return h('button', {
      class: `inv-cell${it ? '' : ' empty'}${isSel ? ' sel' : ''}`,
      attrs: { style: r ? `border-color:${r.color}` : '', 'aria-label': it ? itemDef(it).name : (label ?? 'vacío') },
      onClick,
    }, [
      it ? itemIconElement(itemDef(it).icon) : placeholder ? itemIconElement({ shape: placeholder, color: '#3a3644' }, 'item-icon ghost') : null,
      it && it.qty > 1 ? h('span', { class: 'qty', text: `${it.qty}` }) : null,
      label ? h('span', { class: 'slot-label', text: label }) : null,
    ]);
  };

  const render = () => {
    const d = derive(p);
    const equipGrid = h('div', { class: 'equip-grid' },
      EQUIP_SLOTS.map((s) => cell(p.equipment[s], () => {
        const it = p.equipment[s];
        selected = it ? { it, slot: s } : null;
        render();
      }, SLOT_LABEL[s].name, SLOT_LABEL[s].icon)),
    );
    const bag = h('div', { class: 'bag-grid' }, [
      ...p.inventory.map((it) => cell(it, () => { selected = { it, slot: null }; render(); })),
      ...Array.from({ length: Math.max(0, INVENTORY_SLOTS - p.inventory.length) }, () => cell(undefined, () => { selected = null; render(); })),
    ]);
    const parts: Array<HTMLElement | null> = [
      h('h2', { text: 'Mochila y equipo' }),
      h('div', { class: 'derived' }, [
        stat('CA', `${d.ac}`), stat('Ataque', formatMod(d.toHit)), stat('Daño', `${d.weapon.dice}${formatMod(d.damageMod)}`),
        stat('PV', `${p.hp}/${p.maxHp}`), stat('Oro', `${p.gold}`),
      ]),
      h('div', { class: 'panel' }, [h('h3', { text: 'Equipado' }), equipGrid]),
      selected ? detail(game, selected.it, selected.slot, d, (msg) => { if (msg) game.events.emit('message', { text: msg, kind: 'warn' }); selected = null; onChanged(); render(); }) : null,
      h('div', { class: 'panel' }, [h('h3', { text: `Mochila (${p.inventory.length}/${INVENTORY_SLOTS})` }), bag]),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
    ];
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    // Que la ficha del objeto elegido quede a la vista.
    root.querySelector('.item-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  render();
  return root;
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'derived-item' }, [h('small', { text: label }), h('b', { text: value })]);
}

/**
 * Información de un objeto: cabecera, estadísticas y (si `compare`) la
 * comparación con lo que llevas en esa ranura. La usan la mochila y las tiendas.
 */
export function itemInfo(p: PlayerState, it: ItemInstance, compare: boolean, current: Derived = derive(p)): HTMLElement[] {
  const def = itemDef(it);
  const r = rarityOf(it);
  const lines: HTMLElement[] = [];
  if (def.weapon) {
    const w = def.weapon;
    lines.push(h('div', { text: `Daño ${w.dice} ${w.damageType} · usa ${w.stat}${w.range > 1 ? ` · alcance ${w.range}` : ''}${w.twoHanded ? ' · a dos manos' : ''}${w.critRange ? ` · crítico ${w.critRange}-20` : ''}` }));
    if (r.powerBonus) lines.push(h('div', { text: `+${r.powerBonus} al daño por rareza` }));
  }
  if (def.armor) lines.push(h('div', { text: `CA +${def.armor.ac + r.powerBonus}${def.armor.maxDex !== undefined ? ` · DES máx. +${def.armor.maxDex}` : ''}` }));
  const bonuses = describeBonuses(itemBonuses(it));
  if (bonuses) lines.push(h('div', { class: 'bonus', text: bonuses }));
  if (def.description) lines.push(h('div', { class: 'muted', text: def.description }));
  if (def.pickaxeTier) lines.push(h('div', { text: `Pico de nivel ${def.pickaxeTier} (minería en las mazmorras)` }));
  lines.push(h('div', { class: 'muted', text: `Nivel ${def.level} · Valor ${itemValue(it)} oro${it.qty > 1 ? ` · ×${it.qty}` : ''}` }));

  // Comparación: simula equiparlo y compara valores derivados
  let cmp: HTMLElement | null = null;
  const slots = slotsFor(def);
  if (compare && slots.length) {
    const target = slots.find((s) => !p.equipment[s]) ?? slots[0]!;
    const sim = { ...p, equipment: { ...p.equipment, [target]: it } as typeof p.equipment };
    if (target === 'arma' && def.weapon?.twoHanded) delete sim.equipment.secundaria;
    if (target === 'secundaria' && p.equipment.arma && itemDef(p.equipment.arma).weapon?.twoHanded) delete sim.equipment.arma;
    const after = derive(sim);
    const rows: Array<[string, number, number]> = [
      ['CA', current.ac, after.ac],
      ['Ataque', current.toHit, after.toHit],
      ['Daño medio', averageDice(current.weapon.dice) + current.damageMod, averageDice(after.weapon.dice) + after.damageMod],
      ['PV máx.', current.maxHp, after.maxHp],
      ['Recurso máx.', current.maxMp, after.maxMp],
      ...(['FUE', 'DES', 'CON', 'INT', 'SAB', 'CAR'] as const).map((k): [string, number, number] => [k, current.stats[k], after.stats[k]]),
    ];
    const changes = rows.filter(([, a, b]) => a !== b);
    const worn = p.equipment[target];
    cmp = h('div', { class: 'compare' }, [
      h('small', { class: 'muted', text: worn ? `Comparado con ${itemDef(worn).name}:` : 'Ranura vacía:' }),
      ...(changes.length
        ? changes.map(([k, a, b]) => h('div', { class: b > a ? 'up' : 'down', text: `${k}: ${fmt(a)} → ${fmt(b)} (${b > a ? '▲' : '▼'} ${fmt(Math.abs(b - a))})` }))
        : [h('div', { class: 'muted', text: 'Sin cambios en tus estadísticas.' })]),
    ]);
  }

  const head = h('div', { class: 'item-head' }, [
    itemIconElement(def.icon, 'item-icon big'),
    h('div', {}, [
      h('b', { text: def.name, attrs: { style: `color:${r.color}` } }),
      h('small', { class: 'muted', text: ` ${KIND_LABEL[def.kind] ?? def.kind} · ${r.name}` }),
    ]),
  ]);
  return [head, ...lines, ...(cmp ? [cmp] : [])];
}

/** Ficha de un objeto de la mochila con acciones. */
function detail(game: Game, it: ItemInstance, equippedSlot: EquipSlot | null, current: Derived, done: (err: string | null) => void): HTMLElement {
  const def = itemDef(it);
  const r = rarityOf(it);
  const slots = slotsFor(def);
  const buttons: HTMLElement[] = [];
  if (equippedSlot) {
    buttons.push(h('button', { text: 'Quitar', onClick: () => done(game.unequipSlot(equippedSlot)) }));
  } else {
    if (slots.length) buttons.push(h('button', { class: 'primary', text: 'Equipar', onClick: () => done(game.equipItem(it.uid)) }));
    if (def.use) buttons.push(h('button', { class: 'primary', text: 'Usar', onClick: () => done(game.useItem(it.uid)) }));
    buttons.push(h('button', { class: 'danger', text: 'Soltar', onClick: () => { game.dropItem(it.uid); done(null); } }));
  }
  return h('div', { class: 'panel item-detail', attrs: { style: `border-color:${r.color}` } }, [
    ...itemInfo(game.state.player, it, !equippedSlot, current),
    h('div', { class: 'item-buttons' }, buttons),
  ]);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}
