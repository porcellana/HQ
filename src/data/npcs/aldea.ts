/**
 * PNJ de la Aldea de Brumaroja. `zone`, `x`, `y` = dónde están (casilla del mapa
 * ASCII, contando desde 0). Deben estar sobre una casilla transitable.
 *
 * Diálogos v0.2: muchas conversaciones tienen pruebas de habilidad
 * (`check`), opciones de trasfondo (`ifBackground`) y decisiones con
 * consecuencias (`effects`: oro, banderas, aprobación de compañeros...).
 */
import { BACK, npcDialog, reply } from '../helpers';
import type { NpcDef } from '../schema';

export default [
  {
    id: 'alcalde_ortun', name: 'Ortun', title: 'Alcalde', zone: 'aldea_casa_alcalde', x: 5, y: 2,
    look: { cloth: '#6a2a2a', clothDark: '#3a1a1a', pants: '#2a2420', hair: '#c8c0c8', skin: '#d9a67a' },
    dialog: npcDialog({
      greeting: ['Ah, un aventurero. Brumaroja necesita gente como tú.', 'Los goblins están cada vez más osados...'],
      quests: true,
      rumors: [
        'Hace semanas que la niebla del bosque se volvió roja. Nada bueno sale de ahí.',
        'Los goblins se esconden en una cueva al norte del bosque. La llaman la Cueva de los Colmillos.',
        'En Puerto Ceniza, al sur, hay un gremio que paga bien por cazar alimañas.',
      ],
      extraOptions: [
        { label: '(Le notas nervioso) ¿Hay algo que no me estéis contando?', check: { skill: 'perspicacia', dc: 12, success: 'secreto', failure: 'nada' }, ifFlag: '!ortun_secreto' },
        { label: 'Sobre ese grano que pagabais a los goblins...', goto: 'secreto', ifFlag: 'ortun_secreto' },
        { label: 'Mi familia gobernaba tierras más grandes que esta aldea, alcalde.', ifBackground: 'noble', goto: 'noble', ifFlag: '!ortun_noble' },
      ],
      extraNodes: {
        nada: reply('¿Nervioso? Es la niebla, que me pone la piel de gallina. Nada más.'),
        secreto: {
          text: '(Baja la voz) Está bien... Durante meses les dejamos grano junto al bosque para que no atacaran. Funcionó... hasta que dejó de funcionar. Si la aldea se entera, me cuelgan del pozo.',
          effects: [{ type: 'flag', flag: 'ortun_secreto' }, { type: 'xp', amount: 40 }], once: 'ortun_secreto_xp',
          options: [
            { label: 'La gente merece saberlo. Lo contaré en la plaza.', goto: 'contar', ifFlag: '!ortun_decidido' },
            { label: 'Tu secreto está a salvo... por 25 de oro.', goto: 'chantaje', ifFlag: '!ortun_decidido' },
            { label: 'Hiciste lo que pudiste. Queda entre nosotros.', goto: 'callar', ifFlag: '!ortun_decidido' },
            ...BACK,
          ],
        },
        contar: reply('(Palidece) Supongo... supongo que me lo merezco. Que la aldea decida.', [
          { type: 'flag', flag: 'ortun_decidido' }, { type: 'flag', flag: 'ortun_expuesto' },
          { type: 'attitude', npc: 'alcalde_ortun', amount: -3 }, { type: 'xp', amount: 60 },
          { type: 'approval', companion: 'brann', amount: 1 }, { type: 'approval', companion: 'sira', amount: 1 },
        ], 'ortun_contar'),
        chantaje: reply('(Te tiende una bolsa con manos temblorosas) Toma. Y no vuelvas a hablarme de esto.', [
          { type: 'flag', flag: 'ortun_decidido' }, { type: 'gold', amount: 25 }, { type: 'attitude', npc: 'alcalde_ortun', amount: -2 },
          { type: 'approval', companion: 'brann', amount: -2 }, { type: 'approval', companion: 'sira', amount: 1 },
        ], 'ortun_chantaje'),
        callar: reply('Gracias. De verdad. Brumaroja te debe más de lo que sabe.', [
          { type: 'flag', flag: 'ortun_decidido' }, { type: 'attitude', npc: 'alcalde_ortun', amount: 3 }, { type: 'xp', amount: 30 },
          { type: 'approval', companion: 'brann', amount: 1 }, { type: 'approval', companion: 'sira', amount: -1 },
        ], 'ortun_callar'),
        noble: reply('(Se endereza) Mis disculpas, señoría. Si algo necesitáis... aceptad esto para el camino.', [
          { type: 'gold', amount: 30 }, { type: 'attitude', npc: 'alcalde_ortun', amount: 1 }, { type: 'flag', flag: 'ortun_noble' },
          { type: 'approval', companion: 'brann', amount: -1 },
        ], 'ortun_noble'),
      },
    }),
  },
  {
    id: 'madre_ilse', name: 'Madre Ilse', title: 'Sacerdotisa', zone: 'aldea_capilla', x: 4, y: 2,
    look: { overlay: 'clerigo', cloth: '#d8d0bc', clothDark: '#a89c80', pants: '#5a4a3a', hat: '#d8b050', hair: '#8a8a8a' },
    dialog: npcDialog({
      greeting: 'Que la Llama Blanca te guarde. Si caes en combate, despertarás aquí.',
      temple: 4,
      rumors: [
        'La Llama Blanca no teme a la oscuridad. Los no-muertos sí temen a la Llama.',
        'Si caes, despertarás en el último templo donde hayas pedido sanación.',
        'Alguien robó el relicario de plata de esta capilla en primavera. Rezo por que vuelva.',
      ],
      extraOptions: [
        { label: 'Háblame de la Llama Blanca y de lo que quema.', check: { skill: 'arcanos', dc: 12, success: 'llama_ok', failure: 'llama_ko' }, ifFlag: '!ilse_llama' },
        { label: 'Madre, soy yo. ¿Me recordáis?', ifBackground: 'acolito', goto: 'acolito', ifFlag: '!ilse_acolito' },
        { label: '(Le entregas el relicario de plata)', ifFlag: 'relicario_en_mano', goto: 'relicario' },
        { label: 'He oído que soltaste... no, eso fue otro.', ifFlag: 'prisionero_liberado', goto: 'prisionero' },
      ],
      extraNodes: {
        llama_ok: reply('Lo entiendes rápido. La Llama no es fuego: es memoria. Por eso los muertos que no recuerdan quiénes son arden con ella. Velkar... Velkar quiso olvidar su muerte.', [{ type: 'xp', amount: 40 }, { type: 'flag', flag: 'ilse_llama' }], 'ilse_llama'),
        llama_ko: reply('(Sonríe con paciencia) Son misterios para toda una vida, hijo. Vuelve cuando quieras.'),
        acolito: reply('¡Por la Llama! Te fuiste siendo un crío. Toma, y no vuelvas a irte sin despedirte.', [
          { type: 'heal' }, { type: 'item', item: 'pocion_curacion', qty: 2 }, { type: 'flag', flag: 'ilse_acolito' },
        ], 'ilse_acolito'),
        relicario: reply('(Le tiemblan las manos) El relicario... Lo has traído de vuelta. La Llama te lo pagará. Y yo también, con lo poco que tengo.', [
          { type: 'flag', flag: 'relicario_en_mano', value: false }, { type: 'flag', flag: 'relicario_devuelto' },
          { type: 'xp', amount: 120 }, { type: 'item', item: 'pocion_curacion_mayor' }, { type: 'attitude', npc: 'madre_ilse', amount: 3 },
          { type: 'approval', companion: 'brann', amount: 2 }, { type: 'approval', companion: 'sira', amount: 1 },
        ], 'relicario_devuelto_ef'),
        prisionero: reply('La Hermana Lysa me escribió... Dicen que liberaste a un cultista. Espero que sepas lo que haces. La piedad mal dada también mata.'),
      },
    }),
  },
  {
    id: 'herrera_brunna', name: 'Brunna', title: 'Herrera', zone: 'aldea_herreria', x: 3, y: 2,
    look: { overlay: 'guerrero', cloth: '#5a4a3a', clothDark: '#3a2a20', pants: '#2a2420', hat: '#6a6a72', hair: '#a8642c' },
    dialog: npcDialog({
      greeting: ['¿Buscas acero? Aquí lo forjamos sin prisas pero sin pausa.', 'Cuidado con esa espada, que corta.'],
      shop: 'herreria_brumaroja',
      quests: true,
      rumors: ['Mi primo Garrik tiene la Forja del Ancla en Puerto Ceniza. Allí venden acero de calidad, aunque caro.'],
      extraOptions: [
        { label: '¿Te echo una mano con ese yunque?', check: { skill: 'atletismo', dc: 13, success: 'yunque_ok', failure: 'yunque_ko' }, ifFlag: '!brunna_yunque' },
        { label: 'Este temple... es acero de la guardia. Conozco esta aleación.', ifBackground: 'soldado', goto: 'soldado', ifFlag: '!brunna_soldado' },
      ],
      extraNodes: {
        yunque_ok: reply('(Lo levantáis entre los dos) ¡Ja! Brazos de herrero. Te haré precio de amigo: un 15 % menos en todo.', [
          { type: 'discount', shop: 'herreria_brumaroja', pct: 15 }, { type: 'flag', flag: 'brunna_yunque' },
        ], 'brunna_yunque'),
        yunque_ko: reply('(Casi te aplasta un pie) ¡Quita, quita! Mejor te dedicas a matar goblins.', [{ type: 'flag', flag: 'brunna_yunque' }]),
        soldado: reply('¡Un veterano! Mi padre sirvió en la guardia. Para ti, un 10 % menos. Y que no se entere Garrik.', [
          { type: 'discount', shop: 'herreria_brumaroja', pct: 10 }, { type: 'flag', flag: 'brunna_soldado' },
        ], 'brunna_soldado'),
      },
    }),
  },
  {
    id: 'tendero_pim', name: 'Pim', title: 'Tendero', zone: 'aldea_tienda', x: 3, y: 2,
    look: { cloth: '#3a6a4a', clothDark: '#1f3a2a', pants: '#3a3028', hair: '#3a2418' },
    dialog: npcDialog({
      greeting: '¡Pase, pase! Pan, pociones, cuerdas... lo que el aventurero necesite.',
      shop: 'tienda_brumaroja',
      rumors: ['El stock se renueva cada pocos días. Vuelve a menudo.', 'Si llevas cosas de monstruos, véndemelas: algo te daré.'],
      extraOptions: [
        { label: 'Estos precios son de ladrón. Seguro que podemos llegar a un acuerdo...', check: { skill: 'persuasion', dc: 12, success: 'regateo_ok', failure: 'regateo_ko', fumble: 'regateo_mal' }, ifFlag: '!pim_regateo' },
        { label: '(Guiño) ¿Y lo de la trastienda? Ya sabes, lo que no está a la vista.', ifBackground: 'ladron', goto: 'trastienda', ifFlag: '!pim_trastienda' },
      ],
      extraNodes: {
        regateo_ok: reply('(Suspira) Me vas a arruinar... Un 10 % menos para ti. Pero no se lo digas a nadie.', [
          { type: 'discount', shop: 'tienda_brumaroja', pct: 10 }, { type: 'flag', flag: 'pim_regateo' },
        ], 'pim_regateo'),
        regateo_ko: reply('Precios justos para tiempos difíciles, joven. Ni una moneda menos.', [{ type: 'flag', flag: 'pim_regateo' }]),
        regateo_mal: reply('¿Ladrón? ¿YO? ¡Fuera de mi tienda... bueno, no, compra si quieres, pero ofendido me tienes!', [
          { type: 'flag', flag: 'pim_regateo' }, { type: 'attitude', npc: 'tendero_pim', amount: -2 },
        ]),
        trastienda: reply('(Mira a la puerta) ...Un elixir que «se cayó» de un carro del puerto. 15 de oro y no me has visto.', undefined, undefined, [
          { label: 'Trato hecho (15 oro)', ifGold: 15, goto: 'trastienda_ok' },
          ...BACK,
        ]),
        trastienda_ok: reply('Un placer hacer negocios con gente que entiende.', [
          { type: 'gold', amount: -15 }, { type: 'item', item: 'elixir_fuerza', qty: 2 }, { type: 'flag', flag: 'pim_trastienda' },
          { type: 'approval', companion: 'sira', amount: 1 }, { type: 'approval', companion: 'brann', amount: -1 },
        ], 'pim_trastienda'),
      },
    }),
  },
  {
    id: 'tabernera_marga', name: 'Marga', title: 'Tabernera', zone: 'aldea_taberna', x: 2, y: 2,
    look: { cloth: '#8a3a4a', clothDark: '#5a2030', pants: '#3a2a2a', hair: '#d8c070', skin: '#f0c8a0' },
    dialog: npcDialog({
      greeting: ['¡Bienvenido a La Jarra Roja! ¿Cerveza, cama o trabajo?', 'Siéntate, siéntate. Aquí no muerde nadie... salvo las ratas.'],
      quests: true,
      inn: 10,
      rumors: [
        'Dicen que en el Paso Gris han visto encapuchados con túnicas rojas.',
        'Un viajero juró que oyó cantos bajo tierra, cerca de la cueva de los goblins.',
        'Esa de la esquina es Sira, cazarrecompensas. No le hables de deudas.',
        'Descansar aquí cura cualquier herida... y la cerveza cura el resto.',
      ],
      extraOptions: [
        { label: 'Soy sobrino del alcalde. ¿Invita la casa?', check: { skill: 'engano', dc: 12, success: 'engano_ok', failure: 'engano_ko' }, ifFlag: '!marga_engano' },
      ],
      extraNodes: {
        engano_ok: reply('¡Haberlo dicho antes! Siéntate, que te pongo un guiso. Invita Ortun, ja.', [{ type: 'heal' }, { type: 'flag', flag: 'marga_engano' }], 'marga_engano'),
        engano_ko: reply('¿Sobrino de Ortun? Y yo soy la Reina de Ceniza. Paga como todo el mundo, guapo.', [{ type: 'flag', flag: 'marga_engano' }]),
      },
    }),
  },
  {
    id: 'guardia_bren', name: 'Bren', title: 'Guardia', zone: 'aldea_brumaroja', x: 16, y: 21,
    look: { overlay: 'guerrero', cloth: '#7a808c', clothDark: '#4e535e', pants: '#3a3340', hat: '#9aa0ac' },
    dialog: npcDialog({
      greeting: 'Alto... ah, eres tú. Al norte está el Bosque Sombrío; al sur, el camino a Puerto Ceniza.',
      quests: true,
      rumors: [
        'Toca el minimapa para ir directo a un sitio. Eso me dijo un mago, no sé qué significa.',
        'Si los enemigos te superan, huye. No hay vergüenza en seguir vivo.',
        'Hay un tipo con capa raída rondando el puente. Si fuera tú, no le perdería de vista.',
      ],
    }),
  },
  {
    id: 'desertor_hal', name: 'Hombre encapuchado', title: '¿Viajero?', zone: 'aldea_brumaroja', x: 16, y: 27,
    hideIfFlag: 'hal_resuelto',
    look: { overlay: 'picaro', cloth: '#2f3c5a', clothDark: '#1f2840', pants: '#2a2420', hat: '#3a3a40', hair: '#3a2418' },
    dialog: {
      inicio: {
        text: '(Un hombre con una capa raída evita tu mirada. Bajo la capa asoma una cota de la guardia.) ...¿Qué miras?',
        options: [
          { label: 'Esa insignia... eres de la guardia de Ceniza. Un desertor.', ifBackground: 'soldado', goto: 'confesion' },
          { label: 'Algo te pesa. Cuéntamelo.', check: { skill: 'perspicacia', dc: 11, success: 'confesion', failure: 'nada' } },
          { label: 'Suelta lo que escondes o te lo saco a golpes.', check: { skill: 'intimidacion', dc: 13, success: 'confesion', failure: 'pelea_directa' } },
          { label: 'Nada. Sigue tu camino.', action: { type: 'end' } },
        ],
      },
      nada: reply('No me pasa nada. Déjame en paz.', undefined, undefined, [{ label: 'Adiós', action: { type: 'end' } }]),
      pelea_directa: reply('¡No me cogeréis vivo!', [{ type: 'flag', flag: 'hal_resuelto' }, { type: 'fight', enemy: 'desertor_hal' }]),
      confesion: {
        text: 'Me llamo Hal. Sí, deserté. Pero no por cobarde: en la guardia de Ceniza hay gente que lleva el ojo del Abismo tatuado. Si hablaba, me mataban. Así que huí.',
        effects: [{ type: 'flag', flag: 'pista_infiltrado' }, { type: 'xp', amount: 40 }], once: 'hal_confesion',
        options: [
          { label: 'Vente conmigo a ver a la Capitana Iria. Te escuchará.', check: { skill: 'persuasion', dc: 12, success: 'entregado', failure: 'pelea' } },
          { label: 'Vete. No te he visto.', goto: 'libre' },
          { label: '30 de oro y me olvido de tu cara.', check: { skill: 'intimidacion', dc: 12, success: 'chantaje', failure: 'pelea' } },
        ],
      },
      entregado: reply('...Está bien. Estoy cansado de huir. Iré a Ceniza y contaré lo que sé.', [
        { type: 'flag', flag: 'hal_resuelto' }, { type: 'flag', flag: 'hal_entregado' }, { type: 'xp', amount: 80 },
        { type: 'attitude', npc: 'guardia_ceniza', amount: 2 },
        { type: 'approval', companion: 'sira', amount: 1 }, { type: 'approval', companion: 'brann', amount: 1 },
      ], 'hal_entregado_ef', [{ label: 'Adiós', action: { type: 'end' } }]),
      libre: reply('(Te mira largo rato) Gracias. Toma: es lo único que tengo. Que la Llama te guarde mejor que a mí.', [
        { type: 'flag', flag: 'hal_resuelto' }, { type: 'flag', flag: 'hal_libre' }, { type: 'item', item: 'pocion_curacion', qty: 2 },
        { type: 'approval', companion: 'brann', amount: 2 }, { type: 'approval', companion: 'sira', amount: -1 },
      ], 'hal_libre_ef', [{ label: 'Adiós', action: { type: 'end' } }]),
      chantaje: reply('(Escupe al suelo y te lanza una bolsa) Ahí tienes. Ojalá te atragantes.', [
        { type: 'flag', flag: 'hal_resuelto' }, { type: 'flag', flag: 'hal_chantajeado' }, { type: 'gold', amount: 30 },
        { type: 'approval', companion: 'brann', amount: -2 }, { type: 'approval', companion: 'sira', amount: 1 },
      ], 'hal_chantaje_ef', [{ label: 'Adiós', action: { type: 'end' } }]),
      pelea: reply('(Desenvaina) Lo siento. No pienso volver.', [{ type: 'flag', flag: 'hal_resuelto' }, { type: 'flag', flag: 'hal_pelea' }, { type: 'fight', enemy: 'desertor_hal' }]),
    },
  },
  {
    id: 'sira', name: 'Sira', title: 'Cazarrecompensas', zone: 'aldea_taberna', x: 9, y: 3,
    hideIfFlag: 'reclutado_sira',
    look: { cloth: '#4a5a3a', clothDark: '#2a3420', pants: '#3a2a20', hair: '#1a1418', skin: '#b07850', overlay: 'picaro', hat: '#3a4a2a' },
    dialog: {
      inicio: {
        text: [
          '(Una mujer afila flechas sin levantar la vista) Si vienes a cobrar una deuda, llegas tarde. Si vienes a ofrecer trabajo, siéntate.',
          '¿Y bien? ¿Vienes a mirar o a hablar?',
        ],
        options: [
          { label: '¿Quién eres?', goto: 'quien', ifFlag: '!reclutado_sira' },
          { label: 'Hay botín de sobra en el bosque. Vente conmigo a medias.', check: { skill: 'persuasion', dc: 12, success: 'recluta', failure: 'precio' }, ifFlag: '!reclutado_sira' },
          { label: 'Cazadores los dos. Te vendría bien una presa grande.', ifBackground: 'cazador', goto: 'recluta', ifFlag: '!reclutado_sira' },
          { label: 'Te pago 25 de oro por adelantado.', ifGold: 25, goto: 'recluta_pago', ifFlag: '!reclutado_sira' },
          { label: '¿Qué opinas de cómo van las cosas?', ifCompanion: 'sira', goto: 'opinion' },
          { label: '📜 Misiones', action: { type: 'quests' }, ifCompanion: 'sira' },
          { label: 'Sepárate por ahora. Nos vemos en la taberna.', ifCompanion: 'sira', action: { type: 'dismiss' } },
          { label: 'Adiós', action: { type: 'end' } },
        ],
      },
      quien: reply('Sira. Cazo gente por dinero: bandidos, desertores y, últimamente, cultistas. Pagan bien y nadie llora por ellos.'),
      precio: reply('Bonito discurso. 25 de oro por adelantado y te sigo hasta el infierno. Bueno, hasta la puerta.'),
      recluta: reply('(Guarda las flechas) Me gustas. Vamos, antes de que me arrepienta.', [{ type: 'recruit', companion: 'sira' }], undefined, [{ label: 'En marcha', action: { type: 'end' } }]),
      recluta_pago: reply('Oro por delante. Así da gusto. Andando.', [{ type: 'gold', amount: -25 }, { type: 'recruit', companion: 'sira' }], undefined, [{ label: 'En marcha', action: { type: 'end' } }]),
      opinion: reply([
        'Me gusta la gente que cumple lo que promete y cobra lo que vale. Odio a los que se van de rositas.',
        'Si vuelves a perdonar a un cultista, me lo pensaré dos veces antes de cubrirte.',
        'Esos cultistas... Tengo una lista. Si me ayudas a tacharla, te lo agradeceré a mi manera.',
      ], undefined, undefined, [{ label: 'Volver', goto: 'inicio' }]),
    },
  },
  {
    id: 'nina_tula', name: 'Tula', title: 'Niña curiosa', zone: 'aldea_brumaroja', x: 12, y: 8,
    look: { cloth: '#a0804a', clothDark: '#6a5030', pants: '#5a4a3a', hair: '#a8642c', skin: '#f0c8a0' },
    dialog: npcDialog({
      greeting: ['¿Eres un héroe de verdad? ¿Has matado un dragón?', '¡Hola! Mi madre dice que no hable con desconocidos.'],
      rumors: ['Vi un lobo enorme cerca del puente. ¡Era así de grande!', 'La herrera Brunna hace las mejores espadas del mundo. Bueno, de la aldea.'],
      extraOptions: [
        { label: '¿Quieres oír cómo maté a un dragón?', check: { skill: 'engano', dc: 8, success: 'cuento_ok', failure: 'cuento_ko' }, ifFlag: '!tula_cuento' },
      ],
      extraNodes: {
        cuento_ok: reply('¡¡Halaaa!! ¡Toma, mi piedra de la suerte! La encontré en el río.', [{ type: 'item', item: 'mineral_plata' }, { type: 'flag', flag: 'tula_cuento' }], 'tula_cuento'),
        cuento_ko: reply('Los dragones no existen, tonto. Lo dice mi madre.', [{ type: 'flag', flag: 'tula_cuento' }]),
      },
    }),
  },
] satisfies NpcDef[];
