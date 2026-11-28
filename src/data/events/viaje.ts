/**
 * EVENTOS AL VIAJAR (v0.14): sucesos aleatorios al llegar a una zona salvaje del mundo procedural.
 * Cada uno es un pequeño diálogo con elecciones y tiradas (reglas de los diálogos de PNJ).
 * Las cantidades con `perLevel` se multiplican por el nivel de la zona, y toda CD suma la mitad
 * de ese nivel (ver game/world/travelEvents.ts).
 */
import type { DialogOption, TravelEventDef } from '../schema';

const END: DialogOption = { label: 'Seguir tu camino', action: { type: 'end' } };
const fin = (text: string, effects: NonNullable<TravelEventDef['dialog'][string]['effects']> = []): TravelEventDef['dialog'][string] => ({ text, effects, options: [END] });

export default [
  {
    id: 'viajero_herido', name: 'Viajero herido', icon: '🩹', weight: 10,
    npc: { name: 'Viajero herido', title: 'Caído en el camino', look: { cloth: '#6a5a8a', clothDark: '#3a2f52', pants: '#2a2a3a', hair: '#3a2418', skin: '#d9a67a' } },
    dialog: {
      inicio: {
        text: ['(Un hombre yace junto al camino, con una pierna vendada a medias.) Por favor... unos bandoleros me dejaron aquí. No puedo caminar solo.'],
        options: [
          { label: 'Ayudarle a levantarse', check: { skill: 'atletismo', dc: 10, success: 'ayuda_ok', failure: 'ayuda_ko' } },
          { label: 'Darle 10 de oro y vendas', ifGold: 10, goto: 'oro' },
          { label: 'Registrar sus bolsillos', check: { skill: 'juego_manos', dc: 13, success: 'robo_ok', failure: 'robo_ko', fumble: 'robo_ko' } },
          END,
        ],
      },
      ayuda_ok: {
        text: '(Lo cargas con cuidado.) Gracias, de verdad. Tengo familia en el próximo asentamiento... ¿me acompañarías hasta allí? Te pagarán bien.',
        effects: [{ type: 'xp', amount: 12, perLevel: true }],
        options: [
          { label: 'Escoltarle hasta el asentamiento más cercano', goto: 'escolta' },
          { label: 'Lo siento, tengo prisa. Descansa aquí.', goto: 'despedida' },
        ],
      },
      escolta: { text: 'Que la fortuna te acompañe. Iré a tu paso.', effects: [{ type: 'escort' }], options: [END] },
      despedida: fin('(Asiente, resignado.) Lo entiendo. Buen viaje.', [{ type: 'xp', amount: 4, perLevel: true }]),
      ayuda_ko: fin('(Resbalas y los dos caéis.) Ay... Gracias por intentarlo.', [{ type: 'hurt', pct: 8 }]),
      oro: fin('(Se le humedecen los ojos.) Que los dioses te lo devuelvan. Toma, esto me lo dejaron los ladrones, no lo vieron.', [
        { type: 'gold', amount: -10 }, { type: 'xp', amount: 14, perLevel: true }, { type: 'item', item: 'pocion_curacion' },
      ]),
      robo_ok: fin('(No se entera de nada.) Mmm... ¿has dicho algo?', [{ type: 'gold', amount: 7, perLevel: true }]),
      robo_ko: { text: '(Te agarra de la muñeca con sorprendente fuerza.) ¡Ladrón! ¡Eran sus amigos! (Silba y de los matorrales salen más.)', effects: [{ type: 'ambush' }], options: [END] },
    },
  },
  {
    id: 'mercader_ambulante', name: 'Mercader ambulante', icon: '🛒', weight: 12,
    npc: { name: 'Mercader ambulante', title: 'Buhonero', look: { cloth: '#3a6a4a', clothDark: '#1f3a2a', pants: '#3a3028', hair: '#a8642c', skin: '#c08a60' } },
    dialog: {
      inicio: {
        text: ['¡Ey, viajero! Tengo género de primera, sin impuestos ni preguntas. ¿Echas un vistazo?', '(Un carro cargado hasta los topes chirría junto al camino.)'],
        options: [
          { label: 'Comprar una poción de curación (18 de oro)', ifGold: 18, goto: 'pocion' },
          { label: 'Comprar un antídoto (12 de oro)', ifGold: 12, goto: 'antidoto' },
          { label: 'Regatear', check: { skill: 'persuasion', dc: 11, success: 'regateo_ok', failure: 'regateo_ko', crit: 'regateo_crit' } },
          { label: 'Preguntar por el camino', check: { skill: 'perspicacia', dc: 10, success: 'camino_ok', failure: 'camino_ko' } },
          END,
        ],
      },
      pocion: { text: 'Trato hecho. Que te cure más de lo que te cuesta.', effects: [{ type: 'gold', amount: -18 }, { type: 'item', item: 'pocion_curacion' }], options: [{ label: 'Seguir mirando', goto: 'inicio' }, END] },
      antidoto: { text: 'Fresquito, del último pantano.', effects: [{ type: 'gold', amount: -12 }, { type: 'item', item: 'antidoto' }], options: [{ label: 'Seguir mirando', goto: 'inicio' }, END] },
      regateo_ok: fin('(Resopla.) Está bien, está bien... Dos por el precio de una. Pero que no se entere nadie.', [{ type: 'item', item: 'pocion_curacion', qty: 2 }]),
      regateo_crit: fin('(Se ríe a carcajadas.) ¡Hacía años que no me ganaban así! Llévate esto, y un frasco más por la gracia.', [{ type: 'item', item: 'pocion_curacion', qty: 2 }, { type: 'item', item: 'pocion_mana' }, { type: 'xp', amount: 10, perLevel: true }]),
      regateo_ko: fin('(Cruza los brazos.) Mis precios son sagrados. Buen viaje.'),
      camino_ok: fin('(Baja la voz.) Más adelante hay un cofre sin dueño junto a un árbol seco. No lo cuentes.', [{ type: 'xp', amount: 8, perLevel: true }, { type: 'treasure' }]),
      camino_ko: fin('Todo despejado, creo. O eso me han dicho.'),
    },
  },
  {
    id: 'emboscada_bandidos', name: 'Emboscada', icon: '⚔', weight: 9, minLevel: 2,
    npc: { name: 'Bandolero', title: 'Salteador de caminos', look: { cloth: '#5a3a2a', clothDark: '#33201a', pants: '#2a2420', hair: '#1a1410', skin: '#d9a67a', overlay: 'picaro' } },
    dialog: {
      inicio: {
        text: ['(Salen de entre la maleza, rodeándote.) ¡Alto ahí! El peaje del camino son todas tus monedas... o tu vida.'],
        options: [
          { label: 'Desenvainar', goto: 'pelea' },
          { label: 'Intimidarles', check: { skill: 'intimidacion', dc: 12, success: 'huyen', failure: 'pelea', fumble: 'pelea' } },
          { label: 'Engañarles con un farol', check: { skill: 'engano', dc: 13, success: 'farol_ok', failure: 'pelea' } },
          { label: 'Pagar el peaje', goto: 'peaje' },
        ],
      },
      pelea: { text: '(Se lanzan contra ti.) ¡A él!', effects: [{ type: 'ambush' }], options: [END] },
      huyen: fin('(Se miran entre sí y retroceden.) No... no merece la pena. ¡Vámonos!', [{ type: 'xp', amount: 16, perLevel: true }, { type: 'gold', amount: 4, perLevel: true }]),
      farol_ok: fin('(Dudan.) ¿Una compañía entera detrás de ti? Mejor... mejor lo dejamos.', [{ type: 'xp', amount: 14, perLevel: true }]),
      peaje: fin('(Recogen las monedas, silbando.) Un placer hacer negocios.', [{ type: 'gold', amount: -6, perLevel: true }]),
    },
  },
  {
    id: 'tesoro_oculto', name: 'Tesoro oculto', icon: '💎', weight: 8,
    npc: { name: 'Marca en el suelo', title: 'Un destello entre la tierra', look: { cloth: '#8a7a3a', clothDark: '#4a421e', pants: '#2a2a3a', hair: '#3a2418', skin: '#d9a67a' } },
    dialog: {
      inicio: {
        text: ['(Algo brilla medio enterrado bajo unas raíces. La tierra está removida hace poco.)'],
        options: [
          { label: 'Cavar a mano', check: { skill: 'atletismo', dc: 11, success: 'cavar_ok', failure: 'cavar_ko' } },
          { label: 'Examinar con cuidado', check: { skill: 'perspicacia', dc: 12, success: 'examinar_ok', failure: 'cavar_ko', crit: 'examinar_crit' } },
          { label: 'Dejarlo estar', action: { type: 'end' } },
        ],
      },
      cavar_ok: fin('(Sacas un cofrecillo enterrado.) ¡Hay algo dentro!', [{ type: 'treasure' }, { type: 'xp', amount: 8, perLevel: true }]),
      cavar_ko: fin('(Mueves tierra durante un buen rato y sólo encuentras una trampa vieja que te muerde la mano.)', [{ type: 'hurt', pct: 10 }]),
      examinar_ok: fin('(Estudias las marcas: alguien lo ocultó con prisa. Lo sacas sin riesgos.)', [{ type: 'treasure' }, { type: 'xp', amount: 10, perLevel: true }]),
      examinar_crit: fin('(Hay doble fondo. Más de lo que esperabas.)', [{ type: 'treasure', rolls: 2 }, { type: 'xp', amount: 18, perLevel: true }]),
    },
  },
  {
    id: 'tormenta', name: 'Tormenta', icon: '⛈', weight: 9,
    npc: { name: 'La tormenta', title: 'Truenos sobre el camino', look: { cloth: '#566a92', clothDark: '#2c3550', pants: '#2a2a3a', hair: '#c8c0c8', skin: '#c9b8a8' } },
    dialog: {
      inicio: {
        text: ['(El cielo se cierra de golpe. Truenos, viento, una lluvia que azota. Hay que decidir rápido.)'],
        options: [
          { label: 'Seguir adelante contra el viento', check: { skill: 'atletismo', dc: 12, success: 'seguir_ok', failure: 'seguir_ko' } },
          { label: 'Buscar refugio entre las rocas', check: { skill: 'perspicacia', dc: 10, success: 'refugio_ok', failure: 'seguir_ko' } },
          { label: 'Encauzar los rayos', check: { skill: 'arcanos', dc: 14, success: 'arcano_ok', failure: 'arcano_ko', crit: 'arcano_ok' } },
        ],
      },
      seguir_ok: fin('(Llegas calado pero entero. La lluvia ha limpiado el camino.)', [{ type: 'xp', amount: 10, perLevel: true }]),
      seguir_ko: fin('(Un rayo cae demasiado cerca y te lanza al barro.)', [{ type: 'hurt', pct: 12 }]),
      refugio_ok: fin('(Encuentras una oquedad seca. Esperas a que escampe y recuperas el aliento.)', [{ type: 'restore', pct: 25 }, { type: 'xp', amount: 8, perLevel: true }]),
      arcano_ok: fin('(La energía fluye por tu arma y se disipa. Te sientes lleno de poder.)', [{ type: 'restore', pct: 40 }, { type: 'xp', amount: 20, perLevel: true }]),
      arcano_ko: fin('(El rayo no obedece.)', [{ type: 'hurt', pct: 18 }]),
    },
  },
  {
    id: 'santuario', name: 'Santuario', icon: '⛩', weight: 8,
    npc: { name: 'Santuario olvidado', title: 'Piedra cubierta de musgo', look: { cloth: '#d8d0bc', clothDark: '#a89c80', pants: '#5a4a3a', hair: '#8a8a8a', skin: '#e0d0b8', overlay: 'clerigo' } },
    dialog: {
      inicio: {
        text: ['(Un pequeño altar de piedra entre los árboles, con velas aún tibias. Alguien lo cuida.)'],
        options: [
          { label: 'Rezar en silencio', check: { skill: 'perspicacia', dc: 9, success: 'rezar_ok', failure: 'rezar_ko' } },
          { label: 'Dejar una ofrenda (10 de oro)', ifGold: 10, goto: 'ofrenda' },
          { label: 'Llevarte las velas de plata', check: { skill: 'juego_manos', dc: 12, success: 'saqueo_ok', failure: 'saqueo_ko', fumble: 'saqueo_ko' } },
          END,
        ],
      },
      rezar_ok: fin('(Una calma tibia te recorre.)', [{ type: 'restore', pct: 50 }, { type: 'xp', amount: 9, perLevel: true }]),
      rezar_ko: fin('(Sólo oyes el viento.) Al menos descansas un rato.', [{ type: 'restore', pct: 10 }]),
      ofrenda: fin('(Las velas chisporrotean y una luz suave te envuelve de pies a cabeza.)', [{ type: 'gold', amount: -10 }, { type: 'heal' }, { type: 'xp', amount: 16, perLevel: true }]),
      saqueo_ok: fin('(Las guardas en la mochila. Pesan lo que valen.)', [{ type: 'gold', amount: 9, perLevel: true }]),
      saqueo_ko: { text: '(Una voz profunda retumba entre los árboles: «¡Profanador!» Las sombras se mueven.)', effects: [{ type: 'hurt', pct: 8 }, { type: 'ambush' }], options: [END] },
    },
  },
] satisfies TravelEventDef[];
