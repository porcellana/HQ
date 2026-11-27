/**
 * ESPECIES DE MASCOTA (todas originales).
 * Líneas evolutivas:
 *   Fuego  : Chispón → Brasalón → Volcandor        (inicial)
 *   Agua   : Gotín → Marejón → Tritonal            (inicial)
 *   Planta : Brotín → Ramaleón → Bosquerón         (inicial)
 *   Tierra : Guijarrín → Roquedón → Montañón | Cristalón (piedra de escarcha)
 *   Sombra : Umbrín → Umbracán                     (salvaje: cuevas y cripta)
 *   Luz    : Destellín → Aurelión                  (salvaje, rara: Paso Gris y Galerías)
 * Estadística a nivel N = base + crecimiento × (N − 1).
 */
import type { PetSpeciesDef } from '../schema';

const starterGrowth = { hp: 3, atk: 0.8, def: 0.6, spd: 0.6, mag: 0.8 };

export default [
  // ------------------------------------------------------------------ fuego
  {
    id: 'chispon', name: 'Chispón', type: 'fuego', stage: 1, rarity: 'comun', catchable: false, starter: true, habitats: [],
    description: 'Una lagartija de brasas que no para quieta. Deja huellas chamuscadas y se ofende si la llamas "pequeña".',
    base: { hp: 14, atk: 5, def: 3, spd: 6, mag: 5 }, growth: starterGrowth,
    learnset: [{ level: 1, move: 'placaje' }, { level: 1, move: 'ascua' }, { level: 4, move: 'calor_interior' }, { level: 7, move: 'garra_ignea' }, { level: 12, move: 'llamarada' }],
    evolutions: [{ species: 'brasalon', level: 8 }],
    look: { shape: 'lagarto', main: '#e0602a', dark: '#8a2a1a', accent: '#f2d050', eye: '#1a0a0a' },
  },
  {
    id: 'brasalon', name: 'Brasalón', type: 'fuego', stage: 2, rarity: 'raro', catchable: false, habitats: [],
    description: 'Su lomo está cubierto de escamas incandescentes. Duerme encima de las chimeneas y protege a los suyos con fiereza.',
    base: { hp: 30, atk: 10, def: 7, spd: 9, mag: 10 }, growth: { hp: 4, atk: 1, def: 0.8, spd: 0.7, mag: 1 },
    learnset: [{ level: 12, move: 'llamarada' }, { level: 15, move: 'temblor' }, { level: 18, move: 'rafaga_brasas' }],
    passive: { id: 'furia', name: 'Sangre caliente', description: '+3 ataque y magia con menos de la mitad de PV.', power: 3 },
    evolutions: [{ species: 'volcandor', level: 16 }, { species: 'alboran', level: 16, minBond: 70 }],
    look: { shape: 'lagarto', main: '#c8401a', dark: '#6a1a10', accent: '#f2a030', eye: '#f2d050' },
  },
  {
    id: 'volcandor', name: 'Volcandor', type: 'fuego', stage: 3, rarity: 'epico', catchable: false, habitats: [],
    description: 'Una bestia de roca fundida con cresta de llamas. Cuando ruge, el aire tiembla de calor.',
    base: { hp: 55, atk: 17, def: 12, spd: 12, mag: 17 }, growth: { hp: 5, atk: 1.2, def: 1, spd: 0.8, mag: 1.2 },
    learnset: [{ level: 20, move: 'bola_magma' }, { level: 24, move: 'ira_volcanica' }],
    passive: { id: 'furia', name: 'Furia volcánica', description: '+5 ataque y magia con menos de la mitad de PV.', power: 5 },
    look: { shape: 'lagarto', main: '#a02a10', dark: '#3a0a08', accent: '#ffd060', eye: '#ffffff' },
  },
  // ------------------------------------------------------------------- agua
  {
    id: 'gotin', name: 'Gotín', type: 'agua', stage: 1, rarity: 'comun', catchable: false, starter: true, habitats: [],
    description: 'Una nutria regordeta que siempre lleva una piedrecita favorita. Tranquila, leal y algo glotona.',
    base: { hp: 16, atk: 4, def: 4, spd: 5, mag: 5 }, growth: starterGrowth,
    learnset: [{ level: 1, move: 'placaje' }, { level: 1, move: 'chorro' }, { level: 4, move: 'burbuja_escudo' }, { level: 7, move: 'marea_curativa' }, { level: 12, move: 'remolino' }],
    evolutions: [{ species: 'marejon', level: 8 }],
    look: { shape: 'nutria', main: '#3a8ad8', dark: '#1a4a8a', accent: '#d8f0ff', eye: '#0a0a1a' },
  },
  {
    id: 'marejon', name: 'Marejón', type: 'agua', stage: 2, rarity: 'raro', catchable: false, habitats: [],
    description: 'Nada contra corriente sólo por diversión. Las aletas de su cola cortan el agua como cuchillas.',
    base: { hp: 34, atk: 8, def: 9, spd: 9, mag: 10 }, growth: { hp: 4.2, atk: 0.9, def: 1, spd: 0.7, mag: 1 },
    learnset: [{ level: 12, move: 'remolino' }, { level: 15, move: 'coraza_piedra' }, { level: 18, move: 'cascada' }],
    passive: { id: 'regen', name: 'Piel húmeda', description: 'Recupera 2 PV al empezar su turno.', power: 2 },
    evolutions: [{ species: 'tritonal', level: 16 }, { species: 'tormenton', level: 16, item: 'piedra_trueno' }],
    look: { shape: 'nutria', main: '#2a6ac0', dark: '#0a2a6a', accent: '#a8e0ff', eye: '#f2d050' },
  },
  {
    id: 'tritonal', name: 'Tritonal', type: 'agua', stage: 3, rarity: 'epico', catchable: false, habitats: [],
    description: 'Señor de los arroyos. Dicen que su canto calma tormentas y cura a los marineros heridos.',
    base: { hp: 60, atk: 13, def: 15, spd: 12, mag: 16 }, growth: { hp: 5.2, atk: 1, def: 1.2, spd: 0.8, mag: 1.2 },
    learnset: [{ level: 20, move: 'cascada' }, { level: 24, move: 'niebla_curativa' }],
    passive: { id: 'cuidador', name: 'Canto sereno', description: 'Cura 3 PV a su dueño al empezar su turno.', power: 3 },
    look: { shape: 'nutria', main: '#1a4aa0', dark: '#08184a', accent: '#f2f8ff', eye: '#60f0ff' },
  },
  // ----------------------------------------------------------------- planta
  {
    id: 'brotin', name: 'Brotín', type: 'planta', stage: 1, rarity: 'comun', catchable: false, starter: true, habitats: [],
    description: 'Una semilla con patitas que se planta al sol cuando se cansa. Muy curiosa: lo toca todo con sus hojas.',
    base: { hp: 15, atk: 5, def: 4, spd: 4, mag: 5 }, growth: starterGrowth,
    learnset: [{ level: 1, move: 'placaje' }, { level: 1, move: 'latigo_cepa' }, { level: 4, move: 'esporas' }, { level: 7, move: 'fotosintesis' }, { level: 12, move: 'raices' }],
    evolutions: [{ species: 'ramaleon', level: 8 }],
    look: { shape: 'brote', main: '#4ab040', dark: '#1a5a1a', accent: '#f2a0c0', eye: '#0a1a0a' },
  },
  {
    id: 'ramaleon', name: 'Ramaleón', type: 'planta', stage: 2, rarity: 'raro', catchable: false, habitats: [],
    description: 'Una melena de hojas y un rugido que suena a ramas al viento. Protege los claros del bosque.',
    base: { hp: 32, atk: 10, def: 8, spd: 7, mag: 9 }, growth: { hp: 4, atk: 1, def: 0.9, spd: 0.6, mag: 0.9 },
    learnset: [{ level: 12, move: 'raices' }, { level: 15, move: 'temblor' }, { level: 18, move: 'drenaje' }],
    passive: { id: 'regen', name: 'Savia', description: 'Recupera 2 PV al empezar su turno.', power: 2 },
    evolutions: [{ species: 'bosqueron', level: 16 }, { species: 'espectron', level: 16, natures: ['astuta', 'curiosa', 'agil'] }],
    look: { shape: 'brote', main: '#2a8a2a', dark: '#0a3a10', accent: '#f2d050', eye: '#f2a020' },
  },
  {
    id: 'bosqueron', name: 'Bosquerón', type: 'planta', stage: 3, rarity: 'epico', catchable: false, habitats: [],
    description: 'Un guardián con un árbol entero creciendo en la espalda. Las bestias se apartan a su paso.',
    base: { hp: 62, atk: 16, def: 14, spd: 9, mag: 14 }, growth: { hp: 5.5, atk: 1.2, def: 1.1, spd: 0.6, mag: 1 },
    learnset: [{ level: 20, move: 'hojas_navaja' }, { level: 24, move: 'canto_floral' }],
    passive: { id: 'vigia', name: 'Sombra del bosque', description: '+1 CA a su dueño mientras esté en pie.', power: 1 },
    look: { shape: 'brote', main: '#1a6a1a', dark: '#0a2a08', accent: '#e05080', eye: '#ffffff' },
  },
  // ----------------------------------------------------------------- tierra
  {
    id: 'guijarrin', name: 'Guijarrín', type: 'tierra', stage: 1, rarity: 'comun', catchable: true, habitats: ['bosque_sombrio', 'paso_gris', 'bioma:montana', 'bioma:pradera'],
    description: 'Se hace bola en cuanto algo le asusta, y algo le asusta cada cinco minutos. Duro como una piedra.',
    base: { hp: 16, atk: 5, def: 6, spd: 3, mag: 2 }, growth: { hp: 3.2, atk: 0.9, def: 1, spd: 0.4, mag: 0.4 },
    learnset: [{ level: 1, move: 'placaje' }, { level: 3, move: 'lanzarrocas' }, { level: 6, move: 'coraza_piedra' }, { level: 10, move: 'temblor' }],
    evolutions: [{ species: 'roquedon', level: 10 }],
    look: { shape: 'armadillo', main: '#9a8a70', dark: '#4a3e30', accent: '#c8b898', eye: '#1a1a1a' },
  },
  {
    id: 'roquedon', name: 'Roquedón', type: 'tierra', stage: 2, rarity: 'raro', catchable: true, habitats: ['galerias_seda', 'bioma:montana'],
    description: 'Su caparazón es una muralla andante. Le gusta dormir la siesta en mitad de los caminos.',
    base: { hp: 40, atk: 11, def: 14, spd: 5, mag: 4 }, growth: { hp: 4.5, atk: 1, def: 1.3, spd: 0.4, mag: 0.4 },
    learnset: [{ level: 10, move: 'temblor' }, { level: 14, move: 'embestida' }, { level: 18, move: 'muralla' }],
    evolutions: [{ species: 'montanon', level: 22 }, { species: 'cristalon', level: 22, item: 'piedra_escarcha' }],
    passive: { id: 'tenaz', name: 'Caparazón', description: 'Reduce en 1 el daño que recibe.', power: 1 },
    look: { shape: 'armadillo', main: '#7a6a58', dark: '#2e261e', accent: '#e0a040', eye: '#f05020' },
  },
  // ----------------------------------------------------------------- sombra
  {
    id: 'umbrin', name: 'Umbrín', type: 'sombra', stage: 1, rarity: 'raro', catchable: true, habitats: ['cueva_goblin', 'cripta_velkar', 'lugar:cueva', 'bioma:pantano'],
    description: 'Un murcielaguito de humo negro. Sólo sale de noche y colecciona cosas brillantes que no son suyas.',
    base: { hp: 13, atk: 6, def: 3, spd: 8, mag: 5 }, growth: { hp: 2.8, atk: 1, def: 0.5, spd: 0.9, mag: 0.8 },
    learnset: [{ level: 1, move: 'mordisco' }, { level: 3, move: 'susurro' }, { level: 7, move: 'velo_noche' }, { level: 11, move: 'zarpa_umbria' }],
    evolutions: [{ species: 'umbracan', level: 11 }],
    look: { shape: 'murcielago', main: '#4a3a6a', dark: '#1a1028', accent: '#a080e0', eye: '#ff4060' },
  },
  {
    id: 'umbracan', name: 'Umbracán', type: 'sombra', stage: 2, rarity: 'epico', catchable: true, habitats: ['cripta_velkar', 'lugar:mazmorra'],
    description: 'Sus alas tapan la luna. Los cultistas creen que es un mal augurio; él sólo quiere que le rasquen detrás de la oreja.',
    base: { hp: 36, atk: 14, def: 8, spd: 14, mag: 11 }, growth: { hp: 4, atk: 1.2, def: 0.7, spd: 1, mag: 1 },
    learnset: [{ level: 11, move: 'zarpa_umbria' }, { level: 15, move: 'bocado_vampirico' }, { level: 20, move: 'pesadilla' }],
    evolutions: [{ species: 'noctambulo', level: 24 }],
    passive: { id: 'cazador', name: 'Cazador nocturno', description: '+2 de daño a enemigos con estados alterados.', power: 2 },
    look: { shape: 'murcielago', main: '#2a1a4a', dark: '#0a0614', accent: '#e060ff', eye: '#ffd040' },
  },
  // -------------------------------------------------------------------- luz
  {
    id: 'destellin', name: 'Destellín', type: 'luz', stage: 1, rarity: 'raro', catchable: true, habitats: ['paso_gris', 'galerias_seda', 'bioma:nieve', 'bioma:pradera'],
    description: 'Una lucecita con alas que zumba como una abeja. Se acerca a los heridos y los acompaña hasta que sanan.',
    base: { hp: 12, atk: 3, def: 4, spd: 7, mag: 7 }, growth: { hp: 2.8, atk: 0.4, def: 0.6, spd: 0.8, mag: 1.1 },
    learnset: [{ level: 1, move: 'destello' }, { level: 3, move: 'bendicion_luz' }, { level: 8, move: 'rayo_aurora' }],
    evolutions: [{ species: 'aurelion', level: 12 }],
    look: { shape: 'hada', main: '#f2e080', dark: '#a08a30', accent: '#ffffff', eye: '#3a2a0a' },
  },
  {
    id: 'aurelion', name: 'Aurelión', type: 'luz', stage: 2, rarity: 'epico', catchable: true, habitats: ['cripta_velkar', 'lugar:ruinas'],
    description: 'Un espíritu de amanecer con plumas de oro. Donde vuela, los no-muertos se deshacen en ceniza.',
    base: { hp: 34, atk: 7, def: 10, spd: 12, mag: 17 }, growth: { hp: 4, atk: 0.6, def: 0.9, spd: 0.9, mag: 1.4 },
    learnset: [{ level: 12, move: 'burbuja_escudo' }, { level: 16, move: 'lanza_solar' }, { level: 21, move: 'aura_sanadora' }],
    evolutions: [{ species: 'serafon', level: 25 }],
    passive: { id: 'cuidador', name: 'Luz cálida', description: 'Cura 2 PV a su dueño al empezar su turno.', power: 2 },
    look: { shape: 'hada', main: '#ffd040', dark: '#a06a10', accent: '#fff8e0', eye: '#a03010' },
  },
] satisfies PetSpeciesDef[];
