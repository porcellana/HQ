/**
 * Biomas del mundo procedural (v0.8). Para añadir uno: nuevo objeto aquí con su clima,
 * vecinos permitidos (simétricos), tiles, enemigos y botín. El motor sólo lee estos datos.
 * Clasificación: se toma el primero (por `order`) cuyo clima encaja; `pradera` es el puente.
 */
import type { BiomeDef } from '../schema';

export default [
  {
    id: 'nieve', name: 'Tierras Nevadas', icon: '❄', order: 1,
    climate: { temp: [0, 0.22], moist: [0, 1] }, neighbors: ['pradera', 'bosque', 'montana'],
    ground: 'nieve', groundAlt: { tile: 'hielo', chance: 0.06 }, path: 'camino', border: 'pino_nevado',
    props: [{ tile: 'pino_nevado', density: 0.5 }, { tile: 'pena', density: 0.08 }], water: { tile: 'hielo', ponds: [1, 2] },
    roof: 'tejado_azul', wall: 'pared', darkness: 0.08, tint: { color: '#a8c8ff', alpha: 0.1 }, music: 'viento_helado', battle: 'montana',
    enemies: [
      { enemy: 'lobo_nieve', weight: 5, min: 1, max: 3 }, { enemy: 'yeti', weight: 2, min: 1, max: 1 },
      { enemy: 'esqueleto', weight: 2, min: 1, max: 2 }, { enemy: 'bandido', weight: 2, min: 1, max: 2 },
    ],
    chestLoot: 'cofre_nieve', ores: ['plata', 'hierro', 'gema'],
    nouns: ['Páramo', 'Ventisquero', 'Llanura', 'Valle', 'Paso'], epithets: ['Helado', 'del Lobo Blanco', 'Silente', 'de Escarcha', 'del Cuervo Gris'],
  },
  {
    id: 'montana', name: 'Montañas', icon: '⛰', order: 2,
    climate: { temp: [0.22, 1], moist: [0, 1], elev: [0.68, 1] }, neighbors: ['pradera', 'bosque', 'nieve', 'desierto'],
    ground: 'grava', groundAlt: { tile: 'suelo', chance: 0.05 }, path: 'camino', border: 'pena',
    props: [{ tile: 'pena', density: 0.4 }, { tile: 'pino', density: 0.12 }, { tile: 'roca', density: 0.1 }],
    roof: 'tejado_azul', wall: 'pared', darkness: 0.1, tint: { color: '#9a9ab0', alpha: 0.06 }, music: 'cumbres', battle: 'montana',
    enemies: [
      { enemy: 'lobo', weight: 3, min: 1, max: 3 }, { enemy: 'orco_bruto', weight: 3, min: 1, max: 2 },
      { enemy: 'goblin_chaman', weight: 2, min: 1, max: 1 }, { enemy: 'arana_cazadora', weight: 2, min: 1, max: 1 },
      { enemy: 'goblin', weight: 2, min: 2, max: 3 },
    ],
    chestLoot: 'cofre_montana', ores: ['hierro', 'plata', 'plata', 'gema'],
    nouns: ['Cumbre', 'Risco', 'Garganta', 'Peñasco', 'Sierra'], epithets: ['del Águila', 'Quebrado', 'del Trueno', 'Gris', 'de la Cabra'],
  },
  {
    id: 'costa', name: 'Costa', icon: '🌊', order: 3,
    climate: { temp: [0.22, 1], moist: [0, 1], elev: [0, 0.2] }, neighbors: ['pradera', 'bosque', 'desierto', 'pantano'],
    ground: 'arena', path: 'camino', border: 'roca',
    props: [{ tile: 'palmera', density: 0.12 }, { tile: 'roca', density: 0.1 }, { tile: 'arbusto', density: 0.08 }], water: { tile: 'agua', ponds: [2, 3] },
    roof: 'tejado', wall: 'pared', darkness: 0, music: 'oleaje', battle: 'puerto',
    enemies: [
      { enemy: 'cangrejo_gigante', weight: 4, min: 1, max: 3 }, { enemy: 'pirata', weight: 3, min: 1, max: 2 },
      { enemy: 'maton_puerto', weight: 2, min: 1, max: 2 }, { enemy: 'rata_gigante', weight: 2, min: 2, max: 3 },
    ],
    chestLoot: 'cofre_costa', ores: ['hierro', 'gema'],
    nouns: ['Playa', 'Cala', 'Acantilado', 'Ensenada', 'Bahía'], epithets: ['del Naufragio', 'de la Sal', 'del Faro Roto', 'Dorada', 'de las Gaviotas'],
  },
  {
    id: 'desierto', name: 'Desierto', icon: '🏜', order: 4,
    climate: { temp: [0.72, 1], moist: [0, 0.45] }, neighbors: ['pradera', 'montana', 'costa'],
    ground: 'arena', groundAlt: { tile: 'grava', chance: 0.05 }, path: 'camino', border: 'pena',
    props: [{ tile: 'cactus', density: 0.16 }, { tile: 'pena', density: 0.1 }, { tile: 'roca', density: 0.05 }],
    roof: 'tejado', wall: 'pared', darkness: 0, tint: { color: '#ffb050', alpha: 0.09 }, music: 'dunas', battle: 'montana',
    enemies: [
      { enemy: 'escorpion_gigante', weight: 4, min: 1, max: 3 }, { enemy: 'momia', weight: 3, min: 1, max: 2 },
      { enemy: 'bandido', weight: 3, min: 1, max: 3 }, { enemy: 'esqueleto_arquero', weight: 1, min: 1, max: 2 },
    ],
    chestLoot: 'cofre_desierto', ores: ['hierro', 'plata', 'gema'],
    nouns: ['Duna', 'Oasis', 'Erial', 'Mesa', 'Salar'], epithets: ['Ardiente', 'del Escorpión', 'de los Huesos', 'Sin Sombra', 'del Espejismo'],
  },
  {
    id: 'pantano', name: 'Pantano', icon: '🐸', order: 5,
    climate: { temp: [0.5, 1], moist: [0.7, 1], elev: [0, 0.55] }, neighbors: ['pradera', 'bosque', 'costa'],
    ground: 'cieno', groundAlt: { tile: 'hierba', chance: 0.12 }, path: 'camino', border: 'arbol_seco',
    props: [{ tile: 'arbol_seco', density: 0.3 }, { tile: 'arbusto', density: 0.12 }], water: { tile: 'agua_cieno', ponds: [3, 5] },
    roof: 'tejado', wall: 'pared', darkness: 0.14, tint: { color: '#5a7a40', alpha: 0.1 }, music: 'cienaga', battle: 'bosque',
    enemies: [
      { enemy: 'sapo_gigante', weight: 4, min: 1, max: 3 }, { enemy: 'zombi', weight: 3, min: 1, max: 2 },
      { enemy: 'arana_tejedora', weight: 2, min: 1, max: 2 }, { enemy: 'rata_gigante', weight: 2, min: 2, max: 3 },
    ],
    chestLoot: 'cofre_pantano', ores: ['hierro', 'hierro', 'plata'],
    nouns: ['Ciénaga', 'Marisma', 'Fangal', 'Turbera', 'Tremedal'], epithets: ['Podrida', 'del Sapo Rey', 'de las Luces Fatuas', 'Sombría', 'del Ahogado'],
  },
  {
    id: 'bosque', name: 'Bosque', icon: '🌲', order: 6,
    climate: { temp: [0.22, 1], moist: [0.52, 1] }, neighbors: ['pradera', 'montana', 'pantano', 'costa', 'nieve'],
    ground: 'hierba', groundAlt: { tile: 'flores', chance: 0.05 }, path: 'camino', border: 'pino',
    props: [{ tile: 'pino', density: 0.45 }, { tile: 'arbol', density: 0.2 }, { tile: 'arbusto', density: 0.08 }], water: { tile: 'agua', ponds: [0, 2] },
    roof: 'tejado', wall: 'pared', darkness: 0.1, tint: { color: '#40803a', alpha: 0.06 }, music: 'espesura', battle: 'bosque',
    enemies: [
      { enemy: 'lobo', weight: 4, min: 1, max: 3 }, { enemy: 'arana_gigante', weight: 3, min: 1, max: 2 },
      { enemy: 'goblin', weight: 3, min: 2, max: 3 }, { enemy: 'goblin_arquero', weight: 2, min: 1, max: 2 }, { enemy: 'oso_pardo', weight: 1, min: 1, max: 1 },
    ],
    chestLoot: 'cofre_bosque', ores: ['hierro', 'hierro', 'plata'],
    nouns: ['Bosque', 'Espesura', 'Arboleda', 'Claro', 'Robledal'], epithets: ['de las Sombras', 'del Cuervo', 'Umbrío', 'de los Susurros', 'del Roble Hueco'],
  },
  {
    id: 'pradera', name: 'Praderas', icon: '🌾', order: 99, bridge: true,
    climate: { temp: [0, 1], moist: [0, 1] }, neighbors: ['pradera', 'bosque', 'montana', 'nieve', 'desierto', 'pantano', 'costa'],
    ground: 'hierba', groundAlt: { tile: 'flores', chance: 0.08 }, path: 'camino', border: 'arbol',
    props: [{ tile: 'arbol', density: 0.2 }, { tile: 'arbusto', density: 0.1 }, { tile: 'roca', density: 0.06 }], water: { tile: 'agua', ponds: [0, 2] },
    roof: 'tejado', wall: 'pared', darkness: 0, music: 'campiña', battle: 'pradera',
    enemies: [
      { enemy: 'lobo', weight: 3, min: 1, max: 3 }, { enemy: 'goblin', weight: 4, min: 2, max: 3 }, { enemy: 'rata_gigante', weight: 2, min: 2, max: 3 },
      { enemy: 'bandido', weight: 2, min: 1, max: 2 }, { enemy: 'jabali', weight: 2, min: 1, max: 2 },
    ],
    chestLoot: 'cofre_pradera', ores: ['hierro', 'hierro', 'plata'],
    nouns: ['Pradera', 'Llanura', 'Colina', 'Vega', 'Campo'], epithets: ['Verde', 'del Viento', 'de los Hitos', 'Dorada', 'del Pastor'],
  },
] satisfies BiomeDef[];
