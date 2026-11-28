/** Talentos de Explorador: Tirador, Rastreador y Cazador de bestias (v0.10). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'explorador', ...x });

export default [
  // --- Tirador
  t({ id: 'exp_ojo_halcon', branch: 'Tirador', icon: '🦅', name: 'Ojo de halcón', minLevel: 2,
    description: 'Crítico con 19-20.',
    effects: [{ type: 'critRange', amount: 1 }] }),
  t({ id: 'exp_punteria', branch: 'Tirador', icon: '🎯', name: 'Puntería', minLevel: 3,
    description: '+2 al ataque.',
    effects: [{ type: 'stat', stat: 'ataque', amount: 2 }] }),
  t({ id: 'exp_flecha_extra', branch: 'Tirador', icon: '🏹', name: 'Flecha extra', minLevel: 5,
    description: 'Disparo certero hace 1d6 más.',
    effects: [{ type: 'skillMod', skill: 'disparo_certero', extraDice: '1d6' }] }),
  // --- Rastreador
  t({ id: 'exp_pies_ligeros', branch: 'Rastreador', icon: '👣', name: 'Pies ligeros', minLevel: 2,
    description: '+1 casilla de movimiento en combate.',
    effects: [{ type: 'movement', amount: 1 }] }),
  t({ id: 'exp_esquiva_monte', branch: 'Rastreador', icon: '🌿', name: 'Esquiva del monte', minLevel: 3,
    description: '15% de esquivar un golpe.',
    effects: [{ type: 'dodge', chance: 0.15 }] }),
  t({ id: 'exp_curtido', branch: 'Rastreador', icon: '🩹', name: 'Curtido', minLevel: 4,
    description: 'En combate recuperas 1 PV cada 3 turnos.',
    effects: [{ type: 'regen', every: 3, amount: 1 }] }),
  // --- Cazador de bestias
  t({ id: 'exp_flechas_veneno', branch: 'Cazador de bestias', icon: '🧪', name: 'Flechas envenenadas', minLevel: 2,
    description: 'Tus ataques pueden envenenar (25%).',
    effects: [{ type: 'poisonStrike', chance: 0.25, turns: 3 }] }),
  t({ id: 'exp_lluvia_ancha', branch: 'Cazador de bestias', icon: '🌧️', name: 'Lluvia ancha', minLevel: 5,
    description: 'Lluvia de flechas con +1 de radio.',
    effects: [{ type: 'skillMod', skill: 'lluvia_flechas', radiusDelta: 1 }] }),
  t({ id: 'exp_trampero', branch: 'Cazador de bestias', icon: '🪤', name: 'Trampero', minLevel: 4,
    description: 'Flecha trabadora aturde (30%).',
    effects: [{ type: 'skillMod', skill: 'flecha_trabadora', applyStatus: { id: 'aturdido', chance: 0.3, turns: 1 } }] }),
] satisfies TalentDef[];
