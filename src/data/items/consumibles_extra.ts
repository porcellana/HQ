/** Pociones, elixires, pergaminos, bombas y comida adicionales (v0.9.4). */
import type { ItemDef } from '../schema';

type U = NonNullable<ItemDef['use']>;
const c = (id: string, name: string, lv: number, value: number, shape: string, color: string, use: U, description: string, maxStack = 10): ItemDef => ({
  id, name, kind: 'consumible', level: lv, value, stackable: true, maxStack, plain: true, icon: { shape, color }, use, description,
});

export default [
  // Curación y recurso
  c('pocion_curacion_suprema', 'Poción de curación suprema', 10, 220, 'pocion', '#ff3060', { heal: '8d4+8' }, 'Recupera 8d4+8 PV.'),
  c('pocion_mana_mayor', 'Poción de maná mayor', 5, 80, 'pocion', '#4a80f0', { restore: '4d4+4' }, 'Recupera 4d4+4 de recurso.'),
  c('pocion_mana_suprema', 'Poción de maná suprema', 10, 200, 'pocion', '#60a0ff', { restore: '8d4+8' }, 'Recupera 8d4+8 de recurso.'),
  c('tonico_vital', 'Tónico vital', 3, 40, 'pocion', '#e0a0a0', { heal: '2d6', cleanse: true }, 'Cura 2d6 PV y elimina estados.'),
  c('panacea', 'Panacea', 8, 140, 'pocion', '#f0f0a0', { heal: '4d6', cleanse: true }, 'Cura 4d6 PV y elimina todos los estados.'),
  c('elixir_vigor', 'Elixir de vigor', 6, 110, 'pocion', '#80e0a0', { heal: '3d6', restore: '3d6' }, 'Recupera 3d6 PV y 3d6 de recurso.'),
  // Mejoras temporales
  c('elixir_defensa', 'Elixir de piel de piedra', 3, 55, 'pocion', '#a0a0b0', { buff: { stat: 'ca', amount: 2, turns: 8 } }, '+2 a la CA durante 8 turnos.', 5),
  c('elixir_punteria', 'Elixir de puntería', 3, 55, 'pocion', '#60c0e0', { buff: { stat: 'ataque', amount: 2, turns: 8 } }, '+2 al ataque durante 8 turnos.', 5),
  c('elixir_fuerza_mayor', 'Elixir de fuerza mayor', 8, 130, 'pocion', '#ff9040', { buff: { stat: 'daño', amount: 4, turns: 10 } }, '+4 al daño durante 10 turnos.', 5),
  c('elixir_bastion', 'Elixir de bastión', 9, 150, 'pocion', '#c0c0d8', { buff: { stat: 'ca', amount: 4, turns: 10 } }, '+4 a la CA durante 10 turnos.', 5),
  c('pergamino_escudo', 'Pergamino de escudo', 2, 45, 'pergamino', '#80b0ff', { buff: { stat: 'ca', amount: 3, turns: 6 } }, '+3 a la CA durante 6 turnos.', 5),
  c('pergamino_furia', 'Pergamino de furia', 4, 70, 'pergamino', '#ff6040', { buff: { stat: 'daño', amount: 3, turns: 6 } }, '+3 al daño durante 6 turnos.', 5),
  c('pergamino_bendicion', 'Pergamino de bendición', 4, 70, 'pergamino', '#ffe880', { buff: { stat: 'ataque', amount: 3, turns: 8 } }, '+3 al ataque durante 8 turnos.', 5),
  c('pergamino_pureza', 'Pergamino de pureza', 5, 60, 'pergamino', '#e8f8e8', { cleanse: true, heal: '1d8' }, 'Elimina estados y cura 1d8 PV.', 5),
  c('pergamino_titan', 'Pergamino del titán', 12, 260, 'pergamino', '#ffd060', { buff: { stat: 'daño', amount: 6, turns: 10 } }, '+6 al daño durante 10 turnos.', 5),
  // Bombas (sólo en batalla)
  c('bomba_fuego', 'Bomba de fuego', 2, 35, 'bomba', '#e05030', { damage: { dice: '2d6', type: 'fuego', status: { id: 'quemado', turns: 3, chance: 0.6 } } }, 'Daña a un enemigo (2d6 fuego) y puede quemarlo.', 10),
  c('bomba_acida', 'Bomba ácida', 3, 40, 'bomba', '#70c030', { damage: { dice: '2d6', type: 'veneno', status: { id: 'veneno', turns: 4, chance: 0.7 } } }, 'Daña a un enemigo (2d6 veneno) y puede envenenarlo.', 10),
  c('bomba_hielo', 'Bomba de hielo', 4, 55, 'bomba', '#80d0ff', { damage: { dice: '2d8', type: 'frio', status: { id: 'ralentizado', turns: 3, chance: 0.7 } } }, 'Daña a un enemigo (2d8 frío) y puede ralentizarlo.', 10),
  c('bomba_trueno', 'Bomba de trueno', 7, 100, 'bomba', '#f0e060', { damage: { dice: '4d6', type: 'rayo', status: { id: 'aturdido', turns: 1, chance: 0.4 } } }, 'Daña a un enemigo (4d6 rayo) y puede aturdirlo.', 10),
  c('bomba_abismo', 'Bomba del abismo', 12, 240, 'bomba', '#8040c0', { damage: { dice: '8d6', type: 'necrotico', status: { id: 'sangrado', turns: 4, chance: 0.5 } } }, 'Daña a un enemigo (8d6 necrótico).', 10),
  // Comida (fuera de combate)
  c('manzana', 'Manzana', 1, 1, 'pan', '#d04040', { heal: '1d4', outOfCombatOnly: true }, 'Recupera 1d4 PV fuera de combate.', 20),
  c('queso', 'Queso curado', 1, 5, 'pan', '#f0d060', { heal: '2d4', outOfCombatOnly: true }, 'Recupera 2d4 PV fuera de combate.', 20),
  c('pescado_asado', 'Pescado asado', 2, 8, 'carne', '#e0a070', { heal: '2d8', outOfCombatOnly: true }, 'Recupera 2d8 PV fuera de combate.', 20),
  c('estofado', 'Estofado caliente', 4, 18, 'carne', '#a06030', { heal: '4d8', outOfCombatOnly: true }, 'Recupera 4d8 PV fuera de combate.', 10),
  c('pastel_miel', 'Pastel de miel', 6, 40, 'pan', '#f0b050', { heal: '6d8', restore: '2d8', outOfCombatOnly: true }, 'Recupera 6d8 PV y algo de recurso fuera de combate.', 10),
] satisfies ItemDef[];
