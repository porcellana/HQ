/** Anillos, amuletos y picos. Los accesorios siempre reciben al menos un bono aleatorio. */
import type { ItemDef } from '../schema';

export default [
  { id: 'anillo_cobre', name: 'Anillo de cobre', kind: 'accesorio', slot: 'accesorio', level: 1, value: 12, icon: { shape: 'anillo', color: '#c87a4a' } },
  { id: 'amuleto_hueso', name: 'Amuleto de hueso', kind: 'accesorio', slot: 'accesorio', level: 2, value: 18, icon: { shape: 'amuleto', color: '#d8d0bc' } },
  { id: 'anillo_plata', name: 'Anillo de plata', kind: 'accesorio', slot: 'accesorio', level: 4, value: 40, icon: { shape: 'anillo', color: '#d8e0f0' } },
  { id: 'amuleto_ambar', name: 'Amuleto de ámbar', kind: 'accesorio', slot: 'accesorio', level: 5, value: 60, icon: { shape: 'amuleto', color: '#e0a030' } },
  { id: 'anillo_oro', name: 'Anillo de oro', kind: 'accesorio', slot: 'accesorio', level: 8, value: 120, icon: { shape: 'anillo', color: '#f2d888' } },
  // Picos (minería en el Hito 6): cuanto más nivel, mejores minerales.
  { id: 'pico_hierro', name: 'Pico de hierro', kind: 'herramienta', slot: 'herramienta', level: 1, value: 20, icon: { shape: 'pico', color: '#9aa0ac' }, pickaxeTier: 1, plain: true },
  { id: 'pico_acero', name: 'Pico de acero', kind: 'herramienta', slot: 'herramienta', level: 5, value: 80, icon: { shape: 'pico', color: '#c8d0dc' }, pickaxeTier: 2, plain: true },
  { id: 'pico_mithril', name: 'Pico de mithril', kind: 'herramienta', slot: 'herramienta', level: 10, value: 250, icon: { shape: 'pico', color: '#80e0ff' }, pickaxeTier: 3, plain: true },
] satisfies ItemDef[];
