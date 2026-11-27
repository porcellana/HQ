/** Anillos y amuletos adicionales (v0.9.4). Reciben además bonos aleatorios por rareza. */
import type { BonusStat, ItemDef } from '../schema';

const R = (id: string, name: string, lv: number, value: number, shape: 'anillo' | 'amuleto', color: string, stats: Partial<Record<BonusStat, number>>, desc?: string, classes?: string[]): ItemDef => ({
  id, name, kind: 'accesorio', slot: 'accesorio', level: lv, value, icon: { shape, color }, stats, ...(classes ? { classes } : {}),
  ...(lv >= 6 ? { reqLevel: lv - 2 } : {}), ...(desc ? { description: desc } : {}),
});

export default [
  R('anillo_hierro', 'Anillo de hierro', 2, 22, 'anillo', '#9aa0ac', { CON: 1 }),
  R('anillo_jade', 'Anillo de jade', 3, 45, 'anillo', '#50c080', { SAB: 1 }),
  R('amuleto_lobo', 'Amuleto del lobo', 3, 50, 'amuleto', '#8a8a92', { FUE: 1, pv: 3 }),
  R('anillo_rubi', 'Anillo de rubí', 6, 120, 'anillo', '#e03040', { FUE: 1, daño: 1 }),
  R('anillo_zafiro', 'Anillo de zafiro', 6, 120, 'anillo', '#3070e0', { INT: 1, recurso: 4 }),
  R('amuleto_sol', 'Amuleto del sol', 7, 150, 'amuleto', '#ffd040', { SAB: 1, pv: 6 }, 'Calienta la mano que lo sostiene.', ['clerigo']),
  R('amuleto_luna', 'Amuleto de la luna', 7, 150, 'amuleto', '#c8d8ff', { INT: 1, recurso: 6 }, 'Brilla con luz fría.', ['mago']),
  R('anillo_sombra', 'Anillo de sombra', 8, 170, 'anillo', '#3a2a50', { DES: 2 }, 'Quien lo lleva se mueve sin ruido.', ['picaro']),
  R('anillo_coloso', 'Anillo del coloso', 9, 200, 'anillo', '#c0c8d4', { FUE: 2, pv: 6 }, undefined, ['guerrero']),
  R('amuleto_guardian', 'Amuleto del guardián', 10, 260, 'amuleto', '#80c0ff', { ca: 1, CON: 1 }),
  R('anillo_esmeralda', 'Anillo de esmeralda', 10, 260, 'anillo', '#30c060', { CON: 1, pv: 10 }),
  R('amuleto_dragon', 'Colmillo de dragón', 13, 520, 'amuleto', '#ff7040', { FUE: 2, ataque: 1 }),
  R('anillo_arcano', 'Anillo arcano', 13, 520, 'anillo', '#b070ff', { INT: 2, recurso: 10 }),
  R('amuleto_fenix', 'Amuleto del fénix', 15, 800, 'amuleto', '#ffa030', { CON: 2, pv: 15 }),
  R('anillo_eclipse', 'Anillo del eclipse', 17, 1100, 'anillo', '#201030', { DES: 2, daño: 2 }),
  R('amuleto_estrella', 'Amuleto de la estrella', 18, 1300, 'amuleto', '#fff0a0', { SAB: 2, INT: 1, recurso: 10 }),
  // Herramientas
  { id: 'pico_enano', name: 'Pico enano', kind: 'herramienta', slot: 'herramienta', level: 8, value: 160, icon: { shape: 'pico', color: '#e0b060' }, pickaxeTier: 3, plain: true, description: 'Muerde cualquier veta.' },
  { id: 'llave_maestra', name: 'Ganzúa maestra', kind: 'herramienta', slot: 'herramienta', level: 4, value: 90, icon: { shape: 'llave', color: '#d8d0b8' }, plain: true, stats: { DES: 1 }, description: 'Útil para los cofres cerrados.' },
] satisfies ItemDef[];
