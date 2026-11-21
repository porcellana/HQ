import type { EnemyDef } from '../schema';

export default [
  {
    id: 'esqueleto', name: 'Esqueleto', family: 'no-muerto', level: 3, hp: '3d8+3', ac: 13, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Espada oxidada', toHit: 4, dice: '1d6+2', damageType: 'cortante', range: 1 },
    resist: ['perforante'], vulnerable: ['contundente', 'sagrado'], immune: ['veneno', 'sangrado'],
    xp: 60, description: 'Huesos animados. Las mazas y la luz sagrada lo destrozan.',
    look: { shape: 'esqueleto', main: '#d8d0bc', dark: '#8a8270', accent: '#9aa0ac', eye: '#40e0ff' }, lootTable: 'no_muerto',
  },
  {
    id: 'esqueleto_arquero', name: 'Esqueleto arquero', family: 'no-muerto', level: 4, hp: '3d8+2', ac: 13, speed: 1, sight: 7, ai: 'ranged',
    attack: { name: 'Arco largo', toHit: 5, dice: '1d8+1', damageType: 'perforante', range: 6 },
    resist: ['perforante'], vulnerable: ['contundente', 'sagrado'], immune: ['veneno', 'sangrado'],
    xp: 80, description: 'Dispara flechas negras desde la oscuridad.',
    look: { shape: 'esqueleto', main: '#c8c0a8', dark: '#7a7260', accent: '#6a4a2a', eye: '#a040ff' }, lootTable: 'no_muerto',
  },
  {
    id: 'zombi', name: 'Zombi', family: 'no-muerto', level: 4, hp: '5d8+10', ac: 8, speed: 1, slow: true, sight: 5, ai: 'melee',
    attack: { name: 'Zarpazo', toHit: 4, dice: '1d8+2', damageType: 'contundente', range: 1 },
    vulnerable: ['sagrado', 'fuego'], immune: ['veneno', 'sangrado'],
    xp: 70, description: 'Lento pero incansable: actúa un turno de cada dos.',
    look: { shape: 'humanoide', main: '#7a9a6a', dark: '#3a3a30', accent: '#5a4a3a', eye: '#e0e040' }, lootTable: 'no_muerto',
  },
] satisfies EnemyDef[];
