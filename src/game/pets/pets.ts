/**
 * MASCOTAS: lógica pura (sin DOM ni mapa), testeable.
 *  - Estadísticas por nivel (base + crecimiento × (nivel − 1)).
 *  - Experiencia, subida de nivel, aprendizaje de movimientos (máximo 4) y
 *    evolución (se puede detener una vez por nivel).
 *  - Eficacia de tipos, probabilidad de vínculo (captura) y entrenamiento en el
 *    establo con el paso del tiempo real.
 */
import { FAMILY_TYPE, PET_MOVES, PET_NATURES, PET_SPECIES, PET_TYPE_MAP } from '@/data/registry';
import type { EnemyFamily, PetEvolution, PetMoveDef, PetNatureDef, PetSpeciesDef, PetStats, PetType } from '@/data/schema';

export const MAX_MOVES = 4;
export const STABLE_CAPACITY = 8;
/** Nivel máximo de una mascota. */
export const PET_MAX_LEVEL = 30;

export interface PetInstance {
  uid: string;
  species: string;
  /** Mote que le pone el jugador (opcional). */
  nickname?: string;
  level: number;
  /** Naturaleza (id de data/config/pet_natures): +10 % / −10 % a dos estadísticas. */
  nature: string;
  /** XP dentro del nivel actual. */
  xp: number;
  hp: number;
  moves: string[];
  /** Vínculo 0..100: sube al luchar juntos y da pequeños bonus. */
  bond: number;
  /** Debilitada (0 PV): no lucha hasta recuperarse. */
  down: boolean;
  /** Movimientos nuevos esperando a que el jugador elija cuál olvidar. */
  pendingMoves: string[];
  /** Puede evolucionar (el jugador verá la pantalla de evolución). */
  pendingEvolution: boolean;
  /** Nivel en el que se detuvo la evolución (se vuelve a ofrecer al subir). */
  declinedEvolutionAt?: number;
  /** Última vez (ms) que se la acarició (sube el vínculo, con espera). */
  lastPetted?: number;
  /** Instante (ms) desde el que entrena en el establo. */
  restSince?: number;
}

export interface PetsState {
  active: PetInstance | null;
  stable: PetInstance[];
  /** Ya se eligió la mascota inicial en el establo. */
  starterChosen: boolean;
  /** Especies vistas y vinculadas (bestiario). */
  seen: string[];
  caught: string[];
}

export function emptyPets(): PetsState {
  return { active: null, stable: [], starterChosen: false, seen: [], caught: [] };
}

export function getSpecies(id: string): PetSpeciesDef {
  const s = PET_SPECIES.get(id);
  if (!s) throw new Error(`Especie de mascota desconocida: ${id}`);
  return s;
}

export function getMove(id: string): PetMoveDef | undefined {
  return PET_MOVES.get(id);
}

export function petName(p: PetInstance): string {
  return p.nickname?.trim() || getSpecies(p.species).name;
}

export function getNature(id: string | undefined): PetNatureDef | undefined {
  return PET_NATURES.find((n) => n.id === id);
}

/** Naturaleza determinista a partir de un texto (migración de partidas antiguas). */
export function natureFromSeed(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PET_NATURES[h % PET_NATURES.length]!.id;
}

/** Estadísticas a un nivel (hacia abajo): base + crecimiento, naturaleza (±10 %, no la vida) y vínculo (hasta +10 %). */
export function statsAt(sp: PetSpeciesDef, level: number, bond = 0, nature?: string): PetStats {
  const n = getNature(nature);
  const f = (k: keyof PetStats) => {
    const nat = k === 'hp' || !n ? 1 : n.up === k ? 1.1 : n.down === k ? 0.9 : 1;
    return Math.floor((sp.base[k] + sp.growth[k] * (level - 1)) * nat * (1 + Math.min(100, bond) / 1000));
  };
  return { hp: f('hp'), atk: f('atk'), def: f('def'), spd: f('spd'), mag: f('mag') };
}

export function petStats(p: PetInstance): PetStats {
  return statsAt(getSpecies(p.species), p.level, p.bond, p.nature);
}

// ------------------------------------------------------------------- vínculo
export const BOND_TIERS = [
  { min: 0, name: 'Desconfiada', perk: '' },
  { min: 25, name: 'Amistosa', perk: 'Hasta +10 % de estadísticas con el vínculo.' },
  { min: 50, name: 'Leal', perk: 'Sus movimientos se recargan 1 turno antes.' },
  { min: 80, name: 'Inseparable', perk: 'Una vez por combate resiste un golpe mortal con 1 PV.' },
] as const;

export function bondTier(bond: number): number {
  let t = 0;
  BOND_TIERS.forEach((x, i) => { if (bond >= x.min) t = i; });
  return t;
}

export const PET_CARESS_WAIT_MS = 30 * 60_000;

/** Acariciar: +3 de vínculo (con espera). Devuelve false si aún no toca. */
export function caress(p: PetInstance, now: number): boolean {
  if (p.lastPetted !== undefined && now - p.lastPetted < PET_CARESS_WAIT_MS) return false;
  p.lastPetted = now;
  p.bond = Math.min(100, p.bond + 3);
  return true;
}

/** XP para pasar de `level` al siguiente. */
export function petXpToNext(level: number): number {
  return Math.round(30 * Math.pow(level, 1.5));
}

/** Movimientos aprendidos hasta un nivel (los últimos 4). */
export function movesUpTo(sp: PetSpeciesDef, level: number): string[] {
  const list = sp.learnset.filter((l) => l.level <= level).map((l) => l.move);
  return [...new Set(list)].slice(-MAX_MOVES);
}

let uidN = 0;
export function newPetUid(): string {
  return `m${Date.now().toString(36)}${(uidN++).toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`;
}

/** Crea una mascota de una especie y nivel (con la vida al máximo). */
export function createPet(speciesId: string, level = 1): PetInstance {
  const sp = getSpecies(speciesId);
  const lv = Math.max(1, Math.min(PET_MAX_LEVEL, level));
  const nature = PET_NATURES[Math.floor(Math.random() * PET_NATURES.length)]!.id;
  return {
    uid: newPetUid(), species: sp.id, nature, level: lv, xp: 0, hp: statsAt(sp, lv).hp, moves: movesUpTo(sp, lv),
    bond: 0, down: false, pendingMoves: [], pendingEvolution: false,
  };
}

export interface PetGain {
  levels: number;
  learned: string[];
}

/**
 * Suma experiencia. Sube de nivel, aprende movimientos (si hay hueco; si no,
 * quedan pendientes) y marca la evolución. `levelCap` limita el nivel (establo).
 */
export function gainPetXp(p: PetInstance, amount: number, levelCap = PET_MAX_LEVEL): PetGain {
  const out: PetGain = { levels: 0, learned: [] };
  const cap = Math.min(PET_MAX_LEVEL, levelCap);
  if (p.level >= cap) {
    p.xp = 0;
    return out;
  }
  p.xp += Math.max(0, Math.floor(amount));
  while (p.level < cap && p.xp >= petXpToNext(p.level)) {
    p.xp -= petXpToNext(p.level);
    const before = petStats(p).hp;
    p.level++;
    out.levels++;
    if (!p.down) p.hp = Math.min(petStats(p).hp, p.hp + (petStats(p).hp - before));
    const sp = getSpecies(p.species);
    for (const l of sp.learnset.filter((x) => x.level === p.level)) {
      if (p.moves.includes(l.move) || p.pendingMoves.includes(l.move)) continue;
      if (p.moves.length < MAX_MOVES) {
        p.moves.push(l.move);
        out.learned.push(l.move);
      } else p.pendingMoves.push(l.move);
    }
    if (p.declinedEvolutionAt !== p.level && evolutionOptions(p).length) p.pendingEvolution = true;
  }
  if (p.level >= cap) p.xp = 0;
  return out;
}

/** Resuelve un movimiento pendiente: `forget` = movimiento a olvidar, o null para no aprenderlo. */
export function resolveMove(p: PetInstance, move: string, forget: string | null): void {
  p.pendingMoves = p.pendingMoves.filter((m) => m !== move);
  if (!forget) return;
  const i = p.moves.indexOf(forget);
  if (i >= 0) p.moves[i] = move;
}

/** ¿Cumple la rama sus condiciones? (el objeto sólo cuenta si se indica `hasItem`). */
export function evolutionMet(p: PetInstance, e: PetEvolution, hasItem?: (id: string) => boolean): boolean {
  if (p.level < e.level) return false;
  if (e.minBond !== undefined && p.bond < e.minBond) return false;
  if (e.natures && !e.natures.includes(p.nature)) return false;
  if (e.item && !(hasItem?.(e.item))) return false;
  return true;
}

/** Ramas disponibles ahora. Sin `hasItem` sólo se consideran las que no piden objeto. */
export function evolutionOptions(p: PetInstance, hasItem?: (id: string) => boolean): PetEvolution[] {
  return (getSpecies(p.species).evolutions ?? []).filter((e) => (hasItem || !e.item) && evolutionMet(p, e, hasItem));
}

/** Texto de las condiciones de una rama. */
export function evolutionCondition(e: PetEvolution, itemName?: (id: string) => string): string {
  const parts = [`Nv ${e.level}`];
  if (e.minBond) parts.push(`vínculo ${e.minBond}+`);
  if (e.natures) parts.push(`naturaleza ${e.natures.map((n) => getNature(n)?.name ?? n).join('/')}`);
  if (e.item) parts.push(itemName ? itemName(e.item) : e.item);
  return parts.join(', ');
}

/**
 * Evoluciona. `to` elige la rama (por defecto la primera disponible sin objeto).
 * Mantiene la proporción de vida. Devuelve la nueva especie o null.
 */
export function evolve(p: PetInstance, to?: string, hasItem?: (id: string) => boolean): PetSpeciesDef | null {
  const sp = getSpecies(p.species);
  const opts = evolutionOptions(p, hasItem ?? (to ? () => true : undefined));
  const pick = to ? opts.find((e) => e.species === to) : opts[0] ?? (sp.evolutions ?? []).find((e) => !e.item && p.level >= e.level);
  if (!pick) {
    p.pendingEvolution = false;
    return null;
  }
  const ratio = p.down ? 0 : p.hp / Math.max(1, petStats(p).hp);
  p.species = pick.species;
  p.pendingEvolution = false;
  delete p.declinedEvolutionAt;
  p.hp = Math.max(p.down ? 0 : 1, Math.round(petStats(p).hp * ratio));
  // Al evolucionar aprende lo que le tocaba hasta su nivel y no sabía (si hay hueco).
  for (const l of getSpecies(p.species).learnset.filter((x) => x.level <= p.level)) {
    if (p.moves.length < MAX_MOVES && !p.moves.includes(l.move)) p.moves.push(l.move);
  }
  return getSpecies(p.species);
}

/** Detiene la evolución: se volverá a ofrecer al subir otro nivel. */
export function declineEvolution(p: PetInstance): void {
  p.pendingEvolution = false;
  p.declinedEvolutionAt = p.level;
}

/** Multiplicador de daño de un tipo de ataque contra un tipo defensor. */
export function typeMultiplier(attack: PetType, defender: PetType | null): number {
  if (!defender) return 1;
  const t = PET_TYPE_MAP.get(attack);
  if (!t) return 1;
  if (t.strong.includes(defender)) return 2;
  if (t.weak.includes(defender)) return 0.5;
  return 1;
}

/** Tipo de una familia de enemigos (para la eficacia). */
export function familyType(family: EnemyFamily): PetType {
  return FAMILY_TYPE[family];
}

/**
 * Probabilidad de vincular una criatura salvaje: cuanto menos vida le quede,
 * más fácil. Las raras y épicas cuestan más.
 */
export function captureChance(rarity: PetSpeciesDef['rarity'], hpRatio: number): number {
  const r = Math.max(0, Math.min(1, hpRatio));
  const mult = rarity === 'comun' ? 1 : rarity === 'raro' ? 0.7 : 0.45;
  const base = 0.1 + 0.8 * (1 - r) + (r <= 0.25 ? 0.1 : 0);
  return Math.max(0.05, Math.min(0.95, base * mult));
}

// ------------------------------------------------------------------ establo
/** XP por hora real en el establo (más cuanto mayor es la mascota). */
export function stableXpPerHour(level: number): number {
  return 20 + 6 * level;
}
/** Horas de entrenamiento que cuentan por cada día real (tope diario). */
export const STABLE_HOURS_PER_DAY = 8;

export interface TrainingReport {
  uid: string;
  name: string;
  levels: number;
  learned: string[];
}

/**
 * Entrenamiento en el establo: cada mascota gana XP según el tiempo real que
 * lleva allí (con tope diario) sin pasar del nivel del jugador. `now` es
 * inyectable para los tests.
 */
export function trainStable(pets: PetsState, now: number, playerLevel: number): TrainingReport[] {
  const out: TrainingReport[] = [];
  for (const p of pets.stable) {
    if (p.restSince === undefined) {
      p.restSince = now;
      continue;
    }
    const hours = Math.max(0, (now - p.restSince) / 3_600_000);
    if (hours < 0.05) continue;
    const days = Math.max(1, Math.ceil(hours / 24));
    const counted = Math.min(hours, days * STABLE_HOURS_PER_DAY);
    const gain = gainPetXp(p, counted * stableXpPerHour(p.level), playerLevel);
    // En el establo se aprende solo lo que cabe; el resto espera.
    p.restSince = now;
    // También se curan.
    p.down = false;
    p.hp = petStats(p).hp;
    if (gain.levels > 0) out.push({ uid: p.uid, name: petName(p), levels: gain.levels, learned: gain.learned });
  }
  return out;
}

/** Deja la mascota activa en el establo. Devuelve un error o null. */
export function depositActive(pets: PetsState, now: number): string | null {
  const p = pets.active;
  if (!p) return 'No llevas ninguna mascota.';
  if (pets.stable.length >= STABLE_CAPACITY) return 'El establo está lleno.';
  p.restSince = now;
  pets.stable.push(p);
  pets.active = null;
  return null;
}

/** Saca una mascota del establo (la activa, si la hay, ocupa su sitio). */
export function withdraw(pets: PetsState, uid: string): string | null {
  const i = pets.stable.findIndex((x) => x.uid === uid);
  if (i < 0) return 'Esa mascota no está en el establo.';
  const [p] = pets.stable.splice(i, 1);
  delete p!.restSince;
  if (pets.active) {
    pets.active.restSince = Date.now();
    pets.stable.push(pets.active);
  }
  pets.active = p!;
  return null;
}

/** Añade una mascota nueva: va contigo si no llevas ninguna, si no al establo. */
export function addPet(pets: PetsState, p: PetInstance, now: number): 'activa' | 'establo' | 'lleno' {
  if (!pets.caught.includes(p.species)) pets.caught.push(p.species);
  markSeen(pets, p.species);
  if (!pets.active) {
    pets.active = p;
    return 'activa';
  }
  if (pets.stable.length >= STABLE_CAPACITY) return 'lleno';
  p.restSince = now;
  pets.stable.push(p);
  return 'establo';
}

export function markSeen(pets: PetsState, species: string): void {
  if (!pets.seen.includes(species)) pets.seen.push(species);
}

/** Cadena evolutiva principal (sigue la primera rama) de la cría a la última etapa. */
export function evolutionLine(speciesId: string): PetSpeciesDef[] {
  let first = getSpecies(speciesId);
  for (;;) {
    const prev = [...PET_SPECIES.values()].find((s) => s.evolutions?.some((e) => e.species === first.id));
    if (!prev) break;
    first = prev;
  }
  const line = [first];
  for (;;) {
    const next = line[line.length - 1]!.evolutions?.[0];
    if (!next) break;
    line.push(getSpecies(next.species));
  }
  return line;
}

/** Especies de las que viene (para el bestiario). */
export function evolvesFrom(speciesId: string): Array<{ from: PetSpeciesDef; evo: PetEvolution }> {
  const out: Array<{ from: PetSpeciesDef; evo: PetEvolution }> = [];
  for (const s of PET_SPECIES.values()) for (const evo of s.evolutions ?? []) if (evo.species === speciesId) out.push({ from: s, evo });
  return out;
}
