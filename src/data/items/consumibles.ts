/** Pociones y comida. Se apilan. Usarlos en combate gasta el turno. */
import type { ItemDef } from '../schema';

export default [
  { id: 'pocion_curacion', name: 'Poción de curación', kind: 'consumible', level: 1, value: 25, stackable: true, maxStack: 10, plain: true,
    icon: { shape: 'pocion', color: '#d03030' }, use: { heal: '2d4+2' }, description: 'Recupera 2d4+2 PV.' },
  { id: 'pocion_curacion_mayor', name: 'Poción de curación mayor', kind: 'consumible', level: 5, value: 75, stackable: true, maxStack: 10, plain: true,
    icon: { shape: 'pocion', color: '#ff5050' }, use: { heal: '4d4+4' }, description: 'Recupera 4d4+4 PV.' },
  { id: 'pocion_mana', name: 'Poción de maná', kind: 'consumible', level: 1, value: 30, stackable: true, maxStack: 10, plain: true,
    icon: { shape: 'pocion', color: '#3a6ad0' }, use: { restore: '2d4+2' }, description: 'Recupera 2d4+2 de tu recurso (maná, vigor, energía o fe).' },
  { id: 'antidoto', name: 'Antídoto', kind: 'consumible', level: 1, value: 15, stackable: true, maxStack: 10, plain: true,
    icon: { shape: 'pocion', color: '#7ac040' }, use: { cleanse: true }, description: 'Elimina veneno, sangrado y otros estados.' },
  { id: 'elixir_fuerza', name: 'Elixir de fuerza', kind: 'consumible', level: 3, value: 50, stackable: true, maxStack: 5, plain: true,
    icon: { shape: 'pocion', color: '#e0a030' }, use: { buff: { stat: 'daño', amount: 2, turns: 8 } }, description: '+2 al daño durante 8 turnos.' },
  { id: 'pan', name: 'Hogaza de pan', kind: 'consumible', level: 1, value: 2, stackable: true, maxStack: 20, plain: true,
    icon: { shape: 'pan', color: '#c8964a' }, use: { heal: '1d6', outOfCombatOnly: true }, description: 'Recupera 1d6 PV. No se puede comer en combate.' },
  { id: 'carne_seca', name: 'Carne seca', kind: 'consumible', level: 1, value: 4, stackable: true, maxStack: 20, plain: true,
    icon: { shape: 'carne', color: '#8a3a2a' }, use: { heal: '2d6', outOfCombatOnly: true }, description: 'Recupera 2d6 PV. No se puede comer en combate.' },
] satisfies ItemDef[];
