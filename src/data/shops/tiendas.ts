/**
 * Tiendas. Precio de compra = valor del objeto × priceMult (± carisma).
 * El stock se genera al abrir la tienda y se renueva cada `restockTurns` turnos.
 *  - { item, qty: [mín, máx], chance } objeto concreto.
 *  - { pool, count: [mín, máx] } equipo aleatorio (con rareza) de nivel ≈ `level`.
 */
import type { ShopDef } from '../schema';

export default [
  {
    id: 'herreria_brumaroja', name: 'Herrería de Brumaroja', priceMult: 1, restockTurns: 300, level: 2,
    buys: ['arma', 'armadura', 'secundaria', 'herramienta', 'material'],
    stock: [
      { pool: 'armas', count: [2, 3] },
      { pool: 'armaduras', count: [2, 3] },
      { item: 'pico_hierro', chance: 1 },
      { item: 'escudo_madera', chance: 0.7 },
    ],
  },
  {
    id: 'tienda_brumaroja', name: 'Tienda de ultramarinos', priceMult: 1, restockTurns: 250, level: 1,
    stock: [
      { item: 'pocion_curacion', qty: [3, 5] },
      { item: 'pocion_mana', qty: [1, 3] },
      { item: 'antidoto', qty: [1, 3] },
      { item: 'pan', qty: [5, 10] },
      { item: 'carne_seca', qty: [3, 6] },
      { item: 'pico_hierro', chance: 0.5 },
      { pool: 'accesorios', count: [0, 1] },
    ],
  },
  {
    id: 'forja_ancla', name: 'Forja del Ancla', priceMult: 1.15, restockTurns: 300, level: 5,
    buys: ['arma', 'armadura', 'secundaria', 'herramienta', 'material'],
    stock: [
      { pool: 'armas', count: [3, 4] },
      { pool: 'armaduras', count: [3, 4] },
      { item: 'pico_acero', chance: 1 },
      { item: 'escudo_hierro', chance: 0.8 },
    ],
  },
  {
    id: 'alquimista_ceniza', name: 'Alquimista Vela Verde', priceMult: 0.9, restockTurns: 200, level: 3,
    buys: ['consumible', 'material'],
    stock: [
      { item: 'pocion_curacion', qty: [4, 8] },
      { item: 'pocion_curacion_mayor', qty: [1, 3] },
      { item: 'pocion_mana', qty: [3, 6] },
      { item: 'antidoto', qty: [2, 4] },
      { item: 'elixir_fuerza', qty: [1, 2] },
    ],
  },
  {
    id: 'mercado_ceniza', name: 'Puesto de Fabio', priceMult: 1.1, restockTurns: 250, level: 4,
    stock: [
      { item: 'pan', qty: [5, 10] },
      { item: 'carne_seca', qty: [4, 8] },
      { item: 'pico_hierro', chance: 0.6 },
      { item: 'tomo_arcano', chance: 0.5 },
      { item: 'simbolo_sagrado', chance: 0.5 },
      { pool: 'accesorios', count: [1, 2] },
    ],
  },
] satisfies ShopDef[];
