/**
 * Interiores de la Aldea de Brumaroja. Leyenda extra de interiores:
 *   ':' suelo de madera  'r' alfombra  'K' mostrador  'O' mesa  'X' barril
 *   'E' estantería  'A' altar  'H' chimenea  'Z' cama  'U' yunque
 * '@' en un templo = punto donde reapareces al caer.
 */
import { interior } from '../helpers';

export default [
  interior('aldea_casa_alcalde', 'Casa del alcalde', 'aldea_brumaroja', '3', [
    '###########',
    '#EEE:::HHH#',
    '#:::::::::#',
    '#::OO:::Z:#',
    '#::OO:::Z:#',
    '#r:::::::r#',
    '#:::rrr:::#',
    '#####1#####',
  ]),
  interior('aldea_capilla', 'Capilla de la Llama Blanca', 'aldea_brumaroja', '4', [
    '###########',
    '#E:::A:::E#',
    '#:::::::::#',
    '#::::@::::#',
    '#:OO:r:OO:#',
    '#:OO:r:OO:#',
    '#::::r::::#',
    '#####1#####',
  ], { spawnTile: 'alfombra' }),
  interior('aldea_herreria', 'Herrería de Brumaroja', 'aldea_brumaroja', '5', [
    '###########',
    '#HH::::EEE#',
    '#::::U::::#',
    '#KKKKK::::#',
    '#:::::::X:#',
    '#:::::::X:#',
    '#:::::::::#',
    '#####1#####',
  ], { exitTile: 'suelo', spawnTile: 'suelo' }),
  interior('aldea_tienda', 'Tienda de ultramarinos', 'aldea_brumaroja', '6', [
    '###########',
    '#EEEEEEEEE#',
    '#:::::::::#',
    '#KKKKKK:::#',
    '#::::::::X#',
    '#X:::::::X#',
    '#:::rrr:::#',
    '#####1#####',
  ]),
  interior('aldea_taberna', 'Taberna La Jarra Roja', 'aldea_brumaroja', '7', [
    '#############',
    '#XX::HHH::ZZ#',
    '#:::::::::::#',
    '#KKKK:::::::#',
    '#:::::OO::OO#',
    '#:OO::OO::OO#',
    '#:OO:::::r::#',
    '#::::rrrrr::#',
    '######1######',
  ]),
];
