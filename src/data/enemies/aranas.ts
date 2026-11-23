import type { EnemyDef } from '../schema';

export default [
  {
    id: 'arana_gigante', name: 'Araña gigante', family: 'araña', level: 3, hp: '4d8', ac: 14, speed: 1, movement: 5, sight: 6, ai: 'melee',
    attack: { name: 'Colmillos', toHit: 5, dice: '1d8', damageType: 'perforante', range: 1, applyStatus: { id: 'veneno', chance: 0.5, turns: 3 } },
    immune: ['veneno'], xp: 60, description: 'Su mordisco envenena.',
    look: { shape: 'arana', main: '#2a2230', dark: '#14101a', accent: '#8a2a4a', eye: '#e03030' }, lootTable: 'arana',
  },
  {
    id: 'arana_tejedora', name: 'Araña tejedora', family: 'araña', level: 4, hp: '3d8+3', ac: 13, speed: 1, movement: 5, sight: 7, ai: 'ranged',
    attack: { name: 'Telaraña', toHit: 5, dice: '1d6', damageType: 'veneno', range: 4, applyStatus: { id: 'ralentizado', chance: 0.6, turns: 2 } },
    immune: ['veneno'], xp: 75, description: 'Escupe telarañas que te ralentizan.',
    look: { shape: 'arana', main: '#c8c0b0', dark: '#7a7268', accent: '#5a8a3a', eye: '#40c0e0' }, lootTable: 'arana',
  },
] satisfies EnemyDef[];
