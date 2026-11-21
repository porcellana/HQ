/**
 * PNJ de la Aldea de Brumaroja. `zone`, `x`, `y` = dónde están (casilla del mapa
 * ASCII, contando desde 0). Deben estar sobre una casilla transitable.
 */
import { npcDialog } from '../helpers';
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
      ],
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
    }),
  },
  {
    id: 'tendero_pim', name: 'Pim', title: 'Tendero', zone: 'aldea_tienda', x: 3, y: 2,
    look: { cloth: '#3a6a4a', clothDark: '#1f3a2a', pants: '#3a3028', hair: '#3a2418' },
    dialog: npcDialog({
      greeting: '¡Pase, pase! Pan, pociones, cuerdas... lo que el aventurero necesite.',
      shop: 'tienda_brumaroja',
      rumors: ['El stock se renueva cada pocos días. Vuelve a menudo.', 'Si llevas cosas de monstruos, véndemelas: algo te daré.'],
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
        'Las arañas gigantes huyen del fuego. Ojalá supiera lanzar bolas de fuego.',
        'Descansar aquí cura cualquier herida... y la cerveza cura el resto.',
      ],
    }),
  },
  {
    id: 'guardia_bren', name: 'Bren', title: 'Guardia', zone: 'aldea_brumaroja', x: 16, y: 21,
    look: { overlay: 'guerrero', cloth: '#7a808c', clothDark: '#4e535e', pants: '#3a3340', hat: '#9aa0ac' },
    dialog: npcDialog({
      greeting: 'Alto... ah, eres tú. Al norte está el Bosque Sombrío; al sur, el camino a Puerto Ceniza.',
      quests: true,
      rumors: ['Toca el minimapa para ir directo a un sitio. Eso me dijo un mago, no sé qué significa.', 'Si los enemigos te superan, huye. No hay vergüenza en seguir vivo.'],
    }),
  },
  {
    id: 'nina_tula', name: 'Tula', title: 'Niña curiosa', zone: 'aldea_brumaroja', x: 12, y: 8,
    look: { cloth: '#a0804a', clothDark: '#6a5030', pants: '#5a4a3a', hair: '#a8642c', skin: '#f0c8a0' },
    dialog: npcDialog({
      greeting: ['¿Eres un héroe de verdad? ¿Has matado un dragón?', '¡Hola! Mi madre dice que no hable con desconocidos.'],
      rumors: ['Vi un lobo enorme cerca del puente. ¡Era así de grande!', 'La herrera Brunna hace las mejores espadas del mundo. Bueno, de la aldea.'],
    }),
  },
] satisfies NpcDef[];
