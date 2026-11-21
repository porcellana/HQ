/**
 * PANTALLA DE TIENDA: pestañas Comprar / Vender. Al tocar un objeto se ve su
 * ficha (con comparación de estadísticas) y el precio.
 */
import type { Game } from '@/game/game';
import { buyPrice, getShop, sellPrice, shopBuys } from '@/game/economy/shop';
import { itemDef, rarityOf, type ItemInstance } from '@/game/items/items';
import { itemIconElement } from '@/gfx/items';
import { h } from './dom';
import { itemInfo } from './inventory';

export function shopScreen(game: Game, shopId: string, onClose: () => void, onChanged: () => void): HTMLElement {
  const shop = getShop(shopId);
  const root = h('div', { class: 'screen shop' });
  let tab: 'comprar' | 'vender' = 'comprar';
  let selected: string | null = null;
  let note = '';
  /** Cantidad elegida para comprar/vender la pila seleccionada. */
  let amount = 1;

  const render = () => {
    const p = game.state.player;
    const cha = game.derived.stats.CAR;
    const stock = game.shopStock(shopId).items;
    const list: ItemInstance[] = tab === 'comprar' ? stock : p.inventory;
    const discount = game.shopDiscount(shopId);
    const priceOf = (it: ItemInstance) => (tab === 'comprar' ? buyPrice(it, shop, cha, discount) : sellPrice(it, shop, cha));
    const sel = list.find((x) => x.uid === selected) ?? null;

    const rows = list.map((it) => {
      const def = itemDef(it);
      const r = rarityOf(it);
      const blocked = tab === 'vender' && !shopBuys(shop, it);
      const tooExpensive = tab === 'comprar' && priceOf(it) > p.gold;
      return h('button', {
        class: `shop-row${it.uid === selected ? ' sel' : ''}${blocked || tooExpensive ? ' dim' : ''}`,
        onClick: () => { selected = it.uid; amount = 1; note = ''; render(); },
      }, [
        itemIconElement(def.icon, 'item-icon'),
        h('span', { class: 'name', text: `${def.name}${it.qty > 1 ? ` ×${it.qty}` : ''}`, attrs: { style: `color:${r.color}` } }),
        h('span', { class: 'price', text: blocked ? 'no lo compra' : `${priceOf(it)} ●` }),
      ]);
    });

    let detail: HTMLElement | null = null;
    if (sel) {
      const price = priceOf(sel);
      // Máximo: lo que hay en la pila (y, al comprar, lo que te puedes permitir).
      const max = Math.max(1, tab === 'comprar' ? Math.min(sel.qty, Math.floor(p.gold / Math.max(1, price))) : sel.qty);
      amount = Math.min(Math.max(1, amount), max);
      const name = itemDef(sel).name;
      const actions: HTMLElement[] = [];
      const stepper = sel.qty > 1
        ? h('div', { class: 'qty-stepper' }, [
            h('button', { class: 'mini', text: '−', disabled: amount <= 1, onClick: () => { amount--; render(); } }),
            h('b', { text: `${amount}` }),
            h('button', { class: 'mini', text: '+', disabled: amount >= max, onClick: () => { amount++; render(); } }),
            h('button', { class: 'mini', text: '+5', disabled: amount >= max, onClick: () => { amount = Math.min(max, amount + 5); render(); } }),
            h('button', { class: 'mini', text: 'Máx', disabled: amount >= max, onClick: () => { amount = max; render(); } }),
          ])
        : null;
      if (tab === 'comprar') {
        actions.push(h('button', { class: 'primary', text: `Comprar ${amount > 1 ? `${amount} ` : ''}(${price * amount} oro)`, disabled: price * amount > p.gold, onClick: () => {
          const err = game.buyFromShop(shopId, sel.uid, amount);
          note = err ?? `Compras ${amount > 1 ? `${amount} × ` : ''}${name}.`;
          if (!err) onChanged();
          amount = 1;
          render();
        } }));
      } else if (shopBuys(shop, sel)) {
        actions.push(h('button', { class: 'primary', text: `Vender ${amount > 1 ? `${amount} ` : ''}(${price * amount} oro)`, onClick: () => {
          const res = game.sellToShop(shopId, sel.uid, amount);
          note = typeof res === 'string' ? res : `Vendes ${amount > 1 ? `${amount} × ` : ''}${name} por ${res} de oro.`;
          if (typeof res !== 'string') onChanged();
          if (amount >= sel.qty) selected = null;
          amount = 1;
          render();
        } }));
      }
      detail = h('div', { class: 'panel item-detail', attrs: { style: `border-color:${rarityOf(sel).color}` } }, [
        ...itemInfo(p, sel, tab === 'comprar'),
        ...(stepper ? [h('small', { class: 'muted', text: 'Cantidad:' }), stepper] : []),
        h('div', { class: 'item-buttons' }, actions),
      ]);
    }

    const parts: Array<HTMLElement | null> = [
      h('h2', { text: shop.name }),
      h('div', { class: 'shop-gold' }, [`Tu oro: `, h('b', { text: `${p.gold} ●` }), h('small', { class: 'muted', text: `  ·  Vendes al ${Math.round(sellPriceRate(game) * 100)} % (CAR)${discount ? `  ·  Descuento ${discount} %` : ''}` })]),
      h('div', { class: 'tabs' }, [
        h('button', { class: tab === 'comprar' ? 'primary' : '', text: 'Comprar', onClick: () => { tab = 'comprar'; selected = null; note = ''; render(); } }),
        h('button', { class: tab === 'vender' ? 'primary' : '', text: 'Vender', onClick: () => { tab = 'vender'; selected = null; note = ''; render(); } }),
      ]),
      note ? h('div', { class: 'shop-note', text: note }) : null,
      detail,
      h('div', { class: 'panel shop-list' }, rows.length ? rows : [h('p', { class: 'muted', text: tab === 'comprar' ? 'No queda nada a la venta. Vuelve más tarde.' : 'No llevas nada que vender.' })]),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Salir de la tienda', onClick: onClose })]),
    ];
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    root.querySelector('.item-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  render();
  return root;
}

function sellPriceRate(game: Game): number {
  const mod = Math.floor((game.derived.stats.CAR - 10) / 2);
  return Math.max(0.2, Math.min(0.5, 0.35 + 0.03 * mod));
}
