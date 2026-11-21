/** Misiones secundarias (una sola vez). */
import type { QuestDef } from '../schema';

export default [
  {
    id: 'sq_mineral', name: 'Hierro para la forja', kind: 'secundaria', giver: 'herrera_brunna',
    description: 'Brunna necesita mineral de hierro. Equipa un pico y busca vetas en el bosque, el Paso Gris o las mazmorras.',
    objectives: [{ type: 'collect', item: 'mineral_hierro', count: 5, label: 'Consigue mineral de hierro' }],
    completeText: '¡Buen hierro! Con esto forjo media docena de herraduras. Toma, te lo has ganado.',
    rewards: { xp: 90, gold: 50, items: [{ item: 'pocion_curacion', qty: 2 }] },
  },
  {
    id: 'sq_ratas', name: 'Ratas en la bodega', kind: 'secundaria', giver: 'tabernera_marga',
    description: 'Unas ratas gigantes salen del bosque y se comen las provisiones de La Jarra Roja.',
    objectives: [{ type: 'kill', enemy: 'rata_gigante', count: 4, label: 'Mata ratas gigantes' }],
    completeText: '¡Por fin! Toma, y la próxima cerveza la pago yo.',
    rewards: { xp: 60, gold: 25 },
  },
  {
    id: 'sq_pieles', name: 'Pieles para el invierno', kind: 'secundaria', giver: 'tabernera_marga', requires: ['sq_ratas'],
    description: 'Marga quiere pieles de lobo para preparar la taberna para el invierno.',
    objectives: [{ type: 'collect', item: 'piel_lobo', count: 3, label: 'Consigue pieles de lobo' }],
    completeText: 'Qué calentitas. Toma algo de comida para el camino.',
    rewards: { xp: 80, gold: 45, items: [{ item: 'carne_seca', qty: 3 }] },
  },
  {
    id: 'sq_paso', name: 'Vigía del Paso Gris', kind: 'secundaria', giver: 'guardia_bren',
    description: 'El guardia Bren quiere saber si el camino del sur sigue abierto.',
    objectives: [{ type: 'visit', zone: 'paso_gris', label: 'Explora el Paso Gris (al sur de la aldea)' }],
    completeText: '¿Encapuchados en el paso? Avisaré al alcalde. Gracias.',
    rewards: { xp: 50, gold: 15 },
  },
  {
    id: 'sq_carta', name: 'Carta para la Forja', kind: 'secundaria', giver: 'herrera_brunna', turnIn: 'herrero_garrik',
    description: 'Brunna te pide que lleves un mensaje a su primo Garrik, herrero de Puerto Ceniza.',
    objectives: [{ type: 'talk', npc: 'herrero_garrik', label: 'Habla con Garrik en la Forja del Ancla' }],
    completeText: '¿Brunna me escribe? ¡Ja! Quiere carbón, cómo no. Toma, por las molestias.',
    rewards: { xp: 70, gold: 30 },
  },
  {
    id: 'sq_colmillos', name: 'Colmillos para el boticario', kind: 'secundaria', giver: 'alquimista_sabela',
    description: 'Sabela necesita colmillos de goblin para un ungüento.',
    objectives: [{ type: 'collect', item: 'colmillo_goblin', count: 5, label: 'Consigue colmillos de goblin' }],
    completeText: 'Perfectos. Toma, una de mis mejores pociones.',
    rewards: { xp: 90, gold: 30, items: [{ item: 'pocion_curacion_mayor' }] },
  },
] satisfies QuestDef[];
