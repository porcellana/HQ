import { describe, expect, it } from 'vitest';
import { ENEMIES, ITEMS, NPCS, QUESTS, SHOPS, ZONES, getEnemy } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { buyPrice, ensureStock, generateStock, getShop, sellPrice, sellRate } from '@/game/economy/shop';
import { Game } from '@/game/game';
import { countItem, addItem } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import * as Quests from '@/game/quests/quests';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { recalcPlayer, type GameState } from '@/game/state';
import { Zone } from '@/game/world/zone';
import { testState } from './helpers';

describe('datos de pueblos, PNJ, tiendas y misiones', () => {
  it('hay una aldea, una ciudad y lugares con todos los servicios', () => {
    const towns = [...ZONES.values()].filter((z) => z.kind === 'town');
    expect(towns.length).toBeGreaterThanOrEqual(2);
    const actions = new Set<string>();
    for (const n of NPCS.values()) for (const node of Object.values(n.dialog)) for (const o of node.options) if (o.action) actions.add(o.action.type);
    for (const a of ['shop', 'inn', 'temple', 'quests']) expect(actions.has(a), a).toBe(true);
    expect(ZONES.get('ciudad_gremio')).toBeDefined();
  });

  for (const n of NPCS.values()) {
    it(`PNJ ${n.id}: casilla válida y diálogo coherente`, () => {
      const def = ZONES.get(n.zone);
      expect(def, `zona ${n.zone}`).toBeDefined();
      const z = new Zone(def!);
      expect(z.isWalkable(n.x, n.y), `${n.id} en (${n.x},${n.y})`).toBe(true);
      expect(z.exitAt(n.x, n.y)).toBeUndefined();
      expect(n.dialog['inicio']).toBeDefined();
      for (const node of Object.values(n.dialog)) {
        for (const o of node.options) {
          if (o.goto) expect(n.dialog[o.goto], `${n.id}: goto ${o.goto}`).toBeDefined();
          if (o.action?.type === 'shop') expect(SHOPS.has(o.action.shop), o.action.shop).toBe(true);
          if (o.ifQuest) expect(QUESTS.has(o.ifQuest.quest)).toBe(true);
        }
      }
    });
  }

  it('los PNJ no tapan el camino entre salidas', () => {
    for (const def of ZONES.values()) {
      const z = new Zone(def);
      const npcs = [...NPCS.values()].filter((n) => n.zone === def.id);
      if (!npcs.length) continue;
      const g = new Game(testState());
      g.enterZone(def.id, z.exits[0]?.digit ?? null);
      g.enemies = [];
      for (const e of z.exits) {
        g.tapTile(e.x, e.y);
        expect(g.view.path.length > 0 || (g.playerPos.x === e.x && g.playerPos.y === e.y), `${def.id}: salida ${e.digit}`).toBe(true);
      }
    }
  });

  for (const q of QUESTS.values()) {
    it(`misión ${q.id}: coherente`, () => {
      expect(Quests.validateQuest(q, (id) => ITEMS.has(id))).toEqual([]);
    });
  }

  it('hay trama principal, secundarias y 3+ repetibles', () => {
    const qs = [...QUESTS.values()];
    expect(qs.filter((q) => q.kind === 'principal').length).toBeGreaterThanOrEqual(2);
    expect(qs.filter((q) => q.kind === 'secundaria').length).toBeGreaterThanOrEqual(3);
    expect(qs.filter((q) => q.kind === 'repetible').length).toBeGreaterThanOrEqual(3);
    for (const q of qs.filter((x) => x.kind === 'repetible')) expect(q.cooldownTurns).toBeGreaterThan(0);
  });

  it('tiendas: el stock existe y es válido', () => {
    for (const s of SHOPS.values()) {
      const items = generateStock(s, new Rng(1));
      expect(items.length, s.id).toBeGreaterThan(0);
      for (const it of items) expect(ITEMS.has(it.id)).toBe(true);
    }
  });
});

describe('comercio', () => {
  it('vender da menos que comprar y el carisma mejora ambos', () => {
    const shop = getShop('herreria_brumaroja');
    const it = createItem('espada_larga', 'raro', new Rng(2));
    const buy10 = buyPrice(it, shop, 10);
    const sell10 = sellPrice(it, shop, 10);
    expect(sell10).toBeLessThan(buy10);
    expect(sell10 / buy10).toBeCloseTo(0.35, 1);
    expect(sellPrice(it, shop, 18)).toBeGreaterThan(sell10);
    expect(buyPrice(it, shop, 18)).toBeLessThan(buy10);
    expect(sellPrice(it, shop, 6)).toBeLessThan(sell10);
    expect(sellRate(30)).toBe(0.5);
    expect(sellRate(1)).toBeGreaterThanOrEqual(0.2);
  });

  it('cada ciudad tiene precios distintos', () => {
    const it = createItem('pocion_curacion', 'comun', new Rng(3));
    expect(buyPrice(it, getShop('alquimista_ceniza'), 10)).toBeLessThan(buyPrice(it, getShop('tienda_brumaroja'), 10));
  });

  it('comprar y vender mueve oro y objetos; el stock se renueva con el tiempo', () => {
    const g = new Game(testState('guerrero'));
    const p = g.state.player;
    p.gold = 1000;
    const st = g.shopStock('tienda_brumaroja');
    const potion = st.items.find((x) => x.id === 'pocion_curacion')!;
    const before = countItem(p, 'pocion_curacion');
    const stockBefore = potion.qty;
    expect(g.buyFromShop('tienda_brumaroja', potion.uid)).toBeNull();
    expect(countItem(p, 'pocion_curacion')).toBe(before + 1);
    expect(p.gold).toBeLessThan(1000);
    expect(potion.qty).toBe(stockBefore - 1);
    const gold = p.gold;
    const stack = p.inventory.find((x) => x.id === 'pan')!;
    const res = g.sellToShop('tienda_brumaroja', stack.uid, 1);
    expect(typeof res).toBe('number');
    expect(p.gold).toBe(gold + (res as number));
    // Herrería no compra comida
    expect(typeof g.sellToShop('alquimista_ceniza', p.inventory.find((x) => x.id === 'espada_larga')?.uid ?? 'x')).toBe('string');
    // Renovación
    const restockAt = g.state.shops['tienda_brumaroja']!.restockAt;
    g.state.turn = restockAt;
    const fresh = ensureStock(g.state, 'tienda_brumaroja');
    expect(fresh.restockAt).toBeGreaterThan(restockAt);
    expect(fresh.items.find((x) => x.id === 'pocion_curacion')).toBeDefined();
  });

  it('sin oro no se puede comprar', () => {
    const g = new Game(testState('mago'));
    g.state.player.gold = 0;
    const it = g.shopStock('herreria_brumaroja').items[0]!;
    expect(g.buyFromShop('herreria_brumaroja', it.uid)).toMatch(/oro/);
  });
});

describe('misiones', () => {
  it('cazar: aceptar, progresar al matar y entregar con recompensa', () => {
    const g = new Game(testState('guerrero'));
    const s = g.state;
    expect(Quests.questStatus(s, 'mq1_sombras')).toBe('disponible');
    expect(Quests.questStatus(s, 'mq2_rastro')).toBe('bloqueada');
    expect(g.acceptQuest('mq1_sombras')).toBeNull();
    const goblin = getEnemy('goblin')!;
    const archer = getEnemy('goblin_arquero')!;
    for (let i = 0; i < 3; i++) Quests.onKill(s, goblin);
    Quests.onKill(s, getEnemy('lobo')!); // no cuenta
    expect(Quests.questStatus(s, 'mq1_sombras')).toBe('activa');
    Quests.onKill(s, archer);
    Quests.onKill(s, goblin);
    expect(Quests.questStatus(s, 'mq1_sombras')).toBe('lista');
    const gold = s.player.gold;
    const xp = s.player.xp;
    expect(g.turnInQuest('mq1_sombras', 'tendero_pim')).toMatch(/otra persona/);
    expect(g.turnInQuest('mq1_sombras', 'alcalde_ortun')).toBeNull();
    expect(s.player.gold).toBe(gold + 40);
    expect(s.player.xp).toBeGreaterThan(xp);
    expect(s.flags['mq1']).toBe(true);
    expect(Quests.questStatus(s, 'mq2_rastro')).toBe('disponible');
  });

  it('recoger: se cuenta la mochila y se consumen los objetos al entregar', () => {
    const g = new Game(testState('picaro'));
    const s = g.state;
    s.quests['sq_ratas'] = { status: 'completada', progress: [4], completions: 1 };
    expect(g.acceptQuest('sq_pieles')).toBeNull();
    addItem(s.player, createItem('piel_lobo', 'comun', new Rng(1), { qty: 2 }));
    expect(Quests.questStatus(s, 'sq_pieles')).toBe('activa');
    addItem(s.player, createItem('piel_lobo', 'comun', new Rng(1), { qty: 2 }));
    expect(Quests.questStatus(s, 'sq_pieles')).toBe('lista');
    expect(g.turnInQuest('sq_pieles', 'tabernera_marga')).toBeNull();
    expect(countItem(s.player, 'piel_lobo')).toBe(1);
    expect(countItem(s.player, 'carne_seca')).toBeGreaterThanOrEqual(3);
  });

  it('visitar y hablar, con entrega a otro PNJ', () => {
    const g = new Game(testState('clerigo'));
    const s = g.state;
    s.quests['mq1_sombras'] = { status: 'completada', progress: [5], completions: 1 };
    expect(g.acceptQuest('mq2_rastro')).toBeNull();
    g.enterZone('puerto_ceniza', '1');
    expect(Quests.questStatus(s, 'mq2_rastro')).toBe('activa');
    Quests.onTalk(s, 'hermana_lysa');
    expect(Quests.questStatus(s, 'mq2_rastro')).toBe('lista');
    expect(Quests.npcMarker(s, 'hermana_lysa')).toBe('?');
    expect(g.turnInQuest('mq2_rastro', 'hermana_lysa')).toBeNull();
    expect(Quests.questStatus(s, 'mq2_rastro')).toBe('completada');
  });

  it('las repetibles vuelven a estar disponibles tras su recarga', () => {
    const g = new Game(testState('guerrero'));
    const s = g.state;
    g.acceptQuest('rq_lobos');
    for (let i = 0; i < 3; i++) Quests.onKill(s, ENEMIES.get('lobo')!);
    expect(g.turnInQuest('rq_lobos', 'maestre_doran')).toBeNull();
    expect(Quests.questStatus(s, 'rq_lobos')).toBe('completada');
    s.turn += 200;
    expect(Quests.questStatus(s, 'rq_lobos')).toBe('disponible');
    g.acceptQuest('rq_lobos');
    expect(s.quests['rq_lobos']!.progress).toEqual([0]);
    expect(s.quests['rq_lobos']!.completions).toBe(1);
  });

  it('el HUD muestra la misión principal primero', () => {
    const g = new Game(testState());
    g.acceptQuest('sq_paso');
    g.acceptQuest('mq1_sombras');
    expect(Quests.trackedQuest(g.state)?.name).toBe('Sombras sobre Brumaroja');
  });
});

describe('PNJ y servicios en partida', () => {
  it('tocar a un PNJ cercano abre el diálogo; lejano, camina hasta él', () => {
    const g = new Game(testState());
    g.enterZone('aldea_taberna', '1');
    const marga = g.npcs.find((n) => n.id === 'tabernera_marga')!;
    const talks: string[] = [];
    g.events.on('npcTalk', ({ npc }) => talks.push(npc.id));
    g.tapTile(marga.x, marga.y);
    expect(talks).toEqual([]);
    for (let i = 0; i < 200 && talks.length === 0; i++) g.update(0.05);
    expect(talks).toEqual(['tabernera_marga']);
    expect(g.canTalk(marga)).toBe(true);
  });

  it('posada cura y cobra; templo fija el punto de reaparición', () => {
    const g = new Game(testState());
    const p = g.state.player;
    p.gold = 100;
    p.hp = 1;
    expect(g.rest(10)).toBeNull();
    expect(p.hp).toBe(p.maxHp);
    expect(p.gold).toBe(90);
    g.enterZone('ciudad_templo', '1');
    p.hp = 1;
    expect(g.templeHeal(5)).toBeNull();
    expect(p.hp).toBe(p.maxHp);
    expect(p.respawnZone).toBe('ciudad_templo');
    g.damagePlayer(999, 'test');
    g.respawn();
    expect(g.zone.id).toBe('ciudad_templo');
  });
});

describe('guardado v4', () => {
  it('una partida v3 gana misiones y tiendas vacías y sigue cargando', () => {
    const v3 = {
      seed: 1, turn: 50, visitedZones: ['aldea_brumaroja'], flags: {}, playTimeSec: 1, createdAt: '',
      player: { name: 'V3', classId: 'guerrero', portrait: 0, stats: { FUE: 15, DES: 12, CON: 14, INT: 8, SAB: 10, CAR: 11 }, attributePoints: 0, level: 3, xp: 500, hp: 20, maxHp: 20, mp: 5, maxMp: 5, gold: 80, inventory: [], equipment: {}, needsStarterKit: true, pos: { zone: 'aldea_brumaroja', x: 13, y: 22 } },
    };
    const s = migrate(v3, 3, CURRENT_SAVE_VERSION) as unknown as GameState;
    expect(s.quests).toEqual({});
    expect(s.shops).toEqual({});
    recalcPlayer(s.player);
    const g = new Game(s);
    expect(g.zone.id).toBe('aldea_brumaroja');
    expect(Quests.questStatus(g.state, 'mq1_sombras')).toBe('disponible');
  });

  it('una partida v1 sigue llegando hasta la versión actual', () => {
    const v1 = {
      seed: 5, turn: 7, visitedZones: [], flags: {}, playTimeSec: 1, createdAt: '',
      player: { name: 'Viejo', classId: 'aventurero', portrait: 0, level: 1, xp: 0, hp: 12, maxHp: 12, mp: 4, maxMp: 4, gold: 25, pos: { zone: 'aldea_brumaroja', x: 13, y: 22 } },
    };
    const s = migrate(v1, 1) as unknown as GameState;
    const g = new Game(s);
    expect(g.state.player.equipment.arma).toBeDefined();
    expect(g.state.quests).toEqual({});
  });
});
