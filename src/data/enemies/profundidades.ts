/** Enemigos de los pisos profundos de las mazmorras (Hito 6). */
import type { EnemyDef } from '../schema';

export default [
  {
    id: 'arana_cazadora', name: 'Araña cazadora', family: 'araña', level: 6, hp: '6d8+6', ac: 15, speed: 2, sight: 7, ai: 'skirmisher',
    attack: { name: 'Colmillos', toHit: 6, dice: '2d6+2', damageType: 'perforante', range: 1, applyStatus: { id: 'veneno', chance: 0.5, turns: 3 } },
    immune: ['veneno'], xp: 180, description: 'Rápida y silenciosa: salta dos casillas por turno.',
    look: { shape: 'arana', main: '#5a3a1a', dark: '#2a1a0a', accent: '#d08030', eye: '#ffe040' }, lootTable: 'arana',
  },
  {
    id: 'caballero_esqueleto', name: 'Caballero esqueleto', family: 'no-muerto', level: 8, hp: '9d10+9', ac: 17, speed: 1, sight: 7, ai: 'melee',
    attack: { name: 'Mandoble oxidado', toHit: 7, dice: '2d8+3', damageType: 'cortante', range: 1, applyStatus: { id: 'sangrado', chance: 0.3, turns: 3 } },
    resist: ['perforante', 'cortante'], vulnerable: ['contundente', 'sagrado'], immune: ['veneno', 'sangrado'],
    xp: 320, description: 'Un guardián de la cripta con armadura completa.',
    look: { shape: 'humanoide', overlay: 'guerrero', main: '#d8d0bc', dark: '#3a3440', accent: '#5e6470', eye: '#40e0ff' }, lootTable: 'no_muerto',
  },
  {
    id: 'espectro', name: 'Espectro', family: 'no-muerto', level: 9, hp: '8d8+8', ac: 14, speed: 1, sight: 8, ai: 'caster',
    attack: { name: 'Toque helado', toHit: 6, dice: '2d6+2', damageType: 'necrotico', range: 1 },
    spells: [
      { id: 'grito_espectral', name: 'Grito espectral', kind: 'damage', dice: '3d8', damageType: 'necrotico', range: 5, save: 'SAB', dc: 15, applyStatus: { id: 'aturdido', chance: 0.25, turns: 1 }, cooldown: 2 },
    ],
    resist: ['cortante', 'perforante', 'contundente', 'necrotico'], vulnerable: ['sagrado', 'fuego'], immune: ['veneno', 'sangrado', 'ralentizado'],
    xp: 420, description: 'Un alma atada a la cripta. Las armas normales apenas le hacen nada: usa magia o fuego.',
    look: { shape: 'humanoide', overlay: 'mago', main: '#a0b8d0', dark: '#2a3a5a', accent: '#4a5a8a', eye: '#a0ffff' }, lootTable: 'no_muerto',
  },
] satisfies EnemyDef[];
