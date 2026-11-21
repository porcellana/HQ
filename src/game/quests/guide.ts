/**
 * GUÍA HACIA EL OBJETIVO
 * Calcula a qué zona hay que ir para la misión seguida y qué salida de la zona
 * actual lleva hacia allí (búsqueda en anchura sobre el grafo de salidas).
 * La flecha dorada de esa salida se dibuja destacada.
 */
import { DUNGEONS, ENEMIES, NPCS, ZONES } from '@/data/registry';
import type { QuestDef } from '@/data/schema';
import { parseDungeonZone } from '../world/dungeons';
import type { Zone } from '../world/zone';
import { isReady, objectiveProgress, type QuestHolder } from './quests';

/** Zona donde se cumple el siguiente paso de la misión (o null si no se sabe). */
export function questGoalZone(h: QuestHolder, q: QuestDef): string | null {
  if (isReady(h, q)) return NPCS.get(q.turnIn ?? q.giver)?.zone ?? null;
  const i = q.objectives.findIndex((_, k) => {
    const p = objectiveProgress(h, q, k);
    return p.have < p.need;
  });
  const o = q.objectives[i];
  if (!o) return null;
  switch (o.type) {
    case 'visit':
      return o.zone;
    case 'talk':
      return NPCS.get(o.npc)?.zone ?? null;
    case 'kill': {
      if (o.enemy) {
        const d = [...DUNGEONS.values()].find((x) => x.boss.enemy === o.enemy);
        if (d) return `${d.id}__jefe`;
      }
      // Primera zona salvaje cuyos encuentros incluyan ese enemigo o familia.
      for (const z of ZONES.values()) {
        const hit = z.encounters?.groups.some((g) => {
          const e = ENEMIES.get(g.enemy);
          return !!e && (o.enemy ? e.id === o.enemy : e.family === o.family);
        });
        if (hit) return z.id;
      }
      return null;
    }
    default:
      return null;
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
