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
  exits: {
    '1': { to: 'aldea_brumaroja', arrive: '1', label: 'Volver a la aldea' },
    '2': { to: 'cueva_goblin', arrive: '1', label: 'Cueva de los Colmillos', tile: 'cueva' },
  },
  map: [
    'YYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYYYYYYYYYRRRYYYY',
    'YYYYYYYYYY,,,YYYYYYYYYR2RYYYYY',
    'YYYYYYYYY,,,,,,YYYYYYY,=,YYYYY',
    'YYYYYYYY,,"",,,,,YYYY,,=,,YYYY',
    'YYYYYYY,,,,,,,,,,,,,,,,=,,YYYY',
    'YYYYYY,,,,,===========,=,,,YYY',
    'YYYYYY,,,,,=,,,,,,,,,===,,,YYY',
    'YYYYY,,,,,,=,,,,B,,,,,,,,,,YYY',
    'YYYYY,~~~~,=,,,,,,,,,,,,,,YYYY',
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
