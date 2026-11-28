/** Ficha informativa de un combatiente (nombre, nivel, PV, estados, debilidades): pura y testeable. */
import type { DamageType, StatusId } from '@/data/schema';
import type { Battle, Combatant } from './battle';

export const DAMAGE_LABEL: Record<DamageType, string> = {
  cortante: 'Cortante', perforante: 'Perforante', contundente: 'Contundente', fuego: 'Fuego', frio: 'Frío', rayo: 'Rayo',
  veneno: 'Veneno', sagrado: 'Sagrado', necrotico: 'Necrótico', arcano: 'Arcano',
};
export const FAMILY_LABEL: Record<string, string> = {
  goblinoide: 'Goblinoide', 'no-muerto': 'No-muerto', bestia: 'Bestia', 'araña': 'Araña', orco: 'Orco', humano: 'Humano',
};

export interface UnitInfo {
  name: string;
  /** «Nv 4 · No-muerto · Jefe» o el rol del aliado. */
  subtitle: string;
  hp: number;
  maxHp: number;
  ac: number;
  statuses: Array<{ id: StatusId; turns: number }>;
  weak: string[];
  resist: string[];
  immune: StatusId[];
  /** Notas extra: fases del jefe, ataques... */
  notes: string[];
}

export function unitInfo(b: Battle, c: Combatant): UnitInfo {
  const e = c.enemy;
  const sub: string[] = [];
  const notes: string[] = [];
  if (e) {
    sub.push(`Nv ${e.def.level}`, FAMILY_LABEL[e.def.family] ?? e.def.family);
    if (e.def.boss) sub.push('Jefe');
    if (e.def.boss && e.def.phases?.length) notes.push(`Fases: ${e.def.phases.length - e.phase > 0 ? `${e.def.phases.length - e.phase} por venir` : 'todas activas'}`);
    notes.push(`Ataque: ${e.def.attack.name} (${e.def.attack.dice})`);
  } else sub.push(c.kind === 'player' ? 'Tú' : c.kind === 'pet' ? 'Mascota' : c.kind === 'escort' ? 'Protegido' : 'Aliado');
  return {
    name: c.name,
    subtitle: sub.join(' · '),
    hp: b.hp(c),
    maxHp: b.maxHp(c),
    ac: b.ac(c),
    statuses: c.statuses.filter((s) => s.turns > 0).map((s) => ({ id: s.id, turns: s.turns })),
    weak: (e?.def.vulnerable ?? []).map((t) => DAMAGE_LABEL[t]),
    resist: (e?.def.resist ?? []).map((t) => DAMAGE_LABEL[t]),
    immune: e?.def.immune ?? [],
    notes,
  };
}
