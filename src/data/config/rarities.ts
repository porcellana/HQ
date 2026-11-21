/**
 * Rarezas. `weight` es la probabilidad relativa base; los botines de más nivel
 * favorecen rarezas altas (ver game/items/loot.ts). Edita a tu gusto.
 */
import type { RarityDef } from '../schema';

const rarities: RarityDef[] = [
  { id: 'comun', name: 'Común', color: '#d8d4cc', affixes: 0, priceMult: 1, powerBonus: 0, weight: 60, minLevel: 1 },
  { id: 'poco_comun', name: 'Poco común', color: '#5ad05a', affixes: 1, priceMult: 2, powerBonus: 0, weight: 28, minLevel: 1 },
  { id: 'raro', name: 'Raro', color: '#4a90f0', affixes: 2, priceMult: 4, powerBonus: 1, weight: 9, minLevel: 2 },
  { id: 'epico', name: 'Épico', color: '#b060f0', affixes: 3, priceMult: 8, powerBonus: 2, weight: 2.5, minLevel: 4 },
  { id: 'legendario', name: 'Legendario', color: '#ff9a20', affixes: 4, priceMult: 16, powerBonus: 3, weight: 0.5, minLevel: 6 },
];

export default rarities;
