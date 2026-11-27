/**
 * Bosque Sombrío: primera zona salvaje, al norte de la aldea.
 * En el Hito 3 tendrá encuentros aleatorios; en el Hito 6, la entrada a la cueva.
 */
import type { ZoneDef } from '../schema';

export default {
  id: 'bosque_sombrio',
  name: 'Bosque Sombrío',
  kind: 'wild',
  level: 2,
  darkness: 0.18,
  description: 'Los árboles susurran. Algo se mueve entre las sombras.',
  encounters: {
    initial: 4,
    perStepChance: 0.04,
    maxActive: 8,
    minDistance: 7,
    groups: [
      { enemy: 'rata_gigante', weight: 3, min: 1, max: 3 },
      { enemy: 'goblin', weight: 4, min: 1, max: 3 },
      { enemy: 'goblin_arquero', weight: 2, min: 1, max: 1 },
      { enemy: 'lobo', weight: 2, min: 1, max: 2 },
      { enemy: 'goblin_chaman', weight: 1, min: 1, max: 1 },
      { enemy: 'arana_gigante', weight: 1, min: 1, max: 1 },
    ],
  },
  exits: {
    '3': { to: 'w_-1_-1', arrive: '4', label: 'Hacia las tierras del oeste' },
    '4': { to: 'w_1_-1', arrive: '3', label: 'Hacia las tierras del este' },
    '5': { to: 'w_0_-2', arrive: '2', label: 'Hacia las tierras del norte' },
    '1': { to: 'aldea_brumaroja', arrive: '1', label: 'Volver a la aldea' },
    '2': { to: 'cueva_goblin', arrive: '1', label: 'Cueva de los Colmillos', tile: 'cueva' },
  },
  // Vetas de mineral al aire libre (vuelven a crecer con el tiempo).
  features: [
    { kind: 'mineral', x: 22, y: 17, ore: 'hierro' },
    { kind: 'mineral', x: 13, y: 19, ore: 'hierro' },
  ],
  map: [
    'YYYYYYYYYYY55YYYYYYYYYYYYYYYYY',
    'YYYYYYYYYYY,,YYYYYYYYYYRRRYYYY',
    'YYYYYYYYYY,,,YYYYYYYYYR2RYYYYY',
    'YYYYYYYYY,,,,,,YYYYYYY,=,YYYYY',
    'YYYYYYYY,,"",,,,,YYYY,,=,,YYYY',
    'YYYYYYY,,,,,,,,,,,,,,,,=,,,,,4',
    'YYYYYY,,,,,===========,=,,,,,4',
    'YYYYYY,,,,,=,,,,,,,,,===,,,YYY',
    '3,,,,,,,,,,=,,,,B,,,,,,,,,,YYY',
    '3,,,,,~~~~,=,,,,,,,,,,,,,,YYYY',
    'YYYY,~~~~~~=,,,,,,,,,,,,,YYYYY',
    'YYYY,~~~~~~b,,,YYYY,,,,,YYYYYY',
    'YYYY,,~~~~,=,,YYYYYYY,,,,YYYYY',
    'YYYYY,,,,,,=,,YYYYYYYY,,,,YYYY',
    'YYYYYYY,,,,=,,,YYYYYY,,"",YYYY',
    'YYYYYYYYY,,=,,,,,,,,,,,,,,YYYY',
    'YYYYYYYYY,,========,,,,,,YYYYY',
    'YYYYYYYYY,,,,,,,,,=,,,R,,YYYYY',
    'YYYYYYYYYY,,,,,,,,=,,,,,YYYYYY',
    'YYYYYYYYYYY,,R,,,,=,,,,YYYYYYY',
    'YYYYYYYYYYYY,,,,,,=,,,YYYYYYYY',
    'YYYYYYYYYYYYY,,,,,=,,YYYYYYYYY',
    'YYYYYYYYYYYYYY,,,,=,,YYYYYYYYY',
    'YYYYYYYYYYYYYY,,,==,,YYYYYYYYY',
    'YYYYYYYYYYYYYY,,,=,,,YYYYYYYYY',
    'YYYYYYYYYYYYYY,,,=,,YYYYYYYYYY',
    'YYYYYYYYYYYYYYY,,=,YYYYYYYYYYY',
    'YYYYYYYYYYYYYYY,,=,YYYYYYYYYYY',
    'YYYYYYYYYYYYYYY,,==YYYYYYYYYYY',
    'YYYYYYYYYYYYYYYYY11YYYYYYYYYYY',
  ],
} satisfies ZoneDef;
