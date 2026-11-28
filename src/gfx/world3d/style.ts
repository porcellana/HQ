/** Estilo visual de una zona (niebla, cielo, partículas) deducido de sus casillas. Puro. */
import type { Grid3D } from './terrain';
import { hexRgb, mix, type RGB } from './mesh';

export type ParticleKind = 'polen' | 'nieve' | 'polvo' | 'esporas' | 'brasas' | 'motas' | 'ninguna';

export interface ZoneStyle {
  fog: RGB;
  fogDensity: number;
  skyTop: RGB;
  skyHorizon: RGB;
  particles: ParticleKind;
  wind: number;
  snowy: boolean;
  /** Recinto cerrado (cueva, mazmorra, interior): sin cielo ni sol. */
  enclosed: boolean;
  sun: RGB;
}

export function zoneStyle(g: Grid3D): ZoneStyle {
  const count: Record<string, number> = {};
  const n = g.width * g.height;
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) count[g.sprite(x, y)] = (count[g.sprite(x, y)] ?? 0) + 1;
  const f = (...ids: string[]): number => ids.reduce((s, id) => s + (count[id] ?? 0), 0) / Math.max(1, n);
  const enclosed = g.kind === 'dungeon' || g.kind === 'interior' || f('caveFloor', 'cryptFloor', 'silkFloor', 'stoneFloor') > 0.25;
  const snowy = f('snow', 'ice', 'snowPine') > 0.12;
  const desert = f('sand', 'cactus', 'palm') > 0.22;
  const swamp = f('mud', 'swampWater', 'deadTree') > 0.12;
  const forest = f('tree', 'pine') > 0.2;
  let s: ZoneStyle = {
    fog: hexRgb('#b9cfd8'), fogDensity: 0.035, skyTop: hexRgb('#5d9ad6'), skyHorizon: hexRgb('#d3e4ea'),
    particles: forest ? 'motas' : 'polen', wind: 1, snowy, enclosed, sun: hexRgb('#fff0cf'),
  };
  if (snowy) s = { ...s, fog: hexRgb('#d6e4f2'), skyTop: hexRgb('#7fa7d4'), skyHorizon: hexRgb('#e6eef8'), particles: 'nieve', fogDensity: 0.04 };
  else if (desert) s = { ...s, fog: hexRgb('#e6d3a8'), skyTop: hexRgb('#6fa4d8'), skyHorizon: hexRgb('#f0dcae'), particles: 'polvo', wind: 1.4, fogDensity: 0.03 };
  else if (swamp) s = { ...s, fog: hexRgb('#7f9a78'), skyTop: hexRgb('#6f8f86'), skyHorizon: hexRgb('#a8bc9c'), particles: 'esporas', fogDensity: 0.06, wind: 0.5 };
  else if (forest) s = { ...s, fog: hexRgb('#a7c0b0'), skyTop: hexRgb('#5a8cc0'), skyHorizon: hexRgb('#c6dccf'), fogDensity: 0.045 };
  if (g.kind === 'town') s = { ...s, particles: 'polen' };
  if (enclosed) s = { ...s, fog: hexRgb('#0d0b12'), skyTop: hexRgb('#0d0b12'), skyHorizon: hexRgb('#0d0b12'), fogDensity: 0.085, particles: 'polvo', wind: 0 , sun: hexRgb('#8f8aa8')};
  if (g.tint) {
    const t = hexRgb(g.tint.color);
    const a = Math.min(0.6, g.tint.alpha * 1.3);
    s = { ...s, fog: mix(s.fog, t, a), skyHorizon: mix(s.skyHorizon, t, a * 0.7), skyTop: mix(s.skyTop, t, a * 0.5) };
  }
  return s;
}

export interface Env {
  sunDir: [number, number, number];
  sunCol: RGB;
  ambTop: RGB;
  ambBottom: RGB;
  fog: RGB;
  fogDensity: number;
  skyTop: RGB;
  skyHorizon: RGB;
  night: number;
  stars: number;
}

/** Entorno de luz según el estilo, la noche (0..1) y la oscuridad de la zona (0..1). */
export function envFor(st: ZoneStyle, night: number, darkness: number, timeFrac: number): Env {
  const dark = st.enclosed ? 1 : Math.max(darkness, 0);
  const nightCol = hexRgb('#0f1838');
  const dayAmbT = hexRgb('#cfe0f0'), dayAmbB = hexRgb('#7d6a58');
  const nightAmbT = hexRgb('#3a4a82'), nightAmbB = hexRgb('#1a1830');
  const ambTop = mix(dayAmbT, nightAmbT, night), ambBottom = mix(dayAmbB, nightAmbB, night);
  // El sol da la vuelta: amanecer al este (-x), mediodía alto, atardecer al oeste.
  const ang = Math.PI * (0.18 + 0.64 * Math.min(1, Math.max(0, timeFrac)));
  const sunDir: [number, number, number] = [-Math.cos(ang) * 0.8, Math.sin(ang) * 0.9 + 0.25, -0.45];
  const sunCol = mix(mix(st.sun, hexRgb('#ffb070'), Math.max(0, 1 - Math.sin(ang) * 1.6) * 0.8), hexRgb('#6f86d8'), night);
  const k = night * 0.85;
  return {
    sunDir,
    sunCol: [sunCol[0] * (1 - k * 0.8), sunCol[1] * (1 - k * 0.8), sunCol[2] * (1 - k * 0.5)],
    ambTop: mix(ambTop, hexRgb('#2a2638'), dark * 0.75),
    ambBottom: mix(ambBottom, hexRgb('#14111a'), dark * 0.75),
    fog: mix(mix(st.fog, nightCol, night * 0.88), hexRgb('#07060a'), dark * 0.9),
    fogDensity: st.fogDensity * (1 + dark * 0.9 + night * 0.25),
    skyTop: mix(st.skyTop, hexRgb('#070a1e'), night * 0.93),
    skyHorizon: mix(st.skyHorizon, hexRgb('#1c2750'), night * 0.9),
    night,
    stars: Math.max(0, night - 0.35) * 1.5,
  };
}
