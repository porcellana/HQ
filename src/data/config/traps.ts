/**
 * Trampas. CD real = dc + nivel/2. Detectar: SAB (+competencia si eres Pícaro,
 * que además tira con ventaja). Desactivar: DES (igual). Pisarla sin verla:
 * salvación de `save`; si la superas, mitad de daño y sin estado.
 */
import type { TrapDef } from '../schema';

const traps: TrapDef[] = [
  { id: 'pinchos', name: 'Trampa de pinchos', dc: 11, damage: '2d6', damageType: 'perforante', save: 'DES', applyStatus: { id: 'sangrado', chance: 0.5, turns: 3 }, sprite: 'trapSpikes' },
  { id: 'dardos', name: 'Trampa de dardos', dc: 12, damage: '1d8', damageType: 'veneno', save: 'CON', applyStatus: { id: 'veneno', turns: 4 }, sprite: 'trapDarts' },
  { id: 'fuego', name: 'Runa de fuego', dc: 13, damage: '3d6', damageType: 'fuego', save: 'DES', applyStatus: { id: 'quemado', chance: 0.5, turns: 3 }, sprite: 'trapFire' },
];

export default traps;
