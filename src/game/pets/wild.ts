/**
 * Criaturas salvajes: se convierten en "enemigos" normales (con `pet`) para
 * reutilizar todo el combate. Al debilitarlas se pueden vincular con una Runa.
 */
import { PET_SPECIES } from '@/data/registry';
import type { DamageType, EnemyDef, PetType } from '@/data/schema';
import { getMove, getSpecies, statsAt } from './pets';

export const PET_DAMAGE_TYPE: Record<PetType, DamageType> = {
  fuego: 'fuego', agua: 'frio', planta: 'veneno', tierra: 'contundente', sombra: 'necrotico', luz: 'sagrado', hielo: 'frio', rayo: 'rayo',
};

/** Ficha de enemigo para una criatura salvaje de cierta especie y nivel. */
export function wildEnemyDef(speciesId: string, level: number): EnemyDef {
  const sp = getSpecies(speciesId);
  const st = statsAt(sp, level);
  const moves = sp.learnset.filter((l) => l.level <= level).map((l) => getMove(l.move)).filter((m) => m?.kind === 'daño');
  const mv = moves[moves.length - 1] ?? getMove('placaje')!;
  const rarityXp = sp.rarity === 'comun' ? 1 : sp.rarity === 'raro' ? 1.5 : 2.2;
  return {
    id: `mascota_${sp.id}`,
    name: `${sp.name} salvaje`,
    family: 'bestia',
    level,
    hp: `${st.hp}`,
    ac: 10 + Math.floor(st.def / 2),
    speed: st.spd >= 9 ? 2 : 1,
    sight: 5,
    ai: mv.range > 1 ? 'ranged' : 'melee',
    attack: {
      name: mv.name, toHit: 2 + Math.floor(level / 2), dice: mv.dice ?? '1d4', damageType: PET_DAMAGE_TYPE[mv.type], range: mv.range,
      ...(mv.applyStatus ? { applyStatus: mv.applyStatus } : {}),
    },
    xp: Math.round(12 * level * rarityXp),
    description: sp.description,
    look: { shape: 'goblin', main: sp.look.main, dark: sp.look.dark, accent: sp.look.accent },
    pet: { species: sp.id, level },
  };
}

/**
 * Especies salvajes de una zona o mazmorra (id), de un bioma procedural y/o de un tipo de lugar.
 * Con `level`, las etapas 2 y 3 sólo salen en zonas de nivel 8+ y 16+.
 */
export function wildSpeciesIn(zoneOrDungeonId: string, biome?: string, place?: string, level?: number): string[] {
  return [...PET_SPECIES.values()].filter((s) => s.catchable
    && (level === undefined || level >= (s.stage - 1) * 8)
    && (s.habitats.includes(zoneOrDungeonId) || (!!biome && s.habitats.includes(`bioma:${biome}`)) || (!!place && s.habitats.includes(`lugar:${place}`)))).map((s) => s.id);
}
