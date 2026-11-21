/**
 * TALENTOS: consulta de efectos activos y elección al subir de nivel.
 * Los talentos se definen en src/data/talents; el motor sólo pregunta
 * "¿qué efectos de tipo X tengo?" en sus ganchos.
 */
import { TALENTS } from '@/data/registry';
import type { TalentDef, TalentEffect } from '@/data/schema';
import { Rng, hashString } from '@/engine/rng';

export interface TalentOwner {
  classId: string;
  level: number;
  talents?: string[];
  talentChoices?: number;
}

/** Talentos elegidos (definiciones). */
export function ownedTalents(p: TalentOwner): TalentDef[] {
  return (p.talents ?? []).map((id) => TALENTS.get(id)).filter((t): t is TalentDef => !!t);
}

/** Efectos de un tipo concreto de todos tus talentos. */
export function talentEffects<T extends TalentEffect['type']>(p: TalentOwner, type: T): Array<Extract<TalentEffect, { type: T }>> {
  const out: Array<Extract<TalentEffect, { type: T }>> = [];
  for (const t of ownedTalents(p)) for (const e of t.effects) if (e.type === type) out.push(e as Extract<TalentEffect, { type: T }>);
  return out;
}

/** Modificadores de talentos para una habilidad de clase. */
export function skillMods(p: TalentOwner, skillId: string): Array<Extract<TalentEffect, { type: 'skillMod' }>> {
  return talentEffects(p, 'skillMod').filter((m) => m.skill === skillId);
}

/** Talentos que se pueden elegir ahora. */
export function eligibleTalents(p: TalentOwner): TalentDef[] {
  const owned = new Set(p.talents ?? []);
  return [...TALENTS.values()].filter(
    (t) =>
      (t.classId === p.classId || t.classId === 'todas') &&
      t.minLevel <= p.level &&
      (t.repeatable || !owned.has(t.id)) &&
      (!t.requires || owned.has(t.requires)),
  );
}

/**
 * Las 3 opciones que se ofrecen (deterministas: si cierras y vuelves, son las
 * mismas). Prioriza talentos de clase de ramas distintas; los genéricos sólo
 * rellenan.
 */
export function talentOffer(p: TalentOwner, seed: number): TalentDef[] {
  const pool = eligibleTalents(p);
  const rng = new Rng(hashString(`${seed}:${p.level}:${(p.talents ?? []).length}`));
  const own = pool.filter((t) => t.classId !== 'todas');
  const generic = pool.filter((t) => t.classId === 'todas');
  const shuffled = [...own].sort(() => rng.next() - 0.5);
  const picked: TalentDef[] = [];
  const branches = new Set<string>();
  for (const t of shuffled) if (picked.length < 3 && !branches.has(t.branch)) (picked.push(t), branches.add(t.branch));
  for (const t of shuffled) if (picked.length < 3 && !picked.includes(t)) picked.push(t);
  for (const t of generic) if (picked.length < 3) picked.push(t);
  return picked;
}

/** Elige un talento (gasta una elección pendiente). Devuelve un error o null. */
export function chooseTalent(p: TalentOwner, id: string): string | null {
  if ((p.talentChoices ?? 0) <= 0) return 'No tienes talentos por elegir.';
  const t = TALENTS.get(id);
  if (!t || !eligibleTalents(p).includes(t)) return 'Ese talento no está disponible.';
  (p.talents ??= []).push(id);
  p.talentChoices = (p.talentChoices ?? 0) - 1;
  return null;
}
