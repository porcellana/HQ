import type { ClassDef } from '../schema';

export default {
  id: 'explorador',
  name: 'Explorador',
  role: 'Ojo del camino',
  description: 'Cazador y rastreador. Dispara de lejos, conoce el terreno y rara vez se pierde.',
  baseStats: { FUE: 11, DES: 16, CON: 13, INT: 10, SAB: 14, CAR: 9 },
  primary: ['DES', 'SAB'],
  hitDie: 10,
  resource: { name: 'Aguante', short: 'AGU', base: 5, perLevel: 1, stat: 'DES', color: '#6aae4a' },
  armorBonus: 0,
  movement: 6,
  skillProficiencies: ['sigilo', 'perspicacia'],
  startingItems: [
    { item: 'arco_corto', equip: true }, { item: 'armadura_cuero', equip: true }, { item: 'capucha_cuero', equip: true },
    { item: 'botas_cuero', equip: true }, { item: 'daga', qty: 1 }, { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 3 },
  ],
  critRange: 20,
  startingGold: 35,
  traits: ['Arco desde el inicio y buen movimiento (6)', 'Ventaja para descubrir trampas y rastros'],
  look: { overlay: 'explorador', cloth: '#4a6a32', clothDark: '#2e4220', pants: '#4a3a28', hat: '#5a7a3a' },
  skills: [
    {
      id: 'disparo_certero', name: 'Disparo certero', icon: '🎯', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 6, description: 'Disparo apuntado: +2 al ataque y 1d6 de daño extra.',
      effects: [{ type: 'attack', extraDice: '1d6', toHitBonus: 2 }],
    },
    {
      id: 'marca_cazador', name: 'Marca del cazador', icon: '🏹', unlockLevel: 3, cost: 2, cooldown: 5,
      target: 'self', range: 0, description: '+2 al ataque y +2 al daño durante 4 turnos.',
      effects: [{ type: 'buff', stat: 'ataque', amount: 2, turns: 4 }, { type: 'buff', stat: 'daño', amount: 2, turns: 4 }],
    },
    {
      id: 'lluvia_flechas', name: 'Lluvia de flechas', icon: '🌧️', unlockLevel: 6, cost: 5, cooldown: 3,
      target: 'area', range: 6, description: '3d6 perforante en radio 2. Salvación de DES: mitad.',
      effects: [{ type: 'spell', dice: '3d6', stat: 'DES', damageType: 'perforante', save: 'DES', radius: 2 }],
    },
    {
      id: 'flecha_trabadora', name: 'Flecha trabadora', icon: '🕸️', unlockLevel: 10, cost: 3, cooldown: 4,
      target: 'enemy', range: 6, description: 'Una flecha que ralentiza 3 turnos.',
      effects: [{ type: 'attack', extraDice: '1d6', applyStatus: { id: 'ralentizado', turns: 3 } }],
    },
    {
      id: 'disparo_doble', name: 'Disparo doble', icon: '⚡', unlockLevel: 15, cost: 5, cooldown: 3,
      target: 'enemy', range: 6, description: 'Dos flechas seguidas con 1d8 extra cada una.',
      effects: [{ type: 'attack', extraDice: '1d8', hits: 2 }],
    },
  ],
} satisfies ClassDef;
