/**
 * Trama principal (ligera). El villano es Velkar el Nigromante (enemies/jefes.ts).
 * El Hito 7 completará la historia; aquí están los primeros capítulos.
 */
import type { QuestDef } from '../schema';

export default [
  {
    id: 'mq1_sombras', name: 'Sombras sobre Brumaroja', kind: 'principal', giver: 'alcalde_ortun',
    description: 'Los goblins del Bosque Sombrío atacan a los viajeros. El alcalde Ortun te pide que los escarmientes.',
    objectives: [{ type: 'kill', family: 'goblinoide', count: 5, label: 'Derrota goblins en el Bosque Sombrío' }],
    completeText: '¡Bien hecho! Pero mira esto: los goblins llevaban este símbolo... un ojo dentro de un abismo. Alguien los está guiando. Ve a Puerto Ceniza y enséñaselo a la Hermana Lysa, en el templo.',
    rewards: { xp: 150, gold: 40, items: [{ item: 'pocion_curacion', qty: 2 }], flag: 'mq1' },
  },
  {
    id: 'mq2_rastro', name: 'El rastro del Abismo', kind: 'principal', giver: 'alcalde_ortun', turnIn: 'hermana_lysa',
    requires: ['mq1_sombras'],
    description: 'Viaja por el Paso Gris hasta Puerto Ceniza y muestra el símbolo de los goblins a la Hermana Lysa.',
    objectives: [
      { type: 'visit', zone: 'puerto_ceniza', label: 'Llega a Puerto Ceniza' },
      { type: 'talk', npc: 'hermana_lysa', label: 'Habla con la Hermana Lysa en el templo' },
    ],
    completeText: 'Este símbolo... es la marca de Velkar el Nigromante. Despertó algo antiguo bajo la tierra: el Abismo. Sus cultistas reclutan goblins y alzan a los muertos. Sus goblins se esconden en la Cueva de los Colmillos, al norte del Bosque Sombrío. Empieza por ahí: corta la mano antes que la cabeza.',
    rewards: { xp: 250, gold: 60, items: [{ item: 'amuleto_hueso' }], flag: 'mq2' },
  },
  {
    id: 'mq3_colmillos', name: 'La Cueva de los Colmillos', kind: 'principal', giver: 'hermana_lysa', turnIn: 'alcalde_ortun',
    requires: ['mq2_rastro'],
    description: 'Los goblins de Velkar se esconden en la Cueva de los Colmillos (salida norte del Bosque Sombrío). Baja hasta el fondo y derrota a su jefe, Gruñaz. Luego avisa al alcalde Ortun.',
    objectives: [
      { type: 'visit', zone: 'cueva_goblin', label: 'Entra en la Cueva de los Colmillos' },
      { type: 'kill', enemy: 'rey_goblin', count: 1, label: 'Derrota a Gruñaz, el Rey Goblin' },
    ],
    completeText: '¡Gruñaz derrotado! La aldea por fin respira. Pero tu informe me inquieta: los goblins guardaban mapas de las Galerías de Seda y de unas criptas bajo Puerto Ceniza... Velkar sigue moviendo sus piezas. (Continuará...)',
    rewards: { xp: 400, gold: 120, items: [{ item: 'pocion_curacion_mayor', qty: 2 }], flag: 'mq3' },
  },
] satisfies QuestDef[];
