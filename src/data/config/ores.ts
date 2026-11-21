/** Minerales. Hace falta un pico con `pickaxeTier` >= `tier` en la ranura herramienta. */
import type { OreDef } from '../schema';

const ores: OreDef[] = [
  { id: 'hierro', name: 'Veta de hierro', item: 'mineral_hierro', tier: 1, hits: 3, qty: [1, 3], xp: 5, sprite: 'oreIron' },
  { id: 'plata', name: 'Veta de plata', item: 'mineral_plata', tier: 2, hits: 4, qty: [1, 2], xp: 12, sprite: 'oreSilver' },
  { id: 'gema', name: 'Geoda de gemas', item: 'gema_bruta', tier: 3, hits: 5, qty: [1, 1], xp: 25, sprite: 'oreGem' },
];

export default ores;
