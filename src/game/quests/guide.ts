/**
 * GUÍA HACIA EL OBJETIVO
 * Calcula a qué zona hay que ir para la misión seguida y qué salida de la zona
 * actual lleva hacia allí (búsqueda en anchura sobre el grafo de salidas).
 * Esa salida se rotula destacada en verde con ★ (y la brújula apunta hacia ella).
 */
import { DUNGEONS, ENEMIES, LOOT_TABLES, NPCS, ORES, PET_SPECIES, ZONES } from '@/data/registry';
import type { QuestDef, QuestObjective } from '@/data/schema';
import { parseDungeonZone } from '../world/dungeons';
import { activeSeed, genZoneDef, plannedName, plannedNeighbors } from '../world/procgen';
import type { Zone } from '../world/zone';
import { isReady, objectiveProgress, type QuestHolder } from './quests';

/** Tipo de paso de misión (decide el icono de la guía). */
export type GoalKind = 'hablar' | 'cazar' | 'recoger' | 'ir';

export const GOAL_ICON: Record<GoalKind, string> = { hablar: '💬', cazar: '⚔', recoger: '✋', ir: '📍' };

/** Siguiente paso concreto de una misión. */
export type QuestStep =
  | { kind: 'hablar'; npc: string }
  | { kind: 'cazar'; enemy?: string; family?: string; wild?: string | true }
  | { kind: 'recoger'; item: string }
  | { kind: 'ir'; zone: string };

/** Primer objetivo sin cumplir (o la entrega si ya está todo). */
export function questStep(h: QuestHolder, q: QuestDef): QuestStep | null {
  if (isReady(h, q)) return { kind: 'hablar', npc: q.turnIn ?? q.giver };
  const i = q.objectives.findIndex((_, k) => {
    const p = objectiveProgress(h, q, k);
    return p.have < p.need;
  });
  const o: QuestObjective | undefined = q.objectives[i];
  if (!o) return null;
  switch (o.type) {
    case 'visit':
      return { kind: 'ir', zone: o.zone };
    case 'talk':
      return { kind: 'hablar', npc: o.npc };
    case 'kill':
      return { kind: 'cazar', ...(o.enemy ? { enemy: o.enemy } : {}), ...(o.family ? { family: o.family } : {}) };
    case 'collect':
      return { kind: 'recoger', item: o.item };
    case 'bind':
      return { kind: 'cazar', wild: o.species ?? true };
  }
}

/** Primera zona donde vive una criatura salvaje (de una especie o cualquiera). */
export function wildZone(species: string | true): string | null {
  const list = [...PET_SPECIES.values()].filter((s) => s.catchable && (species === true || s.id === species));
  for (const s of list) for (const hId of s.habitats) if (ZONES.has(hId)) return hId;
  for (const s of list) for (const hId of s.habitats) if (DUNGEONS.has(hId)) return hId;
  return null;
}

/** ¿Este enemigo cuenta para un paso de caza? */
export function enemyMatches(step: { enemy?: string; family?: string }, enemyId: string): boolean {
  const e = ENEMIES.get(enemyId);
  if (!e) return false;
  return step.enemy ? e.id === step.enemy : e.family === step.family;
}

/** Enemigos que pueden soltar este objeto (según sus tablas de botín). */
export function enemiesDropping(itemId: string): string[] {
  const tables = [...LOOT_TABLES.values()].filter((t) => t.entries.some((e) => 'item' in e && e.item === itemId)).map((t) => t.id);
  return [...ENEMIES.values()].filter((e) => e.lootTable && tables.includes(e.lootTable)).map((e) => e.id);
}

/** Primera zona (fija o mazmorra) donde aparece alguno de estos enemigos. */
function zoneWithEnemy(match: (enemyId: string) => boolean): string | null {
  for (const z of ZONES.values()) if (z.encounters?.groups.some((g) => match(g.enemy))) return z.id;
  for (const d of DUNGEONS.values()) if (d.floorEncounters.some((t) => t.groups.some((g) => match(g.enemy)))) return d.id;
  return null;
}

/** Dónde se consigue un objeto: veta de mineral o enemigos que lo sueltan. */
export function itemSourceZone(itemId: string): string | null {
  const ore = [...ORES.values()].find((o) => o.item === itemId);
  if (ore) {
    for (const z of ZONES.values()) if (z.features?.some((f) => f.kind === 'mineral' && f.ore === ore.id)) return z.id;
    for (const d of DUNGEONS.values()) if (d.ores.includes(ore.id)) return d.id;
  }
  const droppers = enemiesDropping(itemId);
  if (droppers.length) return zoneWithEnemy((id) => droppers.includes(id));
  return null;
}

/** Zona donde se cumple el siguiente paso de la misión (o null si no se sabe). */
export function questGoalZone(h: QuestHolder, q: QuestDef): string | null {
  const step = questStep(h, q);
  if (!step) return null;
  // Misiones generadas: la zona del objetivo está guardada en la propia misión.
  if (q.zoneHint && (step.kind === 'recoger' || (step.kind === 'cazar' && !step.wild))) return q.zoneHint;
  switch (step.kind) {
    case 'ir':
      return step.zone;
    case 'hablar':
      return NPCS.get(step.npc)?.zone ?? null;
    case 'cazar': {
      if (step.wild) return wildZone(step.wild);
      if (step.enemy) {
        const d = [...DUNGEONS.values()].find((x) => x.boss.enemy === step.enemy);
        if (d) return `${d.id}__jefe`;
      }
      return zoneWithEnemy((id) => enemyMatches(step, id));
    }
    case 'recoger':
      // Si no se sabe dónde se consigue, guía a quien dio la misión.
      return itemSourceZone(step.item) ?? NPCS.get(q.giver)?.zone ?? null;
  }
}

/** Vecinos de una zona fija (destinos de sus salidas). */
function neighbors(zoneId: string): string[] {
  const def = ZONES.get(zoneId) ?? genZoneDef(zoneId);
  const out = def ? Object.values(def.exits ?? {}).map((e) => e.to) : [];
  // Mundo procedural: la rejilla se conoce sin generar las zonas, así la guía llega también a las no descubiertas.
  out.push(...plannedNeighbors(activeSeed(), zoneId));
  return [...new Set(out)];
}

/**
 * Destino (`to`) de la salida de `zone` que acerca a `goal`, o null.
 * Dentro de una mazmorra se baja hacia el jefe o se sube hacia la superficie.
 */
export function nextHop(zone: Zone, goal: string): string | null {
  if (zone.id === goal) return null;
  const here = parseDungeonZone(zone.id);
  const target = parseDungeonZone(goal);
  if (here) {
    const down = zone.exits.find((e) => e.tile === 'escalera_bajada');
    const up = zone.exits.find((e) => e.to !== zone.id && e.tile !== 'escalera_bajada');
    if (target && target.dungeon.id === here.dungeon.id) return down?.to ?? null;
    return up?.to ?? zone.exits[0]?.to ?? null;
  }
  // Un piso de mazmorra se alcanza llegando a su primer piso (su id es el de la mazmorra).
  const goalNode = target ? target.dungeon.id : goal;
  const start = zone.exits.map((e) => e.to);
  const seen = new Set<string>([zone.id]);
  const queue: Array<{ id: string; first: string }> = [];
  for (const s of start) {
    if (s === goalNode) return s;
    if (!seen.has(s)) {
      seen.add(s);
      queue.push({ id: s, first: s });
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur.id)) {
      if (n === goalNode) return cur.first;
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push({ id: n, first: cur.first });
    }
  }
  return null;
}

/**
 * Ruta más corta (nombres de zona) desde la zona actual hasta la de destino,
 * para decirle al jugador «Aldea de Brumaroja → Bosque Sombrío». Devuelve null si
 * no hay ruta o si estás dentro de una mazmorra (ahí se guía con la brújula).
 */
export function routeNames(fromZoneId: string, goalZoneId: string): string[] | null {
  if (parseDungeonZone(fromZoneId)) return null;
  const target = parseDungeonZone(goalZoneId);
  const goal = target ? target.dungeon.id : goalZoneId;
  if (fromZoneId === goal) return [];
  const prev = new Map<string, string>();
  const queue = [fromZoneId];
  const seen = new Set<string>([fromZoneId]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      if (n === goal) {
        const path: string[] = [];
        for (let z: string | undefined = n; z !== undefined; z = prev.get(z)) path.unshift(z);
        return path.slice(1).map(zoneName);
      }
      queue.push(n);
    }
  }
  return null;
}

/** Nombre legible de una zona (para "Objetivo: … · en X"). */
export function zoneName(id: string): string {
  const d = parseDungeonZone(id);
  if (d) return d.floor === 'jefe' ? `${d.dungeon.name} (guarida del jefe)` : d.dungeon.name;
  return ZONES.get(id)?.name ?? genZoneDef(id)?.name ?? plannedName(activeSeed(), id) ?? id;
}
