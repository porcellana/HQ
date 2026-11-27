/**
 * PANTALLA DE TIENDA: Comprar / Vender / Recomprar (+ Mejorar en herreros y Bolsa en el
 * mercado negro). Filtros por tipo, orden, flechas ▲▼ de comparación y venta de basura.
 */
import type { Game } from '@/game/game';
import { buyPrice, buybackPrice, getShop, sellPrice, shopBuys, isJunk } from '@/game/economy/shop';
import { MAX_PLUS, gamblePrice, upgradeCost } from '@/game/economy/curve';
import { displayName, equipBlock, itemDef, rarityOf, type ItemInstance } from '@/game/items/items';
import { RARITIES } from '@/data/registry';
import { itemIconElement } from '@/gfx/items';
import { h } from './dom';
import { gearDelta, itemInfo } from './inventory';

type Tab = 'comprar' | 'vender' | 'recomprar' | 'mejorar';
type Filter = 'todo' | 'arma' | 'armadura' | 'accesorio' | 'consumible' | 'material';
type Sort = 'precio' | 'nivel' | 'rareza' | 'nombre';

const FILTERS: Array<[Filter, string]> = [['todo', 'Todo'], ['arma', 'Armas'], ['armadura', 'Armad.'], ['accesorio', 'Acces.'], ['consumible', 'Consum.'], ['material', 'Mater.']];
const SORTS: Array<[Sort, string]> = [['precio', 'Precio'], ['nivel', 'Nivel'], ['rareza', 'Rareza'], ['nombre', 'A-Z']];
const SHOP_KIND: Record<string, string> = { general: 'Tienda', herrero: 'Herrería', alquimista: 'Alquimia', armero: 'Armería', magos: 'Arcanos', negro: 'Mercado negro' };

function matchesFilter(it: ItemInstance, f: Filter): boolean {
  if (f === 'todo') return true;
  const k = itemDef(it).kind;
  return f === 'armadura' ? k === 'armadura' || k === 'secundaria' : k === f;
}

export function shopScreen(game: Game, shopId: string, onClose: () => void, onChanged: () => void): HTMLElement {
  const shop = getShop(shopId);
  const root = h('div', { class: 'screen shop' });
  let tab: Tab = 'comprar';
  let filter: Filter = 'todo';
  let sort: Sort = 'precio';
  let selected: string | null = null;
  let note = '';
  let amount = 1;

  const render = () => {
    const p = game.state.player;
    const cha = game.derived.stats.CAR;
    const st = game.shopStock(shopId);
    const discount = game.shopDiscount(shopId);
    const rep = game.shopRep(shopId);
    const bbList = (st.buyback ?? []).map((e) => e.item);
    const equipped = Object.values(p.equipment).filter((x): x is ItemInstance => !!x);
    const upgradable = (it: ItemInstance) => ['arma', 'armadura', 'secundaria', 'accesorio'].includes(itemDef(it).kind);
    const source: ItemInstance[] = tab === 'comprar' ? st.items : tab === 'vender' ? p.inventory : tab === 'recomprar' ? bbList : [...equipped, ...p.inventory].filter(upgradable);
    const paid = (it: ItemInstance) => st.buyback?.find((e) => e.item.uid === it.uid)?.paid ?? 0;
    const priceOf = (it: ItemInstance) => {
      switch (tab) {
        case 'comprar': return buyPrice(it, shop, cha, discount);
        case 'vender': return sellPrice(it, shop, cha);
        case 'recomprar': return buybackPrice(paid(it));
        default: return upgradeCost(itemDef(it).value, it.plus ?? 0);
      }
    };
    const rar = (it: ItemInstance) => RARITIES.findIndex((r) => r.id === it.rarity);
    const list = source.filter((it) => matchesFilter(it, filter)).sort((a, b) => {
      switch (sort) {
        case 'precio': return priceOf(b) - priceOf(a);
        case 'nivel': return itemDef(b).level - itemDef(a).level;
        case 'rareza': return rar(b) - rar(a) || itemDef(b).level - itemDef(a).level;
        default: return displayName(a).localeCompare(displayName(b), 'es');
      }
    });
    const sel = list.find((x) => x.uid === selected) ?? null;
    const needed = new Set<string>();
    const junk = p.inventory.filter((it) => isJunk(it, needed) && shopBuys(shop, it));

    const rows = list.map((it) => {
      const def = itemDef(it);
      const r = rarityOf(it);
      const blockedSell = tab === 'vender' && !shopBuys(shop, it);
      const cant = !!equipBlock(def, p.classId, p.level) && (tab === 'comprar' || tab === 'recomprar');
      const tooExpensive = tab !== 'vender' && priceOf(it) > p.gold;
      const d = tab === 'comprar' || tab === 'recomprar' ? gearDelta(p, it) : 0;
      const isEq = equipped.includes(it);
      return h('button', {
        class: `shop-row${it.uid === selected ? ' sel' : ''}${blockedSell || tooExpensive || cant ? ' dim' : ''}`,
        onClick: () => { selected = it.uid; amount = 1; note = ''; render(); },
      }, [
        itemIconElement(def.icon, 'item-icon'),
        h('span', { class: 'name', text: `${displayName(it)}${it.qty > 1 ? ` ×${it.qty}` : ''}${isEq ? ' (puesto)' : ''}`, attrs: { style: `color:${r.color}` } }),
        d ? h('span', { class: d > 0 ? 'delta up' : 'delta down', text: d > 0 ? '▲' : '▼' }) : null,
        cant ? h('span', { class: 'delta down', text: '🔒' }) : null,
        h('span', { class: 'price', text: blockedSell ? 'no lo compra' : `${priceOf(it)} ●` }),
      ].filter((x): x is HTMLElement => !!x));
    });

    let detail: HTMLElement | null = null;
    if (sel) {
      const price = priceOf(sel);
      const stack = tab === 'mejorar' ? 1 : sel.qty;
      const max = Math.max(1, tab === 'vender' ? stack : Math.min(stack, Math.floor(p.gold / Math.max(1, price))));
      amount = Math.min(Math.max(1, amount), max);
      const name = displayName(sel);
      const actions: HTMLElement[] = [];
      const stepper = stack > 1
        ? h('div', { class: 'qty-stepper' }, [
            h('button', { class: 'mini', text: '−', disabled: amount <= 1, onClick: () => { amount--; render(); } }),
            h('b', { text: `${amount}` }),
            h('button', { class: 'mini', text: '+', disabled: amount >= max, onClick: () => { amount++; render(); } }),
            h('button', { class: 'mini', text: 'Máx', disabled: amount >= max, onClick: () => { amount = max; render(); } }),
          ])
        : null;
      const done = (err: string | null, ok: string) => { note = err ?? ok; if (!err) onChanged(); amount = 1; render(); };
      if (tab === 'comprar') {
        actions.push(h('button', { class: 'primary', text: `Comprar${amount > 1 ? ` ${amount}` : ''} (${price * amount} ●)`, disabled: price * amount > p.gold, onClick: () => done(game.buyFromShop(shopId, sel.uid, amount), `Compras ${amount > 1 ? `${amount} × ` : ''}${name}.`) }));
      } else if (tab === 'recomprar') {
        actions.push(h('button', { class: 'primary', text: `Recomprar${amount > 1 ? ` ${amount}` : ''} (${price * amount} ●)`, disabled: price * amount > p.gold, onClick: () => done(game.buyBackFromShop(shopId, sel.uid, amount), `Recompras ${name}.`) }));
      } else if (tab === 'vender') {
        if (shopBuys(shop, sel)) actions.push(h('button', { class: 'primary', text: `Vender${amount > 1 ? ` ${amount}` : ''} (${price * amount} ●)`, onClick: () => {
          const res = game.sellToShop(shopId, sel.uid, amount);
          note = typeof res === 'string' ? res : `Vendes ${amount > 1 ? `${amount} × ` : ''}${name} por ${res} de oro.`;
          if (typeof res !== 'string') onChanged();
          if (amount >= sel.qty) selected = null;
          amount = 1;
          render();
        } }));
      } else {
        const plus = sel.plus ?? 0;
        actions.push(h('button', { class: 'primary', text: plus >= MAX_PLUS ? 'Al máximo (+3)' : `Mejorar a +${plus + 1} (${price} ●)`, disabled: plus >= MAX_PLUS || price > p.gold, onClick: () => done(game.upgradeAtShop(shopId, sel.uid), `${name} mejora a +${plus + 1}.`) }));
      }
      detail = h('div', { class: 'panel item-detail', attrs: { style: `border-color:${rarityOf(sel).color}` } }, [
        ...itemInfo(p, sel, tab === 'comprar' || tab === 'recomprar'),
        ...(stepper ? [stepper] : []),
        h('div', { class: 'item-buttons' }, actions),
      ]);
    }

    const sortSelect = () => {
      const el = h('select', { class: 'chip sort', attrs: { 'aria-label': 'Ordenar' } },
        SORTS.map(([s, label]) => h('option', { text: `↕ ${label}`, attrs: { value: s, ...(s === sort ? { selected: 'selected' } : {}) } })));
      el.addEventListener('change', () => { sort = el.value as Sort; render(); });
      return el;
    };
    const tabBtn = (t: Tab, label: string) => h('button', { class: tab === t ? 'primary' : '', text: label, onClick: () => { tab = t; selected = null; note = ''; render(); } });
    const empty = { comprar: 'No queda nada a la venta. Vuelve más tarde.', vender: 'No llevas nada que vender.', recomprar: 'No has vendido nada aquí.', mejorar: 'No llevas equipo que mejorar.' }[tab];
    const parts: Array<HTMLElement | null> = [
      h('h2', { text: shop.name }),
      h('div', { class: 'shop-gold' }, [
        `Oro: `, h('b', { text: `${p.gold} ●` }),
        h('small', { class: 'muted', text: `  ·  ${SHOP_KIND[shop.kind ?? 'general']}${discount ? ` · −${discount} %` : ''}${rep.next !== null ? ` · rep. ${rep.spent}` : ' · cliente VIP'}` }),
      ]),
      h('div', { class: 'tabs' }, [
        tabBtn('comprar', 'Comprar'), tabBtn('vender', 'Vender'), tabBtn('recomprar', `Recompra${bbList.length ? ` (${bbList.length})` : ''}`),
        ...(shop.upgrades ? [tabBtn('mejorar', 'Mejorar')] : []),
      ]),
      h('div', { class: 'shop-filters' }, [
        ...FILTERS.map(([f, label]) => h('button', { class: `chip${filter === f ? ' on' : ''}`, text: label, onClick: () => { filter = f; render(); } })),
        sortSelect(),
      ]),
      tab === 'vender' && junk.length
        ? h('button', { class: 'junk-btn', text: `Vender basura (${junk.reduce((a, x) => a + x.qty, 0)} · ${junk.reduce((a, x) => a + sellPrice(x, shop, cha) * x.qty, 0)} ●)`, onClick: () => {
          const r = game.sellJunkToShop(shopId);
          note = `Vendes ${r.count} objetos por ${r.gold} de oro.`;
          selected = null;
          if (r.count) onChanged();
          render();
        } })
        : null,
      tab === 'comprar' && shop.gamble
        ? h('button', { class: 'junk-btn', text: `🎲 Bolsa misteriosa (${gamblePrice(shop.level)} ●)`, disabled: p.gold < gamblePrice(shop.level), onClick: () => {
          const res = game.gambleAtShop(shopId);
          if (typeof res === 'string') note = res;
          else { note = `La bolsa contenía: ${displayName(res)} (${rarityOf(res).name}).`; onChanged(); }
          render();
        } })
        : null,
      note ? h('div', { class: 'shop-note', text: note }) : null,
      detail,
      h('div', { class: 'panel shop-list' }, rows.length ? rows : [h('p', { class: 'muted', text: filter !== 'todo' && source.length ? 'Nada de este tipo.' : empty })]),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Salir de la tienda', onClick: onClose })]),
    ];
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    root.querySelector('.item-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  render();
  return root;
}
