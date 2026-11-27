/**
 * Tablas de botín. Cada enemigo indica la suya con `lootTable`.
 *  - rolls: cuántas veces se tira en la tabla.
 *  - gold: oro [mín, máx] × nivel del enemigo (con probabilidad goldChance).
 *  - entries: { item } objeto concreto, { pool } equipo aleatorio de nivel
 *    adecuado (con rareza), { nothing } nada.
 */
import type { LootTableDef } from '../schema';

export default [
  {
    id: 'goblin', rolls: [1, 1], gold: [1, 4], goldChance: 0.7,
    entries: [
      { nothing: true, weight: 40 },
      { item: 'colmillo_goblin', weight: 25, min: 1, max: 2 },
      { item: 'runa_vinculo', weight: 5 },
      { item: 'pocion_curacion', weight: 8 },
      { item: 'carne_seca', weight: 8 },
      { pool: 'armas', weight: 7 },
      { pool: 'armaduras', weight: 7 },
      { pool: 'accesorios', weight: 2 },
      { item: 'bomba_fuego', weight: 3 },
      { item: 'carta_sellada', weight: 1 },
    ],
  },
  {
    id: 'bestia', rolls: [1, 1], gold: [0, 1], goldChance: 0.2,
    entries: [
      { nothing: true, weight: 35 },
      { item: 'piel_lobo', weight: 25 },
      { item: 'cola_rata', weight: 20 },
      { item: 'carne_seca', weight: 20, min: 1, max: 2 },
      { item: 'garra_lobo', weight: 10 },
      { item: 'cuero_curtido', weight: 6 },
    ],
  },
  {
    id: 'arana', rolls: [1, 2], gold: [0, 2], goldChance: 0.3,
    entries: [
      { nothing: true, weight: 30 },
      { item: 'seda_arana', weight: 30, min: 1, max: 2 },
      { item: 'glandula_veneno', weight: 15 },
      { item: 'antidoto', weight: 10 },
      { item: 'ojo_arana', weight: 6 },
      { item: 'bomba_acida', weight: 3 },
      { pool: 'accesorios', weight: 4 },
    ],
  },
  {
    id: 'no_muerto', rolls: [1, 2], gold: [2, 6], goldChance: 0.6,
    entries: [
      { nothing: true, weight: 30 },
      { item: 'polvo_hueso', weight: 25 },
      { pool: 'equipo', weight: 15 },
      { item: 'pocion_curacion', weight: 10 },
      { item: 'pocion_mana', weight: 8 },
      { item: 'hueso_antiguo', weight: 8 },
      { item: 'ectoplasma', weight: 4 },
      { item: 'reliquia_antigua', weight: 1 },
    ],
  },
  {
    id: 'humano', rolls: [1, 2], gold: [3, 8], goldChance: 0.9,
    entries: [
      { nothing: true, weight: 20 },
      { pool: 'equipo', weight: 25 },
      { item: 'pocion_curacion', weight: 15 },
      { item: 'pocion_mana', weight: 10 },
      { item: 'elixir_fuerza', weight: 5 },
      { pool: 'accesorios', weight: 6 },
      { pool: 'consumibles', weight: 8 },
      { item: 'pergamino_escudo', weight: 4 },
      { item: 'bomba_hielo', weight: 3 },
    ],
  },
  {
    id: 'jefe', rolls: [3, 4], gold: [15, 25], goldChance: 1,
    entries: [
      { pool: 'equipo', weight: 40 },
      { pool: 'accesorios', weight: 15 },
      { pool: 'sets', weight: 8 },
      { item: 'pocion_curacion_mayor', weight: 12 },
      { item: 'gema_bruta', weight: 8 },
      { item: 'rubi_bruto', weight: 4 },
      { item: 'hoja_eco', weight: 2 },
      { item: 'escudo_vigia', weight: 2 },
      { item: 'arco_cazador_noche', weight: 2 },
      { item: 'cetro_aurora', weight: 2 },
      { item: 'diadema_olvido', weight: 1.5 },
      { item: 'amuleto_abismo', weight: 1.5 },
    ],
  },
  // Jefes de la trama: botín propio y un único garantizado.
  {
    id: 'jefe_rey_goblin', rolls: [3, 4], gold: [18, 28], goldChance: 1,
    entries: [
      { item: 'machete_grunaz', weight: 22 }, { item: 'colmillo_rey', weight: 22 }, { item: 'sello_goblin', weight: 14 },
      { pool: 'equipo', weight: 30 }, { pool: 'sets', weight: 8 }, { item: 'pocion_curacion_mayor', weight: 14 }, { item: 'gema_bruta', weight: 6 },
    ],
  },
  {
    id: 'jefe_reina_arana', rolls: [3, 4], gold: [18, 28], goldChance: 1,
    entries: [
      { item: 'aguijon_morgala', weight: 22 }, { item: 'manto_morgala', weight: 22 }, { item: 'ojo_arana', weight: 12, min: 1, max: 3 },
      { pool: 'equipo', weight: 30 }, { pool: 'sets', weight: 10 }, { item: 'pocion_curacion_mayor', weight: 14 }, { item: 'zafiro_bruto', weight: 6 },
    ],
  },
  {
    id: 'jefe_nigromante', rolls: [4, 5], gold: [20, 30], goldChance: 1,
    entries: [
      { item: 'baston_velkar', weight: 22 }, { item: 'anillo_nigromante', weight: 22 }, { item: 'esencia_arcana', weight: 10, min: 1, max: 2 },
      { pool: 'equipo', weight: 30 }, { pool: 'sets', weight: 10 }, { item: 'pocion_curacion_suprema', weight: 10 }, { item: 'rubi_bruto', weight: 6 },
    ],
  },
] satisfies LootTableDef[];
