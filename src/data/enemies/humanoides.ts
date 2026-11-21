import type { EnemyDef } from '../schema';

export default [
  {
    id: 'cultista', name: 'Cultista del Abismo', family: 'humano', level: 5, hp: '6d8', ac: 12, speed: 1, sight: 7, ai: 'caster',
    attack: { name: 'Daga ritual', toHit: 4, dice: '1d6+1', damageType: 'perforante', range: 1 },
    spells: [
      { id: 'llamarada', name: 'Llamarada', kind: 'damage', dice: '2d6+2', damageType: 'fuego', range: 5, save: 'DES', dc: 13, applyStatus: { id: 'quemado', chance: 0.4, turns: 3 }, cooldown: 2 },
    ],
    xp: 120, description: 'Siervo del Nigromante. Su fuego quema durante varios turnos.',
    look: { shape: 'humanoide', overlay: 'picaro', main: '#c89a7a', dark: '#5a1a1a', accent: '#8a1a1a', eye: '#000000' }, lootTable: 'humano',
  },
  {
    id: 'orco_bruto', name: 'Orco bruto', family: 'orco', level: 6, hp: '7d10+14', ac: 13, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Gran hacha', toHit: 6, dice: '1d12+4', damageType: 'cortante', range: 1, applyStatus: { id: 'sangrado', chance: 0.3, turns: 3 } },
    xp: 200, description: 'Una montaña de músculo con un hacha. Muy peligroso a nivel bajo.',
    look: { shape: 'humanoide', overlay: 'guerrero', main: '#6a8a5a', dark: '#3a3028', accent: '#5a4a3a', eye: '#e03030' }, lootTable: 'humano',
  },
  {
    id: 'maton_puerto', name: 'Matón del puerto', family: 'humano', level: 2, hp: '3d8', ac: 12, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Porra', toHit: 4, dice: '1d6+1', damageType: 'contundente', range: 1 },
    xp: 35, description: 'Músculo a sueldo de los mercaderes con pocos escrúpulos.',
    look: { shape: 'humanoide', main: '#c89a7a', dark: '#3a2a20', accent: '#5a3a2a', eye: '#000000' }, lootTable: 'humano',
  },
  {
    id: 'desertor_hal', name: 'Hal, el desertor', family: 'humano', level: 3, hp: '4d10', ac: 15, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Espada larga', toHit: 5, dice: '1d8+2', damageType: 'cortante', range: 1 },
    xp: 90, description: 'Un guardia que huyó. Pelea como alguien sin nada que perder.',
    look: { shape: 'humanoide', overlay: 'guerrero', main: '#d9a67a', dark: '#2f3c5a', accent: '#2f3c5a', eye: '#000000' }, lootTable: 'humano',
  },
] satisfies EnemyDef[];
