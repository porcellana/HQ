/**
 * Cripta de Velkar (nivel 8-10). Entrada: salida '7' de Puerto Ceniza, sellada
 * hasta que la historia (Hito 7) ponga la bandera `cripta_abierta`.
 * Jefe final: Velkar el Nigromante.
 */
import type { DungeonDef } from '../schema';

export default {
  id: 'cripta_velkar',
  name: 'Cripta de Velkar',
  description: 'El aire es frío y huele a incienso rancio. Los muertos no descansan aquí.',
  level: 8,
  floors: 3,
  width: 46,
  height: 46,
  rooms: [9, 12],
  wallTile: 'muro_cripta',
  floorTile: 'suelo_cripta',
  darkness: 0.32,
  surface: { zone: 'puerto_ceniza', arrive: '7' },
  requiresFlag: 'cripta_abierta',
  lockedText: 'Una reja sellada con runas cierra la cripta. Quizá alguien en la ciudad sepa cómo abrirla.',
  floorEncounters: [
    {
      initial: 4, perStepChance: 0.012, maxActive: 11, minDistance: 7,
      groups: [
        { enemy: 'esqueleto', weight: 4, min: 2, max: 3 },
        { enemy: 'esqueleto_arquero', weight: 3, min: 1, max: 2 },
        { enemy: 'zombi', weight: 3, min: 1, max: 3 },
        { enemy: 'cultista', weight: 2, min: 1, max: 2 },
      ],
    },
    {
      initial: 5, perStepChance: 0.012, maxActive: 11, minDistance: 7,
      groups: [
        { enemy: 'caballero_esqueleto', weight: 3, min: 1, max: 2 },
        { enemy: 'esqueleto_arquero', weight: 3, min: 2, max: 2 },
        { enemy: 'cultista', weight: 3, min: 1, max: 2 },
        { enemy: 'zombi', weight: 2, min: 2, max: 3 },
      ],
    },
    {
      initial: 5, perStepChance: 0.012, maxActive: 12, minDistance: 7,
      groups: [
        { enemy: 'caballero_esqueleto', weight: 3, min: 1, max: 2 },
        { enemy: 'espectro', weight: 3, min: 1, max: 2 },
        { enemy: 'cultista', weight: 2, min: 2, max: 3 },
        { enemy: 'orco_bruto', weight: 1, min: 1, max: 1 },
      ],
    },
  ],
  chestLoot: 'cofre',
  chestsPerFloor: [3, 4],
  lockedChance: 0.55,
  trapsPerFloor: [3, 6],
  traps: ['fuego', 'dardos', 'pinchos'],
  oresPerFloor: [1, 3],
  ores: ['plata', 'gema'],
  boss: {
    enemy: 'nigromante',
    guards: [{ enemy: 'cultista', x: 6, y: 8 }, { enemy: 'cultista', x: 15, y: 8 }],
    map: [
      '######################',
      '##########11##########',
      '##########..##########',
      '######..........######',
      '#####............#####',
      '####..##......##..####',
      '####..............####',
      '###................###',
      '###.......X........###',
      '###................###',
      '####..##......##..####',
      '####..............####',
      '#####............#####',
      '######..........######',
      '##########..##########',
      '##########33##########',
      '######################',
    ],
  },
} satisfies DungeonDef;
