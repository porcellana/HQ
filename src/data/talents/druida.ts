/** Talentos de Druida: Savia, Tempestad y Bestia (v0.10). */
import type { TalentDef } from '../schema';

const t = (x: Omit<TalentDef, 'classId'>): TalentDef => ({ classId: 'druida', ...x });

export default [
  // --- Savia
  t({ id: 'dru_raices_vivas', branch: 'Savia', icon: '🌱', name: 'Raíces vivas', minLevel: 2,
    description: 'Savia curativa cura 1d6 más.',
    effects: [{ type: 'skillMod', skill: 'savia_curativa', extraDice: '1d6' }] }),
  t({ id: 'dru_renacer', branch: 'Savia', icon: '🌸', name: 'Renacer', minLevel: 4,
    description: 'En combate recuperas 1 PV cada 2 turnos.',
    effects: [{ type: 'regen', every: 2, amount: 1 }] }),
  t({ id: 'dru_luz_del_alba', branch: 'Savia', icon: '☀️', name: 'Luz del alba', minLevel: 3,
    description: 'Tus curaciones queman a los no-muertos cercanos.',
    effects: [{ type: 'healSmite', dice: '1d8', radius: 2 }] }),
  // --- Tempestad
  t({ id: 'dru_chispa', branch: 'Tempestad', icon: '⚡', name: 'Chispa viva', minLevel: 2,
    description: '+3 de daño a tus hechizos de rayo.',
    effects: [{ type: 'spellPower', damageType: 'rayo', amount: 3 }] }),
  t({ id: 'dru_espinas_mas', branch: 'Tempestad', icon: '🌿', name: 'Espinas largas', minLevel: 3,
    description: 'Látigo de espinas hace 1d6 más.',
    effects: [{ type: 'skillMod', skill: 'latigo_espinas', extraDice: '1d6' }] }),
  t({ id: 'dru_tormenta_ancha', branch: 'Tempestad', icon: '⛈️', name: 'Tormenta ancha', minLevel: 6,
    description: 'Llamar a la tormenta con +1 de radio.',
    effects: [{ type: 'skillMod', skill: 'llamar_tormenta', radiusDelta: 1 }] }),
  // --- Bestia
  t({ id: 'dru_corteza', branch: 'Bestia', icon: '🪵', name: 'Corteza dura', minLevel: 2,
    description: '+2 a la CA.',
    effects: [{ type: 'stat', stat: 'ca', amount: 2 }] }),
  t({ id: 'dru_veneno_natural', branch: 'Bestia', icon: '🐍', name: 'Veneno natural', minLevel: 3,
    description: '+3 de daño a tus hechizos de veneno.',
    effects: [{ type: 'spellPower', damageType: 'veneno', amount: 3 }] }),
  t({ id: 'dru_vigor_fiera', branch: 'Bestia', icon: '🐺', name: 'Vigor de fiera', minLevel: 5,
    description: '+8 PV máximos.',
    effects: [{ type: 'stat', stat: 'pv', amount: 8 }] }),
] satisfies TalentDef[];
