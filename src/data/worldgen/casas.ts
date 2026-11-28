/**
 * Casas con interior del mundo procedural (v0.14). No es una carpeta que cargue el registro:
 * la importa el generador de interiores (src/game/world/procgen/interiors.ts).
 */
export type HouseRole = 'tienda' | 'posada' | 'herrero' | 'alquimista' | 'armero' | 'templo' | 'gremio' | 'magos' | 'negro' | 'casa';

export interface HouseKind {
  /** Nombre del interior; {town} = nombre del asentamiento, {name} = del residente. */
  name: string;
  /** Tamaño [ancho, alto] (interior incluido el muro). */
  size: [number, number];
  /** Música/ambiente del interior (id de data/music). */
  music: string;
  /** Posibilidad de que haya un cofre (0..1) y cuántos como máximo. */
  chest: [number, number];
}

export const HOUSE_KINDS: Record<HouseRole, HouseKind> = {
  tienda: { name: 'Tienda de {town}', size: [11, 8], music: 'aldea', chest: [0.35, 1] },
  posada: { name: 'Posada de {town}', size: [13, 9], music: 'aldea', chest: [0.6, 1] },
  herrero: { name: 'Herrería de {town}', size: [11, 8], music: 'aldea', chest: [0.4, 1] },
  alquimista: { name: 'Alquimia de {town}', size: [11, 8], music: 'aldea', chest: [0.5, 1] },
  armero: { name: 'Armería de {town}', size: [11, 8], music: 'aldea', chest: [0.4, 1] },
  templo: { name: 'Templo de {town}', size: [11, 9], music: 'aldea', chest: [0.5, 1] },
  gremio: { name: 'Gremio de {town}', size: [13, 8], music: 'aldea', chest: [0.5, 1] },
  magos: { name: 'Torre de los Arcanos de {town}', size: [11, 8], music: 'aldea', chest: [0.7, 1] },
  negro: { name: 'Trastienda de {town}', size: [11, 8], music: 'aldea', chest: [0.8, 2] },
  casa: { name: 'Casa de {name}', size: [11, 8], music: 'aldea', chest: [0.85, 2] },
};

/** Residentes de las casas corrientes: oficio, saludo y, a veces, un favor que pedir. */
export const RESIDENTS: Array<{ title: string; greetings: string[] }> = [
  { title: 'Leñador', greetings: ['Pase, pase, pero no pise el serrín.', 'El hogar está caliente; el sidra, no tanto.'] },
  { title: 'Costurera', greetings: ['Cuidado con las agujas, forastero.', 'Ya casi acabo este remiendo. ¿Qué necesitas?'] },
  { title: 'Cazador retirado', greetings: ['Las trampas de la pared ya no cazan nada. Yo tampoco.', 'Siéntate. Tengo historias y poco más.'] },
  { title: 'Anciana', greetings: ['Ay, visita. Hace tiempo que nadie llama a esta puerta.', 'Mis rodillas ya no suben al desván, pero mi memoria sí.'] },
  { title: 'Panadero', greetings: ['Huele a pan, ¿verdad? Es lo único que sé hacer bien.', 'Llegas justo a tiempo: la hornada acaba de salir.'] },
  { title: 'Tejedor', greetings: ['El telar no se detiene. Habla mientras trabajo.', 'Esta lana es de la mejor de la comarca.'] },
  { title: 'Pescador', greetings: ['Perdona el olor. Es el oficio.', 'Hoy no hubo suerte con las redes.'] },
  { title: 'Escribano', greetings: ['Silencio, por favor... ah, no, ya terminé. Dime.', 'Cartas, contratos, testamentos. ¿Qué te trae?'] },
];

/** Pedidos de vecinos: título de misión y descripción (las completa un objetivo normal). */
export const HOUSE_RUMORS: string[] = [
  'Dicen que hay un viajero que escolta a gente a salvo de pueblo en pueblo. Cobra poco, pero no falla.',
  'No salgas de noche sin luz. Los caminos ya no son lo que eran.',
  'Mi cuñado encontró un cofre enterrado junto a un santuario. Juró que no era suyo y lo devolvió. Tonto.',
  'Las tormentas del camino sorprenden hasta a los más veteranos. Busca refugio a tiempo.',
];
