/** Enemigos propios de los biomas del mundo procedural (v0.8). Se escalan al nivel de la zona. */
import type { EnemyDef } from '../schema';

export default [
  {
    id: 'lobo_nieve', name: 'Lobo de las nieves', family: 'bestia', level: 3, hp: '3d8+3', ac: 13, speed: 2, movement: 7, sight: 8, ai: 'skirmisher',
    attack: { name: 'Mordisco gélido', toHit: 4, dice: '2d4', damageType: 'perforante', range: 1 },
    xp: 40, description: 'Pelaje blanco; caza en manada entre la ventisca.',
    look: { shape: 'lobo', main: '#e8eef8', dark: '#9aa8c0', accent: '#ffffff', eye: '#60c0ff' }, lootTable: 'bestia',
  },
  {
    id: 'yeti', name: 'Yeti', family: 'bestia', level: 5, hp: '6d10+12', ac: 12, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Zarpazo helado', toHit: 6, dice: '2d6+3', damageType: 'contundente', range: 1 },
    xp: 110, description: 'Enorme, peludo y muy territorial.',
    look: { shape: 'goblin', main: '#dde6f4', dark: '#8a98b0', accent: '#b8c8e0', eye: '#c03030' }, lootTable: 'bestia',
  },
  {
    id: 'bandido', name: 'Bandido', family: 'humano', level: 2, hp: '3d8+3', ac: 12, speed: 1, sight: 7, ai: 'melee',
    attack: { name: 'Espada corta', toHit: 4, dice: '1d6+2', damageType: 'cortante', range: 1 },
    xp: 30, description: 'Asalta caminos a cambio de unas monedas.',
    look: { shape: 'humanoide', overlay: 'picaro', main: '#c89a7a', dark: '#3a2a20', accent: '#6a4a2a', eye: '#000000' }, lootTable: 'humano',
  },
  {
    id: 'pirata', name: 'Pirata', family: 'humano', level: 3, hp: '4d8+4', ac: 13, speed: 1, sight: 7, ai: 'melee',
    attack: { name: 'Alfanje', toHit: 5, dice: '1d8+2', damageType: 'cortante', range: 1 },
    xp: 45, description: 'Saqueador de playas con más orgullo que escrúpulos.',
    look: { shape: 'humanoide', overlay: 'guerrero', main: '#d9a67a', dark: '#6a2a2a', accent: '#c8a040', eye: '#000000' }, lootTable: 'humano',
  },
  {
    id: 'cangrejo_gigante', name: 'Cangrejo gigante', family: 'bestia', level: 2, hp: '3d8+6', ac: 15, speed: 1, sight: 5, ai: 'melee',
    attack: { name: 'Pinza', toHit: 4, dice: '1d8+1', damageType: 'contundente', range: 1 },
    xp: 30, description: 'Su caparazón desvía casi todo.',
    look: { shape: 'arana', main: '#c8502c', dark: '#6a2a18', accent: '#e8884c', eye: '#101010' }, lootTable: 'bestia',
  },
  {
    id: 'escorpion_gigante', name: 'Escorpión gigante', family: 'araña', level: 3, hp: '4d8', ac: 14, speed: 1, sight: 5, ai: 'melee',
    attack: { name: 'Aguijón', toHit: 5, dice: '1d8+1', damageType: 'perforante', range: 1, applyStatus: { id: 'veneno', chance: 0.4, turns: 3 } },
    xp: 45, description: 'Enterrado bajo la arena hasta que pisas cerca.',
    look: { shape: 'arana', main: '#c8a050', dark: '#6a4a20', accent: '#e8c878', eye: '#e03030' }, lootTable: 'arana',
  },
  {
    id: 'momia', name: 'Momia', family: 'no-muerto', level: 4, hp: '5d8+10', ac: 11, speed: 1, slow: true, sight: 6, ai: 'melee',
    attack: { name: 'Vendas malditas', toHit: 5, dice: '1d8+3', damageType: 'necrotico', range: 1 },
    xp: 70, description: 'Guarda tumbas olvidadas bajo la arena.',
    look: { shape: 'esqueleto', main: '#d8d0b0', dark: '#8a8058', accent: '#a89868', eye: '#60e060' }, lootTable: 'no_muerto',
  },
  {
    id: 'sapo_gigante', name: 'Sapo gigante', family: 'bestia', level: 2, hp: '3d8+3', ac: 11, speed: 1, sight: 5, ai: 'melee',
    attack: { name: 'Lengüetazo', toHit: 4, dice: '1d6+2', damageType: 'contundente', range: 2 },
    xp: 28, description: 'Croa a la luz de las luciérnagas.',
    look: { shape: 'rata', main: '#5a8a3a', dark: '#2e4a22', accent: '#a8d070', eye: '#f0e040' }, lootTable: 'bestia',
  },
  {
    id: 'oso_pardo', name: 'Oso pardo', family: 'bestia', level: 4, hp: '5d10+10', ac: 12, speed: 1, sight: 6, ai: 'melee',
    attack: { name: 'Garra', toHit: 6, dice: '2d6+2', damageType: 'cortante', range: 1 },
    xp: 80, description: 'Nadie quiere interponerse entre un oso y su colmena.',
    look: { shape: 'lobo', main: '#6a4a30', dark: '#3a2818', accent: '#8a6a48', eye: '#e8c040' }, lootTable: 'bestia',
  },
  {
    id: 'jabali', name: 'Jabalí', family: 'bestia', level: 1, hp: '2d8+2', ac: 11, speed: 1, sight: 5, ai: 'melee',
    attack: { name: 'Embestida', toHit: 3, dice: '1d6+1', damageType: 'perforante', range: 1 },
    xp: 15, description: 'Embiste sin pensarlo dos veces.',
    look: { shape: 'rata', main: '#7a5a40', dark: '#4a3424', accent: '#e8e0c0', eye: '#d03030' }, lootTable: 'bestia',
  },
] satisfies EnemyDef[];
