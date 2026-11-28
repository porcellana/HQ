/** Talentos de Bárbaro: Berserker, Montañés y Rompehuesos (v0.10). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'barbaro', ...x });

export default [
  // --- Berserker
  t({ id: 'bar_sed_sangre', branch: 'Berserker', icon: '🩸', name: 'Sed de sangre', minLevel: 2,
    description: 'Con poca vida (≤40%) haces +4 de daño con el arma.',
    effects: [{ type: 'berserk', threshold: 40, damage: 4 }] }),
  t({ id: 'bar_furia_ardiente', branch: 'Berserker', icon: '🔥', name: 'Furia ardiente', minLevel: 3,
    description: 'La furia te da +2 de daño extra.',
    effects: [{ type: 'skillMod', skill: 'furia', extraDice: '1d4' }] }),
  t({ id: 'bar_trofeo', branch: 'Berserker', icon: '🦴', name: 'Trofeo de caza', minLevel: 4,
    description: 'Al matar recuperas 2 de furia.',
    effects: [{ type: 'onKill', restore: 2 }] }),
  // --- Montañés
  t({ id: 'bar_piel_roble', branch: 'Montañés', icon: '🌳', name: 'Piel de roble', minLevel: 2,
    description: '+2 a la CA.',
    effects: [{ type: 'stat', stat: 'ca', amount: 2 }] }),
  t({ id: 'bar_vigor', branch: 'Montañés', icon: '💪', name: 'Vigor de las cumbres', minLevel: 3,
    description: '+10 PV máximos.',
    effects: [{ type: 'stat', stat: 'pv', amount: 10 }] }),
  t({ id: 'bar_espinas', branch: 'Montañés', icon: '🌵', name: 'Piel de espinas', minLevel: 5,
    description: 'Quien te golpea cuerpo a cuerpo recibe 1d4 perforante.',
    effects: [{ type: 'thorns', dice: '1d4', damageType: 'perforante' }] }),
  // --- Rompehuesos
  t({ id: 'bar_golpe_brutal', branch: 'Rompehuesos', icon: '🔨', name: 'Golpe brutal', minLevel: 2,
    description: 'Tus críticos aturden 1 turno.',
    effects: [{ type: 'onCrit', status: { id: 'aturdido', turns: 1 } }] }),
  t({ id: 'bar_torbellino_mejora', branch: 'Rompehuesos', icon: '🌀', name: 'Torbellino mejorado', minLevel: 4,
    description: 'El torbellino cuesta 1 menos.',
    effects: [{ type: 'skillMod', skill: 'torbellino', costDelta: -1 }] }),
  t({ id: 'bar_sanguinario', branch: 'Rompehuesos', icon: '🩹', name: 'Sanguinario', minLevel: 6,
    description: 'Recuperas vida al dañar (10%).',
    effects: [{ type: 'lifesteal', pct: 10 }] }),
] satisfies TalentDef[];
