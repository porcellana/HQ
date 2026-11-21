/**
 * Galerías de Seda (nivel 5-7). Entrada: salida '3' del Paso Gris.
 * Jefa: Mórgala, Reina Araña.
 */
import type { DungeonDef } from '../schema';

export default {
  id: 'galerias_seda',
  name: 'Galerías de Seda',
  description: 'Hilos pegajosos cuelgan del techo. Algo enorme se mueve ahí abajo.',
  level: 5,
  floors: 3,
  width: 44,
  height: 44,
  rooms: [8, 11],
  wallTile: 'muro_seda',
  floorTile: 'suelo_seda',
  darkness: 0.28,
  surface: { zone: 'paso_gris', arrive: '3' },
  floorEncounters: [
    {
      initial: 4, perStepChance: 0.012, maxActive: 10, minDistance: 7,
      groups: [
        { enemy: 'arana_gigante', weight: 5, min: 1, max: 3 },
        { enemy: 'arana_tejedora', weight: 3, min: 1, max: 2 },
        { enemy: 'lobo', weight: 2, min: 2, max: 3 },
      ],
    },
    {
      initial: 4, perStepChance: 0.012, maxActive: 10, minDistance: 7,
      groups: [
        { enemy: 'arana_gigante', weight: 4, min: 2, max: 3 },
        { enemy: 'arana_tejedora', weight: 3, min: 1, max: 2 },
        { enemy: 'arana_cazadora', weight: 2, min: 1, max: 2 },
      ],
    },
    {
      initial: 5, perStepChance: 0.012, maxActive: 11, minDistance: 7,
      groups: [
        { enemy: 'arana_cazadora', weight: 4, min: 1, max: 3 },
        { enemy: 'arana_tejedora', weight: 3, min: 2, max: 2 },
        { enemy: 'orco_bruto', weight: 1, min: 1, max: 1 },
      ],
    },
  ],
  chestLoot: 'cofre',
  chestsPerFloor: [2, 4],
  lockedChance: 0.45,
  trapsPerFloor: [3, 5],
  traps: ['dardos', 'pinchos'],
  oresPerFloor: [2, 4],
  ores: ['hierro', 'plata', 'plata', 'gema'],
  boss: {
    enemy: 'reina_arana',
    guards: [{ enemy: 'arana_tejedora', x: 5, y: 7 }],
    map: [
      '######################',
      '##########11##########',
      '########......########',
      '######..........######',
      '####..............####',
      '###....##....##....###',
      '###................###',
      '##..................##',
      '##........X.........##',
      '##..................##',
      '###................###',
      '###....##....##....###',
      '####..............####',
      '######..........######',
      '#########....#########',
      '##########33##########',
      '######################',
    ],
  },
} satisfies DungeonDef;
