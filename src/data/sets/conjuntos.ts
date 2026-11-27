/** Conjuntos: con 2 y 4 piezas puestas se activan bonos (se suman a los del equipo). */
import type { ItemSetDef } from '../schema';

export default [
  { id: 'alba', name: 'Bastión del Alba', pieces: ['casco_alba', 'coraza_alba', 'grebas_alba', 'botas_alba'], bonuses: [
    { count: 2, stats: { ca: 1 }, text: '+1 CA' }, { count: 4, stats: { FUE: 2, pv: 15 }, text: '+2 FUE, +15 PV' } ] },
  { id: 'onix', name: 'Sombra de Ónix', pieces: ['capucha_onix', 'jubon_onix', 'guantes_onix', 'botas_onix'], bonuses: [
    { count: 2, stats: { DES: 1 }, text: '+1 DES' }, { count: 4, stats: { DES: 2, ataque: 2 }, text: '+2 DES, +2 Ataque' } ] },
  { id: 'cometa', name: 'Vestiduras del Cometa', pieces: ['sombrero_cometa', 'tunica_cometa', 'guantes_cometa', 'faldon_cometa'], bonuses: [
    { count: 2, stats: { INT: 1 }, text: '+1 INT' }, { count: 4, stats: { INT: 2, recurso: 12 }, text: '+2 INT, +12 Recurso' } ] },
  { id: 'vigilia', name: 'Vigilia Solar', pieces: ['mitra_vigilia', 'vestidura_vigilia', 'manoplas_vigilia', 'botas_vigilia'], bonuses: [
    { count: 2, stats: { SAB: 1 }, text: '+1 SAB' }, { count: 4, stats: { SAB: 2, pv: 12 }, text: '+2 SAB, +12 PV' } ] },
  { id: 'dragon', name: 'Furia del Dragón', pieces: ['coraza_dragon', 'escudo_drac', 'espada_dragon'], bonuses: [
    { count: 2, stats: { daño: 1 }, text: '+1 Daño' }, { count: 3, stats: { FUE: 2, ca: 1, pv: 20 }, text: '+2 FUE, +1 CA, +20 PV' } ] },
] satisfies ItemSetDef[];
