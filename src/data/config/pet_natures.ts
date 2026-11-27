/** Naturalezas de mascota: +10 % a una estadística y −10 % a otra (la vida no cambia). */
import type { PetNatureDef } from '../schema';

export const PET_NATURES: PetNatureDef[] = [
  { id: 'osada', name: 'Osada', up: 'atk', down: 'def' },
  { id: 'tenaz', name: 'Tenaz', up: 'def', down: 'spd' },
  { id: 'agil', name: 'Ágil', up: 'spd', down: 'atk' },
  { id: 'astuta', name: 'Astuta', up: 'mag', down: 'def' },
  { id: 'serena', name: 'Serena', up: 'def', down: 'atk' },
  { id: 'fogosa', name: 'Fogosa', up: 'atk', down: 'mag' },
  { id: 'curiosa', name: 'Curiosa', up: 'mag', down: 'spd' },
  { id: 'vivaz', name: 'Vivaz', up: 'spd', down: 'mag' },
];
