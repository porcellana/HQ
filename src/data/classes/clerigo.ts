import type { ClassDef } from '../schema';

export default {
  id: 'clerigo',
  name: 'Clérigo',
  role: 'Luz en la cripta',
  description: 'Devoto de la Llama Blanca. Cura, bendice y abrasa a los no-muertos con fuego sagrado.',
  baseStats: { FUE: 13, DES: 10, CON: 13, INT: 10, SAB: 16, CAR: 12 },
  primary: ['SAB', 'CON'],
  hitDie: 8,
  resource: { name: 'Fe', short: 'FE', base: 6, perLevel: 2, stat: 'SAB', color: '#e0c050' },
  armorBonus: 0,
  startingItems: [
    { item: 'maza', equip: true }, { item: 'cota_anillas', equip: true }, { item: 'escudo_madera', equip: true },
    { item: 'simbolo_sagrado', qty: 1 }, { item: 'pocion_curacion', qty: 2 }, { item: 'pan', qty: 2 },
  ],
  critRange: 20,
  startingGold: 35,
  traits: ['Empieza con cota de anillas y escudo', 'Su daño sagrado castiga a los no-muertos'],
  look: { overlay: 'clerigo', cloth: '#d8d0bc', clothDark: '#a89c80', pants: '#5a4a3a', hat: '#d8b050' },
  skills: [
    {
      id: 'curar_heridas', name: 'Curar heridas', icon: '💖', unlockLevel: 1, cost: 2, cooldown: 0,
      target: 'self', range: 0, description: 'Recuperas 1d8 + SAB de vida.',
      effects: [{ type: 'heal', dice: '1d8', stat: 'SAB' }],
    },
    {
      id: 'llama_sagrada', name: 'Llama sagrada', icon: '🕯️', unlockLevel: 1, cost: 1, cooldown: 0,
      target: 'enemy', range: 5, description: '1d8+SAB sagrado a distancia. Salvación de DES: mitad.',
      effects: [{ type: 'spell', dice: '1d8', stat: 'SAB', damageType: 'sagrado', save: 'DES' }],
    },
    {
      id: 'bendicion', name: 'Bendición', icon: '🙏', unlockLevel: 3, cost: 3, cooldown: 8,
      target: 'self', range: 0, description: '+2 al ataque y +2 a la CA durante 5 turnos.',
      effects: [{ type: 'buff', stat: 'ataque', amount: 2, turns: 5 }, { type: 'buff', stat: 'ca', amount: 2, turns: 5 }],
    },
    {
      id: 'aura_sagrada', name: 'Aura sagrada', icon: '☀️', unlockLevel: 6, cost: 5, cooldown: 4,
      target: 'self', range: 2, description: '3d8 sagrado a todos los enemigos en 2 casillas a tu alrededor.',
      effects: [{ type: 'spell', dice: '3d8', stat: 'SAB', damageType: 'sagrado', save: 'SAB', radius: 2 }],
    },
    {
      id: 'sanacion_mayor', name: 'Sanación mayor', icon: '🌟', unlockLevel: 10, cost: 7, cooldown: 10,
      target: 'self', range: 0, description: 'Recuperas 4d8 + SAB de vida y eliminas los estados alterados.',
      effects: [{ type: 'heal', dice: '4d8', stat: 'SAB' }, { type: 'cleanse' }],
    },
    {
      id: 'juicio_divino', name: 'Juicio divino', icon: '⚖️', unlockLevel: 15, cost: 8, cooldown: 4,
      target: 'enemy', range: 6, description: '6d8 sagrado y aturde 1 turno (50%). Salvación de SAB: mitad.',
      effects: [{ type: 'spell', dice: '6d8', stat: 'SAB', damageType: 'sagrado', save: 'SAB', applyStatus: { id: 'aturdido', chance: 0.5, turns: 1 } }],
    },
  ],
} satisfies ClassDef;
