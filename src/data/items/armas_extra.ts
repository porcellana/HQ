/** Armas adicionales (v0.9.4) por clase y nivel. `classes`/`reqLevel` limitan quién las equipa. */
import type { DamageType, ItemDef, WeaponType, AbilityKey } from '../schema';

type W = { id: string; name: string; lv: number; value: number; shape: string; color: string; type: WeaponType; dice: string; stat: AbilityKey; dmg: DamageType; range?: number; two?: boolean; crit?: number; classes?: string[]; stats?: ItemDef['stats']; desc?: string };
const w = (o: W): ItemDef => ({
  id: o.id, name: o.name, kind: 'arma', slot: 'arma', level: o.lv, value: o.value, icon: { shape: o.shape, color: o.color },
  weapon: { type: o.type, dice: o.dice, stat: o.stat, damageType: o.dmg, range: o.range ?? 1, ...(o.two ? { twoHanded: true } : {}), ...(o.crit ? { critRange: o.crit } : {}) },
  ...(o.classes ? { classes: o.classes } : {}), ...(o.lv >= 6 ? { reqLevel: o.lv - 2 } : {}), ...(o.stats ? { stats: o.stats } : {}), ...(o.desc ? { description: o.desc } : {}),
});
const G = ['guerrero'], P = ['picaro'], M = ['mago'], C = ['clerigo'];

export default [
  // Guerrero: espadas, hachas y lanzas pesadas
  w({ id: 'lanza_cazador', name: 'Lanza de cazador', lv: 2, value: 18, shape: 'lanza', color: '#a0a8b4', type: 'baston', dice: '1d8', stat: 'FUE', dmg: 'perforante', two: true }),
  w({ id: 'espada_acero', name: 'Espada de acero', lv: 5, value: 70, shape: 'espada', color: '#d0d8e8', type: 'espada', dice: '1d10', stat: 'FUE', dmg: 'cortante', classes: G }),
  w({ id: 'lanza_guardia', name: 'Lanza de guardia', lv: 6, value: 85, shape: 'lanza', color: '#c8d0dc', type: 'baston', dice: '1d10', stat: 'FUE', dmg: 'perforante', two: true }),
  w({ id: 'hacha_berserker', name: 'Hacha berserker', lv: 8, value: 150, shape: 'hacha', color: '#d05040', type: 'hacha', dice: '2d6', stat: 'FUE', dmg: 'cortante', two: true, classes: G }),
  w({ id: 'alabarda', name: 'Alabarda', lv: 9, value: 190, shape: 'lanza', color: '#e0e8f4', type: 'baston', dice: '1d12', stat: 'FUE', dmg: 'cortante', two: true, classes: G }),
  w({ id: 'mandoble', name: 'Mandoble', lv: 11, value: 330, shape: 'espada', color: '#e8f0ff', type: 'espada', dice: '2d8', stat: 'FUE', dmg: 'cortante', two: true, classes: G }),
  w({ id: 'hacha_titan', name: 'Hacha de titán', lv: 14, value: 600, shape: 'hacha', color: '#ffd070', type: 'hacha', dice: '2d10', stat: 'FUE', dmg: 'cortante', two: true, classes: G }),
  w({ id: 'espada_dragon', name: 'Espada de escama de dragón', lv: 17, value: 1100, shape: 'espada', color: '#ff6040', type: 'espada', dice: '3d6', stat: 'FUE', dmg: 'fuego', classes: G }),
  // Pícaro: dagas, estoques y ballestas
  w({ id: 'punal_envenenado', name: 'Puñal envenenado', lv: 3, value: 40, shape: 'daga', color: '#60c040', type: 'daga', dice: '1d4', stat: 'DES', dmg: 'veneno', crit: 19, classes: P }),
  w({ id: 'ballesta_ligera', name: 'Ballesta ligera', lv: 3, value: 55, shape: 'ballesta', color: '#8a6a4a', type: 'arco', dice: '1d8', stat: 'DES', dmg: 'perforante', range: 6, two: true }),
  w({ id: 'kris', name: 'Kris ondulado', lv: 7, value: 130, shape: 'daga', color: '#d8d0f0', type: 'daga', dice: '1d6', stat: 'DES', dmg: 'cortante', crit: 18, classes: P }),
  w({ id: 'estoque_duelista', name: 'Estoque de duelista', lv: 8, value: 160, shape: 'espada', color: '#f0f0ff', type: 'espada', dice: '1d10', stat: 'DES', dmg: 'perforante', classes: P }),
  w({ id: 'ballesta_pesada', name: 'Ballesta pesada', lv: 9, value: 210, shape: 'ballesta', color: '#5a4a3a', type: 'arco', dice: '1d12', stat: 'DES', dmg: 'perforante', range: 7, two: true }),
  w({ id: 'arco_elfico', name: 'Arco élfico', lv: 11, value: 340, shape: 'arco', color: '#80e090', type: 'arco', dice: '2d6', stat: 'DES', dmg: 'perforante', range: 8, two: true }),
  w({ id: 'daga_asesino', name: 'Daga del asesino', lv: 13, value: 520, shape: 'daga', color: '#2a2a3a', type: 'daga', dice: '2d4', stat: 'DES', dmg: 'perforante', crit: 17, classes: P }),
  w({ id: 'arco_tormenta', name: 'Arco de la tormenta', lv: 16, value: 900, shape: 'arco', color: '#60b0ff', type: 'arco', dice: '2d8', stat: 'DES', dmg: 'rayo', range: 8, two: true }),
  // Mago: varitas y bastones (usan INT)
  w({ id: 'varita_chispas', name: 'Varita de chispas', lv: 1, value: 20, shape: 'varita', color: '#ffe060', type: 'baston', dice: '1d4', stat: 'INT', dmg: 'rayo', range: 4, stats: { recurso: 1 } }),
  w({ id: 'varita_escarcha', name: 'Varita de escarcha', lv: 4, value: 70, shape: 'varita', color: '#a0e0ff', type: 'baston', dice: '1d6', stat: 'INT', dmg: 'frio', range: 4, classes: M, stats: { recurso: 2 } }),
  w({ id: 'baston_cristal', name: 'Bastón de cristal', lv: 6, value: 110, shape: 'baston', color: '#c0a0ff', type: 'baston', dice: '1d8', stat: 'INT', dmg: 'arcano', range: 4, two: true, classes: M, stats: { INT: 1, recurso: 4 } }),
  w({ id: 'varita_llamas', name: 'Varita de llamas', lv: 8, value: 180, shape: 'varita', color: '#ff7030', type: 'baston', dice: '1d10', stat: 'INT', dmg: 'fuego', range: 4, classes: M, stats: { recurso: 4 } }),
  w({ id: 'baston_archimago', name: 'Bastón de archimago', lv: 12, value: 450, shape: 'baston', color: '#e0a0ff', type: 'baston', dice: '2d6', stat: 'INT', dmg: 'arcano', range: 5, two: true, classes: M, stats: { INT: 2, recurso: 8 } }),
  w({ id: 'cetro_vacio', name: 'Cetro del vacío', lv: 16, value: 950, shape: 'varita', color: '#8040c0', type: 'baston', dice: '2d8', stat: 'INT', dmg: 'necrotico', range: 5, classes: M, stats: { INT: 2, recurso: 10 } }),
  // Clérigo: mazas sagradas (usan SAB o FUE)
  w({ id: 'maza_acolito', name: 'Maza de acólito', lv: 2, value: 22, shape: 'maza', color: '#f0e0a0', type: 'maza', dice: '1d6', stat: 'SAB', dmg: 'sagrado', stats: { SAB: 1 } }),
  w({ id: 'mayal_bendito', name: 'Mayal bendito', lv: 5, value: 75, shape: 'maza', color: '#ffe8a0', type: 'maza', dice: '1d8', stat: 'SAB', dmg: 'sagrado', classes: C }),
  w({ id: 'martillo_sagrado', name: 'Martillo sagrado', lv: 8, value: 170, shape: 'maza', color: '#ffd860', type: 'maza', dice: '1d10', stat: 'SAB', dmg: 'sagrado', classes: C, stats: { SAB: 1 } }),
  w({ id: 'maza_amanecer', name: 'Maza del amanecer', lv: 12, value: 420, shape: 'maza', color: '#fff0a0', type: 'maza', dice: '2d6', stat: 'SAB', dmg: 'sagrado', classes: C, stats: { SAB: 2, recurso: 4 } }),
  w({ id: 'martillo_alba', name: 'Martillo del alba', lv: 17, value: 1000, shape: 'maza', color: '#ffffff', type: 'maza', dice: '2d8', stat: 'SAB', dmg: 'sagrado', two: true, classes: C, stats: { SAB: 2, pv: 10 } }),
  // Genéricas de nivel medio y alto
  w({ id: 'espada_ancha', name: 'Espada ancha', lv: 4, value: 45, shape: 'espada', color: '#b8bec8', type: 'espada', dice: '1d8', stat: 'FUE', dmg: 'cortante' }),
  w({ id: 'cimitarra', name: 'Cimitarra', lv: 6, value: 95, shape: 'espada', color: '#e0d8c0', type: 'espada', dice: '1d8', stat: 'DES', dmg: 'cortante' }),
  w({ id: 'arco_compuesto', name: 'Arco compuesto', lv: 7, value: 130, shape: 'arco', color: '#6a4a3a', type: 'arco', dice: '1d10', stat: 'DES', dmg: 'perforante', range: 7, two: true }),
  w({ id: 'maza_clavos', name: 'Maza de clavos', lv: 7, value: 100, shape: 'maza', color: '#8a8a94', type: 'maza', dice: '1d10', stat: 'FUE', dmg: 'contundente' }),
  w({ id: 'espada_helada', name: 'Espada helada', lv: 10, value: 300, shape: 'espada', color: '#a0e0ff', type: 'espada', dice: '2d6', stat: 'FUE', dmg: 'frio' }),
  w({ id: 'hacha_volcanica', name: 'Hacha volcánica', lv: 12, value: 440, shape: 'hacha', color: '#ff7030', type: 'hacha', dice: '2d8', stat: 'FUE', dmg: 'fuego', two: true }),
  w({ id: 'espada_celeste', name: 'Espada celeste', lv: 15, value: 780, shape: 'espada', color: '#c0f0ff', type: 'espada', dice: '2d8', stat: 'FUE', dmg: 'sagrado' }),
  w({ id: 'lanza_tormenta', name: 'Lanza de tormenta', lv: 15, value: 760, shape: 'lanza', color: '#70b8ff', type: 'baston', dice: '2d8', stat: 'FUE', dmg: 'rayo', two: true }),
  w({ id: 'espada_abismo', name: 'Hoja del abismo', lv: 19, value: 1500, shape: 'espada', color: '#7a30c0', type: 'espada', dice: '3d8', stat: 'FUE', dmg: 'necrotico' }),
].map((d) => (['coraza_dragon', 'escudo_drac', 'espada_dragon'].includes(d.id) ? { ...d, set: 'dragon' } : d)) satisfies ItemDef[];
