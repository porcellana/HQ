/**
 * Tipos de casilla. Para añadir uno nuevo:
 *  1. Añade una entrada aquí con un `char` libre.
 *  2. Usa un `sprite` existente de src/gfx/tiles.ts o crea uno nuevo allí.
 */
import type { TileDef } from '../schema';

const tiles: TileDef[] = [
  { id: 'hierba', char: ',', name: 'Hierba', walkable: true, blocksSight: false, sprite: 'grass', minimap: '#2f4a2a' },
  { id: 'flores', char: '"', name: 'Flores', walkable: true, blocksSight: false, sprite: 'flowers', minimap: '#3a5530' },
  { id: 'camino', char: '=', name: 'Camino', walkable: true, blocksSight: false, sprite: 'dirt', minimap: '#6b5838' },
  { id: 'adoquin', char: 'p', name: 'Adoquines', walkable: true, blocksSight: false, sprite: 'cobble', minimap: '#5d5a60' },
  { id: 'suelo', char: '.', name: 'Suelo de piedra', walkable: true, blocksSight: false, sprite: 'stoneFloor', minimap: '#3c3843' },
  { id: 'muro', char: '#', name: 'Muro de piedra', walkable: false, blocksSight: true, sprite: 'stoneWall', minimap: '#17151c' },
  { id: 'agua', char: '~', name: 'Agua', walkable: false, blocksSight: false, sprite: 'water', minimap: '#23405e' },
  { id: 'arbol', char: 'T', name: 'Árbol', walkable: false, blocksSight: true, sprite: 'tree', minimap: '#1a2e1a' },
  { id: 'pino', char: 'Y', name: 'Pino oscuro', walkable: false, blocksSight: true, sprite: 'pine', minimap: '#14261a' },
  { id: 'arbusto', char: 'B', name: 'Arbusto', walkable: false, blocksSight: false, sprite: 'bush', minimap: '#26401f' },
  { id: 'roca', char: 'R', name: 'Roca', walkable: false, blocksSight: false, sprite: 'rock', minimap: '#4a4650' },
  { id: 'tejado', char: 'M', name: 'Tejado', walkable: false, blocksSight: true, sprite: 'roof', minimap: '#6e2c2c' },
  { id: 'tejado_azul', char: 'N', name: 'Tejado de pizarra', walkable: false, blocksSight: true, sprite: 'roofSlate', minimap: '#2f3c5a' },
  { id: 'pared', char: 'W', name: 'Pared de madera', walkable: false, blocksSight: true, sprite: 'woodWall', minimap: '#4b3524' },
  { id: 'puerta', char: '+', name: 'Puerta', walkable: true, blocksSight: true, sprite: 'door', minimap: '#a07040' },
  { id: 'valla', char: 'f', name: 'Valla', walkable: false, blocksSight: false, sprite: 'fence', minimap: '#5a4430' },
  { id: 'puente', char: 'b', name: 'Puente', walkable: true, blocksSight: false, sprite: 'bridge', minimap: '#7a5a38' },
  { id: 'pozo', char: 'w', name: 'Pozo', walkable: false, blocksSight: false, sprite: 'well', minimap: '#7a7a88' },
  { id: 'cartel', char: 's', name: 'Cartel', walkable: false, blocksSight: false, sprite: 'sign', minimap: '#8a6a40' },
  { id: 'farol', char: 'l', name: 'Farol', walkable: false, blocksSight: false, sprite: 'lamp', minimap: '#d8b050' },
  { id: 'tumba', char: 't', name: 'Lápida', walkable: false, blocksSight: false, sprite: 'grave', minimap: '#55525e' },
  { id: 'cueva', char: 'C', name: 'Entrada de cueva', walkable: true, blocksSight: false, sprite: 'cave', minimap: '#000000' },
];

export default tiles;
