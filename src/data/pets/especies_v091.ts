/**
 * ESPECIES v0.9.1 (originales). Hábitats: 'bioma:<id>' (mundo procedural), 'lugar:<tipo>' (cueva, mazmorra, ruinas).
 *   Hielo   : Escarchín → Ventisquero → Glaciarión | Auroral (vínculo ≥ 60)
 *   Rayo    : Chispín → Relampagal → Tormentario
 *   Pantano : Cienín → Venenal → Cienagón | Sombralisco (naturaleza astuta/osada)
 *   Desierto: Arenín → Escarabón → Faraonte | Solarión (piedra solar)
 *   Costa   : Medusín → Medusal | Voltaica (piedra de trueno)
 *   Bosque  : Bayín → Zorrobosque
 *   Alternativas de los iniciales y de Roquedón/Umbracán/Aurelión (etapa 3).
 */
import type { PetPassive, PetSpeciesDef, PetStats, PetType } from '../schema';

type Look = PetSpeciesDef['look'];
const g = (hp: number, atk: number, def: number, spd: number, mag: number): PetStats => ({ hp, atk, def, spd, mag });
const mv = (...a: Array<[number, string]>) => a.map(([level, move]) => ({ level, move }));

function sp(id: string, name: string, type: PetType, stage: 1 | 2 | 3, rarity: PetSpeciesDef['rarity'], habitats: string[], description: string,
  base: PetStats, growth: PetStats, learnset: Array<[number, string]>, look: Look, extra: Partial<PetSpeciesDef> = {}): PetSpeciesDef {
  return { id, name, type, stage, rarity, catchable: habitats.length > 0, habitats, description, base, growth, learnset: mv(...learnset), look, ...extra };
}
const pa = (id: PetPassive['id'], name: string, description: string, power: number): PetPassive => ({ id, name, description, power });

export default [
  // ---------------------------------------------------------------- hielo
  sp('escarchin', 'Escarchín', 'hielo', 1, 'comun', ['bioma:nieve'], 'Un zorrito de pelaje blanco azulado que deja huellas de escarcha. Se acurruca contra quien le da calor.',
    g(14, 4, 4, 7, 6), g(2.9, 0.7, 0.6, 0.8, 0.9), [[1, 'placaje'], [1, 'carambano'], [4, 'garra_escarcha'], [8, 'armadura_hielo']],
    { shape: 'zorro', main: '#bfe4f4', dark: '#5a8aa8', accent: '#ffffff', eye: '#1a2a6a' },
    { evolutions: [{ species: 'ventisquero', level: 14 }, { species: 'auroral', level: 14, minBond: 60 }] }),
  sp('ventisquero', 'Ventisquero', 'hielo', 2, 'raro', [], 'Su cola levanta ventiscas. Cuando corre, el suelo se cubre de hielo fino.',
    g(32, 9, 9, 11, 11), g(4, 0.9, 0.9, 0.9, 1.1), [[14, 'aliento_gelido'], [18, 'garra_escarcha'], [22, 'ventisca']],
    { shape: 'zorro', main: '#8ac8ea', dark: '#2a5a8a', accent: '#e8f8ff', eye: '#ffffff' },
    { evolutions: [{ species: 'glaciarion', level: 24 }], passive: pa('tenaz', 'Pelaje helado', 'Reduce en 1 el daño que recibe.', 1) }),
  sp('glaciarion', 'Glaciarión', 'hielo', 3, 'epico', [], 'Un zorro de cristal con nueve colas de hielo. Congela el aire con un suspiro.',
    g(58, 14, 15, 14, 18), g(5, 1.1, 1.1, 1, 1.3), [[24, 'ventisca'], [28, 'armadura_hielo']],
    { shape: 'zorro', main: '#5aa8da', dark: '#183a78', accent: '#ffffff', eye: '#60f0ff' },
    { passive: pa('vigia', 'Aura glacial', '+1 CA a su dueño mientras esté en pie.', 1) }),
  sp('auroral', 'Auroral', 'luz', 2, 'epico', [], 'Su pelaje reproduce los colores de la aurora. Calienta el corazón de quien lo cuida.',
    g(30, 8, 10, 13, 14), g(3.8, 0.7, 0.9, 1, 1.3), [[14, 'destello'], [16, 'aliento_gelido'], [20, 'aura_sanadora']],
    { shape: 'zorro', main: '#c8b0f8', dark: '#5a4aa8', accent: '#80ffd0', eye: '#ffffff' },
    { passive: pa('cuidador', 'Luz de aurora', 'Cura 2 PV a su dueño al empezar su turno.', 2) }),
  // ---------------------------------------------------------------- rayo
  sp('chispin', 'Chispín', 'rayo', 1, 'comun', ['bioma:pradera', 'bioma:montana'], 'Un pajarillo eléctrico que se posa en las espadas. Su pelusa suelta chispas cuando se enfada.',
    g(12, 5, 3, 9, 6), g(2.6, 0.8, 0.5, 1, 0.9), [[1, 'placaje'], [1, 'chispazo'], [4, 'colmillo_rayo'], [8, 'carga_estatica']],
    { shape: 'pajaro', main: '#f0d840', dark: '#a07a10', accent: '#ffffff', eye: '#1a1a1a' },
    { evolutions: [{ species: 'relampagal', level: 14 }] }),
  sp('relampagal', 'Relampagal', 'rayo', 2, 'raro', ['bioma:montana'], 'Vuela tan rápido que el trueno llega después. Anida en las cumbres azotadas por tormentas.',
    g(28, 10, 7, 15, 12), g(3.6, 1, 0.7, 1.2, 1.1), [[14, 'descarga'], [18, 'cadena_rayos'], [22, 'carga_estatica']],
    { shape: 'pajaro', main: '#e8c020', dark: '#6a4a08', accent: '#fff8c0', eye: '#2030c0' },
    { evolutions: [{ species: 'tormentario', level: 26 }] }),
  sp('tormentario', 'Tormentario', 'rayo', 3, 'epico', [], 'Un ave de tormenta con alas de nube. Cada aleteo es un relámpago.',
    g(50, 15, 11, 20, 19), g(4.6, 1.2, 0.9, 1.4, 1.4), [[26, 'rayo_fulminante'], [28, 'cadena_rayos']],
    { shape: 'pajaro', main: '#6a78d8', dark: '#1a1a5a', accent: '#f8f060', eye: '#ffffff' },
    { passive: pa('furia', 'Ojo de la tormenta', '+4 ataque y magia con menos de la mitad de PV.', 4) }),
  // -------------------------------------------------------------- pantano
  sp('cienin', 'Cienín', 'planta', 1, 'comun', ['bioma:pantano'], 'Una culebrilla verde que vive entre el cieno. Tímida, pero su mordisco pica.',
    g(14, 5, 4, 6, 5), g(2.9, 0.8, 0.6, 0.7, 0.8), [[1, 'placaje'], [1, 'espina_venenosa'], [4, 'esporas'], [8, 'drenaje']],
    { shape: 'serpiente', main: '#6a9a3a', dark: '#2a4a1a', accent: '#d8e070', eye: '#c02020' },
    { evolutions: [{ species: 'venenal', level: 13 }] }),
  sp('venenal', 'Venenal', 'planta', 2, 'raro', ['bioma:pantano'], 'Mide tres metros y se camufla como una liana. Su veneno huele a flores.',
    g(30, 10, 8, 9, 11), g(3.8, 1, 0.8, 0.8, 1), [[13, 'espina_venenosa'], [17, 'hojas_navaja'], [21, 'drenaje']],
    { shape: 'serpiente', main: '#4a8a2a', dark: '#1a3a10', accent: '#e060c0', eye: '#f0e020' },
    { evolutions: [{ species: 'cienagon', level: 24 }, { species: 'sombralisco', level: 24, natures: ['astuta', 'osada', 'fogosa'] }],
      passive: pa('cazador', 'Toxina', '+2 de daño a enemigos con estados alterados.', 2) }),
  sp('cienagon', 'Cienagón', 'planta', 3, 'epico', [], 'El rey de las ciénagas. Cada mordisco le devuelve fuerzas.',
    g(56, 15, 13, 11, 15), g(5.2, 1.2, 1, 0.8, 1.2), [[24, 'drenaje'], [28, 'canto_floral']],
    { shape: 'serpiente', main: '#2a6a1a', dark: '#0a2a08', accent: '#80f040', eye: '#ffffff' },
    { passive: pa('regen', 'Cieno vital', 'Recupera 3 PV al empezar su turno.', 3) }),
  sp('sombralisco', 'Sombralisco', 'sombra', 3, 'epico', [], 'Un basilisco de bruma oscura. Su mirada paraliza y su mordisco roba la vida.',
    g(48, 16, 11, 14, 17), g(4.4, 1.3, 0.9, 1, 1.3), [[24, 'bocado_vampirico'], [26, 'pesadilla'], [29, 'eclipse']],
    { shape: 'serpiente', main: '#4a3a7a', dark: '#140a28', accent: '#c060ff', eye: '#ffe040' },
    { passive: pa('cazador', 'Mirada paralizante', '+3 de daño a enemigos con estados alterados.', 3) }),
  // ------------------------------------------------------------- desierto
  sp('arenin', 'Arenín', 'tierra', 1, 'comun', ['bioma:desierto'], 'Un escarabajo dorado que rueda bolitas de arena. Nunca se separa de la suya.',
    g(15, 5, 6, 4, 3), g(3, 0.9, 1, 0.5, 0.5), [[1, 'placaje'], [1, 'arena_ciega'], [4, 'lanzarrocas'], [8, 'coraza_piedra']],
    { shape: 'escarabajo', main: '#d8b050', dark: '#7a5a20', accent: '#fff0a0', eye: '#1a1a1a' },
    { evolutions: [{ species: 'escarabon', level: 14 }] }),
  sp('escarabon', 'Escarabón', 'tierra', 2, 'raro', ['bioma:desierto'], 'Su coraza refleja el sol. Entierra a sus rivales bajo dunas enteras.',
    g(36, 11, 13, 7, 8), g(4.4, 1, 1.2, 0.5, 0.7), [[14, 'embestida'], [18, 'tormenta_arena'], [22, 'muralla']],
    { shape: 'escarabajo', main: '#c89030', dark: '#5a3a10', accent: '#40c0d0', eye: '#f04020' },
    { evolutions: [{ species: 'faraonte', level: 26 }, { species: 'solarion', level: 22, item: 'piedra_solar' }],
      passive: pa('tenaz', 'Coraza solar', 'Reduce en 1 el daño que recibe.', 1) }),
  sp('faraonte', 'Faraonte', 'tierra', 3, 'epico', [], 'Un coloso de oro y arena que custodia tumbas olvidadas.',
    g(66, 17, 18, 9, 11), g(5.6, 1.2, 1.4, 0.5, 0.8), [[26, 'avalancha'], [29, 'muralla']],
    { shape: 'escarabajo', main: '#a87a20', dark: '#3a2808', accent: '#40e0f0', eye: '#ffffff' },
    { passive: pa('tenaz', 'Maldición del faraón', 'Reduce en 2 el daño que recibe.', 2) }),
  sp('solarion', 'Solarión', 'luz', 3, 'epico', [], 'Un escarabajo sagrado que empuja el sol cada mañana. Quema a lo oscuro.',
    g(52, 12, 14, 12, 18), g(4.8, 0.9, 1.1, 0.9, 1.4), [[22, 'lanza_solar'], [26, 'escudo_sagrado'], [29, 'sentencia']],
    { shape: 'escarabajo', main: '#ffd848', dark: '#b06810', accent: '#ffffff', eye: '#d03010' },
    { passive: pa('vigia', 'Luz del mediodía', '+1 CA a su dueño mientras esté en pie.', 1) }),
  // ---------------------------------------------------------------- costa
  sp('medusin', 'Medusín', 'agua', 1, 'comun', ['bioma:costa'], 'Una medusa pequeña que flota en la marea. Brilla de noche para no perderse.',
    g(15, 4, 3, 6, 7), g(3, 0.6, 0.5, 0.7, 1), [[1, 'chorro'], [1, 'aguijon_medusa'], [4, 'burbuja_escudo'], [8, 'niebla_curativa']],
    { shape: 'medusa', main: '#a0d8f8', dark: '#3a78b8', accent: '#ffffff', eye: '#103060' },
    { evolutions: [{ species: 'medusal', level: 14 }, { species: 'voltaica', level: 14, item: 'piedra_trueno' }] }),
  sp('medusal', 'Medusal', 'agua', 2, 'raro', ['bioma:costa'], 'Sus tentáculos acarician a los marineros heridos y curan sus golpes.',
    g(34, 8, 9, 10, 15), g(4, 0.7, 0.9, 0.8, 1.3), [[14, 'cascada'], [18, 'niebla_curativa'], [22, 'remolino']],
    { shape: 'medusa', main: '#70b8f0', dark: '#1a4a98', accent: '#f0ffff', eye: '#ffffff' },
    { passive: pa('cuidador', 'Tentáculos suaves', 'Cura 2 PV a su dueño al empezar su turno.', 2) }),
  sp('voltaica', 'Voltaica', 'rayo', 2, 'epico', [], 'Una medusa cargada de electricidad. Ilumina las cuevas marinas con relámpagos.',
    g(30, 9, 8, 13, 16), g(3.6, 0.8, 0.8, 1, 1.4), [[14, 'chispazo'], [18, 'cadena_rayos'], [24, 'rayo_fulminante']],
    { shape: 'medusa', main: '#f0e060', dark: '#8a6a10', accent: '#ffffff', eye: '#1a1a6a' },
    { passive: pa('furia', 'Sobrecarga', '+3 ataque y magia con menos de la mitad de PV.', 3) }),
  // --------------------------------------------------------------- bosque
  sp('bayin', 'Bayín', 'planta', 1, 'comun', ['bioma:bosque'], 'Un zorrillo del bosque que lleva bayas en la cola. Las comparte con quien le cae bien.',
    g(14, 5, 4, 7, 5), g(2.9, 0.8, 0.6, 0.8, 0.8), [[1, 'placaje'], [1, 'latigo_cepa'], [4, 'espina_venenosa'], [8, 'fotosintesis']],
    { shape: 'zorro', main: '#7ab048', dark: '#2a5a1a', accent: '#e04868', eye: '#1a1a1a' },
    { evolutions: [{ species: 'zorrobosque', level: 15 }] }),
  sp('zorrobosque', 'Zorrobosque', 'planta', 2, 'raro', ['bioma:bosque'], 'Su cola es un arbusto frutal. Los ciervos le siguen por donde pasa.',
    g(32, 11, 9, 12, 10), g(4, 1.1, 0.8, 1, 0.9), [[15, 'hojas_navaja'], [19, 'aullido_valor'], [23, 'canto_floral']],
    { shape: 'zorro', main: '#4a9a30', dark: '#1a4a10', accent: '#f06080', eye: '#f0d030' },
    { passive: pa('vigia', 'Frutos del bosque', '+1 CA a su dueño mientras esté en pie.', 1) }),
  // -------------------------------------------- alternativas / etapa 3
  sp('alboran', 'Alborán', 'luz', 3, 'epico', [], 'Un lagarto de luz del alba. Evoluciona sólo con quien confía plenamente en él.',
    g(54, 15, 13, 13, 18), g(5, 1.1, 1, 0.9, 1.3), [[18, 'lanza_solar'], [22, 'fulgor'], [26, 'aura_sanadora']],
    { shape: 'lagarto', main: '#ffd878', dark: '#c87020', accent: '#ffffff', eye: '#d03030' },
    { passive: pa('cuidador', 'Calor del alba', 'Cura 3 PV a su dueño al empezar su turno.', 3) }),
  sp('tormenton', 'Tormentón', 'rayo', 3, 'epico', [], 'Una nutria de tormenta con el pelo erizado. Nada entre rayos sin inmutarse.',
    g(56, 13, 13, 14, 18), g(5, 1, 1.1, 0.9, 1.3), [[18, 'descarga'], [22, 'cadena_rayos'], [26, 'rayo_fulminante']],
    { shape: 'nutria', main: '#5a7ae0', dark: '#1a2a78', accent: '#fff060', eye: '#ffffff' },
    { passive: pa('furia', 'Pelo de rayo', '+4 ataque y magia con menos de la mitad de PV.', 4) }),
  sp('espectron', 'Espectrón', 'sombra', 3, 'epico', [], 'Un brote marchito que ha aprendido a susurrar a los espectros.',
    g(52, 15, 12, 11, 17), g(4.8, 1.1, 1, 0.8, 1.3), [[18, 'bocado_vampirico'], [22, 'pesadilla'], [27, 'eclipse']],
    { shape: 'brote', main: '#6a4a8a', dark: '#1a0a2a', accent: '#c060e0', eye: '#ffe040' },
    { passive: pa('cazador', 'Marchitar', '+3 de daño a enemigos con estados alterados.', 3) }),
  sp('montanon', 'Montañón', 'tierra', 3, 'epico', [], 'Tan grande que le crecen árboles en el caparazón. Es un muro vivo.',
    g(72, 16, 20, 7, 8), g(6, 1.2, 1.5, 0.4, 0.5), [[22, 'avalancha'], [26, 'muralla']],
    { shape: 'armadillo', main: '#6a5a48', dark: '#241c14', accent: '#60c040', eye: '#f0a020' },
    { passive: pa('tenaz', 'Montaña viviente', 'Reduce en 2 el daño que recibe.', 2) }),
  sp('cristalon', 'Cristalón', 'hielo', 3, 'epico', [], 'Su caparazón es un glaciar. Se rompe en esquirlas que no se derriten jamás.',
    g(64, 15, 18, 8, 14), g(5.6, 1.1, 1.4, 0.5, 1), [[22, 'ventisca'], [26, 'armadura_hielo']],
    { shape: 'armadillo', main: '#9ad8f0', dark: '#3a6a98', accent: '#ffffff', eye: '#2040c0' },
    { passive: pa('vigia', 'Escudo de cristal', '+1 CA a su dueño mientras esté en pie.', 1) }),
  sp('noctambulo', 'Noctámbulo', 'sombra', 3, 'epico', [], 'Un gran murciélago de sombra: los gremios de ladrones lo veneran como talismán.',
    g(56, 17, 11, 18, 15), g(4.8, 1.3, 0.8, 1.3, 1.1), [[24, 'garra_espectral'], [27, 'eclipse']],
    { shape: 'murcielago', main: '#1a1030', dark: '#050308', accent: '#ff60a0', eye: '#ffe040' },
    { passive: pa('cazador', 'Acechador', '+3 de daño a enemigos con estados alterados.', 3) }),
  sp('serafon', 'Serafón', 'luz', 3, 'epico', [], 'Un serafín de pluma dorada. Su canto sana heridas y espanta a los demonios.',
    g(52, 10, 14, 17, 22), g(4.6, 0.7, 1.1, 1.1, 1.6), [[25, 'sentencia'], [28, 'fulgor']],
    { shape: 'hada', main: '#fff0a0', dark: '#d09020', accent: '#ffffff', eye: '#c03010' },
    { passive: pa('cuidador', 'Canto sanador', 'Cura 3 PV a su dueño al empezar su turno.', 3) }),
] satisfies PetSpeciesDef[];
