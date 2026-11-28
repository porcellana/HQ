/**
 * EVENTOS AL VIAJAR (v0.14, puro y testeable)
 * Elige un suceso de data/events según el bioma, el nivel y una tirada determinista, y lo convierte
 * en un PNJ temporal cuyo diálogo ya viene escalado al nivel de la zona (CD y cantidades).
 */
import { TRAVEL_EVENTS } from '@/data/registry';
import type { DialogEffect, DialogNode, DialogOption, NpcDef, TravelEventDef } from '@/data/schema';
import type { Rng } from '@/engine/rng';

/** Probabilidad de que ocurra un evento interactivo al llegar a una zona salvaje. */
export const TRAVEL_EVENT_CHANCE = 0.17;

/** Eventos que pueden ocurrir en este bioma y nivel. */
export function eligibleEvents(biome: string | undefined, level: number): TravelEventDef[] {
  return [...TRAVEL_EVENTS.values()].filter((e) => (!e.biomes || (!!biome && e.biomes.includes(biome))) && level >= (e.minLevel ?? 1));
}

/** Elige un evento ponderado (o null si no hay candidatos). */
export function pickEvent(rng: Rng, biome: string | undefined, level: number): TravelEventDef | null {
  const list = eligibleEvents(biome, level);
  return list.length ? rng.weighted(list, (e) => e.weight) : null;
}

/** Aumento de CD con el nivel de la zona: +1 cada dos niveles. */
export const dcBonus = (level: number): number => Math.floor(Math.max(1, level) / 2);

/** Escala una cantidad `perLevel` al nivel del evento. */
export const scaled = (amount: number, level: number, perLevel?: boolean): number => (perLevel ? amount * Math.max(1, level) : amount);

function scaleOption(o: DialogOption, level: number): DialogOption {
  return o.check ? { ...o, check: { ...o.check, dc: o.check.dc + dcBonus(level) } } : { ...o };
}

function scaleEffect(e: DialogEffect, level: number): DialogEffect {
  if ((e.type === 'gold' || e.type === 'xp') && e.perLevel) return { type: e.type, amount: scaled(e.amount, level, true) };
  return e;
}

/** PNJ temporal del evento: diálogo con CD y recompensas ya escaladas al nivel. */
export function instantiateEvent(def: TravelEventDef, level: number): NpcDef {
  const dialog: Record<string, DialogNode> = {};
  for (const [id, node] of Object.entries(def.dialog)) {
    dialog[id] = {
      ...node,
      options: node.options.map((o) => scaleOption(o, level)),
      ...(node.effects ? { effects: node.effects.map((e) => scaleEffect(e, level)) } : {}),
    };
  }
  return { id: `evt:${def.id}`, name: def.npc.name, ...(def.npc.title ? { title: def.npc.title } : {}), zone: '', x: 0, y: 0, look: def.npc.look, dialog };
}

/** Comprueba la coherencia de un evento (para tests): nodos alcanzables y existentes, y salida posible. */
export function validateEvent(def: TravelEventDef, itemExists: (id: string) => boolean): string[] {
  const errs: string[] = [];
  if (!def.dialog['inicio']) errs.push('sin nodo inicio');
  for (const [id, n] of Object.entries(def.dialog)) {
    if (!n.options.length) errs.push(`${id}: sin opciones`);
    for (const o of n.options) {
      for (const t of [o.goto, o.check?.success, o.check?.failure, o.check?.crit, o.check?.fumble]) if (t && !def.dialog[t]) errs.push(`${id}: nodo inexistente ${t}`);
      if (!o.goto && !o.action && !o.check) errs.push(`${id}: opción "${o.label}" sin destino`);
    }
    for (const e of n.effects ?? []) if (e.type === 'item' && !itemExists(e.item)) errs.push(`${id}: objeto desconocido ${e.item}`);
  }
  return errs;
}
