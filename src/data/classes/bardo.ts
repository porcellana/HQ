import type { ClassDef } from '../schema';

export default {
  id: 'bardo',
  name: 'Bardo',
  role: 'Canción y acero',
  description: 'Músico errante con lengua afilada. Inspira a sus aliados, desconcierta a los enemigos y se cura con su música.',
  baseStats: { FUE: 9, DES: 14, CON: 12, INT: 12, SAB: 10, CAR: 16 },
  primary: ['CAR', 'DES'],
  hitDie: 8,
  resource: { name: 'Inspiración', short: 'INS', base: 5, perLevel: 2, stat: 'CAR', color: '#c070d0' },
  armorBonus: 0,
  movement: 6,
  skillProficiencies: ['persuasion', 'engano', 'perspicacia'],
  startingItems: [
    { item: 'espada_corta', equip: true }, { item: 'armadura_cuero', equip: true }, { item: 'botas_cuero', equip: true },
    { item: 'daga', qty: 1 }, { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 2 },
  ],
  critRange: 20,
  startingGold: 50,
  traits: ['Más oro inicial y labia (persuasión, engaño)', 'Canciones que curan, protegen y confunden'],
  look: { overlay: 'bardo', cloth: '#8a3a6a', clothDark: '#5a2444', pants: '#3a2a4a', hat: '#c0a040' },
  skills: [
    {
      id: 'burla_hiriente', name: 'Burla hiriente', icon: '🎭', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 5, description: '1d6+1 de daño psíquico (arcano). Salvación de SAB: mitad.',
      effects: [{ type: 'spell', dice: '1d6+1', stat: 'CAR', damageType: 'arcano', save: 'SAB' }],
    },
    {
      id: 'cancion_aliento', name: 'Canción de aliento', icon: '🎵', unlockLevel: 2, cost: 3, cooldown: 1,
      target: 'self', range: 0, description: 'Te curas 2d6 + CAR.',
      effects: [{ type: 'heal', dice: '2d6', stat: 'CAR' }],
    },
    {
      id: 'himno_valor', name: 'Himno de valor', icon: '🎺', unlockLevel: 4, cost: 3, cooldown: 5,
      target: 'self', range: 0, description: '+2 al ataque y +2 a la CA durante 4 turnos.',
      effects: [{ type: 'buff', stat: 'ataque', amount: 2, turns: 4 }, { type: 'buff', stat: 'ca', amount: 2, turns: 4 }],
    },
    {
      id: 'nota_disonante', name: 'Nota disonante', icon: '🔔', unlockLevel: 8, cost: 5, cooldown: 3,
      target: 'area', range: 5, description: '3d6 en radio 2 y puede aturdir. Salvación de CON: mitad.',
      effects: [{ type: 'spell', dice: '3d6', stat: 'CAR', damageType: 'arcano', save: 'CON', radius: 2, applyStatus: { id: 'aturdido', chance: 0.35, turns: 1 } }],
    },
    {
      id: 'balada_heroica', name: 'Balada heroica', icon: '🎻', unlockLevel: 14, cost: 7, cooldown: 6,
      target: 'self', range: 0, description: 'Te curas 4d8, purificas tus males y ganas +3 al ataque 3 turnos.',
      effects: [{ type: 'heal', dice: '4d8', stat: 'CAR' }, { type: 'cleanse' }, { type: 'buff', stat: 'ataque', amount: 3, turns: 3 }],
    },
  ],
} satisfies ClassDef;
