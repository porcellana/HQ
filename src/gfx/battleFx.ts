/** Lógica pura (sin DOM) de los efectos de batalla: estilos, trayectorias, ambiente. */
import type { DamageType } from '@/data/schema';
import type { Biome } from '@/game/battle/biome';

export type AtkKind = 'slash' | 'thrust' | 'smash' | 'arrow' | 'orb' | 'claw';
export type Element = 'fuego' | 'frio' | 'rayo' | 'veneno' | 'sagrado' | 'necrotico' | 'arcano' | 'fisico';

/** Qué animación de ataque corresponde a un golpe. */
export function attackKind(style: 'melee' | 'ranged' | 'cast' | 'self', dmg?: DamageType): AtkKind {
  if (style === 'cast') return 'orb';
  if (style === 'ranged') return dmg && dmg !== 'perforante' && dmg !== 'cortante' && dmg !== 'contundente' ? 'orb' : 'arrow';
  if (dmg === 'perforante') return 'thrust';
  if (dmg === 'contundente') return 'smash';
  if (dmg === 'cortante' || !dmg) return 'slash';
  return 'claw';
}

export function elementOf(dmg?: DamageType | null): Element {
  switch (dmg) {
    case 'fuego': case 'frio': case 'rayo': case 'veneno': case 'sagrado': case 'necrotico': case 'arcano': return dmg;
    default: return 'fisico';
  }
}

export const ELEMENT_COLORS: Record<Element, [string, string]> = {
  fuego: ['#ffd060', '#ff5020'], frio: ['#e0f8ff', '#60b0ff'], rayo: ['#ffffff', '#f0e040'], veneno: ['#c8f060', '#58a028'],
  sagrado: ['#ffffff', '#ffe890'], necrotico: ['#d090ff', '#5a1a90'], arcano: ['#f0c8ff', '#a060ff'], fisico: ['#ffffff', '#d8d0bc'],
};

export type NumKind = 'dmg' | 'crit' | 'heal' | 'miss' | 'resist' | 'weak' | 'status' | 'ally';
export interface NumStyle { kind: NumKind; color: string; size: number; text: string; life: number; pop: number }

/** Estilo del número flotante de un golpe. */
export function damageStyle(amount: number, o: { crit?: boolean; tag?: string; toParty?: boolean }): NumStyle {
  if (o.crit) return { kind: 'crit', color: '#ffd860', size: 32, text: `${amount}!`, life: 1.25, pop: 1.8 };
  if (o.tag === 'resiste' || o.tag === 'mitad') return { kind: 'resist', color: '#a8b0c4', size: 19, text: `${amount}`, life: 0.95, pop: 1.1 };
  if (o.tag === 'vulnerable') return { kind: 'weak', color: '#ff9030', size: 28, text: `${amount}↑`, life: 1.1, pop: 1.5 };
  if (o.tag === 'estado') return { kind: 'status', color: '#c8a0ff', size: 20, text: `${amount}`, life: 0.95, pop: 1.1 };
  if (o.toParty) return { kind: 'ally', color: '#ff7a7a', size: 24, text: `${amount}`, life: 1.0, pop: 1.3 };
  return { kind: 'dmg', color: '#ffffff', size: 24, text: `${amount}`, life: 1.0, pop: 1.3 };
}
export const healStyle = (amount: number): NumStyle => ({ kind: 'heal', color: '#70f090', size: 25, text: `+${amount}`, life: 1.1, pop: 1.4 });
export const missStyle = (text: string): NumStyle => ({ kind: 'miss', color: '#b8b0a0', size: 17, text, life: 0.9, pop: 1.0 });

/** Segundos de «hit-stop» (congelado breve) según la contundencia del golpe. */
export function hitStop(o: { crit: boolean; killed: boolean; amount: number; maxHp: number }): number {
  if (o.amount <= 0) return 0;
  const frac = Math.min(1, o.amount / Math.max(1, o.maxHp));
  let s = 0.025 + frac * 0.05;
  if (o.crit) s += 0.06;
  if (o.killed) s += 0.04;
  return Math.min(0.14, s);
}

/** Posición en una trayectoria con arco (k de 0 a 1). */
export function arcPoint(k: number, x0: number, y0: number, x1: number, y1: number, height: number): { x: number; y: number } {
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * height };
}

/** Puntos de un tajo en arco: barrido de `sweep` rad desde `a0` con radio `r`. */
export function slashArc(cx: number, cy: number, r: number, a0: number, sweep: number, k: number, n = 10): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const end = Math.max(0.001, k);
  for (let i = 0; i <= n; i++) {
    const a = a0 + sweep * end * (i / n);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Rayo quebrado de (x0,y0) a (x1,y1); determinista con `seed`. */
export function lightningPath(x0: number, y0: number, x1: number, y1: number, seed: number, segs = 7, jitter = 8): Array<{ x: number; y: number }> {
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2;
  const pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < segs; i++) {
    const k = i / segs;
    pts.push({ x: x0 + (x1 - x0) * k + rnd() * jitter, y: y0 + (y1 - y0) * k + rnd() * jitter * 0.5 });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

export type AmbientKind = 'motes' | 'leaves' | 'embers' | 'dust' | 'snow' | 'spores' | 'fog' | 'bubbles';
export interface AmbientSpec { kind: AmbientKind; count: number; color: string; vx: number; vy: number; size: number; tint: string; fog: number }

/** Partículas ambientales, tinte de iluminación y niebla por bioma. */
export function ambientSpec(b: Biome): AmbientSpec {
  switch (b) {
    case 'bosque': return { kind: 'leaves', count: 14, color: 'rgba(170,220,110,0.8)', vx: 14, vy: 10, size: 3, tint: 'rgba(20,60,10,0.18)', fog: 0.05 };
    case 'montana': return { kind: 'snow', count: 22, color: 'rgba(255,255,255,0.85)', vx: -10, vy: 22, size: 2, tint: 'rgba(120,150,200,0.14)', fog: 0.1 };
    case 'cueva': return { kind: 'embers', count: 12, color: 'rgba(255,170,80,0.85)', vx: 3, vy: -9, size: 2, tint: 'rgba(40,10,0,0.28)', fog: 0.08 };
    case 'galerias': return { kind: 'spores', count: 12, color: 'rgba(200,255,150,0.7)', vx: 2, vy: -5, size: 2, tint: 'rgba(10,30,10,0.3)', fog: 0.1 };
    case 'cripta': return { kind: 'fog', count: 10, color: 'rgba(170,150,255,0.55)', vx: 8, vy: -3, size: 4, tint: 'rgba(30,0,60,0.3)', fog: 0.22 };
    case 'puerto': return { kind: 'bubbles', count: 10, color: 'rgba(255,255,255,0.7)', vx: 6, vy: -4, size: 2, tint: 'rgba(0,40,90,0.12)', fog: 0.08 };
    case 'interior': return { kind: 'dust', count: 14, color: 'rgba(255,230,170,0.6)', vx: 3, vy: 2, size: 2, tint: 'rgba(60,30,0,0.22)', fog: 0 };
    case 'aldea': return { kind: 'dust', count: 12, color: 'rgba(255,240,200,0.55)', vx: 8, vy: 1, size: 2, tint: 'rgba(80,50,10,0.1)', fog: 0 };
    default: return { kind: 'motes', count: 14, color: 'rgba(255,255,220,0.6)', vx: 10, vy: -2, size: 2, tint: 'rgba(255,200,120,0.06)', fog: 0.04 };
  }
}

/** Posición de una mota ambiental (envuelta en pantalla) para el instante `t`. */
export function ambientPos(i: number, t: number, w: number, h: number, s: AmbientSpec): { x: number; y: number; depth: number } {
  const depth = 0.5 + ((i * 7) % 5) / 5; // 0,5..1,3: parallax por profundidad
  const x = (((i * 97.3 + t * s.vx * depth + Math.sin(t * 0.8 + i) * 8) % w) + w) % w;
  const y = (((h * (0.1 + ((i * 53) % 80) / 100) + t * s.vy * depth + Math.sin(t * 1.3 + i * 2) * 5) % h) + h) % h;
  return { x, y, depth };
}

/** Barra de vida con «estela» de daño: la fantasma baja más lento que la real. */
export function ghostStep(real: number, ghost: number, dt: number): number {
  if (ghost <= real) return real;
  return Math.max(real, ghost - Math.max(0.6, (ghost - real) * 2.2) * dt * 8);
}

/** Color de la barra según la fracción de vida. */
export function hpColor(frac: number): string {
  return frac > 0.5 ? '#58d060' : frac > 0.25 ? '#e8c030' : '#e04040';
}
