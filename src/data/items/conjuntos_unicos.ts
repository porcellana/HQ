/** Piezas de conjunto (data/sets) y únicos de jefe (siempre legendarios). */
import type { BonusStat, ItemDef, ItemSlot } from '../schema';

const P = (set: string, id: string, name: string, slot: ItemSlot, lv: number, value: number, shape: string, color: string, ac: number, stats: Partial<Record<BonusStat, number>>, classes: string[], maxDex?: number): ItemDef => ({
  id, name, kind: 'armadura', slot, level: lv, value, icon: { shape, color }, armor: { ac, ...(maxDex !== undefined ? { maxDex } : {}) }, stats, classes, set, reqLevel: lv - 1,
});
const U = (d: Omit<ItemDef, 'kind' | 'unique'> & { kind: ItemDef['kind'] }): ItemDef => ({ ...d, unique: true, reqLevel: Math.max(1, d.level - 2) });

export default [
  // Bastión del Alba (guerrero)
  P('alba', 'casco_alba', 'Yelmo del Alba', 'cabeza', 7, 160, 'casco', '#f0d890', 2, { FUE: 1 }, ['guerrero']),
  P('alba', 'coraza_alba', 'Coraza del Alba', 'pecho', 7, 260, 'pecho', '#f0d890', 6, {}, ['guerrero'], 2),
  P('alba', 'grebas_alba', 'Grebas del Alba', 'piernas', 7, 150, 'piernas', '#f0d890', 2, { CON: 1 }, ['guerrero']),
  P('alba', 'botas_alba', 'Botas del Alba', 'pies', 7, 130, 'botas', '#f0d890', 1, { pv: 5 }, ['guerrero']),
  // Sombra de Ónix (pícaro)
  P('onix', 'capucha_onix', 'Capucha de Ónix', 'cabeza', 7, 160, 'capucha', '#30304a', 0, { DES: 1 }, ['picaro']),
  P('onix', 'jubon_onix', 'Jubón de Ónix', 'pecho', 7, 250, 'pecho', '#30304a', 4, { DES: 1 }, ['picaro'], 5),
  P('onix', 'guantes_onix', 'Guantes de Ónix', 'manos', 7, 140, 'guantes', '#30304a', 0, { ataque: 1 }, ['picaro']),
  P('onix', 'botas_onix', 'Botas de Ónix', 'pies', 7, 130, 'botas', '#30304a', 0, { DES: 1 }, ['picaro']),
  // Vestiduras del Cometa (mago)
  P('cometa', 'sombrero_cometa', 'Sombrero del Cometa', 'cabeza', 7, 160, 'capucha', '#7060e0', 0, { INT: 1, recurso: 3 }, ['mago']),
  P('cometa', 'tunica_cometa', 'Túnica del Cometa', 'pecho', 7, 260, 'pecho', '#7060e0', 1, { INT: 1, recurso: 5 }, ['mago']),
  P('cometa', 'guantes_cometa', 'Guantes del Cometa', 'manos', 7, 140, 'guantes', '#7060e0', 0, { recurso: 4 }, ['mago']),
  P('cometa', 'faldon_cometa', 'Faldón del Cometa', 'piernas', 7, 150, 'piernas', '#7060e0', 0, { INT: 1 }, ['mago']),
  // Vigilia Solar (clérigo)
  P('vigilia', 'mitra_vigilia', 'Mitra de la Vigilia', 'cabeza', 7, 160, 'casco', '#ffe890', 1, { SAB: 1 }, ['clerigo']),
  P('vigilia', 'vestidura_vigilia', 'Vestidura de la Vigilia', 'pecho', 7, 260, 'pecho', '#ffe890', 3, { SAB: 1, recurso: 3 }, ['clerigo'], 3),
  P('vigilia', 'manoplas_vigilia', 'Manoplas de la Vigilia', 'manos', 7, 140, 'guantes', '#ffe890', 1, { pv: 5 }, ['clerigo']),
  P('vigilia', 'botas_vigilia', 'Botas de la Vigilia', 'pies', 7, 130, 'botas', '#ffe890', 1, { SAB: 1 }, ['clerigo']),

  // Únicos de jefe
  U({ id: 'machete_grunaz', name: 'Machete de Gruñaz', kind: 'arma', slot: 'arma', level: 4, value: 140, icon: { shape: 'hacha', color: '#6aa040' },
    weapon: { type: 'hacha', dice: '1d10', stat: 'FUE', damageType: 'cortante', range: 1 }, stats: { FUE: 1, daño: 1 }, description: 'Botín del Rey Goblin. Aún huele a humo.' }),
  U({ id: 'colmillo_rey', name: 'Colmillo del Rey', kind: 'accesorio', slot: 'accesorio', level: 4, value: 130, icon: { shape: 'amuleto', color: '#e8e0c8' },
    stats: { CON: 1, pv: 6 }, description: 'Un colmillo enorme engarzado en oro sucio.' }),
  U({ id: 'aguijon_morgala', name: 'Aguijón de Mórgala', kind: 'arma', slot: 'arma', level: 7, value: 330, icon: { shape: 'daga', color: '#a030c0' },
    weapon: { type: 'daga', dice: '1d8', stat: 'DES', damageType: 'veneno', range: 1, critRange: 18 }, stats: { DES: 2 }, description: 'Gotea veneno aunque esté limpia.' }),
  U({ id: 'manto_morgala', name: 'Manto de seda de Mórgala', kind: 'armadura', slot: 'pecho', level: 7, value: 320, icon: { shape: 'pecho', color: '#d8b050' },
    armor: { ac: 4, maxDex: 4 }, stats: { DES: 1, pv: 8 }, description: 'Ligero, resistente y pegajoso al tacto.' }),
  U({ id: 'baston_velkar', name: 'Bastón de Velkar', kind: 'arma', slot: 'arma', level: 10, value: 600, icon: { shape: 'baston', color: '#8a30d0' },
    weapon: { type: 'baston', dice: '2d6', stat: 'INT', damageType: 'necrotico', range: 5, twoHanded: true }, stats: { INT: 2, recurso: 8 }, description: 'Susurra nombres de los muertos.' }),
  U({ id: 'anillo_nigromante', name: 'Anillo del Nigromante', kind: 'accesorio', slot: 'accesorio', level: 10, value: 580, icon: { shape: 'anillo', color: '#6a2a9a' },
    stats: { INT: 1, SAB: 1, pv: 10 }, description: 'Frío como una lápida.' }),
  // Únicos de jefes generados
  U({ id: 'hoja_eco', name: 'Hoja del Último Eco', kind: 'arma', slot: 'arma', level: 8, value: 450, icon: { shape: 'espada', color: '#80ffe0' },
    weapon: { type: 'espada', dice: '1d10', stat: 'FUE', damageType: 'arcano', range: 1 }, stats: { FUE: 1, ataque: 2 }, description: 'Se oye un eco cada vez que golpea.' }),
  U({ id: 'escudo_vigia', name: 'Escudo del Vigía Eterno', kind: 'secundaria', slot: 'secundaria', level: 8, value: 430, icon: { shape: 'escudo', color: '#c0a060' },
    armor: { ac: 3 }, stats: { CON: 1, pv: 10 }, description: 'Nunca ha cedido ante nada.' }),
  U({ id: 'arco_cazador_noche', name: 'Arco del Cazador de la Noche', kind: 'arma', slot: 'arma', level: 9, value: 480, icon: { shape: 'arco', color: '#3040a0' },
    weapon: { type: 'arco', dice: '1d10', stat: 'DES', damageType: 'perforante', range: 8, twoHanded: true, critRange: 19 }, stats: { DES: 2 }, description: 'La cuerda no suena.' }),
  U({ id: 'cetro_aurora', name: 'Cetro de la Aurora', kind: 'arma', slot: 'arma', level: 9, value: 470, icon: { shape: 'varita', color: '#ffe080' },
    weapon: { type: 'maza', dice: '1d10', stat: 'SAB', damageType: 'sagrado', range: 1 }, stats: { SAB: 2, recurso: 6 }, description: 'Calienta incluso en las criptas.' }),
  U({ id: 'diadema_olvido', name: 'Diadema del Olvido', kind: 'armadura', slot: 'cabeza', level: 11, value: 620, icon: { shape: 'capucha', color: '#a080ff' },
    armor: { ac: 1 }, stats: { INT: 2, recurso: 10 }, description: 'Quien la lleva recuerda lo que nadie sabe.' }),
  U({ id: 'amuleto_abismo', name: 'Corazón del Abismo', kind: 'accesorio', slot: 'accesorio', level: 12, value: 800, icon: { shape: 'amuleto', color: '#5020a0' },
    stats: { FUE: 1, DES: 1, CON: 1, ataque: 1 }, description: 'Late al ritmo de las profundidades.' }),
] satisfies ItemDef[];
