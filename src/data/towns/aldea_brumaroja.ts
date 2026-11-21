/**
 * Aldea de Brumaroja: pueblo inicial.
 * Mapa ASCII: consulta src/data/config/tiles.ts para el significado de cada carácter.
 * Todas las filas deben tener el mismo ancho (hay un test que lo comprueba).
 */
import type { ZoneDef } from '../schema';

export default {
  id: 'aldea_brumaroja',
  name: 'Aldea de Brumaroja',
  kind: 'town',
  level: 1,
  description: 'Una aldea humilde envuelta en niebla rojiza. Aquí empieza tu historia.',
  exits: {
    '1': { to: 'bosque_sombrio', arrive: '1', label: 'Hacia el Bosque Sombrío' },
  },
  map: [
    'TTTTTTTTTTTTT11TTTTTTTTTTTTTTT',
    'TT,,,,"",,,,,==,,,,,,,,,,,T,TT',
    'T,,MMMMMM,,,,==,,,,,NNNNNNN,,T',
    'T,,MMMMMM,,,,==,,,,,NNNNNNN,,T',
    'T,,WWW+WW,s,,==,,l,,WWW+WWW,,T',
    'T,,,,,=,,,,,,==,,,,,,,,=,,,,,T',
    'T,,,,,=======pp=========,,,,,T',
    'T,"",,,,,,,pppppppp,,,,,,"",,T',
    'T,,,,,,,,,,pppppppp,,,,,,,,,,T',
    'T,MMMMM,,,,pppwpppp,,,,MMMMM,T',
    'T,MMMMM,l,,pppppppp,,l,MMMMM,T',
    'T,WW+WW===pppppppppp===WW+WW,T',
    'T,,,,,,,,,pppppppppp,,,,,,,,,T',
    'T,,"",,,,,,,,pp,,,,,,,,,"",,,T',
    'T,,,,,,,,,,,,==,,,,,,,,,,,,,,T',
    'T,,ffffff,,,,==,,,,NNNNNNNN,,T',
    'T,,f,,,,f,,,,==,,,,NNNNNNNN,,T',
    'T,,f"",,f,,,,==,,,,NNNNNNNN,,T',
    'T,,f,,"",,,,,==,,,,WWWW+WWW,,T',
    'T,,ffffff,,,,==,,,,,,,,=,,,,,T',
    'T,,,,,,,,,,,,===========,,,,,T',
    'T,B,,,,,,,,,,==,,,,,,,,,,,,B,T',
    'T,,,,,,,,,,,,@=,,,,,,,,,,,,,,T',
    'T,,,,t,t,,,,,==,,,,,,,,,RR,,,T',
    'T,,,,,,,,,,,,==,,,,,,,,,,,,,,T',
    'T~~~~~~~~~~~~bb~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~bb~~~~~~~~~~~~~~T',
    'T,,,,,,,,,,,,==,,,,,,,,,,,,,,T',
    'TT,,,,B,,,,,,==,,,,,,B,,,,,,TT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
} satisfies ZoneDef;
