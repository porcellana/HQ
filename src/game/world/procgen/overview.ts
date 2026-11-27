/** Resumen del mundo descubierto para el mapa del mundo (puro, sin generar nada). */
import { BIOMES, TILES } from '@/data/registry';
import type { PlaceKind } from '@/data/schema';
import { CORE_CELLS, biomeAt, cellName, inWorld, parseZoneId, placeAt, plannedNeighbors } from './plan';

export interface OverviewCell {
  cx: number;
  cy: number;
  /** Id de la zona (fija o celda generada). */
  id: string;
  name: string;
  /** Color (minimapa del suelo del bioma). */
  color: string;
  icon: string;
  discovered: boolean;
}

const PLACE_ICON: Record<PlaceKind, string> = { wild: '', aldea: '🏘', pueblo: '🏘', ciudad: '🏰', campamento: '⛺', ruinas: '🏛', cueva: '🕳', mazmorra: '💀' };
const CORE_ICON: Record<string, string> = { aldea_brumaroja: '🏘', puerto_ceniza: '🏰', bosque_sombrio: '', paso_gris: '' };

/** Celdas descubiertas y las vecinas aún sin descubrir (para ver hacia dónde hay salidas). */
export function worldOverview(seed: number, visited: readonly string[], coreName: (id: string) => string): OverviewCell[] {
  const out = new Map<string, OverviewCell>();
  const cellOf = (id: string): { cx: number; cy: number } | null => {
    const core = CORE_CELLS.find((c) => c.zone === id);
    if (core) return core;
    return parseZoneId(id);
  };
  const add = (id: string, discovered: boolean) => {
    const c = cellOf(id);
    if (!c) return;
    const key = `${c.cx},${c.cy}`;
    if (out.has(key) && (out.get(key)!.discovered || !discovered)) return;
    const core = CORE_CELLS.find((k) => k.zone === id);
    const biome = BIOMES.get(core ? core.biome : biomeAt(seed, c.cx, c.cy));
    const place = core ? undefined : placeAt(seed, c.cx, c.cy);
    out.set(key, {
      cx: c.cx, cy: c.cy, id: core ? core.zone : `w_${c.cx}_${c.cy}`,
      name: core ? coreName(core.zone) : cellName(seed, c.cx, c.cy),
      color: TILES.get(biome?.ground ?? 'hierba')?.minimap ?? '#2f4a2a',
      icon: core ? (CORE_ICON[core.zone] ?? '') : place ? PLACE_ICON[place] : '',
      discovered,
    });
  };
  for (const id of visited) add(id.replace(/\.d$/, ''), true);
  for (const id of visited) {
    for (const n of plannedNeighbors(seed, id.replace(/\.d$/, ''))) {
      const c = cellOf(n);
      if (c && inWorld(c.cx, c.cy) && !n.endsWith('.d')) add(n, false);
    }
  }
  return [...out.values()];
}
