/** Talentos del Pícaro: Asesino (sombras), Envenenador (toxinas) y Acróbata (esquiva). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'picaro', ...x });

export default [
  // --- Asesino
  t({ id: 'pic_golpe_sombra', branch: 'Asesino', icon: '🌑', name: 'Golpe desde la sombra', minLevel: 3,
    description: 'Tu primer ataque desde sigilo aturde al objetivo 1 turno.',
    effects: [{ type: 'stealthStun' }] }),
  t({ id: 'pic_sicario', branch: 'Asesino', icon: '🗡️', name: 'Sicario', minLevel: 2,
    description: 'Tu rango de crítico mejora en 1 (18-20 con la daga de base).',
    effects: [{ type: 'critRange', amount: 1 }] }),
  t({ id: 'pic_desvanecerse', branch: 'Asesino', icon: '💨', name: 'Desvanecerse', minLevel: 4,
    description: 'Al matar a un enemigo vuelves a ocultarte 2 turnos (y recuperas 1 de energía).',
    effects: [{ type: 'onKill', stealth: 2, restore: 1 }] }),
  // --- Envenenador
  t({ id: 'pic_hojas_untadas', branch: 'Envenenador', icon: '🧪', name: 'Hojas untadas', minLevel: 2,
    description: 'Tus ataques con arma envenenan (35 %, 3 turnos).',
    effects: [{ type: 'poisonStrike', chance: 0.35, turns: 3 }] }),
  t({ id: 'pic_mitridatismo', branch: 'Envenenador', icon: '🍄', name: 'Mitridatismo', minLevel: 2,
    description: 'Inmune al veneno y +4 PV máximos: llevas años tomando dosis pequeñas.',
    effects: [{ type: 'immune', status: 'veneno' }, { type: 'stat', stat: 'pv', amount: 4 }] }),
  t({ id: 'pic_sangre_negra', branch: 'Envenenador', icon: '☠️', name: 'Sangre negra', minLevel: 6,
    description: 'Hoja envenenada hace 2d6 más y cuesta 1 menos.',
    effects: [{ type: 'skillMod', skill: 'hoja_envenenada', extraDice: '2d6', costDelta: -1 }] }),
  t({ id: 'pic_furtivo_toxico', branch: 'Envenenador', icon: '🐍', name: 'Ataque furtivo tóxico', minLevel: 3,
    description: 'Ataque furtivo siempre envenena.',
    effects: [{ type: 'skillMod', skill: 'ataque_furtivo', applyStatus: { id: 'veneno', chance: 1, turns: 3 } }] }),
  // --- Acróbata
  t({ id: 'pic_esquiva', branch: 'Acróbata', icon: '🤸', name: 'Esquiva felina', minLevel: 2,
    description: '15 % de esquivar por completo un golpe que te iba a dar.',
    effects: [{ type: 'dodge', chance: 0.15 }] }),
  t({ id: 'pic_pies_ligeros', branch: 'Acróbata', icon: '👟', name: 'Pies ligeros', minLevel: 3,
    description: '+1 DES, +1 a la CA y +1 casilla de movimiento en combate.',
    effects: [{ type: 'stat', stat: 'DES', amount: 1 }, { type: 'stat', stat: 'ca', amount: 1 }, { type: 'movement', amount: 1 }] }),
  t({ id: 'pic_replica', branch: 'Acróbata', icon: '↩️', name: 'Réplica', minLevel: 4, requires: 'pic_esquiva',
    description: 'Cuando te fallan cuerpo a cuerpo, 40 % de contraatacar.',
    effects: [{ type: 'counter', chance: 0.4 }] }),
] satisfies TalentDef[];
