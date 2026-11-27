/** v0.8: mundo procedural por semilla. */
import { beforeEach, describe, expect, it } from 'vitest';
import { BIOMES, NPCS, QUESTS, SHOPS, getItem, getZoneDef } from '@/data/registry';
import { Game } from '@/game/game';
import { nextHop, questGoalZone } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { SaveManager } from '@/game/save/saveManager';
import { MemoryStore } from '@/game/save/storage';
import { buildZone, type Zone } from '@/game/world/zone';
import { generateCell } from '@/game/world/procgen/generate';
import {
  CORE_CELLS, DELTA, WORLD_RADIUS, biomeAt, cellId, cellLinks, cellName, compatible, hasUnderground, inWorld, isSettlement, parseZoneId, placeAt,
  plannedNeighbors, subId,
} from '@/game/world/procgen/plan';
import { activateGenWorld, assignQuests, emptyGen, ensureZone, zoneLevelFor } from '@/game/world/procgen';
import { testState } from './helpers';

const SEEDS = [1, 7, 42, 1234, 99999];
const cells = (r: number) => {
  const out: Array<[number, number]> = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (!CORE_CELLS.some((c) => c.cx === x && c.cy === y)) out.push([x, y]);
  return out;
};

/** Casillas alcanzables a pie desde (x,y). */
function flood(z: Zone, x: number, y: number): Set<number> {
  const seen = new Set<number>([y * z.width + x]);
  const q = [[x, y]] as Array<[number, number]>;
  while (q.length) {
    const [cx, cy] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (!z.inBounds(nx, ny) || seen.has(ny * z.width + nx) || !z.isWalkable(nx, ny)) continue;
      seen.add(ny * z.width + nx);
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('mundo procedural: plan', () => {
  it('es determinista por semilla y distinto con otra', () => {
    for (const [x, y] of cells(3)) {
      expect(biomeAt(5, x, y)).toBe(biomeAt(5, x, y));
      expect(cellName(5, x, y)).toBe(cellName(5, x, y));
    }
    const sig = (s: number) => cells(4).map(([x, y]) => `${biomeAt(s, x, y)}:${placeAt(s, x, y)}`).join(',');
    expect(sig(5)).toBe(sig(5));
    expect(sig(5)).not.toBe(sig(6));
  });

  it('los biomas vecinos son siempre compatibles (también con el núcleo fijo)', () => {
    for (const seed of SEEDS) {
      for (let y = -WORLD_RADIUS; y <= WORLD_RADIUS; y++) {
        for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
          for (const d of [DELTA.E, DELTA.S]) {
            if (!inWorld(x + d.dx, y + d.dy)) continue;
            const a = biomeAt(seed, x, y), b = biomeAt(seed, x + d.dx, y + d.dy);
            expect(compatible(a, b), `${seed} (${x},${y}) ${a} vs ${b}`).toBe(true);
          }
        }
      }
    }
  });

  it('la compatibilidad entre biomas es simétrica y el puente encaja con todos', () => {
    for (const a of BIOMES.values()) {
      for (const n of a.neighbors) expect(BIOMES.get(n)?.neighbors, `${a.id}↔${n}`).toContain(a.id);
      if (a.bridge) for (const b of BIOMES.values()) expect(compatible(a.id, b.id)).toBe(true);
    }
  });

  it('hay variedad de biomas y de lugares', () => {
    const bs = new Set<string>();
    const ps = new Set<string>();
    for (const [x, y] of cells(WORLD_RADIUS)) { bs.add(biomeAt(42, x, y)); ps.add(placeAt(42, x, y)); }
    expect(bs.size).toBeGreaterThanOrEqual(5);
    expect(ps.size).toBe(7 + 1);
  });

  it('los enlaces son simétricos y todo el mundo es alcanzable desde la aldea', () => {
    for (const seed of SEEDS) {
      const seen = new Set<string>(['aldea_brumaroja']);
      const q = ['aldea_brumaroja'];
      while (q.length) {
        for (const n of plannedNeighbors(seed, q.shift()!)) if (!seen.has(n)) { seen.add(n); q.push(n); }
      }
      for (const [x, y] of cells(WORLD_RADIUS)) {
        expect(seen.has(cellId(x, y)), `${seed} ${x},${y}`).toBe(true);
        for (const l of cellLinks(x, y)) {
          const back = CORE_CELLS.find((c) => c.zone === l.to);
          if (back) continue;
          const p = parseZoneId(l.to)!;
          const rev = cellLinks(p.cx, p.cy).find((r) => r.to === cellId(x, y));
          expect(rev, `${x},${y}→${l.to}`).toBeDefined();
          expect(rev!.arrive).toBe({ N: '1', S: '2', W: '3', E: '4' }[l.dir]);
        }
      }
    }
  });

  it('las salidas del núcleo fijo llevan a celdas que vuelven a ellas', () => {
    for (const c of CORE_CELLS) {
      const def = getZoneDef(c.zone)!;
      for (const [dir, digit] of Object.entries(c.links)) {
        const ex = def.exits![digit!]!;
        expect(ex.to).toMatch(/^w_/);
        const p = parseZoneId(ex.to)!;
        const back = cellLinks(p.cx, p.cy).find((l) => l.to === c.zone);
        expect(back, `${c.zone} ${dir}`).toBeDefined();
        expect(back!.arrive).toBe(digit);
        expect(ex.arrive).toBe(back!.dir === 'N' ? '1' : back!.dir === 'S' ? '2' : back!.dir === 'W' ? '3' : '4');
      }
    }
  });
});

describe('mundo procedural: zonas generadas', () => {
  it('generar la misma celda con la misma semilla y nivel da exactamente lo mismo', () => {
    for (const [x, y] of cells(2)) {
      expect(JSON.stringify(generateCell(11, x, y, 4))).toBe(JSON.stringify(generateCell(11, x, y, 4)));
    }
    expect(JSON.stringify(generateCell(11, 1, 0, 4))).not.toBe(JSON.stringify(generateCell(12, 1, 0, 4)));
  });

  it('todas las salidas, PNJ, cofres y entradas son alcanzables desde cualquier salida', () => {
    for (const seed of [3, 42]) {
      for (const [x, y] of cells(4)) {
        const b = generateCell(seed, x, y, 5);
        for (const def of b.zones) {
          const z = buildZone(def);
          const links = def.generated!.place && Object.keys(def.exits ?? {});
          expect(links!.length, `${def.id} sin salidas`).toBeGreaterThan(0);
          const first = z.exits[0]!;
          const r = flood(z, first.x, first.y);
          for (const e of z.exits) expect(r.has(e.y * z.width + e.x), `${seed} ${def.id} salida ${e.digit}`).toBe(true);
          for (const n of b.npcs.filter((n) => n.zone === def.id)) {
            expect(z.isWalkable(n.x, n.y), `${def.id} PNJ ${n.id} sobre casilla no transitable`).toBe(true);
            expect(r.has(n.y * z.width + n.x), `${seed} ${def.id} PNJ ${n.id} inalcanzable`).toBe(true);
          }
          for (const f of def.features ?? []) {
            const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has((f.y + dy!) * z.width + f.x + dx!));
            expect(adj || r.has(f.y * z.width + f.x), `${seed} ${def.id} elemento ${f.kind} aislado`).toBe(true);
          }
          if (def.bossSpawn) expect(r.has(def.bossSpawn.y * z.width + def.bossSpawn.x)).toBe(true);
        }
      }
    }
  });

  it('cada celda tiene el contenido de su tipo (tienda, posada, mazmorra con jefe...)', () => {
    let seenTown = 0, seenDungeon = 0;
    for (const [x, y] of cells(5)) {
      const place = placeAt(42, x, y);
      const b = generateCell(42, x, y, 6);
      const roles = b.npcs.map((n) => n.id.split(':')[1]);
      if (isSettlement(place)) {
        seenTown++;
        expect(roles).toContain('alcalde');
        expect(roles).toContain('tienda');
        expect(roles).toContain('posada');
        expect(b.shops.length).toBeGreaterThan(0);
        expect(b.zones[0]!.kind).toBe('town');
      } else {
        expect(b.zones[0]!.encounters?.groups.length).toBeGreaterThan(0);
        if (place === 'campamento') expect(roles).toContain('mercader');
      }
      if (hasUnderground(place)) {
        expect(b.zones).toHaveLength(2);
        expect(b.zones[0]!.exits!['5']!.to).toBe(subId(x, y));
        expect(b.zones[1]!.exits!['1']!.to).toBe(cellId(x, y));
        if (place === 'mazmorra') { expect(b.zones[1]!.bossSpawn).toBeDefined(); seenDungeon++; }
      }
    }
    expect(seenTown).toBeGreaterThan(5);
    expect(seenDungeon).toBeGreaterThan(2);
  });

  it('los datos de cada bioma son válidos (tiles, enemigos, botín, nombres)', async () => {
    const { TILES, ENEMIES, LOOT_TABLES } = await import('@/data/registry');
    for (const b of BIOMES.values()) {
      for (const t of [b.ground, b.path, b.border, b.roof, b.wall, ...(b.groundAlt ? [b.groundAlt.tile] : []), ...b.props.map((p) => p.tile), ...(b.water ? [b.water.tile] : [])]) {
        expect(TILES.has(t), `${b.id}: tile ${t}`).toBe(true);
      }
      for (const e of b.enemies) expect(ENEMIES.has(e.enemy), `${b.id}: enemigo ${e.enemy}`).toBe(true);
      expect(LOOT_TABLES.has(b.chestLoot), `${b.id}: botín ${b.chestLoot}`).toBe(true);
      expect(b.nouns.length).toBeGreaterThan(2);
      expect(b.epithets.length).toBeGreaterThan(2);
    }
  });

  it('los enemigos de una zona generada están en su bioma y la zona lleva su bioma', () => {
    for (const [x, y] of cells(3)) {
      const def = generateCell(9, x, y, 5).zones[0]!;
      const b = BIOMES.get(def.generated!.biome)!;
      expect(def.generated!.biome).toBe(biomeAt(9, x, y));
      for (const g of def.encounters?.groups ?? []) expect(b.enemies.some((e) => e.enemy === g.enemy)).toBe(true);
    }
  });
});

describe('mundo procedural: niveles, guardado y misiones', () => {
  let gen = emptyGen();
  beforeEach(() => { gen = emptyGen(); activateGenWorld(77, gen); });

  it('al descubrir una zona su nivel es el del jugador ±1 y queda fijado', () => {
    for (const lvl of [1, 3, 8, 15]) {
      for (const [x, y] of cells(2)) {
        const z = ensureZone(cellId(x, y), lvl)!;
        expect(Math.abs(z.level - lvl)).toBeLessThanOrEqual(1);
        expect(z.level).toBeGreaterThanOrEqual(1);
        if (lvl === 1) continue;
      }
      gen.zones = {};
    }
    const a = ensureZone('w_1_0', 4)!;
    const again = ensureZone('w_1_0', 12)!;
    expect(again.level).toBe(a.level);
    expect(zoneLevelFor(77, 'w_1_0', 4)).toBe(a.level);
  });

  it('los enemigos de una zona generada salen al nivel de la zona', () => {
    const g = new Game(testState('guerrero', 77));
    const z = ensureZone('w_1_0', 6)!;
    g.enterZone(z.id, '3');
    const wild = z.encounters ? g.spawnGroup() : [];
    for (const e of wild.filter((x) => !x.def.pet)) expect(e.def.level).toBe(z.level);
  });

  it('el estado generado se serializa, guarda y recarga igual', async () => {
    const st = testState('guerrero', 77);
    const g = new Game(st);
    g.enterZone(ensureZone('w_1_0', 2)!.id, '3');
    const settle = cells(2).map(([x, y]) => cellId(x, y)).find((id) => isSettlement(placeAt(77, parseZoneId(id)!.cx, parseZoneId(id)!.cy)))!;
    g.enterZone(ensureZone(settle, 2)!.id, '1');
    expect(Object.keys(st.world.gen.zones).length).toBeGreaterThan(1);
    const json = JSON.stringify(st);
    const sm = new SaveManager([new MemoryStore()], 't');
    await sm.save(st);
    const loaded = await sm.load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(JSON.stringify(loaded.state.world.gen)).toBe(JSON.stringify(JSON.parse(json).world.gen));
    // Recargar registra de nuevo los PNJ/tiendas/misiones generados.
    const g2 = new Game(loaded.state);
    expect(NPCS.has(`${settle}:alcalde`)).toBe(true);
    expect(g2.zone.id).toBe(st.player.pos.zone);
  });

  it('migra una partida v8 sin mundo generado', () => {
    const old = { ...testState(), world: { dungeons: {}, features: {} } } as unknown as Record<string, unknown>;
    const m = migrate(old, 8, CURRENT_SAVE_VERSION) as { world: { gen: { zones: object } } };
    expect(m.world.gen.zones).toEqual({});
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(9);
  });

  it('las misiones generadas son válidas y se pueden completar', () => {
    let tested = 0;
    for (const seed of [77, 5, 321]) {
      gen = emptyGen();
      activateGenWorld(seed, gen);
      const towns = cells(4).filter(([x, y]) => isSettlement(placeAt(seed, x, y))).slice(0, 6);
      for (const [x, y] of towns) {
        const id = cellId(x, y);
        const qs = assignQuests(id, 6);
        expect(qs.length, `${seed} ${id} sin misiones`).toBeGreaterThan(0);
        for (const q of qs) {
          expect(Quests.validateQuest(q, (i) => !!getItem(i)), q.id).toEqual([]);
          expect(QUESTS.has(q.id)).toBe(true);
          expect(q.zoneHint && gen.zones[q.zoneHint], `${q.id} zona del objetivo no generada`).toBeTruthy();
          expect(q.rewards.xp).toBeGreaterThan(0);
          expect(q.rewards.gold).toBeGreaterThan(0);
          // La zona del objetivo contiene realmente lo pedido.
          const o = q.objectives[0]!;
          const target = gen.zones[q.zoneHint!]!;
          if (o.type === 'kill') {
            const inGroups = target.encounters?.groups.some((g) => g.enemy === o.enemy) || target.bossSpawn?.enemy === o.enemy;
            expect(inGroups, `${q.id} ${o.enemy} no aparece en ${target.id}`).toBe(true);
          }
          if (o.type === 'visit') expect(gen.zones[o.zone]).toBeDefined();
          if (o.type === 'talk') expect(NPCS.get(o.npc)?.zone && gen.zones[NPCS.get(o.npc)!.zone]).toBeTruthy();
          // Simulación: aceptar, cumplir y entregar.
          const s = testState('guerrero', seed);
          s.player.level = 6;
          s.turn = 0;
          expect(Quests.questStatus(s, q.id)).toBe('disponible');
          expect(Quests.accept(s, q.id)).toBeNull();
          for (const ob of q.objectives) {
            if (ob.type === 'kill') for (let i = 0; i < ob.count; i++) Quests.onKill(s, { id: ob.enemy!, family: 'bestia' } as never);
            if (ob.type === 'visit') Quests.onVisit(s, ob.zone);
            if (ob.type === 'talk') Quests.onTalk(s, ob.npc);
            if (ob.type === 'collect') s.player.inventory.push({ uid: 'u1', id: ob.item, qty: ob.count, rarity: 'comun', level: 1, affixes: [] } as never);
          }
          expect(Quests.questStatus(s, q.id), q.id).toBe('lista');
          const res = Quests.turnIn(s, q.id, q.giver);
          expect('quest' in res, q.id).toBe(true);
          expect(NPCS.get(q.giver)!.zone).toBe(id);
          tested++;
        }
      }
    }
    expect(tested).toBeGreaterThan(10);
  });

  it('la guía de misión funciona con zonas generadas, también hacia no descubiertas', () => {
    const st = testState('guerrero', 77);
    const g = new Game(st);
    const town = cells(3).find(([x, y]) => isSettlement(placeAt(77, x, y)))!;
    const id = cellId(town[0], town[1]);
    g.enterZone(ensureZone(id, 3)!.id, '1');
    const qs = Object.values(st.world.gen.quests).filter((q) => q.giver.startsWith(id));
    expect(qs.length).toBeGreaterThan(0);
    const q = qs[0]!;
    Quests.accept(st, q.id);
    const goal = questGoalZone(st, q)!;
    expect(goal).toBeTruthy();
    const hop = nextHop(g.zone, goal);
    if (goal !== id) expect(hop).toBeTruthy();
    // Desde la aldea inicial hay ruta hasta cualquier celda del mundo, descubierta o no.
    const g2 = new Game(testState('guerrero', 77));
    expect(nextHop(g2.zone, cellId(3, 3))).toBeTruthy();
    expect(SHOPS.size).toBeGreaterThan(0);
  });

  it('recorrer una salida de la aldea genera la zona vecina y se puede volver', () => {
    const g = new Game(testState('guerrero', 77));
    const ex = g.zone.exits.find((e) => e.digit === '9')!;
    g.useExit(ex);
    expect(g.zone.id).toBe('w_1_0');
    expect(g.state.world.gen.zones['w_1_0']).toBeDefined();
    const back = g.zone.exits.find((e) => e.to === 'aldea_brumaroja')!;
    expect(back).toBeDefined();
    g.useExit(back);
    expect(g.zone.id).toBe('aldea_brumaroja');
    expect(g.state.player.pos.x).toBe(ex.x);
  });
});
