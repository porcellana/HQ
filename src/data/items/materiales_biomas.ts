/** Materiales de los biomas del mundo procedural (v0.8). */
import type { ItemDef } from '../schema';

const m = (id: string, name: string, level: number, value: number, shape: string, color: string, description: string): ItemDef => ({
  id, name, kind: 'material', level, value, stackable: true, maxStack: 50, plain: true, icon: { shape, color }, description,
});

export default [
  m('cristal_hielo', 'Cristal de hielo', 3, 18, 'gema', '#a8e0ff', 'No se derrite nunca.'),
  m('ambar_desierto', 'Ámbar del desierto', 3, 16, 'gema', '#e8a830', 'Guarda un insecto de otra era.'),
  m('perla_costa', 'Perla de la costa', 3, 22, 'gema', '#f0ece8', 'Redonda y perfecta.'),
  m('resina_cieno', 'Resina de cieno', 2, 8, 'polvo', '#6a8a3a', 'Pegajosa y maloliente.'),
  m('pieza_roca', 'Cristal de roca', 3, 14, 'mineral', '#c8c8e0', 'Brota entre las grietas de la montaña.'),
  m('hierba_pradera', 'Hierba curativa', 1, 4, 'polvo', '#60c060', 'Los herbolarios la pagan bien.'),
] satisfies ItemDef[];
