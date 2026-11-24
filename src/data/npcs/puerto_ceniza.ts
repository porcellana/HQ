/** PNJ de Puerto Ceniza (con tiradas, opciones de trasfondo y decisiones v0.2). */
import { BACK, npcDialog, reply } from '../helpers';
import type { NpcDef } from '../schema';

const END = [{ label: 'Adiós', action: { type: 'end' as const } }];

export default [
  {
    id: 'maestre_doran', name: 'Doran', title: 'Maestre del gremio', zone: 'ciudad_gremio', x: 4, y: 2,
    look: { overlay: 'guerrero', cloth: '#5a4a6a', clothDark: '#3a2a4a', pants: '#2a2420', hat: '#d8b050', hair: '#1a1418' },
    dialog: npcDialog({
      greeting: 'El tablón del gremio siempre tiene encargos. Cumple y cobra; así de simple.',
      quests: true,
      rumors: ['Los encargos del tablón se renuevan: vuelve cuando quieras más trabajo.', 'Un nigromante... sí, he oído ese nombre. Velkar. Mejor no repetirlo en voz alta.'],
      extraOptions: [
        { label: 'Con lo que arriesgo, merezco un adelanto.', check: { skill: 'persuasion', dc: 13, success: 'adelanto_ok', failure: 'adelanto_ko' }, ifFlag: '!doran_adelanto' },
        { label: '¿Puedo consultar los archivos del gremio?', ifBackground: 'erudito', goto: 'archivos', ifFlag: '!doran_archivos' },
      ],
      extraNodes: {
        adelanto_ok: reply('(Gruñe) Tienes labia. Toma 25 de oro, y que no se entere nadie.', [{ type: 'gold', amount: 25 }, { type: 'flag', flag: 'doran_adelanto' }], 'doran_adelanto'),
        adelanto_ko: reply('Aquí se cobra al terminar. Como todo el mundo.', [{ type: 'flag', flag: 'doran_adelanto' }]),
        archivos: reply('Un erudito, ¡por fin alguien que sabe leer! Mira: hace cien años, Velkar era el maestre de este gremio. Lo expulsaron por saquear tumbas.', [
          { type: 'xp', amount: 60 }, { type: 'flag', flag: 'doran_archivos' }, { type: 'flag', flag: 'saber_velkar' },
        ], 'doran_archivos'),
      },
    }),
  },
  {
    id: 'alquimista_sabela', name: 'Sabela', title: 'Alquimista', zone: 'ciudad_alquimista', x: 3, y: 2,
    look: { overlay: 'mago', cloth: '#3a7a4a', clothDark: '#1f4a2a', pants: '#2a2a20', hat: '#2a5a3a', hair: '#1a1418' },
    dialog: npcDialog({
      greeting: ['Pociones, antídotos, elixires... todo destilado con mis propias manos.', '¿Traes ingredientes? Siempre necesito ingredientes.'],
      shop: 'alquimista_ceniza',
      quests: true,
      rumors: ['Mis precios son mejores que los de la aldea. La competencia es sana.', 'El veneno de araña, bien tratado, da un antídoto excelente.'],
      extraOptions: [
        { label: '¿Destilas en frío o con alambique de cobre? (hablar de alquimia)', check: { skill: 'arcanos', dc: 13, success: 'colega', failure: 'novato' }, ifFlag: '!sabela_charla' },
      ],
      extraNodes: {
        colega: reply('¡Por fin alguien que entiende! A los colegas les cobro un 20 % menos. Y llévate esta, invita la casa.', [
          { type: 'discount', shop: 'alquimista_ceniza', pct: 20 }, { type: 'item', item: 'pocion_mana' }, { type: 'flag', flag: 'sabela_charla' },
        ], 'sabela_charla'),
        novato: reply('(Sonríe) Con alambique, como todo el mundo. Tú mejor compra hechas, ¿eh?', [{ type: 'flag', flag: 'sabela_charla' }]),
      },
    }),
  },
  {
    id: 'herrero_garrik', name: 'Garrik', title: 'Herrero', zone: 'ciudad_herreria', x: 3, y: 2,
    look: { overlay: 'guerrero', cloth: '#4a3a2a', clothDark: '#2a2018', pants: '#2a2420', hat: '#3a3a40', hair: '#3a2418', skin: '#b07850' },
    dialog: npcDialog({
      greeting: 'La Forja del Ancla. El mejor acero del puerto, y el más caro. Se nota.',
      quests: true,
      shop: 'forja_ancla',
      rumors: ['Mi prima Brunna forja en Brumaroja. Buena mano, poco carbón.', 'Las armas a dos manos pegan más, pero adiós al escudo.'],
      extraOptions: [
        { label: '(Golpeas el mostrador) Estos precios son un robo. Rebájalos.', check: { skill: 'intimidacion', dc: 14, success: 'rebaja', failure: 'risa', fumble: 'furia' }, ifFlag: '!garrik_trato' },
        { label: 'Tengo un relicario de plata antiguo. ¿Cuánto me das?', ifFlag: 'relicario_en_mano', goto: 'relicario' },
      ],
      extraNodes: {
        rebaja: reply('(Traga saliva) Vale, vale... un 10 % menos. Pero baja la voz.', [{ type: 'discount', shop: 'forja_ancla', pct: 10 }, { type: 'flag', flag: 'garrik_trato' }], 'garrik_trato'),
        risa: reply('¡JA! Me han amenazado tipos el doble de grandes. El precio es el precio.', [{ type: 'flag', flag: 'garrik_trato' }]),
        furia: reply('(Agarra un martillo) Repite eso y te forjo a ti. Fuera de mi vista un rato, ¿quieres?', [
          { type: 'flag', flag: 'garrik_trato' }, { type: 'attitude', npc: 'herrero_garrik', amount: -3 },
        ]),
        relicario: reply('Plata de templo... eso tiene dueño, amigo. Pero el metal es metal: 150 de oro y no pregunto.', undefined, undefined, [
          { label: 'Véndeselo (150 oro)', goto: 'relicario_vendido' },
          ...BACK,
        ]),
        relicario_vendido: reply('Trato hecho. Esto se funde esta misma noche.', [
          { type: 'flag', flag: 'relicario_en_mano', value: false }, { type: 'flag', flag: 'relicario_vendido' }, { type: 'gold', amount: 150 },
          { type: 'approval', companion: 'sira', amount: 1 }, { type: 'approval', companion: 'brann', amount: -2 },
        ], 'relicario_vendido_ef'),
      },
    }),
  },
  {
    id: 'posadero_tobias', name: 'Tobías', title: 'Posadero', zone: 'ciudad_posada', x: 2, y: 2,
    look: { cloth: '#6a5a3a', clothDark: '#4a3a20', pants: '#3a3028', hair: '#c8c0c8' },
    dialog: npcDialog({
      greeting: 'Posada El Faro: camas limpias y vistas al mar. Bueno, al puerto.',
      inn: 20,
      rumors: [
        'Los marineros hablan de luces raras en las criptas bajo la ciudad.',
        'Aquí se descansa caro, pero se descansa bien.',
        'El tuerto de la mesa del fondo es Brann. Mercenario. Barato no es, pero tampoco se vende.',
      ],
      extraOptions: [
        { label: 'Busco a alguien que compre cosas... sin preguntar.', ifBackground: 'ladron', goto: 'perista', ifFlag: '!tobias_perista' },
      ],
      extraNodes: {
        perista: reply('(Te lleva aparte) El perista es Fabio, el de la plaza. Dile que vienes de mi parte y te tratará bien. Toma, esto me lo dejaron a deber.', [
          { type: 'item', item: 'anillo_cobre' }, { type: 'flag', flag: 'tobias_perista' }, { type: 'flag', flag: 'conoce_perista' },
        ], 'tobias_perista'),
      },
    }),
  },
  {
    id: 'brann', name: 'Brann', title: 'Mercenario tuerto', zone: 'ciudad_posada', x: 9, y: 3,
    hideIfFlag: 'reclutado_brann',
    look: { cloth: '#6a4a3a', clothDark: '#3a2a20', pants: '#2a2420', hair: '#a8642c', skin: '#d9a67a', overlay: 'guerrero', hat: '#7a808c' },
    dialog: {
      inicio: {
        text: ['(Un hombretón con un parche en el ojo te mira por encima de la jarra) Si buscas pelea, la tendrás. Si buscas un hacha, cuesta 60 de oro.', '¿Otra vez tú?'],
        options: [
          { label: '¿Qué le pasó a tu ojo?', goto: 'ojo', ifFlag: '!reclutado_brann' },
          { label: 'Te pago los 60 de oro.', ifGold: 60, goto: 'recluta_pago', ifFlag: '!reclutado_brann' },
          { label: 'Gratis no, pero con gloria. Vente y te haré famoso.', check: { skill: 'persuasion', dc: 15, success: 'recluta', failure: 'no' }, ifFlag: '!reclutado_brann' },
          { label: 'Fuimos soldados los dos. Sé lo que es desertar.', ifBackground: 'soldado', goto: 'recluta', ifFlag: '!reclutado_brann' },
          { label: '¿Qué opinas de cómo van las cosas?', ifCompanion: 'brann', goto: 'opinion' },
          { label: '📜 Misiones', action: { type: 'quests' }, ifCompanion: 'brann' },
          { label: 'Sepárate por ahora. Te buscaré en El Faro.', ifCompanion: 'brann', action: { type: 'dismiss' } },
          { label: 'Adiós', action: { type: 'end' } },
        ],
      },
      ojo: reply('Un orco. Uno enorme, con un collar de orejas. Yo le quité una mano, él me quitó un ojo. Sigue por ahí abajo, en las galerías. Algún día le encontraré.'),
      no: reply('La gloria no paga la cerveza. 60 de oro.'),
      recluta: reply('(Se levanta. Es más grande de lo que parecía) Está bien. Pero el día que me apuñales por la espalda, te llevo conmigo.', [
        { type: 'recruit', companion: 'brann' },
      ], undefined, [{ label: 'En marcha', action: { type: 'end' } }]),
      recluta_pago: reply('Oro de verdad. Me vale. ¿Hacia dónde?', [{ type: 'gold', amount: -60 }, { type: 'recruit', companion: 'brann' }], undefined, [{ label: 'En marcha', action: { type: 'end' } }]),
      opinion: reply([
        'Matar está bien cuando hace falta. Cuando no hace falta, es de nobles aburridos.',
        'Yo también deserté una vez. Cuando veas a un pobre diablo huyendo, piénsatelo antes de entregarle.',
        'Ese orco del collar de orejas... si alguna vez lo ves, avísame. Esa deuda es mía.',
      ], undefined, undefined, [{ label: 'Volver', goto: 'inicio' }]),
    },
  },
  {
    id: 'hermana_lysa', name: 'Hermana Lysa', title: 'Sacerdotisa', zone: 'ciudad_templo', x: 6, y: 2,
    look: { overlay: 'clerigo', cloth: '#e8e0d0', clothDark: '#b8ac90', pants: '#6a5a4a', hat: '#d8b050', hair: '#3a2418' },
    dialog: npcDialog({
      greeting: 'La Llama Blanca te da la bienvenida, viajero.',
      temple: 5,
      quests: true,
      rumors: ['El símbolo de los cultistas es un ojo dentro de un abismo. Lo he visto en sueños.', 'Si caes, el templo donde hayas sanado te traerá de vuelta.'],
      extraOptions: [
        { label: '¿Qué sabéis del prisionero de la Capitana?', ifFlag: 'prisionero_secreto', goto: 'secreto' },
        { label: 'Liberé al cultista encadenado.', ifFlag: 'prisionero_liberado', goto: 'liberado' },
      ],
      extraNodes: {
        secreto: reply('¿Te dijo que la reja de la Cripta teme la Llama? Entonces es cierto... Toma este agua bendita: te protegerá allí abajo.', [
          { type: 'item', item: 'pocion_curacion_mayor' }, { type: 'flag', flag: 'lysa_agua' },
        ], 'lysa_agua'),
        liberado: reply('(Cierra los ojos) La piedad es una virtud... hasta que ese hombre vuelva con un cuchillo. Rezaré por los dos.', [
          { type: 'attitude', npc: 'hermana_lysa', amount: -1 },
        ], 'lysa_liberado'),
      },
    }),
  },
  {
    id: 'mercader_fabio', name: 'Fabio', title: 'Mercader', zone: 'puerto_ceniza', x: 14, y: 26,
    look: { cloth: '#8a6a2a', clothDark: '#5a4418', pants: '#3a3028', hat: '#6a2a2a', hair: '#1a1418', skin: '#b07850' },
    dialog: npcDialog({
      greeting: '¡Mercancía de todos los puertos! Baratijas, víveres y algún anillo con historia.',
      shop: 'mercado_ceniza',
      rumors: ['Compro casi de todo, pero pago lo justo. Con labia, algo más.'],
      extraOptions: [
        { label: 'Ese relicario de plata del fondo...', goto: 'relicario', ifFlag: '!relicario_resuelto' },
        { label: 'Vengo de parte de Tobías.', ifFlag: 'conoce_perista', goto: 'perista', ifAttitude: { npc: 'mercader_fabio', min: 0 } },
      ],
      extraNodes: {
        relicario: {
          text: 'Ah, ¿te gusta? Plata antigua, trabajo de templo. Una ganga: 80 de oro.',
          options: [
            { label: 'Ese relicario es de la capilla de Brumaroja. Es robado.', check: { skill: 'perspicacia', dc: 12, success: 'robado', failure: 'no_sabes' } },
            { label: 'Lo reconozco: es el relicario de la Madre Ilse.', ifBackground: 'acolito', goto: 'robado' },
            { label: 'Lo compro (80 oro).', ifGold: 80, goto: 'comprado' },
            ...BACK,
          ],
        },
        no_sabes: reply('¿Robado? ¿Yo? Lo compré honradamente a un marinero muy honrado. 80 de oro, ni uno menos.'),
        robado: {
          text: '(Se le borra la sonrisa) ...Baja la voz. Mira, yo no lo robé. Lo compré barato y lo vendo caro. Así funciona el comercio.',
          options: [
            { label: 'Lo compro igualmente (80 oro).', ifGold: 80, goto: 'comprado' },
            { label: 'Dámelo o llamo a la Capitana Iria.', check: { skill: 'intimidacion', dc: 14, success: 'cedido', failure: 'matones' } },
            { label: '(Mientras mira a otro cliente, lo coges) ...', check: { skill: 'juego_manos', dc: 15, success: 'robado_ok', failure: 'matones' } },
            { label: 'Somos del mismo gremio, colega. 30 de oro.', ifBackground: 'ladron', ifGold: 30, goto: 'colega' },
            ...BACK,
          ],
        },
        comprado: reply('Un placer. Que le saques partido.', [
          { type: 'gold', amount: -80 }, { type: 'flag', flag: 'relicario_en_mano' }, { type: 'flag', flag: 'relicario_resuelto' },
        ], 'relicario_compra'),
        colega: reply('(Ríe) ¡Haberlo dicho antes! Para la familia, 30.', [
          { type: 'gold', amount: -30 }, { type: 'flag', flag: 'relicario_en_mano' }, { type: 'flag', flag: 'relicario_resuelto' },
          { type: 'approval', companion: 'sira', amount: 1 },
        ], 'relicario_colega'),
        cedido: reply('(Te lo pone en la mano, temblando) Llévatelo. Y no vuelvas por aquí en una temporada.', [
          { type: 'flag', flag: 'relicario_en_mano' }, { type: 'flag', flag: 'relicario_resuelto' },
          { type: 'attitude', npc: 'mercader_fabio', amount: -3 }, { type: 'approval', companion: 'sira', amount: 1 },
        ], 'relicario_cedido'),
        robado_ok: reply('(Fabio sigue regateando con otro cliente. El relicario ya está en tu bolsillo.) ...¿Decías algo?', [
          { type: 'flag', flag: 'relicario_en_mano' }, { type: 'flag', flag: 'relicario_resuelto' }, { type: 'xp', amount: 40 },
          { type: 'approval', companion: 'sira', amount: 1 }, { type: 'approval', companion: 'brann', amount: -1 },
        ], 'relicario_robado', END),
        matones: reply('¡LADRÓN! ¡Chicos, a por él!', [
          { type: 'flag', flag: 'relicario_resuelto' }, { type: 'attitude', npc: 'mercader_fabio', amount: -5 },
          { type: 'fight', enemy: 'maton_puerto', count: 2 },
        ]),
        perista: reply('¡Haberlo dicho antes! Para los amigos de Tobías, un 15 % menos en todo.', [
          { type: 'discount', shop: 'mercado_ceniza', pct: 15 }, { type: 'flag', flag: 'fabio_perista' },
        ], 'fabio_perista'),
      },
    }),
  },
  {
    id: 'guardia_ceniza', name: 'Capitana Iria', title: 'Guardia de la ciudad', zone: 'puerto_ceniza', x: 12, y: 2,
    look: { overlay: 'guerrero', cloth: '#2f3c5a', clothDark: '#1f2840', pants: '#2a2420', hat: '#9aa0ac', hair: '#1a1418' },
    dialog: npcDialog({
      greeting: 'Bienvenido a Puerto Ceniza. Sin peleas dentro de las murallas.',
      rumors: [
        'El gremio está al noroeste. El templo, al noreste.',
        'La posada El Faro está al suroeste, y el mercado en la plaza.',
        'Hemos detenido a un encapuchado con túnica roja. No habla. Quizá a ti te hable.',
      ],
      extraOptions: [
        { label: 'Vuestra casa y la mía se conocen, capitana.', ifBackground: 'noble', goto: 'noble', ifFlag: '!iria_noble' },
        { label: 'Hal, el desertor, os ha contado lo de los infiltrados.', ifFlag: 'hal_entregado', goto: 'hal' },
        { label: 'Un desertor me dijo que hay cultistas en vuestra guardia.', ifFlag: 'pista_infiltrado', goto: 'infiltrado' },
        { label: '¿Qué ha pasado con el prisionero?', ifFlag: 'prisionero_liberado', goto: 'fuga' },
      ],
      extraNodes: {
        noble: reply('(Hace una reverencia rígida) Señoría. La ciudad os agradece cualquier ayuda... y yo os debo un favor por vuestro padre.', [
          { type: 'gold', amount: 40 }, { type: 'attitude', npc: 'guardia_ceniza', amount: 1 }, { type: 'flag', flag: 'iria_noble' },
        ], 'iria_noble'),
        hal: reply('Sí... y le creo. Hemos arrestado a dos de mis propios guardias. Tienes mi gratitud. Toma tu parte de la recompensa.', [
          { type: 'gold', amount: 50 }, { type: 'xp', amount: 60 },
        ], 'iria_hal'),
        infiltrado: reply('(Te agarra del brazo) ¿Cultistas en MI guardia? ...Lo investigaré en silencio. Si es verdad, me habrás salvado el pellejo.', [
          { type: 'attitude', npc: 'guardia_ceniza', amount: 1 }, { type: 'xp', amount: 30 },
        ], 'iria_infiltrado'),
        fuga: {
          text: 'Alguien abrió la cadena del prisionero. Tú estuviste hablando con él, ¿no?',
          options: [
            { label: 'Yo no he sido. Se habrá soltado solo.', check: { skill: 'engano', dc: 14, success: 'fuga_ok', failure: 'fuga_ko' } },
            { label: 'Fui yo. Me suplicó y le creí.', goto: 'fuga_verdad' },
          ],
        },
        fuga_ok: reply('Hmm. Tendré que revisar las cadenas. Disculpa la sospecha.', [{ type: 'flag', flag: 'prisionero_liberado', value: false }], 'iria_fuga'),
        fuga_ko: reply('Mientes fatal. No te arresto porque nos has ayudado... pero no vuelvas a tocar a mis presos.', [
          { type: 'flag', flag: 'prisionero_liberado', value: false }, { type: 'attitude', npc: 'guardia_ceniza', amount: -2 },
        ], 'iria_fuga'),
        fuga_verdad: reply('(Suspira) Al menos eres honesto. La próxima vez que tu corazón blando quiera algo, consúltamelo antes.', [
          { type: 'flag', flag: 'prisionero_liberado', value: false }, { type: 'approval', companion: 'brann', amount: 1 },
        ], 'iria_fuga'),
      },
    }),
  },
  {
    id: 'prisionero', name: 'Prisionero encadenado', title: 'Cultista del Abismo', zone: 'puerto_ceniza', x: 13, y: 3,
    hideIfFlag: 'prisionero_resuelto',
    look: { overlay: 'picaro', cloth: '#5a1a1a', clothDark: '#3a0a0a', pants: '#2a1a1a', hat: '#8a1a1a', hair: '#1a1418' },
    dialog: {
      inicio: {
        text: '(Un hombre con túnica roja, encadenado a una argolla) Por favor... no sé nada... me obligaron a ponerme esta túnica. Tengo una hija en Brumaroja...',
        options: [
          { label: '¿Dices la verdad?', check: { skill: 'perspicacia', dc: 12, success: 'miente', failure: 'sincero' }, ifFlag: '!prisionero_calado' },
          { label: 'Habla. Ahora. O te arranco las palabras.', check: { skill: 'intimidacion', dc: 13, success: 'habla', failure: 'calla', fumble: 'veneno' } },
          { label: 'Ese ojo tatuado... es una runa de vinculación, no de culto.', check: { skill: 'arcanos', dc: 14, success: 'runas', failure: 'sincero' }, ifFlag: '!prisionero_runas' },
          { label: '(Abrir su cadena) Vete con tu hija.', goto: 'liberar' },
          { label: 'Llevárselo a la Capitana Iria para que lo juzgue.', goto: 'entregar' },
          { label: 'Adiós', action: { type: 'end' } },
        ],
      },
      sincero: reply('Lo juro por la Llama... no soy nadie... (parece sincero, o eso crees).', undefined, undefined, [{ label: 'Volver', goto: 'inicio' }]),
      miente: reply('(Se le escapa una sonrisa cuando cree que no miras. Lleva el ojo del Abismo tatuado en la muñeca: no es un recluta forzado.)', [
        { type: 'flag', flag: 'prisionero_calado' }, { type: 'xp', amount: 25 },
      ], 'prisionero_calado', [{ label: 'Volver', goto: 'inicio' }]),
      runas: reply('(Palidece) ¿Sabes leerlas? Entonces sabes que Velkar las pone a todos. Si muero, él lo siente... por favor, no me mates.', [
        { type: 'flag', flag: 'prisionero_runas' }, { type: 'xp', amount: 40 },
      ], 'prisionero_runas', [{ label: 'Volver', goto: 'inicio' }]),
      calla: reply('(Escupe a tus pies) No te diré nada.', undefined, undefined, [{ label: 'Volver', goto: 'inicio' }]),
      habla: reply('¡Vale, vale! La Cripta... la reja de la Cripta está sellada con runas. Sólo la Llama Blanca las debilita. Velkar teme la Llama... La Hermana Lysa lo sabe.', [
        { type: 'flag', flag: 'prisionero_secreto' }, { type: 'xp', amount: 60 },
        { type: 'approval', companion: 'sira', amount: 1 }, { type: 'approval', companion: 'brann', amount: -1 },
      ], 'prisionero_habla', [{ label: 'Volver', goto: 'inicio' }]),
      veneno: reply('(Muerde algo con fuerza. Espuma en la boca.) ...el Abismo... recuerda... (Muere.)', [
        { type: 'flag', flag: 'prisionero_resuelto' }, { type: 'flag', flag: 'prisionero_muerto' },
        { type: 'approval', companion: 'brann', amount: -1 },
      ], 'prisionero_veneno', END),
      liberar: reply('(Te besa las manos) ¡Gracias, gracias! Toma, es lo único que tengo... Si alguna vez necesitas algo de los nuestros, te deberán una.', [
        { type: 'flag', flag: 'prisionero_resuelto' }, { type: 'flag', flag: 'prisionero_liberado' }, { type: 'item', item: 'amuleto_hueso' },
        { type: 'attitude', npc: 'guardia_ceniza', amount: -2 },
        { type: 'approval', companion: 'sira', amount: -3 }, { type: 'approval', companion: 'brann', amount: 1 },
      ], 'prisionero_liberar', END),
      entregar: reply('(La Capitana Iria se lo lleva a rastras) Buen trabajo. La recompensa por un cultista son 40 de oro.', [
        { type: 'flag', flag: 'prisionero_resuelto' }, { type: 'flag', flag: 'prisionero_entregado' }, { type: 'gold', amount: 40 },
        { type: 'attitude', npc: 'guardia_ceniza', amount: 2 },
        { type: 'approval', companion: 'sira', amount: 2 }, { type: 'approval', companion: 'brann', amount: -1 },
      ], 'prisionero_entregar', END),
    },
  },
] satisfies NpcDef[];
