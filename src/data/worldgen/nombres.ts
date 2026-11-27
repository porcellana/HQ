/**
 * Textos y nombres del mundo procedural (v0.8). No es una carpeta que cargue el
 * registro: la importa el generador (src/game/world/procgen). Edita libremente.
 */
export interface WorldgenText {
  settlementPrefix: string[];
  settlementSuffix: string[];
  /** Sustantivo + epíteto por tipo de lugar especial. */
  place: Record<'campamento' | 'ruinas' | 'cueva' | 'mazmorra', { nouns: string[]; epithets: string[] }>;
  /** Tipos de asentamiento: título del líder y adjetivos. */
  settlement: Record<'aldea' | 'pueblo' | 'ciudad', { noun: string; leader: string }>;
  firstNames: string[];
  /** Saludos genéricos de aldeanos. */
  villagerGreetings: string[];
  shopGreetings: string[];
  innGreetings: string[];
  smithGreetings: string[];
  leaderGreetings: string[];
  templeGreetings: string[];
  campGreetings: string[];
  /** Rumores: {place} se sustituye por un lugar cercano. */
  rumors: string[];
  /** Subterráneos generados: cuevas y mazmorras. */
  underground: Record<'cueva' | 'mazmorra', {
    wall: string; floor: string; darkness: number; chestLoot: string;
    enemies: Array<{ enemy: string; weight: number; min?: number; max?: number }>;
  }>;
  /** Jefes de mazmorra por nivel mínimo de la zona (se escalan al nivel de la zona). */
  bosses: Array<{ minLevel: number; enemy: string }>;
  /** Plantillas de misión. */
  quest: {
    killName: string[];
    killDesc: string[];
    collectName: string[];
    collectDesc: string[];
    visitName: string[];
    visitDesc: string[];
    deliverName: string[];
    deliverDesc: string[];
    bossName: string[];
    bossDesc: string[];
    complete: string[];
  };
}

const w: WorldgenText = {
  settlementPrefix: ['Vil', 'Alder', 'Brum', 'Kor', 'Tral', 'Mir', 'Hel', 'Dun', 'Ost', 'Fen', 'Sar', 'Quel', 'Nor', 'Zar', 'Lum', 'Gar', 'Ber', 'Cal', 'Rav', 'Tor'],
  settlementSuffix: ['dena', 'burgo', 'mar', 'fuerte', 'vado', 'hoyo', 'monte', 'valle', 'cruz', 'puente', 'ley', 'sol', 'peña', 'nava', 'fuente'],
  place: {
    campamento: { nouns: ['Campamento', 'Vivac', 'Refugio', 'Parada'], epithets: ['del Mercader', 'de los Cazadores', 'del Último Fuego', 'del Viajero', 'de la Compañía Errante'] },
    ruinas: { nouns: ['Ruinas', 'Atalaya', 'Templo Caído', 'Fortín', 'Torre'], epithets: ['Olvidadas', 'del Rey Mudo', 'de Ceniza', 'Antiguas', 'del Cuervo'] },
    cueva: { nouns: ['Cueva', 'Gruta', 'Cavernas', 'Sima', 'Madriguera'], epithets: ['del Eco', 'Oscura', 'de los Murciélagos', 'Profunda', 'del Silencio'] },
    mazmorra: { nouns: ['Cripta', 'Mazmorra', 'Catacumbas', 'Fortaleza', 'Santuario'], epithets: ['del Abismo', 'Maldita', 'del Nigromante', 'Sepultada', 'de las Sombras'] },
  },
  underground: {
    cueva: {
      wall: 'muro_cueva', floor: 'suelo_cueva', darkness: 0.22, chestLoot: 'cofre',
      enemies: [
        { enemy: 'rata_gigante', weight: 4, min: 2, max: 3 }, { enemy: 'goblin', weight: 4, min: 2, max: 3 },
        { enemy: 'arana_gigante', weight: 2, min: 1, max: 2 }, { enemy: 'lobo', weight: 2, min: 1, max: 2 }, { enemy: 'esqueleto', weight: 1, min: 1, max: 2 },
      ],
    },
    mazmorra: {
      wall: 'muro_cripta', floor: 'suelo_cripta', darkness: 0.3, chestLoot: 'cofre',
      enemies: [
        { enemy: 'esqueleto', weight: 4, min: 2, max: 3 }, { enemy: 'esqueleto_arquero', weight: 3, min: 1, max: 2 }, { enemy: 'zombi', weight: 3, min: 1, max: 2 },
        { enemy: 'cultista', weight: 2, min: 1, max: 2 }, { enemy: 'arana_cazadora', weight: 1, min: 1, max: 1 }, { enemy: 'caballero_esqueleto', weight: 1, min: 1, max: 1 },
      ],
    },
  },
  bosses: [{ minLevel: 1, enemy: 'rey_goblin' }, { minLevel: 6, enemy: 'reina_arana' }, { minLevel: 9, enemy: 'nigromante' }],
  settlement: {
    aldea: { noun: 'Aldea', leader: 'Anciano' },
    pueblo: { noun: 'Pueblo', leader: 'Alcalde' },
    ciudad: { noun: 'Ciudad', leader: 'Regente' },
  },
  firstNames: ['Aldric', 'Brenna', 'Cora', 'Doran', 'Elda', 'Fenn', 'Gisa', 'Harl', 'Ilsa', 'Joran', 'Kira', 'Lorn', 'Mara', 'Nils', 'Orla', 'Pell', 'Quin', 'Rhea', 'Sten', 'Tamsin', 'Ulf', 'Vera', 'Wren', 'Yara', 'Zeno'],
  villagerGreetings: ['Buen día, viajero.', 'No sueles ver caras nuevas por aquí.', '¿Vienes de lejos? Se te nota en las botas.', 'Cuidado en los caminos, últimamente hay mucho movimiento.'],
  shopGreetings: ['¡Pasa, pasa! Mira lo que traigo.', 'Todo a buen precio, y lo que no, regateable.', 'Mercancía fresca de la última caravana.'],
  innGreetings: ['Una cama caliente y un guiso: lo mejor del camino.', 'Aquí se duerme como un bendito. ¿Te quedas?'],
  smithGreetings: ['El acero no se forja solo. ¿Qué necesitas?', 'Armas y armaduras, sin prisas pero sin pausa.'],
  leaderGreetings: ['Gracias a los dioses, alguien con espada. Tenemos problemas.', 'Bienvenido. Aquí siempre hay trabajo para quien sepa defenderse.'],
  templeGreetings: ['Que la llama te guarde. ¿Buscas sanación?', 'La paz sea contigo, viajero.'],
  campGreetings: ['Siéntate junto al fuego. Aquí nadie pregunta.', 'Cuidado ahí fuera. Tengo mercancía si te interesa.'],
  rumors: [
    'Dicen que cerca está {place}. Vale la pena echar un vistazo... si tienes valor.',
    'Un cazador volvió de {place} contando cosas que no me atrevo a repetir.',
    'Me han hablado de tesoros en {place}, pero también de monstruos.',
    'Si vas hacia {place}, lleva pociones. Muchas pociones.',
  ],
  quest: {
    killName: ['Plaga de {enemy}', 'Cazar {enemy}', 'Limpiar el camino', 'Amenaza en {zone}'],
    killDesc: ['Los {enemy} de {zone} no dejan vivir a nadie. Acaba con {n}.', 'Necesitamos que alguien reduzca los {enemy} de {zone}: {n} bastarán.'],
    collectName: ['Encargo de {item}', 'Suministros: {item}', 'Se busca {item}'],
    collectDesc: ['Reúne {n} × {item}. Se consiguen en {zone}.', 'Necesito {n} × {item} y no puedo ir yo. Prueba en {zone}.'],
    visitName: ['Explorar {zone}', 'Noticias de {zone}', 'Reconocimiento'],
    visitDesc: ['Nadie ha vuelto de {zone} con detalles. Ve, mira y regresa a contarlo.', 'Quiero saber qué hay en {zone}. Ve a echar un vistazo.'],
    deliverName: ['Mensaje para {npc}', 'Un recado a {zone}', 'Entrega urgente'],
    deliverDesc: ['Lleva mis saludos y este paquete a {npc}, en {zone}. Es de confianza.', 'Necesito que {npc}, de {zone}, reciba mi mensaje cuanto antes.'],
    bossName: ['El horror de {zone}', 'Acabar con {enemy}', 'La sombra bajo {zone}'],
    bossDesc: ['{enemy} acecha en {zone}. Mientras viva, no dormiremos tranquilos.', 'Algo terrible mora en {zone}: {enemy}. Derrótalo.'],
    complete: ['Sabía que podía contar contigo. Toma tu recompensa.', 'Excelente trabajo. La gente de por aquí te lo agradecerá.', 'Cumpliste. Es poco, pero es de corazón.'],
  },
};

export default w;
