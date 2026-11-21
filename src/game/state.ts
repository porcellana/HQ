/**
 * ESTADO DE PARTIDA
 * -----------------
 * Todo lo que se guarda en disco vive en GameState. Si cambias su forma,
 * SUBE `CURRENT_SAVE_VERSION` en save/migrations.ts y añade una migración
 * para que las partidas antiguas sigan funcionando.
 */
import { START_ZONE_ID, getZoneDef } from '@/data/registry';
import { buildZone } from './world/zone';

export interface Position {
  zone: string;
  x: number;
  y: number;
}

export interface PlayerState {
  name: string;
  /** Id de la clase (data/classes). En el Hito 1 todos son "aventurero". */
  classId: string;
  /** Índice del retrato elegido. */
  portrait: number;
  level: number;
  /** XP acumulada total. */
  xp: number;
  hp: number;
  maxHp: number;
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
  seed: number;
}

/** Crea el estado de una partida nueva en el punto de inicio. */
export function createNewGame(opts: NewGameOptions): GameState {
  const def = getZoneDef(START_ZONE_ID);
  if (!def) throw new Error(`Zona inicial "${START_ZONE_ID}" no encontrada en los datos`);
  const zone = buildZone(def);
  const spawn = zone.spawn ?? { x: 1, y: 1 };
  return {
    seed: opts.seed,
    turn: 0,
    player: {
      name: opts.name,
      classId: opts.classId,
      portrait: opts.portrait,
      level: 1,
      xp: 0,
      hp: 12,
      maxHp: 12,
      mp: 4,
      maxMp: 4,
      gold: 25,
      pos: { zone: zone.id, x: spawn.x, y: spawn.y },
    },
    visitedZones: [zone.id],
    flags: {},
    playTimeSec: 0,
    createdAt: new Date().toISOString(),
  };
}
