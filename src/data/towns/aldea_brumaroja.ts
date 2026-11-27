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
    '8': { to: 'w_-1_0', arrive: '4', label: 'Hacia las tierras del oeste' },
    '9': { to: 'w_1_0', arrive: '3', label: 'Hacia las tierras del este' },
    '1': { to: 'bosque_sombrio', arrive: '1', label: 'Hacia el Bosque Sombrío' },
    '2': { to: 'paso_gris', arrive: '1', label: 'Camino a Puerto Ceniza' },
    '3': { to: 'aldea_casa_alcalde', arrive: '1', label: 'Casa del alcalde', tile: 'puerta', door: true },
    '4': { to: 'aldea_capilla', arrive: '1', label: 'Capilla', tile: 'puerta', door: true },
    '5': { to: 'aldea_herreria', arrive: '1', label: 'Herrería', tile: 'puerta', door: true },
    '6': { to: 'aldea_tienda', arrive: '1', label: 'Tienda', tile: 'puerta', door: true },
    '7': { to: 'aldea_taberna', arrive: '1', label: 'Taberna La Jarra Roja', tile: 'puerta', door: true },
  },
  map: [
    'TTTTTTTTTTTTT11TTTTTTTTTTTTTTT',
    'TT,,,,"",,,,,==,,,,,,,,,,,T,TT',
    'T,,MMMMMM,,,,==,,,,,NNNNNNN,,T',
    'T,,MMMMMM,,,,==,,,,,NNNNNNN,,T',
    'T,,WWW3WW,s,,==,,l,,WWW4WWW,,T',
    '8,,,,,=,,,,,,==,,,,,,,,=,,,,,9',
    '8,,,,,=======pp=========,,,,,9',
    'T,"",,,,,,,pppppppp,,,,,,"",,T',
    'T,,,,,,,,,,pppppppp,,,,,,,,,,T',
    'T,MMMMM,,,,pppwpppp,,,,MMMMM,T',
    'T,MMMMM,l,,pppppppp,,l,MMMMM,T',
    'T,WW5WW===pppppppppp===WW6WW,T',
    'T,,,,,,,,,pppppppppp,,,,,,,,,T',
    'T,,"",,,,,,,,pp,,,,,,,,,"",,,T',
    'T,,,,,,,,,,,,==,,,,,,,,,,,,,,T',
    'T,,ffffff,,,,==,,,,NNNNNNNN,,T',
    'T,,f,,,,f,,,,==,,,,NNNNNNNN,,T',
    'T,,f"",,f,,,,==,,,,NNNNNNNN,,T',
    'T,,f,,"",,,,,==,,,,WWWW7WWW,,T',
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
    'TTTTTTTTTTTTT22TTTTTTTTTTTTTTT',
  ],
} satisfies ZoneDef;
