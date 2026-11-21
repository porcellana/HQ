import type { EnemyDef } from '../schema';

const goblinLook = { shape: 'goblin', main: '#5a8a3a', dark: '#3a5a26', accent: '#6a4a2a', eye: '#f0d040' };

export default [
  {
    id: 'goblin', name: 'Goblin', family: 'goblinoide', level: 1, hp: '2d6', ac: 13, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Cimitarra', toHit: 4, dice: '1d6', damageType: 'cortante', range: 1 },
    xp: 20, description: 'Pequeño, rencoroso y siempre en grupo.', look: goblinLook, lootTable: 'goblin',
  },
  {
    id: 'goblin_arquero', name: 'Goblin arquero', family: 'goblinoide', level: 2, hp: '2d6+1', ac: 12, speed: 1, sight: 7, ai: 'ranged',
    attack: { name: 'Arco corto', toHit: 4, dice: '1d6', damageType: 'perforante', range: 5 },
    xp: 30, description: 'Dispara desde lejos y huye si te acercas.',
    look: { ...goblinLook, accent: '#3a5a8a' }, lootTable: 'goblin',
  },
  {
    id: 'goblin_chaman', name: 'Goblin chamán', family: 'goblinoide', level: 3, hp: '3d6+3', ac: 12, speed: 1, sight: 7, ai: 'caster',
    attack: { name: 'Bastón de hueso', toHit: 3, dice: '1d4', damageType: 'contundente', range: 1 },
    spells: [
      { id: 'chispa', name: 'Chispa infernal', kind: 'damage', dice: '1d10', damageType: 'fuego', range: 5, save: 'DES', dc: 12, cooldown: 2 },
      { id: 'curar_aliado', name: 'Ungüento apestoso', kind: 'heal', dice: '1d8+2', range: 5, cooldown: 4 },
    ],
    xp: 50, description: 'Lanza chispas y cura a los suyos. Mátalo primero.',
    look: { ...goblinLook, accent: '#8a2a2a', eye: '#ff6040' }, lootTable: 'goblin',
  },
] satisfies EnemyDef[];
