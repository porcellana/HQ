/**
 * MASCOTAS: lógica pura (sin DOM ni mapa), testeable.
 *  - Estadísticas por nivel (base + crecimiento × (nivel − 1)).
 *  - Experiencia, subida de nivel, aprendizaje de movimientos (máximo 4) y
 *    evolución (se puede detener una vez por nivel).
 *  - Eficacia de tipos, probabilidad de vínculo (captura) y entrenamiento en el
 *    establo con el paso del tiempo real.
 */
import { FAMILY_TYPE, PET_MOVES, PET_SPECIES, PET_TYPE_MAP } from '@/data/registry';
import type { EnemyFamily, PetMoveDef, PetSpeciesDef, PetStats, PetType } from '@/data/schema';

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

/** Estadísticas a un nivel (redondeadas hacia abajo; el vínculo da hasta +10 %). */
export function statsAt(sp: PetSpeciesDef, level: number, bond = 0): PetStats {
  const f = (k: keyof PetStats) => Math.floor((sp.base[k] + sp.growth[k] * (level - 1)) * (1 + Math.min(100, bond) / 1000));
  return { hp: f('hp'), atk: f('atk'), def: f('def'), spd: f('spd'), mag: f('mag') };
}

export function petStats(p: PetInstance): PetStats {
  return statsAt(getSpecies(p.species), p.level, p.bond);
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
  return {
    uid: newPetUid(), species: sp.id, level: lv, xp: 0, hp: statsAt(sp, lv).hp, moves: movesUpTo(sp, lv),
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
    if (sp.evolvesTo && p.level >= sp.evolvesTo.level && p.declinedEvolutionAt !== p.level) p.pendingEvolution = true;
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

/** Evoluciona a la siguiente especie (mantiene la proporción de vida). */
export function evolve(p: PetInstance): PetSpeciesDef | null {
  const sp = getSpecies(p.species);
  if (!sp.evolvesTo) {
    p.pendingEvolution = false;
    return null;
  }
  const ratio = p.down ? 0 : p.hp / Math.max(1, petStats(p).hp);
  p.species = sp.evolvesTo.species;
  p.pendingEvolution = false;
  delete p.declinedEvolutionAt;
  p.hp = Math.max(p.down ? 0 : 1, Math.round(petStats(p).hp * ratio));
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

/** Cadena evolutiva completa de una especie (de la cría a la última etapa). */
export function evolutionLine(speciesId: string): PetSpeciesDef[] {
  let first = getSpecies(speciesId);
  for (;;) {
    const prev = [...PET_SPECIES.values()].find((s) => s.evolvesTo?.species === first.id);
    if (!prev) break;
    first = prev;
  }
  const line = [first];
  while (line[line.length - 1]!.evolvesTo) line.push(getSpecies(line[line.length - 1]!.evolvesTo!.species));
  return line;
}
