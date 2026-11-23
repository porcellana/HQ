/**
 * TRAMA PRINCIPAL (7 capítulos). El villano es Velkar el Nigromante (enemies/jefes.ts).
 *  1-2  Aldea → Puerto Ceniza: descubres la marca del Abismo.
 *  3    Cueva de los Colmillos: Gruñaz (niveles 2-4).
 *  4    Galerías de Seda: Mórgala (niveles 5-7).
 *  5    La reja de las runas: abre la Cripta (bandera `cripta_abierta`).
 *  6    Cripta de Velkar: combate final (niveles 8-10).
 *  7    Epílogo: vuelves a Brumaroja. La bandera `victoria` muestra el final.
 * Las misiones no bloquean por nivel; la descripción recomienda uno.
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
    completeText: '¡Gruñaz derrotado! La aldea por fin respira. Pero tu informe me inquieta: los goblins guardaban mapas de las Galerías de Seda y de unas criptas bajo Puerto Ceniza... Velkar sigue moviendo sus piezas.',
    rewards: { xp: 400, gold: 120, items: [{ item: 'pocion_curacion_mayor', qty: 2 }], flag: 'mq3', pet: { species: 'umbrin', level: 4 } },
  },
  {
    id: 'mq4_seda', name: 'Hilos en la oscuridad', kind: 'principal', giver: 'alcalde_ortun', turnIn: 'hermana_lysa',
    requires: ['mq3_colmillos'],
    description: 'Los mapas de Gruñaz señalan las Galerías de Seda, al este del Paso Gris. Allí Mórgala, la Reina Araña, teje veneno para los ejércitos de Velkar. Destrúyela y lleva la noticia a la Hermana Lysa. (Recomendado: nivel 5 o más.)',
    objectives: [
      { type: 'visit', zone: 'galerias_seda', label: 'Entra en las Galerías de Seda (este del Paso Gris)' },
      { type: 'kill', enemy: 'reina_arana', count: 1, label: 'Derrota a Mórgala, la Reina Araña' },
    ],
    completeText: 'Mórgala ha caído... y con ella el veneno que Velkar destilaba en sus galerías. Ahora sólo queda su guarida: la Cripta bajo Puerto Ceniza. Pero una reja de runas la sella, y sólo la Llama Blanca puede romperla.',
    rewards: { xp: 2000, gold: 200, items: [{ item: 'pocion_curacion_mayor', qty: 2 }, { item: 'antidoto', qty: 2 }], flag: 'mq4', pet: { species: 'destellin', level: 6 } },
  },
  {
    id: 'mq5_runas', name: 'La reja de las runas', kind: 'principal', giver: 'hermana_lysa',
    requires: ['mq4_seda'],
    description: 'Para romper el sello de la Cripta, Lysa necesita polvo de hueso de los muertos que Velkar alzó y seda de las Galerías. El maestre Doran, del gremio, guarda el calco de las runas. (Recomendado: nivel 7 o más.)',
    objectives: [
      { type: 'collect', item: 'polvo_hueso', count: 3, label: 'Consigue polvo de hueso (esqueletos)' },
      { type: 'collect', item: 'seda_arana', count: 3, label: 'Consigue seda de araña' },
      { type: 'talk', npc: 'maestre_doran', label: 'Pide al maestre Doran el calco de las runas' },
    ],
    completeText: 'Hueso, seda y la palabra escrita... Ya está. Esta noche la Llama Blanca arderá ante la reja y las runas se apagarán. La Cripta de Velkar está abierta, en el rincón suroeste de la ciudad. Que la luz te acompañe ahí abajo.',
    rewards: { xp: 2500, gold: 150, items: [{ item: 'pocion_curacion_mayor', qty: 3 }, { item: 'pocion_mana', qty: 3 }], flag: 'cripta_abierta' },
  },
  {
    id: 'mq6_velkar', name: 'El corazón del Abismo', kind: 'principal', giver: 'hermana_lysa',
    requires: ['mq5_runas'],
    description: 'Baja a la Cripta de Velkar, atraviesa sus tres pisos y acaba con el Nigromante antes de que el Abismo despierte del todo. Lleva pociones: dicen que Velkar no muere a la primera. (Recomendado: nivel 9 o más.)',
    objectives: [
      { type: 'visit', zone: 'cripta_velkar', label: 'Entra en la Cripta de Velkar' },
      { type: 'kill', enemy: 'nigromante', count: 1, label: 'Derrota a Velkar el Nigromante' },
    ],
    completeText: 'Lo siento... el Abismo se ha callado. Por primera vez en meses, las velas del templo no tiemblan. Ve a Brumaroja: el alcalde Ortun merece oírlo de tu boca.',
    rewards: { xp: 3000, gold: 500, flag: 'mq6' },
  },
  {
    id: 'mq7_amanecer', name: 'Amanecer en Brumaroja', kind: 'principal', giver: 'hermana_lysa', turnIn: 'alcalde_ortun',
    requires: ['mq6_velkar'],
    description: 'Vuelve a la Aldea de Brumaroja y cuéntale al alcalde Ortun que Velkar ha caído.',
    objectives: [{ type: 'talk', npc: 'alcalde_ortun', label: 'Habla con el alcalde Ortun en Brumaroja' }],
    completeText: '¿Velkar... muerto? ¡Que suenen las campanas! La niebla roja se levanta por primera vez en años. Brumaroja te debe la vida, héroe. Quédate cuanto quieras: aquí siempre tendrás una jarra y un fuego.',
    rewards: { xp: 500, gold: 300, items: [{ item: 'anillo_oro' }], flag: 'victoria', pet: { species: 'aurelion', level: 10 } },
  },
] satisfies QuestDef[];
