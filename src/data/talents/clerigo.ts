/** Talentos del Clérigo: Sanador, Inquisidor (castigo) y Guardián de la Luz (protección). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'clerigo', ...x });

export default [
  // --- Sanador
  t({ id: 'cle_manos_benditas', branch: 'Sanador', icon: '🤲', name: 'Manos benditas', minLevel: 2,
    description: 'Curar heridas cura 1d8 más.',
    effects: [{ type: 'skillMod', skill: 'curar_heridas', extraDice: '1d8' }] }),
  t({ id: 'cle_luz_purificadora', branch: 'Sanador', icon: '✨', name: 'Luz purificadora', minLevel: 2,
    description: 'Cuando te curas, la luz quema a los no-muertos a 2 casillas (1d8 sagrado).',
    effects: [{ type: 'healSmite', dice: '1d8', radius: 2 }] }),
  t({ id: 'cle_fe_renovada', branch: 'Sanador', icon: '💖', name: 'Fe renovada', minLevel: 4,
    description: 'En combate recuperas 1 PV cada 3 turnos y al matar recuperas 1 de fe.',
    effects: [{ type: 'regen', every: 3, amount: 1 }, { type: 'onKill', restore: 1 }] }),
  // --- Inquisidor
  t({ id: 'cle_llama_ardiente', branch: 'Inquisidor', icon: '🕯️', name: 'Llama ardiente', minLevel: 2,
    description: '+3 de daño a tus hechizos sagrados.',
    effects: [{ type: 'spellPower', damageType: 'sagrado', amount: 3 }] }),
  t({ id: 'cle_juicio_cadena', branch: 'Inquisidor', icon: '⛓️', name: 'Llama encadenada', minLevel: 3,
    description: 'Llama sagrada salta a otro enemigo cercano y puede quemar.',
    effects: [{ type: 'skillMod', skill: 'llama_sagrada', bounce: 1, applyStatus: { id: 'quemado', chance: 0.3, turns: 2 } }] }),
  t({ id: 'cle_castigo', branch: 'Inquisidor', icon: '🔨', name: 'Castigo divino', minLevel: 4,
    description: 'Tus críticos con el arma aturden 1 turno y haces crítico con 19-20.',
    effects: [{ type: 'onCrit', status: { id: 'aturdido', turns: 1 } }, { type: 'critRange', amount: 1 }] }),
  // --- Guardián de la Luz
  t({ id: 'cle_egida', branch: 'Guardián de la Luz', icon: '🛡️', name: 'Égida', minLevel: 2,
    description: '+2 a la CA.',
    effects: [{ type: 'stat', stat: 'ca', amount: 2 }] }),
  t({ id: 'cle_espinas_luz', branch: 'Guardián de la Luz', icon: '☀️', name: 'Espinas de luz', minLevel: 3,
    description: 'Quien te golpea cuerpo a cuerpo recibe 1d6 de daño sagrado.',
    effects: [{ type: 'thorns', dice: '1d6', damageType: 'sagrado' }] }),
  t({ id: 'cle_aura_temple', branch: 'Guardián de la Luz', icon: '🌟', name: 'Aura de temple', minLevel: 6,
    description: 'Inmune al miedo... y al aturdimiento. +6 PV máximos.',
    effects: [{ type: 'immune', status: 'aturdido' }, { type: 'stat', stat: 'pv', amount: 6 }] }),
] satisfies TalentDef[];
