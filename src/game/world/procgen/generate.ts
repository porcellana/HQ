/**
 * GENERADOR DE ZONAS (determinista): celda + nivel → ZoneDef, PNJ y tiendas.
 * Misma semilla + misma celda + mismo nivel = exactamente la misma zona.
 */
import { ENEMIES, getEnemy, getZoneDef } from '@/data/registry';
import { npcDialog } from '@/data/helpers';
import type { BiomeDef, DialogOption, EncounterTable, NpcDef, NpcLook, PlaceKind, ShopDef, ZoneDef, ZoneExitDef, ZoneFeature } from '@/data/schema';
import { BIOMES } from '@/data/registry';
import WG from '@/data/worldgen/nombres';
import type { Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';
import { generateFloor } from '../dungeonGen';
import { Grid, carve, exitCells, isWalk, reach, tch } from './layout';
import {
  DELTA, DIR_DIGIT, ENTRANCE_DIGIT, biomeAt, cellId, cellLinks, cellName, hasUnderground, inWorld, isSettlement, noise2, placeAt, plannedName, subId,
  type CellLink,
} from './plan';

export interface CellBundle {
  zones: ZoneDef[];
  npcs: NpcDef[];
  shops: ShopDef[];
}

/** Grupos de encuentro de la zona: los enemigos del bioma más cercanos al nivel. */
export function groupsFor(list: BiomeDef['enemies'], level: number): EncounterTable['groups'] {
  const known = list.filter((e) => ENEMIES.has(e.enemy));
  const near = known.filter((e) => Math.abs(getEnemy(e.enemy)!.level - level) <= 4);
  const use = near.length >= 3 ? near : [...known].sort((a, b) => Math.abs(getEnemy(a.enemy)!.level - level) - Math.abs(getEnemy(b.enemy)!.level - level)).slice(0, 3);
  return use.map((e) => ({ enemy: e.enemy, weight: e.weight, ...(e.min ? { min: e.min } : {}), ...(e.max ? { max: e.max } : {}) }));
}

const CLOTHES: Array<[string, string]> = [['#6a2a2a', '#3a1a1a'], ['#3a6a4a', '#1f3a2a'], ['#3a4a7a', '#1f2a46'], ['#7a5a2a', '#46321a'], ['#6a3a6a', '#3a1f3a'], ['#5a5a5a', '#2e2e2e']];
const SKINS = ['#d9a67a', '#c08a60', '#f0c8a0', '#8a5a3a'];
const HAIRS = ['#3a2418', '#a8642c', '#c8c0c8', '#1a1410', '#d8b050'];

function look(rng: Rng, overlay?: string): NpcLook {
  const [cloth, clothDark] = rng.pick(CLOTHES);
  return { ...(overlay ? { overlay } : {}), cloth, clothDark, pants: rng.pick(['#2a2420', '#3a3028', '#2a2a3a']), hair: rng.pick(HAIRS), skin: rng.pick(SKINS) };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Frases con lugares cercanos para los rumores. */
function rumorsFor(seed: number, cx: number, cy: number, rng: Rng): string[] {
  const near: string[] = [];
  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inWorld(cx + dx, cy + dy)) continue;
        const p = placeAt(seed, cx + dx, cy + dy);
        if (p !== 'wild' && !isSettlement(p)) near.push(plannedName(seed, cellId(cx + dx, cy + dy)) ?? '');
      }
    }
  }
  const out = near.filter(Boolean).slice(0, 4).map((n) => rng.pick(WG.rumors).replace('{place}', n));
  return out.length ? out : ['Últimamente todo está tranquilo... demasiado.'];
}

// ===================================================================== interiores
function underground(seed: number, cx: number, cy: number, level: number, place: 'cueva' | 'mazmorra', biome: BiomeDef, name: string): ZoneDef {
  const id = subId(cx, cy);
  const T = WG.underground[place];
  const rng = new Rng(hashString(`${seed}:gen:${id}`));
  const gen = generateFloor(rng, {
    width: 40, height: 40, rooms: place === 'cueva' ? [6, 9] : [8, 11], chests: [2, 3], traps: place === 'cueva' ? [1, 2] : [2, 4], ores: [1, 3], down: place === 'mazmorra',
  });
  const features: ZoneFeature[] = [
    ...gen.chests.map((p): ZoneFeature => ({ kind: 'cofre', x: p.x, y: p.y, locked: rng.chance(0.3), loot: T.chestLoot, level })),
    ...gen.traps.map((p): ZoneFeature => ({ kind: 'trampa', x: p.x, y: p.y, trap: rng.pick(['pinchos', 'dardos', 'fuego'] as const), level })),
    ...gen.ores.map((p): ZoneFeature => ({ kind: 'mineral', x: p.x, y: p.y, ore: rng.pick(biome.ores) })),
  ];
  let map = gen.map;
  let bossSpawn: ZoneDef['bossSpawn'];
  if (place === 'mazmorra' && gen.down) {
    const d = gen.down;
    map = map.map((row, y) => (y === d.y ? row.replace('2', '.') : row));
    const boss = [...WG.bosses].reverse().find((b) => b.minLevel <= level)?.enemy ?? WG.bosses[0]!.enemy;
    const guards: Array<{ enemy: string; x: number; y: number }> = [];
    for (const [dx, dy] of [[-2, 0], [2, 0]] as const) {
      if (map[d.y + dy]?.[d.x + dx] === '.') guards.push({ enemy: rng.pick(groupsFor(T.enemies, level)).enemy, x: d.x + dx, y: d.y + dy });
    }
    bossSpawn = { enemy: boss, x: d.x, y: d.y, level: level + 1, guards };
  }
  const info = { cx, cy, biome: biome.id, place, music: place === 'cueva' ? 'cueva' : 'cripta', battle: place === 'cueva' ? 'cueva' : 'cripta' };
  return {
    id,
    name: `${name} · Interior`,
    kind: 'dungeon',
    level,
    map,
    legend: { '#': T.wall, '.': T.floor },
    exitTile: T.floor,
    spawnTile: T.floor,
    exits: { '1': { to: cellId(cx, cy), arrive: ENTRANCE_DIGIT, label: `Salida a ${name}`, tile: 'escalera_subida' } },
    darkness: T.darkness,
    fog: true,
    encounters: { initial: place === 'cueva' ? 4 : 5, perStepChance: 0.015, maxActive: 8, minDistance: 7, groups: groupsFor(T.enemies, level) },
    features,
    ...(bossSpawn ? { bossSpawn } : {}),
    description: place === 'cueva' ? 'Un aire húmedo y el eco de algo que se arrastra.' : 'Frío, silencio y huesos. Algo poderoso vigila al fondo.',
    discoverXp: (place === 'cueva' ? 12 : 22) * level,
    generated: info,
  };
}

// ======================================================================= tiendas
function shops(zoneId: string, kind: PlaceKind, name: string, level: number): { general: ShopDef; smith: ShopDef } {
  const priceMult = kind === 'ciudad' ? 1.1 : kind === 'aldea' ? 1.1 : 1;
  return {
    general: {
      id: `${zoneId}:shop_general`, name: `Tienda de ${name}`, priceMult, restockTurns: 250, level,
      stock: [
        { item: 'pocion_curacion', qty: [3, 5] }, { item: 'pocion_mana', qty: [1, 3] }, { item: 'antidoto', qty: [1, 3] },
        { item: 'pan', qty: [5, 10] }, { item: 'carne_seca', qty: [3, 6] }, { item: 'pico_hierro', chance: 1 },
        { item: 'runa_vinculo', qty: [1, 3] }, { pool: 'accesorios', count: [0, kind === 'ciudad' ? 2 : 1] },
      ],
    },
    smith: {
      id: `${zoneId}:shop_herrero`, name: `Herrería de ${name}`, priceMult, restockTurns: 300, level,
      buys: ['arma', 'armadura', 'secundaria', 'herramienta', 'material'],
      stock: [
        { pool: 'armas', count: [2, 3] }, { pool: 'armaduras', count: [2, 3] },
        { item: 'pico_acero', chance: level >= 5 ? 0.8 : 0.2 }, { item: 'escudo_madera', chance: 0.7 },
      ],
    },
  };
}

// ======================================================================= celdas
export function generateCell(seed: number, cx: number, cy: number, level: number): CellBundle {
  const id = cellId(cx, cy);
  const place = placeAt(seed, cx, cy);
  const biome = BIOMES.get(biomeAt(seed, cx, cy))!;
  const name = cellName(seed, cx, cy);
  const links = cellLinks(cx, cy);
  const rng = new Rng(hashString(`${seed}:gen:${id}`));
  const town = isSettlement(place);
  const [W, H] = place === 'ciudad' ? [42, 34] : place === 'pueblo' ? [36, 30] : town ? [32, 28] : [30, 28];
  const g = new Grid(W, H, tch(biome.ground));
  const reserved = new Set<number>();
  const used = new Set<number>(); // casillas ocupadas por PNJ, elementos o decorados
  const hub = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
  const path = tch(town && place !== 'aldea' ? 'adoquin' : biome.path);
  const roadTile = tch(biome.path);

  // Variación del suelo
  if (biome.groundAlt) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (rng.chance(biome.groundAlt.chance)) g.set(x, y, tch(biome.groundAlt.tile));
  }
  // Borde y salidas
  const border = tch(biome.border);
  for (let x = 0; x < W; x++) { g.set(x, 0, border); g.set(x, H - 1, border); }
  for (let y = 0; y < H; y++) { g.set(0, y, border); g.set(W - 1, y, border); }
  const exits: Record<string, ZoneExitDef> = {};
  const targets: Point[] = [];
  for (const l of links as CellLink[]) {
    const { cells, inner } = exitCells(l.dir, W, H);
    const digit = DIR_DIGIT[l.dir];
    for (const c of cells) { g.set(c.x, c.y, digit); reserved.add(g.k(c.x, c.y)); }
    reserved.add(g.k(inner.x, inner.y));
    g.set(inner.x, inner.y, roadTile);
    const dest = getZoneDef(l.to)?.name ?? plannedName(seed, l.to) ?? l.to;
    exits[digit] = { to: l.to, arrive: l.arrive, label: `Hacia ${dest}` };
    targets.push(inner);
    const lane = { x: inner.x - DELTA[l.dir].dx, y: inner.y - DELTA[l.dir].dy };
    reserved.add(g.k(lane.x, lane.y));
    for (const p of carve(g, inner, hub, new Set(), roadTile, rng)) reserved.add(g.k(p.x, p.y));
  }
  // Reserva el área alrededor del centro
  const clear = (r: number) => { for (let y = hub.y - r; y <= hub.y + r; y++) for (let x = hub.x - r; x <= hub.x + r; x++) reserved.add(g.k(x, y)); };

  const features: ZoneFeature[] = [];
  const npcs: NpcDef[] = [];
  const shopList: ShopDef[] = [];
  let encounters: EncounterTable | undefined;
  const info = { cx, cy, biome: biome.id, place, music: biome.music, battle: biome.battle };
  const sub: ZoneDef[] = [];
  const npcSpot = (x: number, y: number): boolean => g.inb(x, y) && isWalk(g.get(x, y)) && !/[1-9]/.test(g.get(x, y)) && !used.has(g.k(x, y));
  const settle = (x: number, y: number): Point | null => {
    for (let r = 0; r < 4; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (npcSpot(x + dx, y + dy)) { used.add(g.k(x + dx, y + dy)); return { x: x + dx, y: y + dy }; }
    }
    return null;
  };
  const addNpc = (role: string, title: string, nm: string, at: Point | null, dialog: NpcDef['dialog'], overlay?: string): NpcDef | null => {
    if (!at) return null;
    const n: NpcDef = { id: `${id}:${role}`, name: nm, title, zone: id, x: at.x, y: at.y, look: look(rng, overlay), dialog, ...(rng.chance(0.5) ? { facingLeft: true } : {}) };
    npcs.push(n);
    return n;
  };
  const rumors = rumorsFor(seed, cx, cy, rng);
  const firstName = () => rng.pick(WG.firstNames);

  if (town) {
    // ------------------------------------------------------------ asentamiento
    const pr = place === 'ciudad' ? 4 : place === 'pueblo' ? 3 : 2;
    for (let y = hub.y - pr; y <= hub.y + pr; y++) for (let x = hub.x - pr; x <= hub.x + pr; x++) { g.set(x, y, path); reserved.add(g.k(x, y)); }
    g.set(hub.x, hub.y, tch('pozo'));
    used.add(g.k(hub.x, hub.y));
    for (const [dx, dy] of [[-pr, -pr], [pr, -pr], [-pr, pr], [pr, pr]] as const) { g.set(hub.x + dx, hub.y + dy, tch('farol')); used.add(g.k(hub.x + dx, hub.y + dy)); }
    const roads = new Set(reserved);
    // Edificios
    const want = place === 'ciudad' ? 12 : place === 'pueblo' ? 8 : 5;
    interface Building { x: number; y: number; w: number; door: Point; front: Point }
    const blds: Building[] = [];
    const occ = new Set<number>();
    for (let a = 0; a < 500 && blds.length < want; a++) {
      const bw = rng.int(5, 7);
      const x = rng.int(3, W - bw - 3);
      const y = rng.int(3, H - 7);
      let ok = true;
      for (let yy = y - 1; yy <= y + 4 && ok; yy++) for (let xx = x - 1; xx <= x + bw && ok; xx++) if (roads.has(g.k(xx, yy)) || occ.has(g.k(xx, yy))) ok = false;
      if (!ok) continue;
      for (let yy = y - 1; yy <= y + 3; yy++) for (let xx = x - 1; xx <= x + bw; xx++) occ.add(g.k(xx, yy));
      const door = { x: x + Math.floor(bw / 2), y: y + 2 };
      for (let xx = x; xx < x + bw; xx++) { g.set(xx, y, tch(biome.roof)); g.set(xx, y + 1, tch(biome.roof)); g.set(xx, y + 2, tch(biome.wall)); }
      g.set(door.x, door.y, tch('puerta'));
      blds.push({ x, y, w: bw, door, front: { x: door.x, y: door.y + 1 } });
    }
    const bset = new Set<number>();
    for (const b of blds) for (let yy = b.y; yy <= b.y + 2; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) bset.add(g.k(xx, yy));
    for (const b of blds) {
      for (const p of carve(g, b.front, hub, bset, roadTile, rng)) reserved.add(g.k(p.x, p.y));
      reserved.add(g.k(b.front.x, b.front.y));
    }
    for (const k of bset) reserved.add(k);
    // Arbolado en el borde
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (edge > 4 || reserved.has(g.k(x, y)) || occ.has(g.k(x, y))) continue;
        for (const p of biome.props) if (noise2(seed, `p${id}`, x / 4, y / 4) > 0.5 && rng.chance(p.density * 0.7)) { g.set(x, y, tch(p.tile)); break; }
      }
    }
    // Funciones por cercanía al centro
    blds.sort((a, b) => Math.hypot(a.door.x - hub.x, a.door.y - hub.y) - Math.hypot(b.door.x - hub.x, b.door.y - hub.y));
    const roles = place === 'aldea' ? ['tienda', 'posada'] : place === 'pueblo' ? ['tienda', 'posada', 'herrero'] : ['tienda', 'posada', 'herrero', 'templo', 'gremio'];
    const sh = shops(id, place, name, level);
    const kindWord = WG.settlement[place as 'aldea'];
    const leaderSpot = settle(hub.x + 2, hub.y + 1);
    const leaderName = firstName();
    const leaderOpts: DialogOption[] = [];
    addNpc('alcalde', kindWord.leader, leaderName, leaderSpot, npcDialog({ greeting: [...WG.leaderGreetings], quests: true, rumors, extraOptions: leaderOpts }));
    roles.forEach((role, i) => {
      const b = blds[i];
      if (!b) return;
      const spot = settle(b.front.x, b.front.y);
      const nm = firstName();
      if (!spot) return;
      const sign = { x: b.door.x - 1, y: b.door.y + 1 };
      if (g.get(sign.x, sign.y) !== tch('camino') && npcSpot(sign.x, sign.y)) { g.set(sign.x, sign.y, tch('cartel')); used.add(g.k(sign.x, sign.y)); }
      if (role === 'tienda' || role === 'gremio') {
        const s = role === 'tienda' ? sh.general : { ...sh.general, id: `${id}:shop_gremio`, name: `Gremio de ${name}`, stock: [...sh.general.stock, { pool: 'equipo' as const, count: [1, 2] as [number, number] }] };
        shopList.push(s);
        addNpc(role, role === 'tienda' ? 'Tendero' : 'Gremio de aventureros', nm, spot, npcDialog({ greeting: [...WG.shopGreetings], shop: s.id, quests: false, rumors }));
      } else if (role === 'herrero') {
        shopList.push(sh.smith);
        addNpc(role, 'Herrero', nm, spot, npcDialog({ greeting: [...WG.smithGreetings], shop: sh.smith.id, rumors }), 'guerrero');
      } else if (role === 'posada') {
        addNpc(role, 'Posadero', nm, spot, npcDialog({ greeting: [...WG.innGreetings], inn: 6 + level * 3, rumors }));
      } else {
        addNpc(role, 'Sacerdote', nm, spot, npcDialog({ greeting: [...WG.templeGreetings], temple: 4 }), 'clerigo');
      }
    });
    const villagers = place === 'ciudad' ? 4 : place === 'pueblo' ? 3 : 2;
    for (let i = 0; i < villagers; i++) {
      const spot = settle(hub.x + rng.int(-5, 5), hub.y + rng.int(-4, 4));
      addNpc(`aldeano${i + 1}`, i % 2 ? 'Vecina' : 'Vecino', firstName(), spot, npcDialog({ greeting: [rng.pick(WG.villagerGreetings)], rumors: rumors.slice(i % rumors.length).concat(rumors) }));
    }
  } else {
    // ------------------------------------------------------------ zona salvaje
    clear(2);
    let entrance: Point | null = null;
    if (place === 'campamento') {
      const c = { x: hub.x + rng.int(-2, 2), y: hub.y + rng.int(-2, 2) };
      for (let y = c.y - 3; y <= c.y + 3; y++) for (let x = c.x - 4; x <= c.x + 4; x++) { reserved.add(g.k(x, y)); used.add(g.k(x, y)); if (g.get(x, y) !== roadTile && isWalk(g.get(x, y)) === false) g.set(x, y, tch(biome.ground)); }
      g.set(c.x, c.y, tch('fogata'));
      g.set(c.x - 3, c.y - 1, tch('tienda_campana'));
      g.set(c.x + 3, c.y - 1, tch('tienda_campana'));
      g.set(c.x, c.y - 2, tch('tienda_campana'));
      used.delete(g.k(c.x + 1, c.y + 1)); used.delete(g.k(c.x - 1, c.y + 1)); used.delete(g.k(c.x, c.y + 2));
      const sh = shops(id, 'aldea', name, level).general;
      sh.id = `${id}:shop_general`;
      sh.name = `Mercader de ${name}`;
      shopList.push(sh);
      addNpc('mercader', 'Mercader errante', firstName(), settle(c.x + 1, c.y + 1), npcDialog({ greeting: [...WG.campGreetings], shop: sh.id, quests: true, rumors }));
      addNpc('viajero', 'Viajero', firstName(), settle(c.x - 1, c.y + 1), npcDialog({ greeting: [rng.pick(WG.villagerGreetings)], rumors }));
    } else if (place === 'ruinas') {
      const rw = 11, rh = 7;
      const x0 = hub.x - 5, y0 = hub.y - 3;
      for (let y = y0; y < y0 + rh; y++) {
        for (let x = x0; x < x0 + rw; x++) {
          reserved.add(g.k(x, y));
          const edge = x === x0 || y === y0 || x === x0 + rw - 1 || y === y0 + rh - 1;
          if (edge) { if (rng.chance(0.72)) g.set(x, y, tch('muro_ruina')); else g.set(x, y, tch(biome.ground)); }
          else g.set(x, y, tch(biome.ground));
        }
      }
      const inside = (): Point => ({ x: rng.int(x0 + 2, x0 + rw - 3), y: rng.int(y0 + 2, y0 + rh - 3) });
      for (let i = 0; i < 3; i++) { const p = inside(); if ((p.x !== hub.x || p.y !== hub.y) && g.get(p.x, p.y) !== roadTile) g.set(p.x, p.y, tch('tumba')); }
      for (let i = 0; i < 2; i++) {
        const p = inside();
        if (g.get(p.x, p.y) === tch(biome.ground) && !used.has(g.k(p.x, p.y)) && !(p.x === hub.x && p.y === hub.y)) {
          used.add(g.k(p.x, p.y));
          features.push({ kind: 'cofre', x: p.x, y: p.y, locked: rng.chance(0.5), loot: biome.chestLoot, level: level + 1 });
        }
      }
      const tp = inside();
      if (g.get(tp.x, tp.y) === tch(biome.ground) && !used.has(g.k(tp.x, tp.y))) { used.add(g.k(tp.x, tp.y)); features.push({ kind: 'trampa', x: tp.x, y: tp.y, trap: rng.pick(['pinchos', 'dardos'] as const), level }); }
    } else if (hasUnderground(place)) {
      for (let a = 0; a < 80 && !entrance; a++) {
        const x = rng.int(5, W - 6);
        const y = rng.int(5, H - 6);
        if (Math.hypot(x - hub.x, y - hub.y) < 7 || reserved.has(g.k(x, y))) continue;
        entrance = { x, y };
      }
      entrance ??= { x: 5, y: 5 };
      g.set(entrance.x, entrance.y, ENTRANCE_DIGIT);
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]] as const) { g.set(entrance.x + dx, entrance.y + dy, tch(biome.border === 'pino' ? 'pena' : biome.border)); reserved.add(g.k(entrance.x + dx, entrance.y + dy)); }
      reserved.add(g.k(entrance.x, entrance.y));
      const front = { x: entrance.x, y: entrance.y + 1 };
      g.set(front.x, front.y, roadTile);
      reserved.add(g.k(front.x, front.y));
      for (const p of carve(g, front, hub, new Set(), roadTile, rng)) reserved.add(g.k(p.x, p.y));
      exits[ENTRANCE_DIGIT] = { to: subId(cx, cy), arrive: '1', label: name, tile: 'cueva' };
      targets.push(front);
      sub.push(underground(seed, cx, cy, level + (place === 'mazmorra' ? 1 : 0), place as 'cueva' | 'mazmorra', biome, name));
    }
    // Obstáculos agrupados
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (reserved.has(g.k(x, y)) || used.has(g.k(x, y)) || g.get(x, y) !== tch(biome.ground) && g.get(x, y) !== (biome.groundAlt ? tch(biome.groundAlt.tile) : '')) continue;
        const n = noise2(seed, `p${id}`, x / 4, y / 4);
        for (const p of biome.props) {
          if ((n > 0.55 && rng.chance(p.density * 1.4)) || rng.chance(p.density * 0.06)) { g.set(x, y, tch(p.tile)); break; }
        }
      }
    }
    // Estanques
    if (biome.water) {
      const nPonds = rng.int(biome.water.ponds[0], biome.water.ponds[1]);
      for (let i = 0, done = 0; i < 40 && done < nPonds; i++) {
        const c = { x: rng.int(6, W - 7), y: rng.int(6, H - 7) };
        const rx = rng.int(2, 4);
        const ry = rng.int(2, 3);
        const cells: Point[] = [];
        let bad = false;
        for (let y = c.y - ry; y <= c.y + ry && !bad; y++) {
          for (let x = c.x - rx; x <= c.x + rx; x++) {
            if (((x - c.x) / rx) ** 2 + ((y - c.y) / ry) ** 2 > 1) continue;
            if (reserved.has(g.k(x, y)) || used.has(g.k(x, y))) { bad = true; break; }
            cells.push({ x, y });
          }
        }
        if (bad) continue;
        for (const p of cells) g.set(p.x, p.y, tch(biome.water.tile));
        done++;
      }
    }
    // Conectividad: todo destino debe poder alcanzarse desde el centro.
    const fix = () => {
      for (let pass = 0; pass < 3; pass++) {
        const r = reach(g, hub);
        const lost = targets.filter((t) => !r.has(g.k(t.x, t.y)));
        if (!lost.length) return;
        for (const t of lost) carve(g, t, hub, new Set(), roadTile, rng);
      }
    };
    fix();
    // Cofres y vetas
    const spots: Point[] = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!reserved.has(g.k(x, y)) && !used.has(g.k(x, y)) && g.get(x, y) === tch(biome.ground)) spots.push({ x, y });
    const shuffled = [...spots];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const blocked = new Set<number>();
    const tryPlace = (f: ZoneFeature): boolean => {
      for (let i = 0; i < shuffled.length; i++) {
        const p = shuffled[i]!;
        const k = g.k(p.x, p.y);
        if (blocked.has(k) || used.has(k)) continue;
        blocked.add(k);
        const r = reach(g, hub, blocked);
        const touches = (q: Point) => Object.values(DELTA).some((d) => r.has(g.k(q.x + d.dx, q.y + d.dy)));
        const adj = touches(p) && features.every((o) => touches(o));
        if (adj && targets.every((t) => r.has(g.k(t.x, t.y))) && npcs.every((n) => r.has(g.k(n.x, n.y)))) {
          shuffled.splice(i, 1);
          features.push({ ...f, x: p.x, y: p.y } as ZoneFeature);
          used.add(k);
          return true;
        }
        blocked.delete(k);
      }
      return false;
    };
    const nChests = rng.int(1, 3);
    for (let i = 0; i < nChests; i++) tryPlace({ kind: 'cofre', x: 0, y: 0, locked: rng.chance(0.3), loot: biome.chestLoot, level });
    const nOres = rng.int(1, 3);
    for (let i = 0; i < nOres; i++) tryPlace({ kind: 'mineral', x: 0, y: 0, ore: rng.pick(biome.ores) });
    encounters = {
      initial: place === 'campamento' ? 1 : rng.int(2, 4), perStepChance: 0.035, maxActive: place === 'campamento' ? 4 : 7, minDistance: 7,
      groups: groupsFor(biome.enemies, level),
    };
  }

  const def: ZoneDef = {
    id,
    name,
    kind: town ? 'town' : 'wild',
    level,
    map: g.rows(),
    exitTile: biome.path,
    spawnTile: biome.path,
    exits,
    darkness: biome.darkness,
    ...(biome.tint ? { tint: biome.tint } : {}),
    ...(encounters ? { encounters } : {}),
    features,
    description: `${cap(place === 'wild' ? biome.name : place)} · nivel ${level}.`,
    discoverXp: town ? 0 : 12 * level,
    generated: info,
  };
  return { zones: [def, ...sub], npcs, shops: shopList };
}
