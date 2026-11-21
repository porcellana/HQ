/** Talentos del Guerrero: Berserker (furia), Guardián (aguante) y Maestro de armas (técnica). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'guerrero', ...x });

export default [
  // --- Berserker
  t({ id: 'gue_furia', branch: 'Berserker', icon: '😡', name: 'Furia', minLevel: 2,
    description: 'Con la mitad de vida o menos, haces +3 de daño con el arma.',
    effects: [{ type: 'berserk', threshold: 50, damage: 3 }] }),
  t({ id: 'gue_sed_sangre', branch: 'Berserker', icon: '🩸', name: 'Sed de sangre', minLevel: 2,
    description: 'Al matar a un enemigo recuperas 3 PV y 1 de vigor.',
    effects: [{ type: 'onKill', heal: 3, restore: 1 }] }),
  t({ id: 'gue_carniceria', branch: 'Berserker', icon: '🪓', name: 'Carnicería', minLevel: 4,
    description: 'Al matar cuerpo a cuerpo, golpeas gratis a otro enemigo pegado a ti.',
    effects: [{ type: 'onKill', cleave: true }] }),
  t({ id: 'gue_vampirismo', branch: 'Berserker', icon: '🧛', name: 'Golpes voraces', minLevel: 6, requires: 'gue_sed_sangre',
    description: 'Recuperas el 25 % del daño que haces con el arma.',
    effects: [{ type: 'lifesteal', pct: 25 }] }),
  // --- Guardián
  t({ id: 'gue_contraataque', branch: 'Guardián', icon: '↩️', name: 'Contraataque', minLevel: 2,
    description: 'Cuando un enemigo te falla cuerpo a cuerpo, 50 % de devolverle el golpe al momento.',
    effects: [{ type: 'counter', chance: 0.5 }] }),
  t({ id: 'gue_piel_hierro', branch: 'Guardián', icon: '🛡️', name: 'Piel de hierro', minLevel: 2,
    description: '+1 a la CA y +6 PV máximos.',
    effects: [{ type: 'stat', stat: 'ca', amount: 1 }, { type: 'stat', stat: 'pv', amount: 6 }] }),
  t({ id: 'gue_espinas', branch: 'Guardián', icon: '🌵', name: 'Armadura de pinchos', minLevel: 4,
    description: 'Quien te golpea cuerpo a cuerpo recibe 1d6 de daño perforante.',
    effects: [{ type: 'thorns', dice: '1d6', damageType: 'perforante' }] }),
  t({ id: 'gue_inquebrantable', branch: 'Guardián', icon: '🏰', name: 'Inquebrantable', minLevel: 6,
    description: 'En combate recuperas 1 PV cada 2 turnos. No te aturden.',
    effects: [{ type: 'regen', every: 2, amount: 1 }, { type: 'immune', status: 'aturdido' }] }),
  // --- Maestro de armas
  t({ id: 'gue_golpe_certero', branch: 'Maestro de armas', icon: '🎯', name: 'Golpe certero', minLevel: 2,
    description: '+1 al ataque y +1 al daño con cualquier arma.',
    effects: [{ type: 'stat', stat: 'ataque', amount: 1 }, { type: 'stat', stat: 'daño', amount: 1 }] }),
  t({ id: 'gue_precision', branch: 'Maestro de armas', icon: '⚔️', name: 'Precisión letal', minLevel: 3,
    description: 'Haces crítico con 19-20 y tus críticos aturden 1 turno.',
    effects: [{ type: 'critRange', amount: 1 }, { type: 'onCrit', status: { id: 'aturdido', turns: 1 } }] }),
  t({ id: 'gue_golpe_brutal', branch: 'Maestro de armas', icon: '💥', name: 'Golpe poderoso mejorado', minLevel: 4,
    description: 'Golpe poderoso hace 1d8 más y hace sangrar.',
    effects: [{ type: 'skillMod', skill: 'golpe_poderoso', extraDice: '1d8', applyStatus: { id: 'sangrado', chance: 1, turns: 3 } }] }),
] satisfies TalentDef[];
