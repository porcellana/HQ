/** Materiales: botín de monstruos y minería. Se venden o se usarán para fabricar. */
import type { ItemDef } from '../schema';

const m = (id: string, name: string, level: number, value: number, shape: string, color: string, description: string): ItemDef => ({
  id, name, kind: 'material', level, value, stackable: true, maxStack: 50, plain: true, icon: { shape, color }, description,
});

export default [
  m('colmillo_goblin', 'Colmillo de goblin', 1, 2, 'colmillo', '#e8e0c8', 'Los alquimistas pagan algo por ellos.'),
  m('piel_lobo', 'Piel de lobo', 2, 6, 'piel', '#8a8a92', 'Gruesa y cálida.'),
  m('cola_rata', 'Cola de rata', 1, 1, 'colmillo', '#d08080', 'Asquerosa. Casi sin valor.'),
  m('seda_arana', 'Seda de araña', 3, 10, 'seda', '#e8e8f0', 'Resistente como el acero.'),
  m('glandula_veneno', 'Glándula de veneno', 3, 14, 'gema', '#7ac040', 'Base de antídotos.'),
  m('polvo_hueso', 'Polvo de hueso', 3, 8, 'polvo', '#d8d0bc', 'Usado en rituales.'),
  m('mineral_hierro', 'Mineral de hierro', 1, 5, 'mineral', '#9a7a6a', 'Para el herrero.'),
  m('mineral_plata', 'Mineral de plata', 4, 15, 'mineral', '#d8e0f0', 'Brilla en la oscuridad.'),
  m('gema_bruta', 'Gema en bruto', 5, 40, 'gema', '#d04080', 'Vale una fortuna tallada.'),
] satisfies ItemDef[];
