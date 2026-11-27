/**
 * MAZMORRAS EN PARTIDA
 * Convierte una DungeonDef en zonas normales (ZoneDef) bajo demanda:
 *   - piso 1:      id de la mazmorra (p. ej. "cueva_goblin")
 *   - piso N:      "<id>__p<N>"
 *   - sala del jefe: "<id>__jefe"
 * Cada piso se genera con la semilla de la partida + id + piso + reinicio, así
 * que es estable en una partida (puedes guardar dentro) y distinto en otra.
 */
import { DUNGEONS, getEnemy, getZoneDef } from '@/data/registry';
import type { DungeonDef, ZoneDef, ZoneFeature } from '@/data/schema';
import { Rng, hashString } from '@/engine/rng';
import { generateFloor } from './dungeonGen';
import type { GenWorld } from './procgen';
import { emptyGen } from './procgen';

export interface DungeonProgress {
  /** Número de reinicio (cambia la semilla al rejugarla). */
  run: number;
  /** Jefe derrotado en este reinicio. */
  cleared: boolean;
  /** Piso más profundo alcanzado. */
  deepest: number;
}

/** Estado del mundo que se guarda (Hito 6). */
export interface WorldState {
  dungeons: Record<string, DungeonProgress>;
  /**
   * Elementos ya usados: clave "zona#reinicio:x,y" → turno en que se usó
   * (cofre abierto, trampa desactivada o disparada, veta agotada).
   */
  features: Record<string, number>;
  /** Mundo procedural (v0.8): zonas, PNJ, tiendas y misiones generadas al explorar. */
  gen: GenWorld;
}

export function emptyWorld(): WorldState {
  return { dungeons: {}, features: {}, gen: emptyGen() };
}

export type FloorRef = number | 'jefe';

export function floorZoneId(dungeonId: string, floor: FloorRef): string {
  if (floor === 1) return dungeonId;
  return floor === 'jefe' ? `${dungeonId}__jefe` : `${dungeonId}__p${floor}`;
}

/** ¿Es esta zona un piso de mazmorra? Devuelve la mazmorra y el piso. */
export function parseDungeonZone(zoneId: string): { dungeon: DungeonDef; floor: FloorRef } | null {
  const [base, suffix] = zoneId.split('__');
  const dungeon = DUNGEONS.get(base ?? '');
  if (!dungeon) return null;
  if (!suffix) return { dungeon, floor: 1 };
  if (suffix === 'jefe') return { dungeon, floor: 'jefe' };
  const n = Number(suffix.replace(/^p/, ''));
  return Number.isInteger(n) && n >= 2 && n <= dungeon.floors ? { dungeon, floor: n } : null;
}

export function floorLevel(d: DungeonDef, floor: FloorRef): number {
  const n = floor === 'jefe' ? d.floors : floor;
  return d.level + (n - 1) * (d.levelPerFloor ?? 1);
}

export function progressOf(world: WorldState, dungeonId: string): DungeonProgress {
  return (world.dungeons[dungeonId] ??= { run: 0, cleared: false, deepest: 0 });
}

const cache = new Map<string, ZoneDef>();

/** Crea (o recupera de la caché) la ZoneDef de un piso. */
export function dungeonZoneDef(seed: number, world: WorldState, zoneId: string): ZoneDef | undefined {
  const ref = parseDungeonZone(zoneId);
  if (!ref) return undefined;
  const { dungeon: d, floor } = ref;
  const run = progressOf(world, d.id).run;
  const key = `${zoneId}|${seed}|${run}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = floor === 'jefe' ? bossRoom(d, run) : generatedFloor(d, floor, seed, run);
  cache.set(key, def);
  return def;
}

function generatedFloor(d: DungeonDef, floor: number, seed: number, run: number): ZoneDef {
  const rng = new Rng(hashString(`${seed}:${d.id}:${floor}:${run}`));
  const level = floorLevel(d, floor);
  const gen = generateFloor(rng, {
    width: d.width, height: d.height, rooms: d.rooms, chests: d.chestsPerFloor, traps: d.trapsPerFloor, ores: d.oresPerFloor, down: true,
  });
  const features: ZoneFeature[] = [
    ...gen.chests.map((p): ZoneFeature => ({ kind: 'cofre', x: p.x, y: p.y, locked: rng.chance(d.lockedChance), loot: d.chestLoot, level })),
    ...gen.traps.map((p): ZoneFeature => ({ kind: 'trampa', x: p.x, y: p.y, trap: rng.pick(d.traps), level })),
    ...gen.ores.map((p): ZoneFeature => ({ kind: 'mineral', x: p.x, y: p.y, ore: rng.pick(d.ores) })),
  ];
  const isLast = floor === d.floors;
  const up = floor === 1
    ? { to: d.surface.zone, arrive: d.surface.arrive, label: `Salida a ${getZoneDef(d.surface.zone)?.name ?? 'la superficie'}`, tile: 'escalera_subida' }
    : { to: floorZoneId(d.id, floor - 1), arrive: '2', label: `Subir al piso ${floor - 1}`, tile: 'escalera_subida' };
  const bossName = getEnemy(d.boss.enemy)?.name ?? 'el jefe';
  const down = isLast
    ? { to: floorZoneId(d.id, 'jefe'), arrive: '1', label: `Bajar a la guarida de ${bossName}`, tile: 'escalera_bajada' }
    : { to: floorZoneId(d.id, floor + 1), arrive: '1', label: `Bajar al piso ${floor + 1}`, tile: 'escalera_bajada' };
  const enc = d.floorEncounters[Math.min(floor - 1, d.floorEncounters.length - 1)];
  return {
    id: floorZoneId(d.id, floor),
    name: `${d.name} · Piso ${floor}`,
    kind: 'dungeon',
    level,
    map: gen.map,
    legend: { '#': d.wallTile, '.': d.floorTile },
    exitTile: d.floorTile,
    spawnTile: d.floorTile,
    exits: { '1': up, '2': down },
    darkness: d.darkness,
    ...(enc ? { encounters: enc } : {}),
    features,
    description: floor === 1 ? d.description : undefined,
    discoverXp: 10 * level,
    dungeon: { id: d.id, floor, run },
  };
}

function bossRoom(d: DungeonDef, run: number): ZoneDef {
  let spawn = { x: 0, y: 0 };
  const map = d.boss.map.map((row, y) => {
    const x = row.indexOf('X');
    if (x >= 0) spawn = { x, y };
    return row.replace('X', '.');
  });
  return {
    id: floorZoneId(d.id, 'jefe'),
    name: `${d.name} · Guarida`,
    kind: 'dungeon',
    level: floorLevel(d, 'jefe'),
    map,
    legend: { '#': d.wallTile, '.': d.floorTile },
    exitTile: d.floorTile,
    spawnTile: d.floorTile,
    exits: {
      '1': { to: floorZoneId(d.id, d.floors), arrive: '2', label: 'Subir', tile: 'escalera_subida' },
      '3': {
        to: d.surface.zone, arrive: d.surface.arrive, label: 'Salida a la superficie', tile: 'escalera_subida',
        requiresFlag: `boss_${d.boss.enemy}`, lockedText: 'Un derrumbe tapa el pasadizo. Derrota al jefe para abrirlo.',
      },
    },
    darkness: Math.max(0, d.darkness - 0.1),
    bossSpawn: { enemy: d.boss.enemy, ...spawn, ...(d.boss.guards ? { guards: d.boss.guards } : {}) },
    discoverXp: 25 * floorLevel(d, 'jefe'),
    dungeon: { id: d.id, floor: 'jefe', run },
  };
}

/** Clave estable de un elemento (cambia al reiniciar la mazmorra). */
export function featureKey(zone: ZoneDef, x: number, y: number): string {
  return `${zone.id}#${zone.dungeon?.run ?? 0}:${x},${y}`;
}
