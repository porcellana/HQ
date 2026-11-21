/**
 * Cueva de los Colmillos: primera mazmorra (nivel 2-4). Entrada: salida '2'
 * del Bosque Sombrío. Jefe: Gruñaz, Rey Goblin.
 */
import type { DungeonDef } from '../schema';

export default {
  id: 'cueva_goblin',
  name: 'Cueva de los Colmillos',
  description: 'Huele a humo, a perro mojado y a goblin. Mucho goblin.',
  level: 2,
  floors: 2,
  width: 40,
  height: 40,
  rooms: [7, 10],
  wallTile: 'muro_cueva',
  floorTile: 'suelo_cueva',
  darkness: 0.22,
  surface: { zone: 'bosque_sombrio', arrive: '2' },
  floorEncounters: [
    {
      initial: 3, perStepChance: 0.012, maxActive: 8, minDistance: 7,
      groups: [
        { enemy: 'goblin', weight: 5, min: 2, max: 3 },
        { enemy: 'rata_gigante', weight: 3, min: 2, max: 3 },
        { enemy: 'goblin_arquero', weight: 2, min: 1, max: 2 },
        { enemy: 'arana_gigante', weight: 1, min: 1, max: 1 },
      ],
    },
    {
      initial: 4, perStepChance: 0.012, maxActive: 9, minDistance: 7,
      groups: [
        { enemy: 'goblin', weight: 4, min: 2, max: 4 },
        { enemy: 'goblin_arquero', weight: 3, min: 1, max: 2 },
        { enemy: 'goblin_chaman', weight: 2, min: 1, max: 1 },
        { enemy: 'arana_gigante', weight: 2, min: 1, max: 2 },
      ],
    },
  ],
  chestLoot: 'cofre',
  chestsPerFloor: [2, 3],
  lockedChance: 0.35,
  trapsPerFloor: [2, 4],
  traps: ['pinchos', 'dardos'],
  oresPerFloor: [2, 3],
  ores: ['hierro', 'hierro', 'hierro', 'plata'],
  boss: {
    enemy: 'rey_goblin',
    guards: [{ enemy: 'goblin', x: 7, y: 6 }, { enemy: 'goblin_arquero', x: 12, y: 5 }],
    map: [
      '####################',
      '#########11#########',
      '#######......#######',
      '#####..........#####',
      '####............####',
      '###..............###',
      '###.......X......###',
      '###..............###',
      '####............####',
      '#####..........#####',
      '#######......#######',
      '#########..#########',
      '#########33#########',
      '####################',
    ],
  },
} satisfies DungeonDef;
