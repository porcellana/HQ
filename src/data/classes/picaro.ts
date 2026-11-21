import type { ClassDef } from '../schema';

export default {
  id: 'picaro',
  name: 'Pícaro',
  role: 'Sombra afilada',
  description: 'Ágil y letal. Críticos frecuentes, sigilo, y manos hábiles con cerraduras y trampas.',
  baseStats: { FUE: 10, DES: 16, CON: 12, INT: 13, SAB: 10, CAR: 12 },
  primary: ['DES', 'INT'],
  hitDie: 8,
  resource: { name: 'Energía', short: 'ENE', base: 5, perLevel: 1, stat: 'DES', color: '#4fae6a' },
  armorBonus: 0,
  startingItems: [
    { item: 'espada_corta', equip: true }, { item: 'armadura_cuero', equip: true }, { item: 'capucha_cuero', equip: true },
    { item: 'botas_cuero', equip: true }, { item: 'daga', qty: 1 }, { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 2 },
  ],
  critRange: 19,
  startingGold: 45,
  traits: ['Crítico con 19-20', 'Experto en trampas y cofres (ventaja al desactivar/abrir)'],
  look: { overlay: 'picaro', cloth: '#2f4a32', clothDark: '#1d2e20', pants: '#2a2620', hat: '#24392a' },
  skills: [
    {
      id: 'ataque_furtivo', name: 'Ataque furtivo', icon: '🗡️', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 1, description: 'Ataque preciso con 2d6 extra y crítico con 18-20.',
      effects: [{ type: 'attack', extraDice: '2d6', critRange: 18 }],
    },
    {
      id: 'sigilo', name: 'Sigilo', icon: '🌑', unlockLevel: 3, cost: 2, cooldown: 6,
      target: 'self', range: 0, description: 'Te ocultas 3 turnos: los enemigos te pierden y tu siguiente ataque tiene ventaja.',
      effects: [{ type: 'stealth', turns: 3 }],
    },
    {
      id: 'hoja_envenenada', name: 'Hoja envenenada', icon: '🧪', unlockLevel: 6, cost: 3, cooldown: 3,
      target: 'enemy', range: 1, description: 'Ataque que envenena 4 turnos.',
      effects: [{ type: 'attack', extraDice: '1d6', applyStatus: { id: 'veneno', turns: 4 } }],
    },
    {
      id: 'evasion', name: 'Evasión', icon: '💨', unlockLevel: 10, cost: 3, cooldown: 8,
      target: 'self', range: 0, description: '+4 a la CA durante 3 turnos.',
      effects: [{ type: 'buff', stat: 'ca', amount: 4, turns: 3 }],
    },
    {
      id: 'golpe_desangrante', name: 'Golpe desangrante', icon: '🩸', unlockLevel: 15, cost: 4, cooldown: 3,
      target: 'enemy', range: 1, description: 'Dos cuchilladas rápidas que hacen sangrar.',
      effects: [{ type: 'attack', extraDice: '1d6', hits: 2, applyStatus: { id: 'sangrado', chance: 0.7, turns: 3 } }],
    },
  ],
} satisfies ClassDef;
