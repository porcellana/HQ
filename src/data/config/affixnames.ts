/** Nombres de afijos: el equipo raro o mejor se llama según sus bonos más altos. */
import type { BonusStat } from '../schema';

/** Sufijo por bonificación ("Espada larga del Oso"). */
export const AFFIX_SUFFIX: Record<BonusStat, string> = {
  FUE: 'del Oso', DES: 'del Halcón', CON: 'del Roble', INT: 'del Sabio', SAB: 'del Búho', CAR: 'del Heraldo',
  ca: 'del Bastión', ataque: 'de la Precisión', daño: 'de la Matanza', pv: 'de la Vida', recurso: 'del Manantial',
};

/** Prefijo (épico y legendario) según la segunda bonificación. */
export const AFFIX_PREFIX: Record<BonusStat, string> = {
  FUE: 'Brutal', DES: 'Ágil', CON: 'Robusto', INT: 'Lúcido', SAB: 'Sereno', CAR: 'Glorioso',
  ca: 'Blindado', ataque: 'Certero', daño: 'Feroz', pv: 'Vital', recurso: 'Arcano',
};
