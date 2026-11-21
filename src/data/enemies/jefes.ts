/** Jefes: aparecen al final de las mazmorras (Hito 6). */
import type { EnemyDef } from '../schema';

export default [
  {
    id: 'rey_goblin', name: 'Gruñaz, Rey Goblin', family: 'goblinoide', level: 4, hp: '8d8+8', ac: 15, speed: 1, sight: 8, ai: 'boss', boss: true,
    attack: { name: 'Garrote con clavos', toHit: 5, dice: '2d6+2', damageType: 'contundente', range: 1 },
    phases: [
      { hpBelow: 0.6, message: '¡A mí, mis chicos!', summon: { enemy: 'goblin', count: 2 } },
      { hpBelow: 0.3, message: 'Gruñaz entra en cólera.', toHitBonus: 2, damageBonus: 3 },
    ],
    xp: 400, description: 'Jefe de la Cueva de los Colmillos.',
    look: { shape: 'goblin', main: '#4a7a2a', dark: '#2a4a1a', accent: '#8a6a2a', eye: '#ff4020', crown: true }, lootTable: 'jefe',
  },
  {
    id: 'reina_arana', name: 'Mórgala, Reina Araña', family: 'araña', level: 7, hp: '12d10', ac: 15, speed: 1, sight: 8, ai: 'boss', boss: true,
    attack: { name: 'Aguijón', toHit: 7, dice: '2d8+3', damageType: 'perforante', range: 1, applyStatus: { id: 'veneno', chance: 0.6, turns: 4 } },
    spells: [
      { id: 'red', name: 'Red de seda', kind: 'damage', dice: '2d6', damageType: 'veneno', range: 5, radius: 1, save: 'DES', dc: 14, applyStatus: { id: 'ralentizado', turns: 2 }, cooldown: 3 },
    ],
    phases: [
      { hpBelow: 0.6, message: 'Las crías bajan del techo.', summon: { enemy: 'arana_gigante', count: 2 } },
      { hpBelow: 0.3, message: 'Mórgala chilla enloquecida.', toHitBonus: 2, damageBonus: 2 },
    ],
    immune: ['veneno'], xp: 900, description: 'Señora de las Galerías de Seda.',
    look: { shape: 'arana', main: '#4a1a2a', dark: '#1a0a14', accent: '#d8b050', eye: '#ff2020', crown: true }, lootTable: 'jefe',
  },
  {
    id: 'nigromante', name: 'Velkar el Nigromante', family: 'humano', level: 10, hp: '16d8+16', ac: 15, speed: 1, sight: 9, ai: 'boss', boss: true,
    attack: { name: 'Báculo de calavera', toHit: 6, dice: '1d8+2', damageType: 'contundente', range: 1 },
    spells: [
      { id: 'rayo_necrotico', name: 'Rayo necrótico', kind: 'damage', dice: '4d8', damageType: 'necrotico', range: 6, save: 'CON', dc: 16, cooldown: 1 },
      { id: 'alzar_muertos', name: 'Alzar a los muertos', kind: 'summon', summon: { enemy: 'esqueleto', count: 2 }, range: 0, cooldown: 7 },
    ],
    phases: [
      { hpBelow: 0.66, message: '¡Levantaos, arqueros!', summon: { enemy: 'esqueleto_arquero', count: 2 } },
      { hpBelow: 0.33, message: '«La muerte no es el final...» Velkar absorbe la vida de la cripta.', heal: 0.25, damageBonus: 3 },
    ],
    resist: ['necrotico'], vulnerable: ['sagrado'], immune: ['veneno'],
    xp: 2500, description: 'El villano que despertó el Abismo.',
    look: { shape: 'humanoide', overlay: 'mago', main: '#b8b0a0', dark: '#1a1420', accent: '#3a1a4a', eye: '#a040ff', crown: true }, lootTable: 'jefe',
  },
] satisfies EnemyDef[];
