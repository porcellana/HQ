/**
 * REGLAS DE PERSONAJE (estilo D&D 5e simplificado)
 * - Modificador = (característica - 10) / 2 hacia abajo.
 * - Bonificador de competencia = 2 + (nivel - 1) / 4.
 * - PV: dado de golpe + CON al nivel 1; luego (dado/2 + 1) + CON por nivel.
 * - CA sin equipo: 10 + DES + bonificador de armadura de la clase.
 */
import { ABILITY_KEYS, type AbilityKey, type ClassDef, type SkillDef, type StatBlock } from '@/data/schema';
import { abilityModifier } from './dice';

export const STAT_NAMES: Record<AbilityKey, string> = {
  FUE: 'Fuerza',
  DES: 'Destreza',
  CON: 'Constitución',
  INT: 'Inteligencia',
  SAB: 'Sabiduría',
  CAR: 'Carisma',
};

export const STAT_HINTS: Record<AbilityKey, string> = {
  FUE: 'Ataque y daño cuerpo a cuerpo',
  DES: 'Armadura, armas ligeras, iniciativa',
  CON: 'Vida y aguante',
  INT: 'Hechizos de mago',
  SAB: 'Milagros de clérigo y percepción',
  CAR: 'Mejores precios y diálogos',
};

/** Puntos libres al crear el personaje. */
export const CREATION_POINTS = 3;
/** Ninguna característica puede superar esto. */
export const STAT_MAX = 20;
/** Máximo al crear el personaje. */
export const CREATION_STAT_MAX = 17;

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export function maxHpFor(cls: ClassDef, level: number, con: number): number {
  const conMod = abilityModifier(con);
  const first = cls.hitDie + conMod;
  const perLevel = Math.max(1, Math.floor(cls.hitDie / 2) + 1 + conMod);
  return Math.max(1, first + (level - 1) * perLevel);
}

export function maxResourceFor(cls: ClassDef, level: number, stats: StatBlock): number {
  const r = cls.resource;
  const statMod = r.stat ? abilityModifier(stats[r.stat]) : 0;
  return Math.max(1, r.base + (level - 1) * r.perLevel + Math.max(0, statMod) * 2);
}

/** Habilidades desbloqueadas a cierto nivel. */
export function unlockedSkills(cls: ClassDef, level: number): SkillDef[] {
  return cls.skills.filter((s) => s.unlockLevel <= level);
}

/** Puntos de característica que da subir AL nivel `level` (1 normal, 2 en niveles de mejora 5e). */
export function attributePointsAtLevel(level: number): number {
  return [4, 8, 12, 16, 19].includes(level) ? 2 : 1;
}

export function emptyStats(): StatBlock {
  return { FUE: 0, DES: 0, CON: 0, INT: 0, SAB: 0, CAR: 0 };
}

/** Suma de dos bloques de características. */
export function addStats(a: StatBlock, b: Partial<StatBlock>): StatBlock {
  const out = { ...a };
  for (const k of ABILITY_KEYS) out[k] += b[k] ?? 0;
  return out;
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
