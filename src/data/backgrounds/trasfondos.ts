/**
 * TRASFONDOS: quién eras antes de ser aventurero. Dan una pequeña ventaja,
 * competencias en habilidades sociales y abren opciones de diálogo exclusivas
 * (las opciones con `ifBackground: 'soldado'`, etc.).
 */
import type { BackgroundDef } from '../schema';

export default [
  {
    id: 'soldado', name: 'Soldado', icon: '🛡️',
    description: 'Serviste en la guardia de Puerto Ceniza hasta que la guerra terminó... o hasta que tú terminaste con ella.',
    feature: 'Reconoces insignias, rangos y desertores. Los guardias te tratan como a uno de los suyos.',
    statBonus: { FUE: 1 }, proficiencies: ['atletismo', 'intimidacion'],
    startingItems: [{ item: 'casco_hierro' }], gold: 10,
  },
  {
    id: 'ladron', name: 'Ladrón callejero', icon: '🗝️',
    description: 'Creciste en los muelles robando carteras. Sabes qué puertas se abren de noche y quién compra sin preguntar.',
    feature: 'Conoces a los peristas y el lenguaje de los bajos fondos. Algunos tenderos te venden «la otra mercancía».',
    statBonus: { DES: 1 }, proficiencies: ['juego_manos', 'engano'],
    startingItems: [{ item: 'daga' }, { item: 'antidoto' }], gold: 25,
  },
  {
    id: 'erudito', name: 'Erudito', icon: '📚',
    description: 'Pasaste años entre los legajos de la biblioteca de Ceniza, hasta que un libro prohibido te sacó de allí.',
    feature: 'Sabes leer runas antiguas y detectas mentiras en los textos (y en la gente).',
    statBonus: { INT: 1 }, proficiencies: ['arcanos', 'perspicacia'],
    startingItems: [{ item: 'tomo_arcano' }],
  },
  {
    id: 'noble', name: 'Noble caído', icon: '👑',
    description: 'Tu familia lo tenía todo hasta que el Abismo se lo llevó. Te queda el apellido, un anillo y el orgullo.',
    feature: 'Los poderosos te reciben y a veces te deben favores. Los pobres desconfían de ti.',
    statBonus: { CAR: 1 }, proficiencies: ['persuasion', 'intimidacion'],
    startingItems: [{ item: 'anillo_plata' }], gold: 60,
  },
  {
    id: 'acolito', name: 'Acólito', icon: '🕯️',
    description: 'Criado en la capilla de Brumaroja por la Madre Ilse. Conoces cada oración... y cada secreto del confesionario.',
    feature: 'El clero te escucha. Notas cuándo alguien carga con una culpa.',
    statBonus: { SAB: 1 }, proficiencies: ['perspicacia', 'persuasion'],
    startingItems: [{ item: 'simbolo_sagrado' }, { item: 'pocion_curacion' }],
  },
  {
    id: 'cazador', name: 'Cazador del bosque', icon: '🏹',
    description: 'Viviste solo en el Bosque Sombrío, cazando para la aldea, hasta que la niebla roja espantó a toda presa.',
    feature: 'Sabes moverte sin ruido y leer las huellas. Las bestias no te pillan por sorpresa.',
    statBonus: { CON: 1 }, proficiencies: ['sigilo', 'atletismo'],
    startingItems: [{ item: 'carne_seca', qty: 4 }, { item: 'arco_corto' }],
  },
  {
    id: 'aventurero', name: 'Aventurero', icon: '🎒', hidden: true,
    description: 'Tu pasado es cosa tuya.',
    feature: 'Sin ventajas ni ataduras.',
    proficiencies: [],
  },
] satisfies BackgroundDef[];
