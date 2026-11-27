/** Materiales, ingredientes, minerales y objetos de misión adicionales (v0.9.4). */
import type { ItemDef } from '../schema';

const m = (id: string, name: string, level: number, value: number, shape: string, color: string, description: string, quest = false): ItemDef => ({
  id, name, kind: 'material', level, value, stackable: true, maxStack: quest ? 10 : 50, plain: true, icon: { shape, color }, description, ...(quest ? { quest: true } : {}),
});

export default [
  // Minerales y metales
  m('lingote_hierro', 'Lingote de hierro', 2, 12, 'lingote', '#9aa0ac', 'Fundido y listo para forjar.'),
  m('lingote_plata', 'Lingote de plata', 5, 35, 'lingote', '#d8e0f0', 'Reluce con luz propia.'),
  m('mineral_oro', 'Mineral de oro', 6, 50, 'mineral', '#f2d060', 'Pesado y brillante.'),
  m('lingote_mithril', 'Lingote de mithril', 10, 140, 'lingote', '#80e0ff', 'Ligero como una pluma.'),
  m('rubi_bruto', 'Rubí en bruto', 7, 90, 'gema', '#e03040', 'Rojo como una brasa.'),
  m('zafiro_bruto', 'Zafiro en bruto', 7, 90, 'gema', '#3070e0', 'Azul profundo.'),
  m('diamante', 'Diamante', 12, 300, 'gema', '#e8f8ff', 'La gema más dura.'),
  // Partes de monstruo
  m('garra_lobo', 'Garra de lobo', 2, 5, 'colmillo', '#c8c0b0', 'Afilada.'),
  m('ala_murcielago', 'Ala de murciélago', 2, 4, 'piel', '#5a4a6a', 'Ingrediente de brebajes.'),
  m('ojo_arana', 'Ojo de araña', 4, 12, 'gema', '#c04060', 'Mira sin ver.'),
  m('cuero_curtido', 'Cuero curtido', 3, 9, 'piel', '#8a5a34', 'Para armeros.'),
  m('hueso_antiguo', 'Hueso antiguo', 5, 16, 'polvo', '#e0d8b8', 'De una criatura que ya no existe.'),
  m('ectoplasma', 'Ectoplasma', 6, 28, 'polvo', '#a0e0d0', 'Frío y viscoso.'),
  m('corazon_golem', 'Corazón de gólem', 8, 80, 'gema', '#c08040', 'Aún late, lento.'),
  m('escama_dragon', 'Escama de dragón', 12, 260, 'piel', '#ff6040', 'Casi indestructible.'),
  m('esencia_arcana', 'Esencia arcana', 9, 110, 'polvo', '#b080ff', 'Maná condensado.'),
  m('fragmento_vacio', 'Fragmento del vacío', 14, 320, 'mineral', '#6020a0', 'Absorbe la luz.'),
  // Hierbas
  m('raiz_sombra', 'Raíz de sombra', 3, 8, 'polvo', '#403050', 'Crece donde no llega el sol.'),
  m('flor_luna', 'Flor de luna', 5, 20, 'polvo', '#d8e0ff', 'Sólo abre de noche.'),
  m('hongo_cueva', 'Hongo de cueva', 2, 5, 'polvo', '#a08060', 'Comestible, mal sabor.'),
  m('polvo_estrellas', 'Polvo de estrellas', 10, 150, 'polvo', '#fff0a0', 'Cae de los cielos.'),
  // Objetos de misión
  m('carta_sellada', 'Carta sellada', 1, 1, 'pergamino', '#e8dcc0', 'Alguien espera esta carta.', true),
  m('reliquia_antigua', 'Reliquia antigua', 3, 1, 'amuleto', '#d8c070', 'Valiosa para un erudito.', true),
  m('sello_goblin', 'Sello de guerra goblin', 4, 1, 'amuleto', '#6a9a3a', 'El sello del Rey Goblin.', true),
  m('diario_perdido', 'Diario perdido', 3, 1, 'libro', '#8a5a34', 'Páginas manchadas de barro.', true),
  m('llave_vieja', 'Llave oxidada', 2, 1, 'llave', '#9a7a5a', 'Abre algo olvidado.', true),
] satisfies ItemDef[];
