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
    '4': { to: 'w_-1_1', arrive: '4', label: 'Hacia las tierras del oeste' },
    '5': { to: 'w_1_1', arrive: '3', label: 'Hacia las tierras del este' },
    '1': { to: 'aldea_brumaroja', arrive: '2', label: 'A la Aldea de Brumaroja' },
    '2': { to: 'puerto_ceniza', arrive: '1', label: 'A Puerto Ceniza' },
    '3': { to: 'galerias_seda', arrive: '1', label: 'Galerías de Seda', tile: 'cueva' },
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
  // Vetas de mineral al aire libre (vuelven a crecer con el tiempo).
  features: [
    { kind: 'mineral', x: 7, y: 5, ore: 'hierro' },
    { kind: 'mineral', x: 26, y: 14, ore: 'hierro' },
    { kind: 'mineral', x: 7, y: 16, ore: 'plata' },
  ],
  map: [
    'RRRRRRRRRRRRR11RRRRRRRRRRRRRRR',
    'R,,,,,,,,,,,,==,,,,,,,,,,,,,,R',
    'R,,,,,,,,,,,,==,,,,,,,,,,,,,,R',
    'R,,,,,,,,,,,,,==,,,,,,,,,,,,,R',
    'R,,YY,,,,,,,,,,==,,,,,YY,,,,,R',
    'R,,YY,,R,,,,,,,,==,,,,YY,,,,,R',
    'R,,,,,,,,,,,,,,,,==,,,,,,,R,,R',
    'R,,,,,,,,RR,,,,,,,==,,,,,,,,,R',
    '4,,,"",,,RR,,,,,,,,==,,,,,,,,5',
    '4,,,,,,,,,,,,,,,,,,,==,,,,,,,5',
    'R,,,,,,,,,,,,,,,,,,,,==,,,,,,R',
    'R,,,,Y,,,,,,~~~~,,,,,==,,,,,,R',
    'R,,,YYY,,,,~~~~~~,,,,==,,,,,,R',
    'R,,,,Y,,,,,,~~~~,,,,==,,,,,,,R',
    'R,,,,,,,,,,,,,,,,,,==,,,,3,,,R',
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
