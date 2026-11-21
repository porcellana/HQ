/**
 * ESTADO DE PARTIDA
 * -----------------
 * Todo lo que se guarda en disco vive en GameState. Si cambias su forma,
 * SUBE `CURRENT_SAVE_VERSION` en save/migrations.ts y añade una migración
 * para que las partidas antiguas sigan funcionando.
 */
import { START_ZONE_ID, getClass, getZoneDef } from '@/data/registry';
import type { StatBlock } from '@/data/schema';
import { maxHpFor, maxResourceFor } from './rules/character';
import { buildZone } from './world/zone';

export interface Position {
  zone: string;
  x: number;
  y: number;
}

export interface PlayerState {
  name: string;
  /** Id de la clase (data/classes). */
  classId: string;
  /** Índice del retrato elegido (combinación de piel y pelo). */
  portrait: number;
  /** Características actuales (base de clase + puntos repartidos). */
  stats: StatBlock;
  /** Puntos de característica sin repartir (se ganan al subir de nivel). */
  attributePoints: number;
  level: number;
  /** XP acumulada total. */
  xp: number;
  hp: number;
  /** Derivado de clase, nivel y CON (ver recalcPlayer). */
  maxHp: number;
  /** Recurso de la clase: maná, vigor, energía o fe. */
  mp: number;
  maxMp: number;
  gold: number;
  pos: Position;
}

export interface GameState {
  /** Semilla maestra de la partida (mazmorras, botín...). */
  seed: number;
  /** Turnos transcurridos (cada paso o acción = 1 turno). */
  turn: number;
  player: PlayerState;
  /** Zonas descubiertas (para XP de exploración y el mapa del mundo). */
  visitedZones: string[];
  /** Banderas libres para historia y misiones. */
  flags: Record<string, boolean | number | string>;
  playTimeSec: number;
  createdAt: string;
}

export interface NewGameOptions {
  name: string;
  classId: string;
  portrait: number;
  /** Características ya repartidas en la pantalla de creación. */
  stats: StatBlock;
  seed: number;
}

/** Crea el estado de una partida nueva en el punto de inicio. */
export function createNewGame(opts: NewGameOptions): GameState {
  const def = getZoneDef(START_ZONE_ID);
  if (!def) throw new Error(`Zona inicial "${START_ZONE_ID}" no encontrada en los datos`);
  const zone = buildZone(def);
  const spawn = zone.spawn ?? { x: 1, y: 1 };
  const cls = getClass(opts.classId);
  const state: GameState = {
    seed: opts.seed,
    turn: 0,
    player: {
      name: opts.name,
      classId: cls.id,
      portrait: opts.portrait,
      stats: { ...opts.stats },
      attributePoints: 0,
      level: 1,
      xp: 0,
      hp: 1,
      maxHp: 1,
      mp: 0,
      maxMp: 0,
      gold: cls.startingGold,
      pos: { zone: zone.id, x: spawn.x, y: spawn.y },
    },
    visitedZones: [zone.id],
    flags: {},
    playTimeSec: 0,
    createdAt: new Date().toISOString(),
  };
  recalcPlayer(state.player);
  state.player.hp = state.player.maxHp;
  state.player.mp = state.player.maxMp;
  return state;
}

/**
 * Recalcula los valores derivados (PV y recurso máximos) a partir de clase,
 * nivel y características. Se llama al crear, al cargar y al subir de nivel,
 * así que cambiar los números de una clase en data/ afecta también a partidas
 * guardadas.
 */
export function recalcPlayer(p: PlayerState): void {
  const cls = getClass(p.classId);
  p.classId = cls.id;
  p.maxHp = maxHpFor(cls, p.level, p.stats.CON);
  p.maxMp = maxResourceFor(cls, p.level, p.stats);
  p.hp = Math.min(Math.max(0, p.hp), p.maxHp);
  p.mp = Math.min(Math.max(0, p.mp), p.maxMp);
}
