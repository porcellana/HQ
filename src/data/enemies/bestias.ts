import type { EnemyDef } from '../schema';

export default [
  {
    id: 'rata_gigante', name: 'Rata gigante', family: 'bestia', level: 1, hp: '2d4', ac: 11, speed: 1, sight: 5, ai: 'melee',
    attack: { name: 'Mordisco', toHit: 3, dice: '1d4', damageType: 'perforante', range: 1 },
    xp: 10, description: 'Del tamaño de un perro. Huele a cloaca.',
    look: { shape: 'rata', main: '#6a5040', dark: '#3e2e24', accent: '#d08080', eye: '#e03030' }, lootTable: 'bestia',
  },
  {
    id: 'lobo', name: 'Lobo', family: 'bestia', level: 2, hp: '2d8+2', ac: 13, speed: 2, sight: 8, ai: 'skirmisher',
    attack: { name: 'Mordisco', toHit: 4, dice: '2d4', damageType: 'perforante', range: 1 },
    xp: 35, description: 'Rápido: recorre dos casillas por turno.',
    look: { shape: 'lobo', main: '#6a6a72', dark: '#3e3e46', accent: '#d8d0c0', eye: '#f0c040' }, lootTable: 'bestia',
  },
] satisfies EnemyDef[];
