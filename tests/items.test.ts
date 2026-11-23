import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES, ITEMS, LOOT_TABLES, RARITIES } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import { INVENTORY_SLOTS, addItem, countItem, equip, unequip } from '@/game/items/inventory';
import { createItem, itemDef, itemValue } from '@/game/items/items';
import { rollLoot, rollRarity } from '@/game/items/loot';
import { parseDice } from '@/game/rules/dice';
import { derive } from '@/game/rules/derived';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { exportCode, importCode } from '@/game/save/saveManager';
import { recalcPlayer, type GameState } from '@/game/state';
import { ICON_SHAPES } from '@/gfx/items';
import { testState } from './helpers';

describe('datos de objetos', () => {
  it('hay armas de los 6 tipos, todas las ranuras y rarezas en orden', () => {
    const all = [...ITEMS.values()];
    const types = new Set(all.map((d) => d.weapon?.type).filter(Boolean));
    for (const t of ['espada', 'hacha', 'arco', 'baston', 'daga', 'maza']) expect(types.has(t as never), t).toBe(true);
    for (const s of ['cabeza', 'pecho', 'manos', 'piernas', 'pies', 'arma', 'secundaria', 'herramienta', 'accesorio']) {
      expect(all.some((d) => d.slot === s), s).toBe(true);
    }
    expect(RARITIES.map((r) => r.id)).toEqual(['comun', 'poco_comun', 'raro', 'epico', 'legendario']);
  });

  for (const d of ITEMS.values()) {
    it(`${d.id}: coherente`, () => {
      expect(ICON_SHAPES, `icono ${d.icon.shape}`).toContain(d.icon.shape);
      if (d.weapon) {
        expect(() => parseDice(d.weapon!.dice)).not.toThrow();
        expect(d.slot).toBe('arma');
      }
      if (d.kind === 'consumible') expect(d.use).toBeDefined();
      if (['arma', 'armadura', 'secundaria', 'accesorio', 'herramienta'].includes(d.kind)) expect(d.slot).toBeDefined();
      expect(d.value).toBeGreaterThan(0);
    });
  }

  it('tablas de botín y equipo inicial apuntan a objetos que existen', () => {
    for (const t of LOOT_TABLES.values()) for (const e of t.entries) if ('item' in e) expect(ITEMS.has(e.item), `${t.id}: ${e.item}`).toBe(true);
    for (const e of ENEMIES.values()) if (e.lootTable) expect(LOOT_TABLES.has(e.lootTable), `${e.id}: ${e.lootTable}`).toBe(true);
    for (const c of CLASSES.values()) for (const s of c.startingItems) expect(ITEMS.has(s.item), `${c.id}: ${s.item}`).toBe(true);
  });
});

describe('objetos y rarezas', () => {
  it('los bonos aleatorios dependen de la rareza; consumibles y materiales no tienen', () => {
    const rng = new Rng(1);
    expect(createItem('espada_larga', 'comun', rng).affixes).toHaveLength(0);
    expect(createItem('espada_larga', 'raro', rng).affixes.length).toBeGreaterThanOrEqual(1);
    expect(createItem('pocion_curacion', 'legendario', rng)).toMatchObject({ rarity: 'comun', affixes: [] });
    expect(createItem('anillo_cobre', 'comun', rng).affixes.length).toBeGreaterThanOrEqual(1);
    const common = createItem('espada_larga', 'comun', rng);
    const epic = createItem('espada_larga', 'epico', rng);
    expect(itemValue(epic)).toBeGreaterThan(itemValue(common) * 4);
  });

  it('a más nivel, más rarezas altas', () => {
    const rng = new Rng(5);
    const highShare = (level: number) => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (['raro', 'epico', 'legendario'].includes(rollRarity(rng, level))) n++;
      return n / 4000;
    };
    expect(highShare(1)).toBe(0);
    expect(highShare(10)).toBeGreaterThan(highShare(3));
  });

  it('el botín de jefe es generoso y el de rata, pobre', () => {
    const rng = new Rng(9);
    const boss = rollLoot(rng, 'jefe', 4);
    expect(boss.items.length).toBeGreaterThanOrEqual(3);
    expect(boss.gold).toBeGreaterThanOrEqual(60);
    let ratItems = 0;
    for (let i = 0; i < 200; i++) ratItems += rollLoot(rng, 'bestia', 1).items.length;
    expect(ratItems).toBeLessThan(200);
  });
});

describe('inventario y equipo', () => {
  const bag = () => ({ inventory: [] as ReturnType<typeof createItem>[], equipment: {} as Record<string, ReturnType<typeof createItem>> });

  it('apila consumibles y respeta los huecos', () => {
    const rng = new Rng(2);
    const c = bag();
    expect(addItem(c, createItem('pocion_curacion', 'comun', rng, { qty: 7 }))).toBe(0);
    expect(addItem(c, createItem('pocion_curacion', 'comun', rng, { qty: 7 }))).toBe(0);
    expect(c.inventory).toHaveLength(2); // máximo 10 por pila
    expect(countItem(c, 'pocion_curacion')).toBe(14);
    for (let i = 0; i < 30; i++) addItem(c, createItem('daga', 'comun', rng));
    expect(c.inventory).toHaveLength(INVENTORY_SLOTS);
    expect(addItem(c, createItem('daga', 'comun', rng))).toBe(1);
  });

  it('arma a dos manos libera el escudo y viceversa', () => {
    const rng = new Rng(3);
    const c = bag();
    for (const id of ['espada_larga', 'escudo_madera', 'hacha_guerra']) addItem(c, createItem(id, 'comun', rng));
    equip(c, c.inventory.find((x) => x.id === 'espada_larga')!.uid);
    equip(c, c.inventory.find((x) => x.id === 'escudo_madera')!.uid);
    expect(c.equipment['secundaria']?.id).toBe('escudo_madera');
    equip(c, c.inventory.find((x) => x.id === 'hacha_guerra')!.uid);
    expect(c.equipment['arma']?.id).toBe('hacha_guerra');
    expect(c.equipment['secundaria']).toBeUndefined();
    expect(c.inventory.map((x) => x.id).sort()).toEqual(['escudo_madera', 'espada_larga']);
    equip(c, c.inventory.find((x) => x.id === 'escudo_madera')!.uid);
    expect(c.equipment['arma']).toBeUndefined();
    expect(unequip(c, 'secundaria')).toBeNull();
  });

  it('dos anillos van a las dos ranuras de accesorio', () => {
    const rng = new Rng(4);
    const c = bag();
    addItem(c, createItem('anillo_cobre', 'comun', rng));
    addItem(c, createItem('anillo_plata', 'comun', rng));
    equip(c, c.inventory[0]!.uid);
    equip(c, c.inventory[0]!.uid);
    expect(c.equipment['accesorio1']).toBeDefined();
    expect(c.equipment['accesorio2']).toBeDefined();
  });

  it('cada clase empieza con arma equipada y pociones', () => {
    for (const id of CLASSES.keys()) {
      const p = testState(id).player;
      expect(p.equipment.arma, id).toBeDefined();
      expect(countItem(p, 'pocion_curacion'), id).toBeGreaterThan(0);
      expect(p.needsStarterKit).toBe(false);
    }
  });

  it('la armadura sube la CA y la DES queda limitada por armaduras pesadas', () => {
    const p = testState('picaro').player; // DES 16 (+3), cuero CA 1
    const base = derive(p).ac;
    expect(base).toBe(10 + 3 + 1);
    const rng = new Rng(6);
    addItem(p, createItem('cota_escamas', 'comun', rng)); // CA 4, DES máx +2
    equip(p, p.inventory.find((x) => x.id === 'cota_escamas')!.uid);
    expect(derive(p).ac).toBe(10 + 2 + 4);
  });
});

describe('objetos en partida', () => {
  function settle(g: Game) {
  if (g.phase === 'player' && g.combatTurn && g.actionUsed) g.waitTurn(); // economía de turno: acción hecha → fin de turno
    for (let i = 0; i < 200 && g.phase === 'enemies'; i++) g.update(0.25);
  }

  it('recoger botín al pisarlo', () => {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    const p = g.playerPos;
    const rng = new Rng(7);
    g.dropLoot(p.x, p.y - 1, [createItem('anillo_plata', 'raro', rng)], 12);
    const gold = g.state.player.gold;
    g.tapTile(p.x, p.y - 1);
    for (let i = 0; i < 20; i++) g.update(0.05);
    expect(g.state.player.gold).toBe(gold + 12);
    expect(countItem(g.state.player, 'anillo_plata')).toBe(1);
    expect(g.ground).toHaveLength(0);
  });

  it('beber una poción en combate cura y gasta el turno; el pan no se puede comer en combate', () => {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    const p = g.playerPos;
    const e = g.spawnEnemy('goblin', p.x, p.y - 2)!;
    e.alerted = true;
    g.state.player.hp = 1;
    const turn = g.state.turn;
    expect(g.quickPotion()).toBeNull();
    expect(g.state.player.hp).toBeGreaterThan(1);
    expect(g.state.turn).toBe(turn + 1);
    settle(g);
    const bread = g.state.player.inventory.find((x) => x.id === 'pan')!;
    expect(g.useItem(bread.uid)).toMatch(/combate/);
  });

  it('los enemigos sueltan botín a veces', () => {
    let drops = 0;
    for (let i = 0; i < 40; i++) {
      const g = new Game(testState('guerrero'));
      g.enemies = [];
      const p = g.playerPos;
      const e = g.spawnEnemy('goblin', p.x + 1, p.y) ?? g.spawnEnemy('goblin', p.x - 1, p.y)!;
      g.damageEnemy(e, 999, 'cortante');
      if (g.ground.length) drops++;
    }
    expect(drops).toBeGreaterThan(10);
  });
});

describe('guardado v3', () => {
  it('una partida v2 recibe el equipo inicial al cargar', () => {
    const v2 = {
      seed: 1, turn: 5, visitedZones: [], flags: {}, playTimeSec: 1, createdAt: '',
      player: { name: 'Viejo', classId: 'mago', portrait: 0, stats: { FUE: 8, DES: 13, CON: 12, INT: 16, SAB: 12, CAR: 10 }, attributePoints: 0, level: 2, xp: 120, hp: 9, maxHp: 9, mp: 10, maxMp: 10, gold: 50, pos: { zone: 'aldea_brumaroja', x: 13, y: 22 } },
    };
    const s = migrate(v2, 2, CURRENT_SAVE_VERSION) as unknown as GameState;
    recalcPlayer(s.player);
    expect(s.player.equipment.arma?.id).toBe('baston');
    expect(countItem(s.player, 'pocion_mana')).toBe(2);
    expect(s.player.gold).toBe(50);
  });

  it('exportar e importar conserva la partida', () => {
    const s = testState('clerigo');
    s.player.name = 'Ñandú José';
    s.player.gold = 777;
    const code = exportCode(s, 't');
    expect(code.startsWith('ECOS1:')).toBe(true);
    const res = importCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.player.name).toBe('Ñandú José');
      expect(res.state.player.gold).toBe(777);
      expect(itemDef(res.state.player.equipment.arma!).id).toBe('maza');
    }
    expect(importCode('hola').ok).toBe(false);
    expect(importCode('ECOS1:xxxx').ok).toBe(false);
  });
});
