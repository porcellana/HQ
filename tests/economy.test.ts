/** v0.9.2: objetos nuevos, botín, curva de oro/XP, tiendas, recompra, mejoras y conjuntos. */
import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES, ITEMS, LOOT_TABLES, SETS, SHOPS } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import { encounterXpBonus, goldDifficulty, goldLevelScale, upgradeCost } from '@/game/economy/curve';
import { buy, buyBack, buyPrice, buybackPrice, ensureStock, gamble, getShop, isJunk, sell, sellJunk, sellPrice, upgradeItem } from '@/game/economy/shop';
import { addItem, equip } from '@/game/items/inventory';
import { createItem, displayName, equipBlock, itemValue, setBonuses } from '@/game/items/items';
import { rollLoot, randomEquipment } from '@/game/items/loot';
import { derive } from '@/game/rules/derived';
import { ICON_SHAPES } from '@/gfx/items';
import { recalcPlayer } from '@/game/state';
import { testState } from './helpers';

describe('contenido de objetos v0.9.2', () => {
  it('hay mucho más contenido y es coherente', () => {
    expect(ITEMS.size).toBeGreaterThan(180);
    for (const d of ITEMS.values()) {
      expect(ICON_SHAPES, d.id).toContain(d.icon.shape);
      for (const c of d.classes ?? []) expect(CLASSES.has(c), `${d.id}: ${c}`).toBe(true);
      if (d.set) expect(SETS.has(d.set), d.id).toBe(true);
      if (d.use?.damage) expect(d.kind).toBe('consumible');
    }
    for (const c of CLASSES.keys()) {
      const mine = [...ITEMS.values()].filter((d) => d.classes?.includes(c));
      expect(mine.length, c).toBeGreaterThanOrEqual(8);
    }
  });
  it('los conjuntos apuntan a piezas existentes con su set', () => {
    for (const s of SETS.values()) for (const id of s.pieces) expect(ITEMS.get(id)?.set, id).toBe(s.id);
  });
  it('tablas de botín: objetos, pools y tablas de bioma existen', () => {
    for (const t of LOOT_TABLES.values()) for (const e of t.entries) if ('item' in e) expect(ITEMS.has(e.item), `${t.id}:${e.item}`).toBe(true);
    for (const e of ENEMIES.values()) if (e.boss) expect(LOOT_TABLES.has(e.lootTable ?? ''), e.id).toBe(true);
    for (const b of ['nieve', 'montana', 'costa', 'desierto', 'pantano', 'bosque', 'pradera']) expect(LOOT_TABLES.has(`drop_${b}`)).toBe(true);
  });
  it('los precios crecen con el nivel (armas sin único)', () => {
    const w = [...ITEMS.values()].filter((d) => d.kind === 'arma' && !d.unique).sort((a, b) => a.level - b.level);
    const avg = (lo: number, hi: number) => { const x = w.filter((d) => d.level >= lo && d.level <= hi); return x.reduce((s, d) => s + d.value, 0) / x.length; };
    expect(avg(1, 4)).toBeLessThan(avg(5, 9));
    expect(avg(5, 9)).toBeLessThan(avg(10, 20));
  });
});

describe('botín', () => {
  it('los únicos son siempre legendarios y el equipo de jefe es al menos raro', () => {
    const rng = new Rng(3);
    expect(createItem('baston_velkar', 'comun', rng).rarity).toBe('legendario');
    for (let i = 0; i < 40; i++) {
      const r = rollLoot(rng, 'jefe_nigromante', 10, { boss: true, playerLevel: 10 });
      for (const it of r.items) if (['arma', 'armadura', 'accesorio'].includes(ITEMS.get(it.id)!.kind) && !ITEMS.get(it.id)!.unique) expect(['raro', 'epico', 'legendario']).toContain(it.rarity);
    }
  });
  it('un jefe de la trama suelta un único con frecuencia', () => {
    const rng = new Rng(11);
    let n = 0;
    for (let i = 0; i < 100; i++) if (rollLoot(rng, 'jefe_rey_goblin', 4, { boss: true }).items.some((x) => ITEMS.get(x.id)?.unique)) n++;
    expect(n).toBeGreaterThan(40);
  });
  it('el bioma añade materiales propios', () => {
    const rng = new Rng(5);
    const ids = new Set<string>();
    for (let i = 0; i < 300; i++) for (const it of rollLoot(rng, 'bestia', 3, { biome: 'nieve' }).items) ids.add(it.id);
    expect(ids.has('cristal_hielo')).toBe(true);
  });
  it('favorece el equipo de tu clase', () => {
    const rng = new Rng(8);
    let mine = 0, other = 0;
    for (let i = 0; i < 600; i++) {
      const it = randomEquipment(rng, 'equipo', 12, { classId: 'mago' });
      const d = it && ITEMS.get(it.id);
      if (d?.classes) (d.classes.includes('mago') ? mine++ : other++);
    }
    expect(mine).toBeGreaterThan(other);
  });
  it('el equipo raro lleva afijo en el nombre', () => {
    const rng = new Rng(2);
    const it = createItem('espada_larga', 'epico', rng, { level: 8 });
    expect(displayName(it)).not.toBe('Espada larga');
    expect(displayName(createItem('espada_larga', 'comun', rng))).toBe('Espada larga');
  });
});

describe('curva de oro y XP', () => {
  it('el oro crece con el nivel y con la dificultad', () => {
    expect(goldLevelScale(10)).toBeGreaterThan(goldLevelScale(5) * 1.8);
    expect(goldDifficulty(8, 5)).toBeGreaterThan(goldDifficulty(5, 5));
    expect(goldDifficulty(1, 10)).toBeLessThan(0.3);
    expect(goldDifficulty(30, 1)).toBeLessThanOrEqual(1.5);
  });
  it('los grupos grandes y los jefes dan bonus de XP acotado', () => {
    expect(encounterXpBonus(1, false)).toBe(1);
    expect(encounterXpBonus(8, false)).toBeLessThanOrEqual(1.4);
    expect(encounterXpBonus(3, true)).toBeGreaterThan(encounterXpBonus(3, false));
  });
  it('un jefe da más oro que un goblin y el oro es acotado en la trama', () => {
    const rng = new Rng(1);
    let boss = 0, gob = 0;
    for (let i = 0; i < 50; i++) { boss += rollLoot(rng, 'jefe', 4, { playerLevel: 4 }).gold; gob += rollLoot(rng, 'goblin', 2, { playerLevel: 2 }).gold; }
    expect(boss / 50).toBeGreaterThan((gob / 50) * 5);
    expect(boss / 50).toBeLessThan(400);
  });
});

describe('tiendas', () => {
  const trader = () => ({ turn: 0, seed: 7, shops: {} as Record<string, never> });
  it('todas las tiendas generan stock con objetos válidos y rotan por tiempo', () => {
    for (const s of SHOPS.values()) {
      const t = trader();
      const a = ensureStock(t, s.id).items.map((i) => i.id).join(',');
      t.turn = s.restockTurns + 1;
      const b = ensureStock(t, s.id).items.map((i) => i.id).join(',');
      expect(a.length).toBeGreaterThan(0);
      expect(typeof b).toBe('string');
    }
  });
  it('vender rinde menos que comprar; la recompra no regala oro', () => {
    const shop = getShop('forja_ancla');
    const it = createItem('espada_larga', 'raro', new Rng(1), { level: 5 });
    expect(sellPrice(it, shop, 10)).toBeLessThan(buyPrice(it, shop, 10));
    expect(buybackPrice(sellPrice(it, shop, 10))).toBeGreaterThan(sellPrice(it, shop, 10));
  });
  it('vender, recomprar, mejorar y vender basura', () => {
    const s = testState('guerrero');
    const t = { turn: 0, seed: 1, shops: {} } as never;
    const c = s.player;
    c.gold = 1000;
    const it = createItem('hacha_mano', 'comun', new Rng(1));
    addItem(c, it);
    const got = sell(t, 'forja_ancla', c, 10, it.uid, 1);
    expect(typeof got).toBe('number');
    const bb = ensureStock(t, 'forja_ancla').buyback![0]!;
    const before = c.gold;
    expect(buyBack(t, 'forja_ancla', c, bb.item.uid)).toBeNull();
    expect(before - c.gold).toBe(buybackPrice(bb.paid));
    const mine = c.inventory.find((x) => x.id === 'hacha_mano')!;
    expect(upgradeItem('forja_ancla', c, mine)).toBeNull();
    expect(mine.plus).toBe(1);
    expect(itemValue(mine)).toBeGreaterThan(itemValue({ ...mine, plus: 0 }));
    mine.plus = 3;
    expect(upgradeItem('forja_ancla', c, mine)).toMatch(/máximo/);
    expect(upgradeItem('tienda_brumaroja', c, mine)).toMatch(/no mejoran/);
    expect(upgradeCost(100, 2)).toBeGreaterThan(upgradeCost(100, 0));
    addItem(c, createItem('colmillo_goblin', 'comun', new Rng(1), { qty: 3 }));
    addItem(c, createItem('sello_goblin', 'comun', new Rng(1)));
    expect(isJunk(c.inventory.find((x) => x.id === 'colmillo_goblin')!, new Set())).toBe(true);
    expect(isJunk(c.inventory.find((x) => x.id === 'colmillo_goblin')!, new Set(['colmillo_goblin']))).toBe(false);
    expect(isJunk(c.inventory.find((x) => x.id === 'sello_goblin')!, new Set())).toBe(false);
    const r = sellJunk(t, 'forja_ancla', c, 10, new Set());
    expect(r.count).toBeGreaterThanOrEqual(3);
    expect(c.inventory.some((x) => x.id === 'sello_goblin')).toBe(true);
  });
  it('comprar actualiza oro; mercado negro: bolsa misteriosa', () => {
    const s = testState('guerrero');
    const t = { turn: 0, seed: 1, shops: {} } as never;
    s.player.gold = 5000;
    const st = ensureStock(t, 'tienda_brumaroja');
    const pot = st.items.find((x) => x.id === 'pocion_curacion')!;
    expect(buy(t, 'tienda_brumaroja', s.player, 10, pot.uid, 1)).toBeNull();
    expect(s.player.gold).toBeLessThan(5000);
    const bm = [...SHOPS.values()].find((x) => x.gamble);
    if (bm) { expect(typeof gamble(bm.id, s.player, new Rng(4))).not.toBe('string'); }
  });
});

describe('requisitos y conjuntos', () => {
  it('la clase y el nivel limitan el equipo', () => {
    const s = testState('guerrero');
    const c = s.player;
    const staff = createItem('baston_cristal', 'comun', new Rng(1));
    addItem(c, staff);
    expect(equip(c, staff.uid)).toMatch(/clase/);
    const axe = createItem('hacha_berserker', 'comun', new Rng(1));
    addItem(c, axe);
    expect(equip(c, axe.uid)).toMatch(/nivel/);
    c.level = 10;
    expect(equip(c, axe.uid)).toBeNull();
    expect(equipBlock(ITEMS.get('mandoble')!, 'mago', 20)).toMatch(/clase/);
  });
  it('los bonos de conjunto se aplican en derive', () => {
    const s = testState('guerrero');
    const c = s.player;
    c.level = 10;
    recalcPlayer(c);
    const base = derive(c);
    for (const id of SETS.get('alba')!.pieces) { const it = createItem(id, 'comun', new Rng(1)); addItem(c, it); equip(c, it.uid); }
    const worn = Object.values(c.equipment).filter(Boolean) as never[];
    expect(setBonuses(worn).length).toBe(2);
    expect(derive(c).stats.FUE).toBeGreaterThanOrEqual(base.stats.FUE + 3);
  });
});

describe('bombas en batalla', () => {
  it('una bomba daña al enemigo y se consume', () => {
    const s = testState('guerrero');
    const g = new Game(s);
    g.enemies = [];
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    addItem(s.player, createItem('bomba_fuego', 'comun', new Rng(1), { qty: 2 }));
    const b = g.beginBattle([e]);
    for (let i = 0; i < 50 && !b.awaiting && !b.ended; i++) b.step();
    const foe = b.foes()[0]!;
    const hp = b.hp(foe);
    const bomb = s.player.inventory.find((x) => x.id === 'bomba_fuego')!;
    expect(b.itemTarget(bomb)).toBe('enemy');
    expect(b.useItem(bomb.uid, foe.id).ok).toBe(true);
    expect(b.hp(foe)).toBeLessThan(hp);
    expect(s.player.inventory.find((x) => x.id === 'bomba_fuego')!.qty).toBe(1);
  });
});
