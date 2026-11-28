import type { ClassDef } from '../schema';

export default {
  id: 'barbaro',
  name: 'Bárbaro',
  role: 'Furia de las cumbres',
  description: 'Curtido en las montañas del Velo. Golpea con una furia que lo hace más duro cuanto más herido está.',
  baseStats: { FUE: 16, DES: 12, CON: 15, INT: 8, SAB: 10, CAR: 9 },
  primary: ['FUE', 'CON'],
  hitDie: 12,
  resource: { name: 'Furia', short: 'FUR', base: 4, perLevel: 1, stat: 'CON', color: '#d05a2a' },
  armorBonus: 1,
  movement: 6,
  skillProficiencies: ['intimidacion', 'atletismo'],
  startingItems: [
    { item: 'hacha_mano', equip: true }, { item: 'armadura_cuero', equip: true }, { item: 'botas_cuero', equip: true },
    { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 3 },
  ],
  critRange: 20,
  startingGold: 25,
  traits: ['Muchos puntos de vida (dado 12)', 'Defensa natural: +1 a la CA sin armadura pesada'],
  look: { overlay: 'barbaro', cloth: '#7a4a2a', clothDark: '#4a2c18', pants: '#3a2c20', hat: '#9a9aa4' },
  skills: [
    {
      id: 'tajo_salvaje', name: 'Tajo salvaje', icon: '🪓', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 1, description: 'Un hachazo brutal con 1d8 de daño extra.',
      effects: [{ type: 'attack', extraDice: '1d8' }],
    },
    {
      id: 'furia', name: 'Furia', icon: '😡', unlockLevel: 3, cost: 3, cooldown: 6,
      target: 'self', range: 0, description: '+3 al daño durante 4 turnos.',
      effects: [{ type: 'buff', stat: 'daño', amount: 3, turns: 4 }],
    },
    {
      id: 'torbellino', name: 'Torbellino', icon: '🌀', unlockLevel: 6, cost: 4, cooldown: 3,
      target: 'self', range: 1, description: 'Giras con el arma y golpeas a todos los adyacentes.',
      effects: [{ type: 'attack', allAdjacent: true }],
    },
    {
      id: 'grito_de_guerra', name: 'Grito de guerra', icon: '📣', unlockLevel: 10, cost: 4, cooldown: 8,
      target: 'self', range: 0, description: '+3 al ataque y +2 a la CA durante 3 turnos.',
      effects: [{ type: 'buff', stat: 'ataque', amount: 3, turns: 3 }, { type: 'buff', stat: 'ca', amount: 2, turns: 3 }],
    },
    {
      id: 'golpe_titan', name: 'Golpe de titán', icon: '💥', unlockLevel: 15, cost: 6, cooldown: 4,
      target: 'enemy', range: 1, description: 'Un golpe aplastante con 3d8 extra que puede aturdir.',
      effects: [{ type: 'attack', extraDice: '3d8', applyStatus: { id: 'aturdido', chance: 0.4, turns: 1 } }],
    },
  ],
} satisfies ClassDef;
