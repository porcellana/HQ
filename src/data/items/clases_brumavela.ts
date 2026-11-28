/** Equipo de las clases nuevas (v0.10): Bárbaro, Explorador, Druida y Bardo. */
import type { AbilityKey, BonusStat, DamageType, ItemDef, ItemSlot, WeaponType } from '../schema';

const weapon = (id: string, name: string, lv: number, value: number, shape: string, color: string, type: WeaponType, dice: string, stat: AbilityKey, dmg: DamageType, cls: string, extra: { range?: number; two?: boolean; crit?: number; stats?: Partial<Record<BonusStat, number>> } = {}): ItemDef => ({
  id, name, kind: 'arma', slot: 'arma', level: lv, value, icon: { shape, color },
  weapon: { type, dice, stat, damageType: dmg, range: extra.range ?? 1, ...(extra.two ? { twoHanded: true } : {}), ...(extra.crit ? { critRange: extra.crit } : {}) },
  classes: [cls], ...(lv >= 6 ? { reqLevel: lv - 2 } : {}), ...(extra.stats ? { stats: extra.stats } : {}),
});
const armor = (id: string, name: string, slot: ItemSlot, lv: number, value: number, shape: string, color: string, ac: number, cls: string, stats: Partial<Record<BonusStat, number>>, maxDex?: number): ItemDef => ({
  id, name, kind: 'armadura', slot, level: lv, value, icon: { shape, color }, armor: { ac, ...(maxDex !== undefined ? { maxDex } : {}) },
  classes: [cls], stats, ...(lv >= 6 ? { reqLevel: lv - 2 } : {}),
});

export default [
  // Bárbaro
  weapon('hacha_pedernal', 'Hacha de pedernal', 2, 22, 'hacha', '#a09a8a', 'hacha', '1d8', 'FUE', 'cortante', 'barbaro'),
  weapon('hacha_trueno', 'Hacha del trueno', 7, 170, 'hacha', '#80b0ff', 'hacha', '1d12', 'FUE', 'rayo', 'barbaro', { two: true }),
  weapon('hacha_sangrienta', 'Hacha sangrienta', 13, 560, 'hacha', '#d03030', 'hacha', '2d8', 'FUE', 'cortante', 'barbaro', { two: true, crit: 19 }),
  armor('casco_astado', 'Casco astado', 'cabeza', 3, 40, 'casco', '#c8b890', 1, 'barbaro', { FUE: 1 }),
  armor('pieles_oso', 'Pieles de oso', 'pecho', 4, 75, 'pecho', '#7a5a3a', 3, 'barbaro', { CON: 1 }, 3),
  armor('collar_colmillos', 'Armadura de colmillos', 'pecho', 10, 330, 'pecho', '#e8e0c8', 5, 'barbaro', { FUE: 2, CON: 1 }, 2),
  armor('botas_nomada', 'Botas del nómada', 'pies', 5, 60, 'botas', '#6a4a30', 1, 'barbaro', { CON: 1 }),
  armor('yelmo_gigante', 'Yelmo de gigante', 'cabeza', 12, 420, 'casco', '#9aa0b0', 3, 'barbaro', { FUE: 2, pv: 8 }),
  // Explorador
  weapon('arco_cazador_vv', 'Arco del cazador', 2, 30, 'arco', '#8a6a3a', 'arco', '1d8', 'DES', 'perforante', 'explorador', { range: 7, two: true }),
  weapon('arco_bosque', 'Arco del bosque', 7, 180, 'arco', '#60c070', 'arco', '1d10', 'DES', 'perforante', 'explorador', { range: 8, two: true }),
  weapon('arco_halcon', 'Arco del halcón', 13, 580, 'arco', '#f0d070', 'arco', '2d6', 'DES', 'perforante', 'explorador', { range: 9, two: true, crit: 19 }),
  armor('capa_hojas', 'Capa de hojas', 'pecho', 3, 50, 'pecho', '#4a7a3a', 2, 'explorador', { DES: 1 }, 4),
  armor('sombrero_ala', 'Sombrero de ala ancha', 'cabeza', 3, 35, 'capucha', '#7a5a32', 0, 'explorador', { SAB: 1 }),
  armor('botas_senda', 'Botas de sendero', 'pies', 5, 70, 'botas', '#5a4a32', 1, 'explorador', { DES: 1 }),
  armor('jubon_cazador', 'Jubón del cazador', 'pecho', 9, 260, 'pecho', '#3a5a3a', 4, 'explorador', { DES: 2, SAB: 1 }, 4),
  armor('capucha_halcon', 'Capucha de halcón', 'cabeza', 11, 340, 'capucha', '#2a4a3a', 1, 'explorador', { DES: 2 }),
  // Druida
  weapon('cayado_roble', 'Cayado de roble', 2, 24, 'baston', '#8a6a3a', 'baston', '1d6', 'SAB', 'contundente', 'druida', { two: true, stats: { recurso: 2 } }),
  weapon('cayado_savia', 'Cayado de savia', 7, 175, 'baston', '#70d070', 'baston', '1d8', 'SAB', 'contundente', 'druida', { two: true, stats: { SAB: 1, recurso: 5 } }),
  weapon('cayado_tormenta', 'Cayado de la tormenta', 13, 570, 'baston', '#80c0ff', 'baston', '2d6', 'SAB', 'rayo', 'druida', { two: true, stats: { SAB: 2, recurso: 8 } }),
  armor('corona_hojas', 'Corona de hojas', 'cabeza', 3, 40, 'capucha', '#5aa04a', 0, 'druida', { SAB: 1, recurso: 2 }),
  armor('vestido_corteza', 'Vestidura de corteza', 'pecho', 4, 70, 'pecho', '#7a5a3a', 3, 'druida', { CON: 1 }, 3),
  armor('manto_musgo', 'Manto de musgo', 'pecho', 9, 270, 'pecho', '#4a8a4a', 3, 'druida', { SAB: 2, recurso: 5 }, 3),
  armor('botas_raiz', 'Botas de raíz', 'pies', 6, 90, 'botas', '#6a5030', 1, 'druida', { CON: 1, SAB: 1 }),
  armor('diadema_ciervo', 'Diadema de ciervo', 'cabeza', 12, 400, 'capucha', '#d8d0a0', 1, 'druida', { SAB: 2, recurso: 6 }),
  // Bardo
  weapon('estoque_trovador', 'Estoque de trovador', 2, 30, 'espada', '#d8d0f0', 'espada', '1d8', 'DES', 'perforante', 'bardo'),
  weapon('espada_cancion', 'Espada de la canción', 7, 185, 'espada', '#f0a0e0', 'espada', '1d8', 'CAR', 'cortante', 'bardo', { stats: { CAR: 1, recurso: 4 } }),
  weapon('florete_maestro', 'Florete del maestro', 13, 590, 'espada', '#ffe080', 'espada', '2d6', 'CAR', 'perforante', 'bardo', { crit: 19, stats: { CAR: 2, recurso: 6 } }),
  armor('sombrero_pluma', 'Sombrero de pluma', 'cabeza', 3, 40, 'capucha', '#c0a040', 0, 'bardo', { CAR: 1 }),
  armor('jubon_juglar', 'Jubón de juglar', 'pecho', 4, 70, 'pecho', '#8a3a6a', 2, 'bardo', { CAR: 1 }, 4),
  armor('casaca_gala', 'Casaca de gala', 'pecho', 9, 280, 'pecho', '#a04a8a', 3, 'bardo', { CAR: 2, recurso: 4 }, 4),
  armor('botas_baile', 'Botas de baile', 'pies', 5, 65, 'botas', '#6a2a5a', 1, 'bardo', { DES: 1 }),
  armor('corona_laurel', 'Corona de laurel', 'cabeza', 12, 410, 'capucha', '#e0c050', 1, 'bardo', { CAR: 2, recurso: 6 }),
] satisfies ItemDef[];
