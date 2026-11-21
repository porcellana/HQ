/** PNJ de Puerto Ceniza. */
import { npcDialog } from '../helpers';
import type { NpcDef } from '../schema';

export default [
  {
    id: 'maestre_doran', name: 'Doran', title: 'Maestre del gremio', zone: 'ciudad_gremio', x: 4, y: 2,
    look: { overlay: 'guerrero', cloth: '#5a4a6a', clothDark: '#3a2a4a', pants: '#2a2420', hat: '#d8b050', hair: '#1a1418' },
    dialog: npcDialog({
      greeting: 'El tablón del gremio siempre tiene encargos. Cumple y cobra; así de simple.',
      quests: true,
      rumors: ['Los encargos del tablón se renuevan: vuelve cuando quieras más trabajo.', 'Un nigromante... sí, he oído ese nombre. Velkar. Mejor no repetirlo en voz alta.'],
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
    }),
  },
  {
    id: 'herrero_garrik', name: 'Garrik', title: 'Herrero', zone: 'ciudad_herreria', x: 3, y: 2,
    look: { overlay: 'guerrero', cloth: '#4a3a2a', clothDark: '#2a2018', pants: '#2a2420', hat: '#3a3a40', hair: '#3a2418', skin: '#b07850' },
    dialog: npcDialog({
      greeting: 'La Forja del Ancla. El mejor acero del puerto, y el más caro. Se nota.',
      shop: 'forja_ancla',
      rumors: ['Mi prima Brunna forja en Brumaroja. Buena mano, poco carbón.', 'Las armas a dos manos pegan más, pero adiós al escudo.'],
    }),
  },
  {
    id: 'posadero_tobias', name: 'Tobías', title: 'Posadero', zone: 'ciudad_posada', x: 2, y: 2,
    look: { cloth: '#6a5a3a', clothDark: '#4a3a20', pants: '#3a3028', hair: '#c8c0c8' },
    dialog: npcDialog({
      greeting: 'Posada El Faro: camas limpias y vistas al mar. Bueno, al puerto.',
      inn: 20,
      rumors: ['Los marineros hablan de luces raras en las criptas bajo la ciudad.', 'Aquí se descansa caro, pero se descansa bien.'],
    }),
  },
  {
    id: 'hermana_lysa', name: 'Hermana Lysa', title: 'Sacerdotisa', zone: 'ciudad_templo', x: 6, y: 2,
    look: { overlay: 'clerigo', cloth: '#e8e0d0', clothDark: '#b8ac90', pants: '#6a5a4a', hat: '#d8b050', hair: '#3a2418' },
    dialog: npcDialog({
      greeting: 'La Llama Blanca te da la bienvenida, viajero.',
      temple: 5,
      quests: true,
      rumors: ['El símbolo de los cultistas es un ojo dentro de un abismo. Lo he visto en sueños.', 'Si caes, el templo donde hayas sanado te traerá de vuelta.'],
    }),
  },
  {
    id: 'mercader_fabio', name: 'Fabio', title: 'Mercader', zone: 'puerto_ceniza', x: 14, y: 26,
    look: { cloth: '#8a6a2a', clothDark: '#5a4418', pants: '#3a3028', hat: '#6a2a2a', hair: '#1a1418', skin: '#b07850' },
    dialog: npcDialog({
      greeting: '¡Mercancía de todos los puertos! Baratijas, víveres y algún anillo con historia.',
      shop: 'mercado_ceniza',
      rumors: ['Compro casi de todo, pero pago lo justo. Con labia, algo más.'],
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
        'Hemos detenido a dos encapuchados con túnicas rojas este mes. No hablaron.',
      ],
    }),
  },
] satisfies NpcDef[];
