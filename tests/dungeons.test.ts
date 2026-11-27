import { describe, expect, it } from 'vitest';
import { DUNGEONS, ENEMIES, LOOT_TABLES, ORES, TILES, TRAPS, ZONES, getZoneDef } from '@/data/registry';
import type { ZoneFeature } from '@/data/schema';
import { Rng } from '@/engine/rng';
import { findPath } from '@/engine/pathfinding';
import { xpForKill } from '@/game/combat/rules';
import { Game } from '@/game/game';
import { addItem, countItem, equip } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import { totalXpForLevel } from '@/game/rules/progression';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { bfs, generateFloor } from '@/game/world/dungeonGen';
import { dungeonZoneDef, emptyWorld, featureKey, floorZoneId, parseDungeonZone } from '@/game/world/dungeons';
import { Zone } from '@/game/world/zone';
import type { GameState } from '@/game/state';
import { defeat, testState } from './helpers';

const opts = { width: 40, height: 40, rooms: [7, 10] as [number, number], chests: [3, 3] as [number, number], traps: [3, 3] as [number, number], ores: [3, 3] as [number, number], down: true };

describe('generador de pisos', () => {
  it('es determinista con la misma semilla y cambia con otra', () => {
    const a = generateFloor(new Rng(123), opts);
    const b = generateFloor(new Rng(123), opts);
    const c = generateFloor(new Rng(124), opts);
    expect(a.map).toEqual(b.map);
    expect(a.chests).toEqual(b.chests);
    expect(a.map).not.toEqual(c.map);
  });

  it('todas las salas, escaleras y elementos son alcanzables (200 semillas)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = generateFloor(new Rng(seed), opts);
      expect(g.map[g.up.y]![g.up.x]).toBe('1');
      expect(g.down).not.toBeNull();
      expect(g.map[g.down!.y]![g.down!.x]).toBe('2');
      const W = opts.width;
      const blocked = new Set([...g.chests, ...g.ores].map((p) => p.y * W + p.x));
      const reach = bfs(g.map, g.up, blocked);
      for (const r of g.rooms) {
        const c = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
        if (blocked.has(c.y * W + c.x)) continue;
        expect(reach.has(c.y * W + c.x), `semilla ${seed}: sala aislada`).toBe(true);
      }
      expect(reach.has(g.down!.y * W + g.down!.x)).toBe(true);
      // Cada cofre/veta tiene al menos una casilla alcanzable al lado
      for (const p of [...g.chests, ...g.ores]) {
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => reach.has((p.y + dy!) * W + p.x + dx!));
        expect(near, `semilla ${seed}: elemento inaccesible`).toBe(true);
      }
      // Todo el suelo es un único bloque conectado
      let floor = 0;
      g.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#' && !blocked.has(y * W + x)) floor++; }));
      expect(reach.size).toBe(floor);
    }
  });
});

describe('datos de mazmorras', () => {
  it('hay al menos 3 mazmorras de dificultad creciente', () => {
    const list = [...DUNGEONS.values()].sort((a, b) => a.level - b.level);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.map((d) => d.id)).toEqual(expect.arrayContaining(['cueva_goblin', 'galerias_seda', 'cripta_velkar']));
  });

  for (const d of DUNGEONS.values()) {
    it(`${d.id}: datos coherentes y enlazados`, () => {
      expect(TILES.has(d.wallTile) && TILES.has(d.floorTile)).toBe(true);
      expect(ENEMIES.get(d.boss.enemy)?.boss).toBe(true);
      expect(LOOT_TABLES.has(d.chestLoot)).toBe(true);
      for (const t of d.traps) expect(TRAPS.has(t)).toBe(true);
      for (const o of d.ores) expect(ORES.has(o)).toBe(true);
      for (const e of d.floorEncounters) for (const g of e.groups) expect(ENEMIES.has(g.enemy), g.enemy).toBe(true);
      // La superficie tiene una salida que lleva a la mazmorra por '1'
      const surf = ZONES.get(d.surface.zone)!;
      expect(surf, d.surface.zone).toBeDefined();
      const zone = new Zone(surf);
      expect(zone.exits.some((e) => e.to === d.id && e.arrive === '1')).toBe(true);
      expect(zone.exitMarkers.has(d.surface.arrive)).toBe(true);
      // Sala del jefe: mismo ancho, '1', '3' y 'X'
      const w = d.boss.map[0]!.length;
      for (const row of d.boss.map) expect(row.length).toBe(w);
      const flat = d.boss.map.join('');
      for (const ch of ['1', '3', 'X']) expect(flat.includes(ch), ch).toBe(true);
    });

    it(`${d.id}: cada piso enlaza con el siguiente y el último con el jefe`, () => {
      const world = emptyWorld();
      for (let f = 1; f <= d.floors; f++) {
        const def = dungeonZoneDef(777, world, floorZoneId(d.id, f))!;
        expect(def).toBeDefined();
        const z = new Zone(def);
        const next = f === d.floors ? floorZoneId(d.id, 'jefe') : floorZoneId(d.id, f + 1);
        expect(def.exits?.['2']?.to).toBe(next);
        const path = findPath(z.width, z.height, z.arrivalPoint('1'), z.arrivalPoint('2'), (x, y) => z.isWalkable(x, y));
        expect(path, `piso ${f} sin camino`).not.toBeNull();
      }
      const boss = new Zone(dungeonZoneDef(777, world, floorZoneId(d.id, 'jefe'))!);
      expect(boss.def.bossSpawn?.enemy).toBe(d.boss.enemy);
      expect(findPath(boss.width, boss.height, boss.arrivalPoint('1'), boss.arrivalPoint('3'), (x, y) => boss.isWalkable(x, y))).not.toBeNull();
      expect(parseDungeonZone(floorZoneId(d.id, 2))?.floor).toBe(2);
    });
  }

  it('las vetas al aire libre están junto a casillas transitables', () => {
    for (const z of ZONES.values()) {
      const zone = new Zone(z);
      for (const f of z.features ?? []) {
        const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => zone.isWalkable(f.x + dx!, f.y + dy!));
        expect(ok, `${z.id} (${f.x},${f.y})`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------- en partida
function settle(_g: Game) {
  /* (sin turnos de enemigos en el mapa: no hay nada que esperar) */
}

/** Coloca al jugador al lado de un elemento y lo usa. */
function besideAndUse(g: Game, f: ZoneFeature) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    if (g.playerCanWalk(f.x + dx, f.y + dy)) {
      g.state.player.pos.x = f.x + dx;
      g.state.player.pos.y = f.y + dy;
      g.interact(f);
      settle(g);
      return;
    }
  }
  throw new Error('elemento sin hueco al lado');
}

function inDungeon(classId = 'guerrero'): Game {
  const g = new Game(testState(classId));
  g.enterZone('cueva_goblin', '1');
  g.enemies = [];
  g.state.player.hp = 999;
  g.state.player.maxHp = 999;
  return g;
}

describe('mazmorras en partida', () => {
  it('se entra a la cueva por el bosque y el piso es estable en la misma partida', () => {
    const s = testState();
    const g = new Game(s);
    g.enterZone('bosque_sombrio', '1');
    const exit = g.zone.exits.find((e) => e.to === 'cueva_goblin')!;
    g.useExit(exit);
    expect(g.zone.id).toBe('cueva_goblin');
    expect(g.zone.def.kind).toBe('dungeon');
    const map1 = g.zone.def.map;
    // Guardar y cargar dentro: se regenera igual
    const g2 = new Game(structuredClone(s));
    expect(g2.zone.id).toBe('cueva_goblin');
    expect(g2.zone.def.map).toEqual(map1);
    // Otra partida (otra semilla) = otra cueva
    const other = testState('guerrero', 99);
    const g3 = new Game(other);
    g3.enterZone('cueva_goblin', '1');
    expect(g3.zone.def.map).not.toEqual(map1);
  });

  it('los cofres dan botín una sola vez', () => {
    const g = inDungeon();
    const chest = g.zone.def.features!.find((f) => f.kind === 'cofre')!;
    if (chest.kind === 'cofre') chest.locked = false;
    const gold = g.state.player.gold;
    const items = g.state.player.inventory.length;
    besideAndUse(g, chest);
    expect(g.featureUsed(chest)).toBe(true);
    expect(g.state.player.gold + g.state.player.inventory.length).toBeGreaterThanOrEqual(gold + items);
    expect(g.interactiveFeatureAt(chest.x, chest.y)).toBeUndefined();
    // Al volver a entrar, sigue abierto
    g.enterZone('bosque_sombrio', '2');
    g.enterZone('cueva_goblin', '1');
    expect(g.featureUsed(chest)).toBe(true);
  });

  it('el Pícaro abre cerraduras con más facilidad que el Mago', () => {
    const tries = (cls: string) => {
      let opened = 0;
      for (let i = 0; i < 60; i++) {
        const g = inDungeon(cls);
        const chest = g.zone.def.features!.find((f) => f.kind === 'cofre')!;
        if (chest.kind === 'cofre') chest.locked = true;
        besideAndUse(g, chest);
        if (g.featureUsed(chest)) opened++;
        if (chest.kind === 'cofre') chest.locked = false;
      }
      return opened;
    };
    expect(tries('picaro')).toBeGreaterThan(tries('mago'));
  });

  it('minería: sin pico no se puede; con pico de hierro, la veta de hierro se agota y da mineral', () => {
    const g = inDungeon('mago');
    const vein = g.zone.def.features!.find((f) => f.kind === 'mineral')!;
    if (vein.kind === 'mineral') vein.ore = 'hierro';
    const turn = g.state.turn;
    besideAndUse(g, vein);
    expect(g.state.turn).toBe(turn); // sin pico no gasta turno
    expect(countItem(g.state.player, 'mineral_hierro')).toBe(0);
    addItem(g.state.player, createItem('pico_hierro', 'comun', new Rng(1)));
    equip(g.state.player, g.state.player.inventory.find((x) => x.id === 'pico_hierro')!.uid);
    for (let i = 0; i < 3; i++) besideAndUse(g, vein);
    expect(countItem(g.state.player, 'mineral_hierro')).toBeGreaterThan(0);
    expect(g.featureUsed(vein)).toBe(true);
    expect(g.zone.isWalkable(vein.x, vein.y)).toBe(true);
  });

  it('pico de hierro no sirve para gemas', () => {
    const g = inDungeon();
    addItem(g.state.player, createItem('pico_hierro', 'comun', new Rng(1)));
    equip(g.state.player, g.state.player.inventory.find((x) => x.id === 'pico_hierro')!.uid);
    const vein = g.zone.def.features!.find((f) => f.kind === 'mineral')!;
    if (vein.kind === 'mineral') vein.ore = 'gema';
    for (let i = 0; i < 6; i++) besideAndUse(g, vein);
    expect(countItem(g.state.player, 'gema_bruta')).toBe(0);
    if (vein.kind === 'mineral') vein.ore = 'hierro';
  });

  it('trampas: pisar una oculta hace daño; detectarla y desactivarla da XP', () => {
    const g = inDungeon();
    const trap = g.zone.def.features!.find((f) => f.kind === 'trampa')!;
    const hp = g.state.player.hp;
    // Pisarla
    g.state.player.pos.x = trap.x;
    g.state.player.pos.y = trap.y;
    (g as unknown as { stepOnTrap(x: number, y: number): boolean }).stepOnTrap(trap.x, trap.y);
    expect(g.state.player.hp).toBeLessThan(hp);
    expect(g.featureUsed(trap)).toBe(true);
  });

  it('el Pícaro detecta y desactiva trampas', () => {
    let disarmed = 0;
    for (let i = 0; i < 20; i++) {
      const g = inDungeon('picaro');
      const trap = g.zone.def.features!.find((f) => f.kind === 'trampa')!;
      g.detectedTraps.add(featureKey(g.zone.def, trap.x, trap.y));
      expect(g.isKnownTrap(trap.x, trap.y)).toBe(true);
      const xp = g.state.player.xp;
      for (let k = 0; k < 6 && !g.featureUsed(trap); k++) besideAndUse(g, trap);
      if (g.state.player.xp > xp) disarmed++;
    }
    expect(disarmed).toBeGreaterThan(10);
  });

  it('el jefe aparece en su sala, al morir marca la bandera y la mazmorra se renueva al volver', () => {
    const g = inDungeon();
    g.enterZone(floorZoneId('cueva_goblin', 'jefe'), '1');
    const boss = g.enemies.find((e) => e.def.id === 'rey_goblin')!;
    expect(boss).toBeDefined();
    const exit3 = g.zone.exits.find((e) => e.digit === '3')!;
    g.useExit(exit3);
    expect(g.zone.id).toContain('__jefe'); // cerrado hasta matar al jefe
    defeat(g, boss);
    expect(g.state.flags['boss_rey_goblin']).toBe(true);
    expect(g.state.world.dungeons['cueva_goblin']!.cleared).toBe(true);
    // Salir y volver a entrar: nueva semilla
    const firstMap = getZoneDef('cueva_goblin')!.map;
    g.useExit(g.zone.exits.find((e) => e.digit === '3')!);
    expect(g.zone.id).toBe('bosque_sombrio');
    g.useExit(g.zone.exits.find((e) => e.to === 'cueva_goblin')!);
    expect(g.state.world.dungeons['cueva_goblin']!.run).toBe(1);
    expect(g.zone.def.map).not.toEqual(firstMap);
    expect(g.enemies.some((e) => e.def.id === 'rey_goblin')).toBe(false); // el jefe está en su sala, no aquí
  });

  it('la cripta está sellada hasta que la historia la abra', () => {
    const g = new Game(testState());
    g.enterZone('puerto_ceniza', '1');
    const exit = g.zone.exits.find((e) => e.to === 'cripta_velkar')!;
    g.useExit(exit);
    expect(g.zone.id).toBe('puerto_ceniza');
    g.state.flags['cripta_abierta'] = true;
    g.useExit(exit);
    expect(g.zone.id).toBe('cripta_velkar');
  });

  it('equilibrio: limpiar la cueva da ~1 nivel a un personaje de su nivel (3)', () => {
    const level = 3;
    let xp = 0;
    const g = new Game(testState());
    const d = DUNGEONS.get('cueva_goblin')!;
    for (let f = 1; f <= d.floors; f++) {
      g.enterZone(floorZoneId('cueva_goblin', f), '1');
      xp += g.zone.def.discoverXp ?? 0;
      for (const e of g.enemies) xp += xpForKill(e.def.xp, e.def.level, level);
      xp += (g.zone.def.features ?? []).filter((x) => x.kind === 'trampa').length * 10 * g.zone.def.level * 0.5;
    }
    xp += xpForKill(ENEMIES.get('rey_goblin')!.xp, 4, level) + 25 * 4;
    const need = totalXpForLevel(level + 1) - totalXpForLevel(level);
    expect(xp / need).toBeGreaterThan(0.6);
    expect(xp / need).toBeLessThan(1.8);
  });
});

describe('guardado v5', () => {
  it('una partida v4 carga con el mundo vacío', () => {
    const s = testState() as unknown as Record<string, unknown>;
    delete s['world'];
    const v5 = migrate(s, 4, CURRENT_SAVE_VERSION) as unknown as GameState;
    expect(v5.world).toMatchObject({ dungeons: {}, features: {} });
    const g = new Game(v5);
    expect(g.state.world.features).toEqual({});
  });

  it('cadena completa v1 → v5', () => {
    const v1 = {
      seed: 5, turn: 77, visitedZones: ['aldea_brumaroja'], flags: {}, playTimeSec: 10, createdAt: '2026-01-01',
      player: { name: 'Viejo', classId: 'aventurero', portrait: 0, level: 1, xp: 0, hp: 12, maxHp: 12, mp: 4, maxMp: 4, gold: 25, pos: { zone: 'aldea_brumaroja', x: 13, y: 22 } },
    };
    const s = migrate(v1, 1, CURRENT_SAVE_VERSION) as unknown as GameState;
    const g = new Game(s);
    expect(g.state.world).toBeDefined();
    expect(g.state.player.equipment.arma).toBeDefined();
  });
});
