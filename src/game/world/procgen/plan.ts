/**
 * PLAN DEL MUNDO PROCEDURAL (puro y determinista)
 * ------------------------------------------------
 * El mundo es una rejilla infinita (acotada por WORLD_RADIUS) de "celdas"; cada
 * celda es una zona. El núcleo fijo (aldea, bosque, paso, puerto) ocupa celdas
 * conocidas y se enlaza con las generadas por salidas extra.
 * Todo lo de aquí es función pura de (semilla, celda): bioma, tipo de lugar,
 * nombre y enlaces. Sólo el NIVEL se fija al descubrir la zona (ver index.ts).
 */
import { BIOME_LIST, BIOMES } from '@/data/registry';
import type { BiomeDef, PlaceKind } from '@/data/schema';
import WG from '@/data/worldgen/nombres';
import { Rng, hashString } from '@/engine/rng';

export const WORLD_RADIUS = 8;
export type Dir = 'N' | 'S' | 'W' | 'E';
export const DIRS: readonly Dir[] = ['N', 'S', 'W', 'E'];
export const DELTA: Record<Dir, { dx: number; dy: number }> = { N: { dx: 0, dy: -1 }, S: { dx: 0, dy: 1 }, W: { dx: -1, dy: 0 }, E: { dx: 1, dy: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', W: 'E', E: 'W' };
/** Dígito de salida de una zona generada por dirección; '5' es la entrada a la cueva/mazmorra. */
export const DIR_DIGIT: Record<Dir, string> = { N: '1', S: '2', W: '3', E: '4' };
export const ENTRANCE_DIGIT = '5';

export interface CoreCell {
  zone: string;
  cx: number;
  cy: number;
  biome: string;
  /** Dígito de la salida de la zona fija hacia cada dirección (si existe). */
  links: Partial<Record<Dir, string>>;
}

/** Zonas fijas del juego dentro de la rejilla (el resto del mundo se genera). */
export const CORE_CELLS: readonly CoreCell[] = [
  { zone: 'bosque_sombrio', cx: 0, cy: -1, biome: 'bosque', links: { N: '5', W: '3', E: '4' } },
  { zone: 'aldea_brumaroja', cx: 0, cy: 0, biome: 'pradera', links: { W: '8', E: '9' } },
  { zone: 'paso_gris', cx: 0, cy: 1, biome: 'pradera', links: { W: '4', E: '5' } },
  { zone: 'puerto_ceniza', cx: 0, cy: 2, biome: 'costa', links: { W: '8' } },
];

export const coreAt = (cx: number, cy: number): CoreCell | undefined => CORE_CELLS.find((c) => c.cx === cx && c.cy === cy);
export const inWorld = (cx: number, cy: number): boolean => Math.abs(cx) <= WORLD_RADIUS && Math.abs(cy) <= WORLD_RADIUS;

// --------------------------------------------------------------------- ids
export const cellId = (cx: number, cy: number): string => `w_${cx}_${cy}`;
export const subId = (cx: number, cy: number): string => `${cellId(cx, cy)}.d`;

export interface ParsedZoneId {
  cx: number;
  cy: number;
  /** true = subterráneo (cueva o mazmorra) de la celda. */
  sub: boolean;
}
export function parseZoneId(id: string): ParsedZoneId | null {
  const m = /^w_(-?\d+)_(-?\d+)(\.d)?$/.exec(id);
  if (!m) return null;
  const cx = Number(m[1]);
  const cy = Number(m[2]);
  return inWorld(cx, cy) ? { cx, cy, sub: !!m[3] } : null;
}

// ------------------------------------------------------------------- ruido
function lattice(seed: number, salt: string, ix: number, iy: number): number {
  return hashString(`${seed}:${salt}:${ix},${iy}`) / 4294967296;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Ruido de valor suave en [0,1]. */
export function noise2(seed: number, salt: string, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = lattice(seed, salt, x0, y0);
  const b = lattice(seed, salt, x0 + 1, y0);
  const c = lattice(seed, salt, x0, y0 + 1);
  const d = lattice(seed, salt, x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ------------------------------------------------------------------ biomas
const BRIDGE = (): BiomeDef => BIOME_LIST.find((b) => b.bridge) ?? BIOME_LIST[BIOME_LIST.length - 1]!;

/** Bioma "en bruto" por clima (temperatura, humedad, relieve). Cerca del inicio el clima es templado. */
export function rawBiome(seed: number, cx: number, cy: number): string {
  const core = coreAt(cx, cy);
  if (core) return core.biome;
  const d = Math.max(Math.abs(cx), Math.abs(cy));
  const k = Math.min(1, d / 3);
  const mix = (n: number, mid: number) => mid + (n - mid) * k;
  const temp = mix(noise2(seed, 't', cx / 3.2, cy / 3.2), 0.5);
  const moist = mix(noise2(seed, 'm', cx / 3.2 + 40, cy / 3.2), 0.5);
  const elev = mix(noise2(seed, 'e', cx / 2.6 - 40, cy / 2.6 + 17), 0.45);
  for (const b of BIOME_LIST) {
    if (b.bridge) continue;
    const c = b.climate;
    if (temp < c.temp[0] || temp > c.temp[1] || moist < c.moist[0] || moist > c.moist[1]) continue;
    if (c.elev && (elev < c.elev[0] || elev > c.elev[1])) continue;
    return b.id;
  }
  return BRIDGE().id;
}

export function compatible(a: string, b: string): boolean {
  return a === b || (BIOMES.get(a)?.neighbors.includes(b) ?? false);
}

/**
 * Bioma final: si el bruto choca con algún vecino, se sustituye por el bioma
 * puente (compatible con todos). Así dos celdas contiguas siempre son compatibles.
 */
export function biomeAt(seed: number, cx: number, cy: number): string {
  const core = coreAt(cx, cy);
  if (core) return core.biome;
  const mine = rawBiome(seed, cx, cy);
  for (const dir of DIRS) {
    const { dx, dy } = DELTA[dir];
    if (!inWorld(cx + dx, cy + dy)) continue;
    if (!compatible(mine, rawBiome(seed, cx + dx, cy + dy))) return BRIDGE().id;
  }
  return mine;
}

// ------------------------------------------------------------ tipo de lugar
const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Tipo de lugar de una celda generada. Los asentamientos siguen una retícula (todo vecino de uno). */
export function placeAt(seed: number, cx: number, cy: number): PlaceKind {
  const rng = new Rng(hashString(`${seed}:plan:${cx},${cy}`));
  const phase = mod(seed, 5);
  if (mod(cx + 2 * cy + phase, 5) === 0) {
    const d = Math.max(Math.abs(cx), Math.abs(cy));
    const r = rng.next();
    if (d >= 2 && r < 0.28) return 'ciudad';
    return r < 0.62 ? 'pueblo' : 'aldea';
  }
  const r = rng.next();
  if (r < 0.1) return 'campamento';
  if (r < 0.22) return 'ruinas';
  if (r < 0.34) return 'cueva';
  if (r < 0.46) return 'mazmorra';
  return 'wild';
}

export const isSettlement = (p: PlaceKind): boolean => p === 'aldea' || p === 'pueblo' || p === 'ciudad';
export const hasUnderground = (p: PlaceKind): boolean => p === 'cueva' || p === 'mazmorra';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function cellName(seed: number, cx: number, cy: number): string {
  const place = placeAt(seed, cx, cy);
  const rng = new Rng(hashString(`${seed}:name:${cx},${cy}`));
  if (isSettlement(place)) {
    return `${WG.settlement[place as 'aldea'].noun} de ${cap(rng.pick(WG.settlementPrefix) + rng.pick(WG.settlementSuffix))}`;
  }
  if (place === 'wild') {
    const b = BIOMES.get(biomeAt(seed, cx, cy))!;
    return `${rng.pick(b.nouns)} ${rng.pick(b.epithets)}`;
  }
  const t = WG.place[place as 'ruinas'];
  return `${rng.pick(t.nouns)} ${rng.pick(t.epithets)}`;
}

// ------------------------------------------------------------------ enlaces
export interface CellLink {
  dir: Dir;
  /** Zona de destino (id de celda o zona fija). */
  to: string;
  /** Dígito de la salida del destino donde apareces. */
  arrive: string;
}

/** Enlaces de una celda generada hacia sus vecinas (también el núcleo fijo si tiene salida hacia ella). */
export function cellLinks(cx: number, cy: number): CellLink[] {
  const out: CellLink[] = [];
  for (const dir of DIRS) {
    const { dx, dy } = DELTA[dir];
    const nx = cx + dx;
    const ny = cy + dy;
    if (!inWorld(nx, ny)) continue;
    const core = coreAt(nx, ny);
    if (core) {
      const digit = core.links[OPPOSITE[dir]];
      if (digit) out.push({ dir, to: core.zone, arrive: digit });
    } else out.push({ dir, to: cellId(nx, ny), arrive: DIR_DIGIT[OPPOSITE[dir]] });
  }
  return out;
}

/** Vecinos (ids) de cualquier zona de la rejilla, sin generar nada: para la guía de misiones. */
export function plannedNeighbors(seed: number, zoneId: string): string[] {
  const core = CORE_CELLS.find((c) => c.zone === zoneId);
  if (core) {
    const out: string[] = [];
    for (const dir of Object.keys(core.links) as Dir[]) {
      const { dx, dy } = DELTA[dir];
      if (inWorld(core.cx + dx, core.cy + dy) && !coreAt(core.cx + dx, core.cy + dy)) out.push(cellId(core.cx + dx, core.cy + dy));
    }
    return out;
  }
  const p = parseZoneId(zoneId);
  if (!p) return [];
  if (p.sub) return [cellId(p.cx, p.cy)];
  const out = cellLinks(p.cx, p.cy).map((l) => l.to);
  if (hasUnderground(placeAt(seed, p.cx, p.cy))) out.push(subId(p.cx, p.cy));
  return out;
}

/** Nombre de una zona de la rejilla sin generarla (o undefined si no es de la rejilla). */
export function plannedName(seed: number, zoneId: string): string | undefined {
  const p = parseZoneId(zoneId);
  if (!p) return undefined;
  const n = cellName(seed, p.cx, p.cy);
  return p.sub ? `${n} (interior)` : n;
}
