import type { ClassDef } from '../schema';

export default {
  id: 'mago',
  name: 'Mago',
  role: 'Tormenta arcana',
  description: 'Estudioso de lo prohibido. Poca vida, pero hechizos de área devastadores.',
  baseStats: { FUE: 8, DES: 13, CON: 12, INT: 16, SAB: 12, CAR: 10 },
  primary: ['INT', 'DES'],
  hitDie: 6,
  resource: { name: 'Maná', short: 'PM', base: 8, perLevel: 3, stat: 'INT', color: '#3a6ad0' },
  armorBonus: 0,
  movement: 5,
  skillProficiencies: ['arcanos', 'perspicacia'],
  startingItems: [
    { item: 'baston', equip: true }, { item: 'tunica', equip: true }, { item: 'pocion_curacion', qty: 1 },
    { item: 'pocion_mana', qty: 2 }, { item: 'pan', qty: 2 },
  ],
  critRange: 20,
  startingGold: 35,
  traits: ['Mucho maná que crece con la INT', 'Hechizos a distancia y en área'],
  look: { overlay: 'mago', cloth: '#2f3f8a', clothDark: '#1f2a5e', pants: '#1f2a5e', hat: '#3a2f7a' },
  skills: [
    {
      id: 'proyectil_magico', name: 'Proyectil mágico', icon: '✨', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 6, description: 'Tres dardos de fuerza que nunca fallan (3 × 1d4+1).',
      effects: [{ type: 'spell', dice: '1d4+1', stat: 'INT', damageType: 'arcano', hits: 3 }],
    },
    {
      id: 'rayo_escarcha', name: 'Rayo de escarcha', icon: '❄️', unlockLevel: 3, cost: 3, cooldown: 1,
      target: 'enemy', range: 6, description: '2d8 de frío y ralentiza 2 turnos. Salvación de CON: mitad.',
      effects: [{ type: 'spell', dice: '2d8', stat: 'INT', damageType: 'frio', save: 'CON', applyStatus: { id: 'ralentizado', turns: 2 } }],
    },
    {
      id: 'bola_de_fuego', name: 'Bola de fuego', icon: '🔥', unlockLevel: 6, cost: 6, cooldown: 3,
      target: 'area', range: 6, description: '4d6 de fuego en un radio de 2 casillas. Salvación de DES: mitad. Puede quemar.',
      effects: [{ type: 'spell', dice: '4d6', stat: 'INT', damageType: 'fuego', save: 'DES', radius: 2, applyStatus: { id: 'quemado', chance: 0.4, turns: 3 } }],
    },
    {
      id: 'relampago', name: 'Relámpago', icon: '⚡', unlockLevel: 10, cost: 7, cooldown: 3,
      target: 'enemy', range: 7, description: '6d6 de rayo a un objetivo y puede aturdir. Salvación de DES: mitad.',
      effects: [{ type: 'spell', dice: '6d6', stat: 'INT', damageType: 'rayo', save: 'DES', applyStatus: { id: 'aturdido', chance: 0.3, turns: 1 } }],
    },
    {
      id: 'tormenta_arcana', name: 'Tormenta arcana', icon: '🌌', unlockLevel: 15, cost: 12, cooldown: 6,
      target: 'area', range: 7, description: '8d6 arcano en radio 3. Salvación de SAB: mitad.',
      effects: [{ type: 'spell', dice: '8d6', stat: 'INT', damageType: 'arcano', save: 'SAB', radius: 3 }],
    },
  ],
} satisfies ClassDef;
