/** Talentos de Bardo: Juglar, Duelista y Maestro de ceremonias (v0.10). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'bardo', ...x });

export default [
  // --- Juglar
  t({ id: 'bar_voz_dorada', branch: 'Juglar', icon: '🎤', name: 'Voz dorada', minLevel: 2,
    description: 'Canción de aliento cura 1d6 más.',
    effects: [{ type: 'skillMod', skill: 'cancion_aliento', extraDice: '1d6' }] }),
  t({ id: 'bar_repertorio', branch: 'Juglar', icon: '📜', name: 'Repertorio', minLevel: 3,
    description: 'Cada canción cuesta 1 menos.',
    effects: [{ type: 'skillMod', skill: 'himno_valor', costDelta: -1 }] }),
  t({ id: 'bar_bis', branch: 'Juglar', icon: '🎶', name: 'Bis', minLevel: 5,
    description: 'Al matar recuperas 2 de inspiración.',
    effects: [{ type: 'onKill', restore: 2 }] }),
  // --- Duelista
  t({ id: 'bar_estocada', branch: 'Duelista', icon: '🤺', name: 'Estocada', minLevel: 2,
    description: 'Crítico con 19-20.',
    effects: [{ type: 'critRange', amount: 1 }] }),
  t({ id: 'bar_paso_baile', branch: 'Duelista', icon: '💃', name: 'Paso de baile', minLevel: 3,
    description: '15% de esquivar un golpe.',
    effects: [{ type: 'dodge', chance: 0.15 }] }),
  t({ id: 'bar_contraataque', branch: 'Duelista', icon: '↩️', name: 'Contraataque', minLevel: 4,
    description: 'Si un enemigo falla, devuelves el golpe (25%).',
    effects: [{ type: 'counter', chance: 0.25 }] }),
  // --- Maestro de ceremonias
  t({ id: 'bar_lengua_viperina', branch: 'Maestro de ceremonias', icon: '🐍', name: 'Lengua viperina', minLevel: 2,
    description: '+3 de daño a tus hechizos arcanos.',
    effects: [{ type: 'spellPower', damageType: 'arcano', amount: 3 }] }),
  t({ id: 'bar_nota_aguda', branch: 'Maestro de ceremonias', icon: '🔔', name: 'Nota aguda', minLevel: 4,
    description: 'Nota disonante con +1 de radio.',
    effects: [{ type: 'skillMod', skill: 'nota_disonante', radiusDelta: 1 }] }),
  t({ id: 'bar_telon', branch: 'Maestro de ceremonias', icon: '🎭', name: 'Telón de acero', minLevel: 5,
    description: '+2 a la CA.',
    effects: [{ type: 'stat', stat: 'ca', amount: 2 }] }),
] satisfies TalentDef[];
