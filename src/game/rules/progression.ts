/**
 * Curva de experiencia y niveles. Los parámetros viven en
 * src/data/config/progression.json para poder ajustarlos sin tocar código.
 */
import progression from '@/data/config/progression.json';

export interface ProgressionConfig {
  maxLevel: number;
  xpBase: number;
  xpExponent: number;
}

export const PROGRESSION: ProgressionConfig = {
  maxLevel: progression.maxLevel,
  xpBase: progression.xpBase,
  xpExponent: progression.xpExponent,
};

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number, cfg: ProgressionConfig = PROGRESSION): number {
  if (level >= cfg.maxLevel) return Infinity;
  return Math.round(cfg.xpBase * Math.pow(level, cfg.xpExponent));
}

/** XP acumulada total necesaria para *alcanzar* `level` (nivel 1 = 0). */
export function totalXpForLevel(level: number, cfg: ProgressionConfig = PROGRESSION): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, cfg.maxLevel); l++) total += xpToNext(l, cfg);
  return total;
}

/** Nivel correspondiente a una XP acumulada. */
export function levelForXp(xp: number, cfg: ProgressionConfig = PROGRESSION): number {
  let level = 1;
  while (level < cfg.maxLevel && xp >= totalXpForLevel(level + 1, cfg)) level++;
  return level;
}

/** Progreso dentro del nivel actual, para la barra de XP del HUD. */
export function levelProgress(xp: number, cfg: ProgressionConfig = PROGRESSION): { level: number; current: number; needed: number; ratio: number } {
  const level = levelForXp(xp, cfg);
  if (level >= cfg.maxLevel) return { level, current: 0, needed: 0, ratio: 1 };
  const base = totalXpForLevel(level, cfg);
  const needed = xpToNext(level, cfg);
  const current = xp - base;
  return { level, current, needed, ratio: Math.max(0, Math.min(1, current / needed)) };
}
