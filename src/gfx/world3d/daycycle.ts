/**
 * Ciclo de día y noche (puro, testeable): posición del sol y la luna, tonos de amanecer y atardecer,
 * ventanas encendidas y luciérnagas. Se calcula a partir del turno del juego (600 turnos = un día).
 */
import { nightAmount, DAY_LENGTH_TURNS } from '../viewconst';

export type V3 = [number, number, number];

export interface DayClock {
  /** Fracción del día 0..1 (0 = amanecer, 0,3 = mediodía, 0,6 = ocaso, 0,8 = medianoche). */
  t: number;
  /** Altura del sol: 1 = cénit, 0 = horizonte, negativo = bajo el horizonte. */
  elev: number;
  /** 0..1: lo cerca que está el sol del horizonte (tonos cálidos de amanecer/atardecer). */
  warm: number;
  /** Oscuridad nocturna 0..1. */
  night: number;
  sunDir: V3;
  moonDir: V3;
  /** Visibilidad de la luna 0..1. */
  moonAmt: number;
  /** 0..1: ventanas de las casas encendidas. */
  windows: number;
  /** 0..1: luciérnagas en bosques y pantanos. */
  fireflies: number;
  /** true si es la mañana (el sol sube), false si es la tarde/noche. */
  morning: boolean;
}

/** Duración del día visible (fracción del ciclo con el sol sobre el horizonte). */
export const DAY_FRAC = 0.6;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const norm3 = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Reloj del día para un turno de juego. */
export function dayClock(turn: number): DayClock {
  const t = (((turn % DAY_LENGTH_TURNS) + DAY_LENGTH_TURNS) % DAY_LENGTH_TURNS) / DAY_LENGTH_TURNS;
  return clockAt(t, nightAmount(turn));
}

/** Reloj a partir de la fracción del día y la oscuridad ya calculada. */
export function clockAt(t: number, night: number): DayClock {
  const day = t < DAY_FRAC;
  const a = day ? (Math.PI * t) / DAY_FRAC : 0;
  const elev = day ? Math.sin(a) : -Math.sin((Math.PI * (t - DAY_FRAC)) / (1 - DAY_FRAC)) * 0.9;
  const sunDir = norm3(day ? [-Math.cos(a), Math.max(0.02, Math.sin(a)), -0.45] : [Math.cos((Math.PI * (t - DAY_FRAC)) / (1 - DAY_FRAC)), elev, -0.45]);
  const b = Math.PI * Math.min(1, Math.max(0, (t - DAY_FRAC) / (1 - DAY_FRAC)));
  const moonDir = norm3([-Math.cos(b) * 0.85, 0.28 + Math.sin(b) * 0.85, 0.4]);
  const warm = Math.exp(-((elev / 0.24) ** 2));
  return {
    t,
    elev,
    warm,
    night,
    sunDir,
    moonDir,
    moonAmt: smooth(0.12, 0.6, night),
    windows: smooth(0.1, 0.5, night),
    fireflies: smooth(0.3, 0.7, night),
    morning: day || t > 0.9,
  };
}

/** Reloj equivalente para llamadas antiguas (sólo noche y fracción de recorrido del sol). */
export function legacyClock(night: number, dayFrac: number): DayClock {
  return clockAt(Math.min(1, Math.max(0, dayFrac)) * DAY_FRAC, night);
}

/** Dirección de la luz principal (sol de día, luna de noche) con transición suave y altura mínima. */
export function lightDirection(c: DayClock): { dir: V3; moon: number } {
  const w = smooth(0.3, 0.7, c.night);
  const s: V3 = [c.sunDir[0], Math.max(0.2, c.sunDir[1]), c.sunDir[2]];
  const d = norm3([s[0] + (c.moonDir[0] - s[0]) * w, s[1] + (c.moonDir[1] - s[1]) * w, s[2] + (c.moonDir[2] - s[2]) * w]);
  return { dir: d, moon: w };
}

/** Parpadeo de una llama (puro): 0,75..1,25 con ruido determinista por semilla y tiempo. */
export function flicker(t: number, seed: number): number {
  const s = seed * 12.9898;
  return 1 + Math.sin(t * 11 + s) * 0.07 + Math.sin(t * 23.7 + s * 1.7) * 0.05 + Math.sin(t * 5.3 + s * 0.6) * 0.1;
}
