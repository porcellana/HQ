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
      { item: 'pocion_curacion', weight: 8 },
      { item: 'carne_seca', weight: 8 },
      { pool: 'armas', weight: 7 },
      { pool: 'armaduras', weight: 7 },
      { pool: 'accesorios', weight: 2 },
    ],
  },
  {
    id: 'bestia', rolls: [1, 1], gold: [0, 1], goldChance: 0.2,
    entries: [
      { nothing: true, weight: 35 },
      { item: 'piel_lobo', weight: 25 },
      { item: 'cola_rata', weight: 20 },
      { item: 'carne_seca', weight: 20, min: 1, max: 2 },
    ],
  },
  {
    id: 'arana', rolls: [1, 2], gold: [0, 2], goldChance: 0.3,
    entries: [
      { nothing: true, weight: 30 },
      { item: 'seda_arana', weight: 30, min: 1, max: 2 },
      { item: 'glandula_veneno', weight: 15 },
      { item: 'antidoto', weight: 10 },
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
    ],
  },
  {
    id: 'jefe', rolls: [3, 4], gold: [15, 25], goldChance: 1,
    entries: [
      { pool: 'equipo', weight: 50 },
      { pool: 'accesorios', weight: 20 },
      { item: 'pocion_curacion_mayor', weight: 15 },
      { item: 'gema_bruta', weight: 10 },
    ],
  },
] satisfies LootTableDef[];
