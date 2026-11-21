/** Armaduras, escudos y objetos de mano secundaria. */
import type { ItemDef } from '../schema';

export default [
  // Cabeza
  { id: 'capucha_cuero', name: 'Capucha de cuero', kind: 'armadura', slot: 'cabeza', level: 1, value: 4, icon: { shape: 'capucha', color: '#6a4a2a' }, armor: { ac: 0 }, stats: { DES: 1 } },
  { id: 'casco_hierro', name: 'Casco de hierro', kind: 'armadura', slot: 'cabeza', level: 2, value: 15, icon: { shape: 'casco', color: '#9aa0ac' }, armor: { ac: 1 } },
  { id: 'yelmo_caballero', name: 'Yelmo de caballero', kind: 'armadura', slot: 'cabeza', level: 6, value: 60, icon: { shape: 'casco', color: '#d0d8e8' }, armor: { ac: 1 }, stats: { CON: 1 } },
  // Pecho
  { id: 'tunica', name: 'Túnica de aprendiz', kind: 'armadura', slot: 'pecho', level: 1, value: 3, icon: { shape: 'pecho', color: '#2f3f8a' }, armor: { ac: 0 }, stats: { recurso: 1 } },
  { id: 'armadura_cuero', name: 'Armadura de cuero', kind: 'armadura', slot: 'pecho', level: 1, value: 10, icon: { shape: 'pecho', color: '#7a5634' }, armor: { ac: 1 } },
  { id: 'cota_anillas', name: 'Cota de anillas', kind: 'armadura', slot: 'pecho', level: 1, value: 30, icon: { shape: 'pecho', color: '#8a909c' }, armor: { ac: 3, maxDex: 2 } },
  { id: 'cuero_tachonado', name: 'Cuero tachonado', kind: 'armadura', slot: 'pecho', level: 3, value: 45, icon: { shape: 'pecho', color: '#5a3a24' }, armor: { ac: 2 } },
  { id: 'cota_escamas', name: 'Cota de escamas', kind: 'armadura', slot: 'pecho', level: 1, value: 50, icon: { shape: 'pecho', color: '#9aa0ac' }, armor: { ac: 4, maxDex: 2 } },
  { id: 'tunica_arcana', name: 'Túnica arcana', kind: 'armadura', slot: 'pecho', level: 4, value: 70, icon: { shape: 'pecho', color: '#5a2f8a' }, armor: { ac: 1 }, stats: { INT: 1, recurso: 3 } },
  { id: 'coraza', name: 'Coraza', kind: 'armadura', slot: 'pecho', level: 5, value: 120, icon: { shape: 'pecho', color: '#c0c8d4' }, armor: { ac: 5, maxDex: 2 } },
  { id: 'armadura_placas', name: 'Armadura de placas', kind: 'armadura', slot: 'pecho', level: 9, value: 300, icon: { shape: 'pecho', color: '#e0e8f4' }, armor: { ac: 7, maxDex: 0 } },
  // Manos
  { id: 'guantes_cuero', name: 'Guantes de cuero', kind: 'armadura', slot: 'manos', level: 1, value: 4, icon: { shape: 'guantes', color: '#7a5634' }, armor: { ac: 0 }, stats: { ataque: 1 } },
  { id: 'guanteletes', name: 'Guanteletes', kind: 'armadura', slot: 'manos', level: 4, value: 30, icon: { shape: 'guantes', color: '#9aa0ac' }, armor: { ac: 1 } },
  // Piernas
  { id: 'calzas_cuero', name: 'Calzas de cuero', kind: 'armadura', slot: 'piernas', level: 1, value: 5, icon: { shape: 'piernas', color: '#6a4a2a' }, armor: { ac: 0 }, stats: { pv: 2 } },
  { id: 'grebas_hierro', name: 'Grebas de hierro', kind: 'armadura', slot: 'piernas', level: 3, value: 25, icon: { shape: 'piernas', color: '#9aa0ac' }, armor: { ac: 1 } },
  // Pies
  { id: 'botas_cuero', name: 'Botas de cuero', kind: 'armadura', slot: 'pies', level: 1, value: 4, icon: { shape: 'botas', color: '#6a4a2a' }, armor: { ac: 0 } },
  { id: 'botas_hierro', name: 'Botas de hierro', kind: 'armadura', slot: 'pies', level: 4, value: 25, icon: { shape: 'botas', color: '#9aa0ac' }, armor: { ac: 1 } },
  // Mano secundaria
  { id: 'escudo_madera', name: 'Escudo de madera', kind: 'secundaria', slot: 'secundaria', level: 1, value: 8, icon: { shape: 'escudo', color: '#7a5634' }, armor: { ac: 1 } },
  { id: 'escudo_hierro', name: 'Escudo de hierro', kind: 'secundaria', slot: 'secundaria', level: 4, value: 35, icon: { shape: 'escudo', color: '#9aa0ac' }, armor: { ac: 2 } },
  { id: 'tomo_arcano', name: 'Tomo arcano', kind: 'secundaria', slot: 'secundaria', level: 2, value: 30, icon: { shape: 'libro', color: '#5a2f8a' }, stats: { INT: 1, recurso: 2 } },
  { id: 'simbolo_sagrado', name: 'Símbolo sagrado', kind: 'secundaria', slot: 'secundaria', level: 1, value: 15, icon: { shape: 'simbolo', color: '#d8b050' }, stats: { SAB: 1 } },
] satisfies ItemDef[];
