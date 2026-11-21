/**
 * Paso Gris: camino salvaje entre la Aldea de Brumaroja (norte) y Puerto Ceniza (sur).
 * Más peligroso que el bosque: lobos, arañas y algún cultista.
 */
import type { ZoneDef } from '../schema';

export default {
  id: 'paso_gris',
  name: 'Paso Gris',
  kind: 'wild',
  level: 3,
  darkness: 0.1,
  description: 'Un camino pedregoso entre colinas. Dicen que los cultistas vigilan el paso.',
  exits: {
    '1': { to: 'aldea_brumaroja', arrive: '2', label: 'A la Aldea de Brumaroja' },
    '2': { to: 'puerto_ceniza', arrive: '1', label: 'A Puerto Ceniza' },
  },
  encounters: {
    initial: 4,
    perStepChance: 0.04,
    maxActive: 8,
    minDistance: 7,
    groups: [
      { enemy: 'lobo', weight: 4, min: 1, max: 3 },
      { enemy: 'goblin', weight: 3, min: 2, max: 3 },
      { enemy: 'goblin_arquero', weight: 2, min: 1, max: 2 },
      { enemy: 'arana_gigante', weight: 2, min: 1, max: 1 },
      { enemy: 'esqueleto', weight: 1, min: 1, max: 2 },
      { enemy: 'cultista', weight: 1, min: 1, max: 1 },
    ],
  },
  map: [
    'RRRRRRRRRRRRR11RRRRRRRRRRRRRRR',
    'R,,,,,,,,,,,,==,,,,,,,,,,,,,,R',
    'R,,,,,,,,,,,,==,,,,,,,,,,,,,,R',
    'R,,,,,,,,,,,,,==,,,,,,,,,,,,,R',
    'R,,YY,,,,,,,,,,==,,,,,YY,,,,,R',
    'R,,YY,,R,,,,,,,,==,,,,YY,,,,,R',
    'R,,,,,,,,,,,,,,,,==,,,,,,,R,,R',
    'R,,,,,,,,RR,,,,,,,==,,,,,,,,,R',
    'R,,,"",,,RR,,,,,,,,==,,,,,,,,R',
    'R,,,,,,,,,,,,,,,,,,,==,,,,,,,R',
    'R,,,,,,,,,,,,,,,,,,,,==,,,,,,R',
    'R,,,,Y,,,,,,~~~~,,,,,==,,,,,,R',
    'R,,,YYY,,,,~~~~~~,,,,==,,,,,,R',
    'R,,,,Y,,,,,,~~~~,,,,==,,,,,,,R',
    'R,,,,,,,,,,,,,,,,,,==,,,,R,,,R',
    'R,,,,,,,,,,,,,,,,,==,,,,RRR,,R',
    'R,,,,,,R,,,,,,,,,==,,,,,,R,,,R',
    'R,,,,,,,,,,,,,,,==,,,,,,,,,,,R',
    'R,,,,,,,,,,,,,,==,,,,,,,,,,,,R',
    'R,,YY,,,,,,,,,==,,,,,,,,YY,,,R',
    'R,,YY,,,,,,,,,==,,,,,,,,YY,,,R',
    'R,,,,,,,,,,,,,==,,,,,,,,,,,,,R',
    'RR,,,,,R,,,,,,==,,,,,R,,,,,,RR',
    'RRR,,,,,,,,,,,==,,,,,,,,,,,RRR',
    'RRRR,,,,,,,,,,==,,",,,,,,,RRRR',
    'RRRRR,,,,,,,,,==,,,,,,,,,RRRRR',
    'RRRRRR,,,,,,,,==,,,,,,,,RRRRRR',
    'RRRRRRRRRRRRRR22RRRRRRRRRRRRRR',
  ],
} satisfies ZoneDef;
