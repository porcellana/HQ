/** Talentos del Mago: Piromante (fuego), Criomante (hielo) y Arcanista (control y maná). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'mago', ...x });

export default [
  // --- Piromante
  t({ id: 'mago_toque_igneo', branch: 'Piromante', icon: '🔥', name: 'Toque ígneo', minLevel: 2,
    description: 'Tus Proyectiles mágicos son de fuego y pueden dejar al enemigo ardiendo (30 %).',
    effects: [{ type: 'skillMod', skill: 'proyectil_magico', damageType: 'fuego', applyStatus: { id: 'quemado', chance: 0.3, turns: 2 } }] }),
  t({ id: 'mago_piromano', branch: 'Piromante', icon: '🌋', name: 'Pirómano', minLevel: 3,
    description: '+3 de daño a todos tus hechizos de fuego.',
    effects: [{ type: 'spellPower', damageType: 'fuego', amount: 3 }] }),
  t({ id: 'mago_suelo_llamas', branch: 'Piromante', icon: '🔥', name: 'Suelo en llamas', minLevel: 6,
    description: 'La Bola de fuego deja el suelo ardiendo 3 turnos: quien lo pise o se quede encima, se quema.',
    effects: [{ type: 'skillMod', skill: 'bola_de_fuego', burnGround: 3 }] }),
  // --- Criomante
  t({ id: 'mago_corazon_helado', branch: 'Criomante', icon: '🧊', name: 'Corazón helado', minLevel: 2,
    description: 'Tus críticos con arma congelan (ralentizan 2 turnos). +1 a la CA: el frío te protege.',
    effects: [{ type: 'onCrit', status: { id: 'ralentizado', turns: 2 } }, { type: 'stat', stat: 'ca', amount: 1 }] }),
  t({ id: 'mago_escarcha_mordiente', branch: 'Criomante', icon: '❄️', name: 'Escarcha mordiente', minLevel: 3,
    description: 'Rayo de escarcha hace 1d8 más y siempre ralentiza.',
    effects: [{ type: 'skillMod', skill: 'rayo_escarcha', extraDice: '1d8', applyStatus: { id: 'ralentizado', chance: 1, turns: 2 } }] }),
  t({ id: 'mago_cadena_hielo', branch: 'Criomante', icon: '🌨️', name: 'Cadena de hielo', minLevel: 5, requires: 'mago_escarcha_mordiente',
    description: 'Rayo de escarcha salta a otro enemigo cercano.',
    effects: [{ type: 'skillMod', skill: 'rayo_escarcha', bounce: 1 }] }),
  // --- Arcanista
  t({ id: 'mago_rebote', branch: 'Arcanista', icon: '✨', name: 'Proyectiles rebotantes', minLevel: 2,
    description: 'Proyectil mágico rebota y golpea también a otro enemigo cercano.',
    effects: [{ type: 'skillMod', skill: 'proyectil_magico', bounce: 1 }] }),
  t({ id: 'mago_flujo_arcano', branch: 'Arcanista', icon: '🔮', name: 'Flujo arcano', minLevel: 2,
    description: 'Cada vez que matas a un enemigo recuperas 2 de maná.',
    effects: [{ type: 'onKill', restore: 2 }] }),
  t({ id: 'mago_mente_afilada', branch: 'Arcanista', icon: '🧠', name: 'Mente afilada', minLevel: 4,
    description: '+1 INT y +4 de maná máximo.',
    effects: [{ type: 'stat', stat: 'INT', amount: 1 }, { type: 'stat', stat: 'recurso', amount: 4 }] }),
  t({ id: 'mago_economia', branch: 'Arcanista', icon: '📜', name: 'Economía de conjuros', minLevel: 6,
    description: 'Bola de fuego cuesta 2 de maná menos y su radio crece 1 casilla.',
    effects: [{ type: 'skillMod', skill: 'bola_de_fuego', costDelta: -2, radiusDelta: 1 }] }),
] satisfies TalentDef[];
