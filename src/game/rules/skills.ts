/**
 * HABILIDADES (pruebas en diálogos, estilo D&D 5e)
 * Bonificador = modificador de la característica + competencia si tu clase o
 * tu trasfondo te hacen competente.
 */
import { getBackground, getClass } from '@/data/registry';
import type { AbilityKey, SkillKey } from '@/data/schema';
import { abilityModifier } from './dice';
import { proficiencyBonus } from './character';
import { derive, type DerivableCharacter } from './derived';

export const SKILLS: Record<SkillKey, { name: string; stat: AbilityKey }> = {
  persuasion: { name: 'Persuasión', stat: 'CAR' },
  intimidacion: { name: 'Intimidación', stat: 'FUE' },
  engano: { name: 'Engaño', stat: 'CAR' },
  perspicacia: { name: 'Perspicacia', stat: 'SAB' },
  arcanos: { name: 'Arcanos', stat: 'INT' },
  atletismo: { name: 'Atletismo', stat: 'FUE' },
  sigilo: { name: 'Sigilo', stat: 'DES' },
  juego_manos: { name: 'Juego de manos', stat: 'DES' },
};

export interface SkillOwner extends DerivableCharacter {
  background?: string;
}

/** ¿Es competente en la habilidad? */
export function isProficient(p: SkillOwner, skill: SkillKey): boolean {
  const cls = getClass(p.classId);
  return !!cls.skillProficiencies?.includes(skill) || !!getBackground(p.background)?.proficiencies.includes(skill);
}

/** Bonificador total a una prueba de habilidad. */
export function skillBonus(p: SkillOwner, skill: SkillKey): number {
  const stat = SKILLS[skill].stat;
  return abilityModifier(derive(p).stats[stat]) + (isProficient(p, skill) ? proficiencyBonus(p.level) : 0);
}

/** Probabilidad (0..1) de superar una CD con un bonificador (20 siempre éxito, 1 siempre fallo). */
export function successChance(bonus: number, dc: number): number {
  let ok = 0;
  for (let n = 1; n <= 20; n++) if (n === 20 || (n !== 1 && n + bonus >= dc)) ok++;
  return ok / 20;
}
