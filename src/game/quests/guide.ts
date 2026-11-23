/**
 * GUÍA HACIA EL OBJETIVO
 * Calcula a qué zona hay que ir para la misión seguida y qué salida de la zona
 * actual lleva hacia allí (búsqueda en anchura sobre el grafo de salidas).
 * La flecha dorada de esa salida se dibuja destacada.
 */
import { DUNGEONS, ENEMIES, LOOT_TABLES, NPCS, ORES, ZONES } from '@/data/registry';
import type { QuestDef, QuestObjective } from '@/data/schema';
import { parseDungeonZone } from '../world/dungeons';
import type { Zone } from '../world/zone';
import { isReady, objectiveProgress, type QuestHolder } from './quests';

/** Tipo de paso de misión (decide el icono de la guía). */
export type GoalKind = 'hablar' | 'cazar' | 'recoger' | 'ir';

export const GOAL_ICON: Record<GoalKind, string> = { hablar: '💬', cazar: '⚔', recoger: '✋', ir: '📍' };

/** Siguiente paso concreto de una misión. */
export type QuestStep =
  | { kind: 'hablar'; npc: string }
  | { kind: 'cazar'; enemy?: string; family?: string }
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
  }
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
  switch (step.kind) {
    case 'ir':
      return step.zone;
    case 'hablar':
      return NPCS.get(step.npc)?.zone ?? null;
    case 'cazar': {
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
  const def = ZONES.get(zoneId);
  if (!def) return [];
  return Object.values(def.exits ?? {}).map((e) => e.to);
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

/** Nombre legible de una zona (para "Objetivo: … · en X"). */
export function zoneName(id: string): string {
  const d = parseDungeonZone(id);
  if (d) return d.floor === 'jefe' ? `${d.dungeon.name} (guarida del jefe)` : d.dungeon.name;
  return ZONES.get(id)?.name ?? id;
}
