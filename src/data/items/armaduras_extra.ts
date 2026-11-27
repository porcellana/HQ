/** Armaduras, escudos y mano secundaria adicionales (v0.9.4). */
import type { BonusStat, ItemDef, ItemSlot } from '../schema';

const A = (id: string, name: string, slot: ItemSlot, lv: number, value: number, shape: string, color: string, ac: number, extra: { maxDex?: number; stats?: Partial<Record<BonusStat, number>>; classes?: string[]; desc?: string } = {}): ItemDef => ({
  id, name, kind: slot === 'secundaria' ? 'secundaria' : 'armadura', slot, level: lv, value, icon: { shape, color }, armor: { ac, ...(extra.maxDex !== undefined ? { maxDex: extra.maxDex } : {}) },
  ...(extra.stats ? { stats: extra.stats } : {}), ...(extra.classes ? { classes: extra.classes } : {}), ...(lv >= 6 ? { reqLevel: lv - 2 } : {}), ...(extra.desc ? { description: extra.desc } : {}),
});
const S = (id: string, name: string, lv: number, value: number, shape: string, color: string, stats: Partial<Record<BonusStat, number>>, classes?: string[], ac?: number): ItemDef => ({
  id, name, kind: 'secundaria', slot: 'secundaria', level: lv, value, icon: { shape, color }, stats, ...(ac ? { armor: { ac } } : {}),
  ...(classes ? { classes } : {}), ...(lv >= 6 ? { reqLevel: lv - 2 } : {}),
});
const G = ['guerrero'], P = ['picaro'], M = ['mago'], C = ['clerigo'];

export default [
  // Cabeza
  A('sombrero_mago', 'Sombrero de mago', 'cabeza', 2, 25, 'capucha', '#5a2f8a', 0, { stats: { INT: 1, recurso: 2 } }),
  A('casco_cuernos', 'Casco con cuernos', 'cabeza', 5, 70, 'casco', '#c8b890', 1, { stats: { FUE: 1 }, classes: G }),
  A('capucha_sombras', 'Capucha de sombras', 'cabeza', 6, 90, 'capucha', '#2a2a3a', 0, { stats: { DES: 2 }, classes: P }),
  A('diadema_sabio', 'Diadema del sabio', 'cabeza', 8, 160, 'capucha', '#a080ff', 0, { stats: { INT: 2, recurso: 5 }, classes: M }),
  A('mitra_sagrada', 'Mitra sagrada', 'cabeza', 8, 160, 'casco', '#f0e0a0', 1, { stats: { SAB: 2 }, classes: C }),
  A('yelmo_placas', 'Yelmo de placas', 'cabeza', 10, 260, 'casco', '#e0e8f4', 2, { stats: { CON: 1 } }),
  A('corona_hierro', 'Corona de hierro', 'cabeza', 14, 520, 'casco', '#c8a050', 2, { stats: { CAR: 2, CON: 1 } }),
  // Pecho
  A('jubon_acolchado', 'Jubón acolchado', 'pecho', 2, 20, 'pecho', '#a08060', 1),
  A('camisote_malla', 'Camisote de malla', 'pecho', 4, 85, 'pecho', '#a8aeb8', 4, { maxDex: 2 }),
  A('cuero_sombrio', 'Cuero sombrío', 'pecho', 6, 120, 'pecho', '#3a3040', 3, { maxDex: 4, stats: { DES: 1 }, classes: P }),
  A('tunica_astral', 'Túnica astral', 'pecho', 7, 150, 'pecho', '#6a40c0', 1, { stats: { INT: 2, recurso: 6 }, classes: M }),
  A('vestidura_luz', 'Vestidura de luz', 'pecho', 7, 150, 'pecho', '#f0e8b0', 2, { stats: { SAB: 2, recurso: 4 }, classes: C }),
  A('malla_acero', 'Malla de acero', 'pecho', 8, 240, 'pecho', '#c8d0dc', 6, { maxDex: 2, classes: G }),
  A('placas_completas', 'Placas completas', 'pecho', 12, 520, 'pecho', '#f0f4ff', 8, { maxDex: 0, classes: G }),
  A('coraza_dragon', 'Coraza de dragón', 'pecho', 15, 950, 'pecho', '#ff6040', 8, { maxDex: 1, stats: { CON: 2 } }),
  A('manto_archimago', 'Manto de archimago', 'pecho', 14, 800, 'pecho', '#9060f0', 2, { stats: { INT: 3, recurso: 12 }, classes: M }),
  A('sudario_umbra', 'Sudario de umbra', 'pecho', 16, 950, 'pecho', '#202030', 5, { maxDex: 5, stats: { DES: 3 }, classes: P }),
  // Manos
  A('guantes_malla', 'Guantes de malla', 'manos', 3, 30, 'guantes', '#a8aeb8', 1),
  A('guantes_ladron', 'Guantes de ladrón', 'manos', 5, 70, 'guantes', '#3a3040', 0, { stats: { DES: 1, ataque: 1 }, classes: P }),
  A('manoplas_acero', 'Manoplas de acero', 'manos', 8, 150, 'guantes', '#d0d8e8', 2, { stats: { FUE: 1 } }),
  A('guantes_arcanos', 'Guantes arcanos', 'manos', 8, 150, 'guantes', '#8060d0', 0, { stats: { INT: 1, recurso: 4 }, classes: M }),
  A('manoplas_fe', 'Manoplas de la fe', 'manos', 10, 230, 'guantes', '#ffe8a0', 1, { stats: { SAB: 1, pv: 5 }, classes: C }),
  // Piernas
  A('pantalon_malla', 'Pantalón de malla', 'piernas', 4, 45, 'piernas', '#a8aeb8', 1),
  A('calzas_ligeras', 'Calzas ligeras', 'piernas', 6, 80, 'piernas', '#5a4a6a', 0, { stats: { DES: 1, pv: 4 } }),
  A('musleras_acero', 'Musleras de acero', 'piernas', 9, 190, 'piernas', '#d0d8e8', 2, { stats: { CON: 1 } }),
  A('faldon_arcano', 'Faldón arcano', 'piernas', 9, 190, 'piernas', '#7050c0', 0, { stats: { INT: 1, recurso: 5 }, classes: M }),
  // Pies
  A('botas_viaje', 'Botas de viaje', 'pies', 3, 30, 'botas', '#8a6a4a', 0, { stats: { pv: 4 } }),
  A('botas_silenciosas', 'Botas silenciosas', 'pies', 6, 100, 'botas', '#3a3040', 0, { stats: { DES: 2 }, classes: P }),
  A('botas_acero', 'Botas de acero', 'pies', 8, 150, 'botas', '#d0d8e8', 2),
  A('botas_viento', 'Botas del viento', 'pies', 12, 360, 'botas', '#a0e8ff', 1, { stats: { DES: 2, pv: 8 } }),
  // Escudos y manos secundarias
  S('rodela', 'Rodela', 3, 30, 'escudo', '#a07040', {}, undefined, 1),
  S('escudo_torre', 'Escudo torre', 7, 140, 'escudo', '#c8d0dc', { FUE: 1 }, ['guerrero'], 3),
  S('escudo_sagrado', 'Escudo sagrado', 8, 170, 'escudo', '#f0e0a0', { SAB: 1, pv: 5 }, ['clerigo'], 2),
  S('broquel_acero', 'Broquel de acero', 6, 95, 'escudo', '#d8e0f0', { DES: 1 }, ['picaro', 'guerrero'], 2),
  S('escudo_drac', 'Escudo de dragón', 14, 620, 'escudo', '#ff7040', { CON: 2 }, ['guerrero', 'clerigo'], 4),
  S('grimorio_ignis', 'Grimorio de Ignis', 6, 130, 'libro', '#d04020', { INT: 1, recurso: 5 }, ['mago']),
  S('grimorio_abismo', 'Grimorio del abismo', 13, 600, 'libro', '#6020a0', { INT: 2, recurso: 10 }, ['mago']),
  S('orbe_cristal', 'Orbe de cristal', 9, 210, 'gema', '#80e0ff', { INT: 1, recurso: 8 }, ['mago']),
  S('libro_oraciones', 'Libro de oraciones', 5, 80, 'libro', '#f0e0a0', { SAB: 1, recurso: 4 }, ['clerigo']),
  S('simbolo_dorado', 'Símbolo dorado', 9, 220, 'simbolo', '#ffd860', { SAB: 2, pv: 6 }, ['clerigo']),
  S('daga_secundaria', 'Daga de parada', 5, 70, 'daga', '#b8bec8', { DES: 1, ataque: 1 }, ['picaro']),
].map((d) => (['coraza_dragon', 'escudo_drac', 'espada_dragon'].includes(d.id) ? { ...d, set: 'dragon' } : d)) satisfies ItemDef[];
