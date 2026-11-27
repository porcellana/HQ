/**
 * MUNDO PROCEDURAL EN PARTIDA
 * Las zonas se generan al descubrirlas (cruzar una salida), con la semilla de la partida y un
 * nivel = nivel del jugador ±1 que queda fijado y guardado. Todo lo generado vive en
 * `state.world.gen` (se serializa con la partida) y se registra en el registro de contenido.
 */
import { NPCS, clearGenerated, registerGenerated } from '@/data/registry';
import type { NpcDef, QuestDef, ShopDef, ZoneDef } from '@/data/schema';
import { hashString } from '@/engine/rng';
import { generateCell } from './generate';
import { cellId, parseZoneId } from './plan';
import { makeQuests } from './quests';

export interface GenWorld {
  zones: Record<string, ZoneDef>;
  npcs: Record<string, NpcDef>;
  shops: Record<string, ShopDef>;
  quests: Record<string, QuestDef>;
  /** Zonas cuyo reparto de misiones ya se hizo. */
  assigned: Record<string, true>;
}

export const MAX_ZONE_LEVEL = 20;

export function emptyGen(): GenWorld {
  return { zones: {}, npcs: {}, shops: {}, quests: {}, assigned: {} };
}

let active: { seed: number; gen: GenWorld } | null = null;

/** Activa el mundo generado de una partida (al crearla o cargarla): registra sus PNJ, tiendas y misiones. */
export function activateGenWorld(seed: number, gen: GenWorld): void {
  clearGenerated();
  active = { seed, gen };
  registerGenerated({ npcs: Object.values(gen.npcs), shops: Object.values(gen.shops), quests: Object.values(gen.quests) });
}

export function deactivateGenWorld(): void {
  clearGenerated();
  active = null;
}

export const genZoneDef = (id: string): ZoneDef | undefined => active?.gen.zones[id];
export const activeSeed = (): number => active?.seed ?? 0;

/** Nivel con el que se descubre una zona: el del jugador ±1 (determinista por semilla y zona). */
export function zoneLevelFor(seed: number, id: string, playerLevel: number): number {
  const off = (hashString(`${seed}:lvl:${id}`) % 3) - 1;
  return Math.max(1, Math.min(MAX_ZONE_LEVEL, playerLevel + off));
}

/** Genera (si falta) una zona del mundo con el nivel de jugador dado y devuelve su definición. */
export function ensureZone(id: string, playerLevel: number): ZoneDef | undefined {
  if (!active) return undefined;
  const have = active.gen.zones[id];
  if (have) return have;
  const p = parseZoneId(id);
  if (!p) return undefined;
  const { seed, gen } = active;
  const base = cellId(p.cx, p.cy);
  if (!gen.zones[base]) {
    const level = zoneLevelFor(seed, base, playerLevel);
    const bundle = generateCell(seed, p.cx, p.cy, level);
    for (const z of bundle.zones) gen.zones[z.id] = z;
    for (const n of bundle.npcs) gen.npcs[n.id] = n;
    for (const s of bundle.shops) gen.shops[s.id] = s;
    registerGenerated({ npcs: bundle.npcs, shops: bundle.shops });
  }
  return gen.zones[id];
}

/** Reparte las misiones de un asentamiento o campamento (la primera vez que se visita). */
export function assignQuests(id: string, playerLevel: number): QuestDef[] {
  if (!active || active.gen.assigned[id]) return [];
  const zone = ensureZone(id, playerLevel);
  if (!zone?.generated) return [];
  const giverId = NPCS.has(`${id}:alcalde`) ? `${id}:alcalde` : NPCS.has(`${id}:mercader`) ? `${id}:mercader` : null;
  active.gen.assigned[id] = true;
  if (!giverId) return [];
  const place = zone.generated.place;
  const count = place === 'ciudad' ? 4 : place === 'pueblo' ? 3 : place === 'aldea' ? 2 : 1;
  const quests = makeQuests({ seed: active.seed, zone, giver: giverId, count, ensure: (zid) => ensureZone(zid, playerLevel) });
  for (const q of quests) active.gen.quests[q.id] = q;
  registerGenerated({ quests });
  return quests;
}

/** Zonas generadas hasta ahora (para el mapa del mundo). */
export function generatedZones(): ZoneDef[] {
  return active ? Object.values(active.gen.zones) : [];
}

export { cellId, parseZoneId, plannedNeighbors, plannedName, CORE_CELLS, WORLD_RADIUS } from './plan';
