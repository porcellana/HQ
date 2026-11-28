import type { ClassDef } from '../schema';

export default {
  id: 'druida',
  name: 'Druida',
  role: 'Voz del bosque',
  description: 'Guardián de la espesura. Cura con savia, enreda a sus enemigos y llama a la tormenta.',
  baseStats: { FUE: 9, DES: 12, CON: 14, INT: 12, SAB: 16, CAR: 11 },
  primary: ['SAB', 'CON'],
  hitDie: 8,
  resource: { name: 'Savia', short: 'SAV', base: 6, perLevel: 2, stat: 'SAB', color: '#5ac060' },
  armorBonus: 0,
  movement: 5,
  skillProficiencies: ['perspicacia', 'persuasion'],
  startingItems: [
    { item: 'baston', equip: true }, { item: 'armadura_cuero', equip: true }, { item: 'botas_cuero', equip: true },
    { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 3 },
  ],
  critRange: 20,
  startingGold: 30,
  traits: ['Hechizos de la naturaleza (SAB)', 'Cura y controla: ralentiza y enreda'],
  look: { overlay: 'druida', cloth: '#3f6a3a', clothDark: '#2a4626', pants: '#5a4a32', hat: '#4f8f3a' },
  skills: [
    {
      id: 'latigo_espinas', name: 'Látigo de espinas', icon: '🌿', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'enemy', range: 4, description: '1d10 de daño perforante a distancia. Salvación de DES: mitad.',
      effects: [{ type: 'spell', dice: '1d10+1', stat: 'SAB', damageType: 'perforante', save: 'DES' }],
    },
    {
      id: 'savia_curativa', name: 'Savia curativa', icon: '🍃', unlockLevel: 2, cost: 3, cooldown: 1,
      target: 'self', range: 0, description: 'Te curas 2d6 + SAB.',
      effects: [{ type: 'heal', dice: '2d6', stat: 'SAB' }],
    },
    {
      id: 'enredadera', name: 'Enredadera', icon: '🌱', unlockLevel: 4, cost: 3, cooldown: 3,
      target: 'enemy', range: 5, description: 'Raíces que ralentizan 3 turnos y hieren (1d6). Salvación de FUE.',
      effects: [{ type: 'spell', dice: '1d6', stat: 'SAB', damageType: 'contundente', save: 'FUE', applyStatus: { id: 'ralentizado', turns: 3 } }],
    },
    {
      id: 'enjambre', name: 'Enjambre de avispas', icon: '🐝', unlockLevel: 8, cost: 5, cooldown: 3,
      target: 'area', range: 6, description: '3d6 de veneno en radio 2 y envenena. Salvación de CON: mitad.',
      effects: [{ type: 'spell', dice: '3d6', stat: 'SAB', damageType: 'veneno', save: 'CON', radius: 2, applyStatus: { id: 'veneno', chance: 0.6, turns: 3 } }],
    },
    {
      id: 'llamar_tormenta', name: 'Llamar a la tormenta', icon: '⛈️', unlockLevel: 14, cost: 9, cooldown: 5,
      target: 'area', range: 7, description: '6d6 de rayo en radio 3. Salvación de DES: mitad.',
      effects: [{ type: 'spell', dice: '6d6', stat: 'SAB', damageType: 'rayo', save: 'DES', radius: 3 }],
    },
  ],
} satisfies ClassDef;
