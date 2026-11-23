/**
 * Tipos de mascota y su eficacia. `strong` = hace el doble de daño a esos tipos;
 * `weak` = hace la mitad. `FAMILY_TYPE` da un tipo a cada familia de enemigos
 * para que la eficacia también cuente contra ellos.
 */
import type { EnemyFamily, PetType, PetTypeDef } from '../schema';

export const PET_TYPES: PetTypeDef[] = [
  { id: 'fuego', name: 'Fuego', icon: '🔥', color: '#f07030', strong: ['planta', 'sombra'], weak: ['agua', 'tierra'] },
  { id: 'agua', name: 'Agua', icon: '💧', color: '#3a8ad8', strong: ['fuego', 'tierra'], weak: ['planta', 'luz'] },
  { id: 'planta', name: 'Planta', icon: '🌿', color: '#4ab040', strong: ['agua', 'tierra'], weak: ['fuego', 'sombra'] },
  { id: 'tierra', name: 'Tierra', icon: '🪨', color: '#a07848', strong: ['fuego', 'luz'], weak: ['agua', 'planta'] },
  { id: 'sombra', name: 'Sombra', icon: '🌑', color: '#7a4ab0', strong: ['luz', 'planta'], weak: ['fuego', 'sombra'] },
  { id: 'luz', name: 'Luz', icon: '✨', color: '#f0d860', strong: ['sombra', 'agua'], weak: ['tierra', 'luz'] },
];

/** Tipo de cada familia de enemigos (para la eficacia de los movimientos). */
export const FAMILY_TYPE: Record<EnemyFamily, PetType> = {
  'no-muerto': 'sombra',
  'araña': 'planta',
  bestia: 'tierra',
  goblinoide: 'tierra',
  humano: 'sombra',
  orco: 'fuego',
};
