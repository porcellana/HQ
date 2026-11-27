/** Escenario de la batalla según la zona donde ocurre (puro y testeable). */
export type Biome = 'pradera' | 'bosque' | 'montana' | 'cueva' | 'cripta' | 'galerias' | 'puerto' | 'aldea' | 'interior';

export interface ZoneLike {
  id: string;
  kind: string;
  darkness?: number;
  dungeon?: { id: string } | undefined;
  /** Zona del mundo procedural: trae su escenario de batalla. */
  generated?: { battle: string } | undefined;
}

export function biomeOf(z: ZoneLike): Biome {
  if (z.generated) return z.generated.battle as Biome;
  const dung = z.dungeon?.id ?? '';
  if (dung.includes('cripta')) return 'cripta';
  if (dung.includes('galerias') || dung.includes('arana')) return 'galerias';
  if (dung) return 'cueva';
  const id = z.id;
  if (id.includes('bosque')) return 'bosque';
  if (id.includes('paso') || id.includes('monta')) return 'montana';
  if (id.includes('puerto')) return id.includes('interior') ? 'interior' : 'puerto';
  if (id.includes('interior') || id.includes('capilla') || id.includes('taberna') || id.includes('tienda')) return 'interior';
  if (z.kind === 'dungeon') return 'cueva';
  if (z.kind === 'town') return 'aldea';
  if ((z.darkness ?? 0) > 0.6) return 'cueva';
  return 'pradera';
}
