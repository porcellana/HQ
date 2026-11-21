import type { ClassDef } from '../schema';

export default {
  id: 'guerrero',
  name: 'Guerrero',
  role: 'Muro de acero',
  description: 'Veterano de mil escaramuzas. Mucha vida y armadura, y golpes que parten escudos.',
  baseStats: { FUE: 15, DES: 12, CON: 14, INT: 8, SAB: 10, CAR: 11 },
  primary: ['FUE', 'CON'],
  hitDie: 10,
  resource: { name: 'Vigor', short: 'VIG', base: 4, perLevel: 1, stat: 'CON', color: '#d08a3a' },
  armorBonus: 5,
  weapon: { name: 'Espada larga', dice: '1d8', stat: 'FUE', damageType: 'cortante', range: 1 },
  critRange: 20,
  startingGold: 30,
  traits: ['Armadura pesada: +5 a la CA', 'Dado de golpe d10: la vida que más crece'],
  look: { overlay: 'guerrero', cloth: '#7a808c', clothDark: '#4e535e', pants: '#3a3340', hat: '#9aa0ac' },
  skills: [
    {
      id: 'golpe_poderoso', name: 'Golpe poderoso', icon: '⚔️', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 1, description: 'Un tajo brutal que suma 1d8 de daño.',
      effects: [{ type: 'attack', extraDice: '1d8' }],
    },
    {
      id: 'segundo_aliento', name: 'Segundo aliento', icon: '💪', unlockLevel: 3, cost: 3, cooldown: 8,
      target: 'self', range: 0, description: 'Recuperas 1d10 + tu nivel de vida.',
      effects: [{ type: 'heal', dice: '1d10', perLevel: 1 }],
    },
    {
      id: 'torbellino', name: 'Torbellino', icon: '🌀', unlockLevel: 6, cost: 4, cooldown: 3,
      target: 'self', range: 1, description: 'Atacas a todos los enemigos adyacentes.',
      effects: [{ type: 'attack', allAdjacent: true }],
    },
    {
      id: 'grito_de_guerra', name: 'Grito de guerra', icon: '📯', unlockLevel: 10, cost: 3, cooldown: 10,
      target: 'self', range: 0, description: '+2 al ataque y +2 al daño durante 4 turnos.',
      effects: [{ type: 'buff', stat: 'ataque', amount: 2, turns: 4 }, { type: 'buff', stat: 'daño', amount: 2, turns: 4 }],
    },
    {
      id: 'golpe_aturdidor', name: 'Golpe aturdidor', icon: '🔨', unlockLevel: 15, cost: 5, cooldown: 4,
      target: 'enemy', range: 1, description: 'Golpe con 2d8 extra que aturde 1 turno (60%).',
      effects: [{ type: 'attack', extraDice: '2d8', applyStatus: { id: 'aturdido', chance: 0.6, turns: 1 } }],
    },
  ],
} satisfies ClassDef;
