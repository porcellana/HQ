/**
 * ESTADO DE PARTIDA
 * -----------------
 * Todo lo que se guarda en disco vive en GameState. Si cambias su forma,
 * SUBE `CURRENT_SAVE_VERSION` en save/migrations.ts y añade una migración
 * para que las partidas antiguas sigan funcionando.
 */
import { START_ZONE_ID, getClass, getZoneDef } from '@/data/registry';
import type { StatBlock } from '@/data/schema';
import { addItem, equip, type Equipment } from './items/inventory';
import { createItem, type ItemInstance } from './items/items';
import { Rng } from '@/engine/rng';
import { derive } from './rules/derived';
import type { QuestProgress } from './quests/quests';
import type { ShopState } from './economy/shop';
import { buildZone } from './world/zone';
import { emptyWorld, type WorldState } from './world/dungeons';

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
  /** Mochila. */
  inventory: ItemInstance[];
  /** Objetos equipados por ranura. */
  equipment: Equipment;
  /** Pendiente de recibir el equipo inicial de su clase (partidas migradas). */
  needsStarterKit?: boolean;
  /** Zona (templo) donde reapareces al caer. Por defecto, la capilla de la aldea. */
  respawnZone?: string;
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
  /** Estado de las misiones por id. */
  quests: Record<string, QuestProgress>;
  /** Stock de las tiendas visitadas (se renueva con el tiempo). */
  shops: Record<string, ShopState>;
  /** Mazmorras (reinicios, jefes) y elementos usados (cofres, trampas, vetas). */
  world: WorldState;
  /** Estadísticas de la partida (pantalla final). */
  record: GameRecord;
  playTimeSec: number;
  createdAt: string;
}

export interface GameRecord {
  kills: number;
  bosses: number;
  deaths: number;
  /** Turno en que se terminó la historia (0 = aún no). */
  victoryTurn: number;
  /** Tiempo de juego al terminar la historia (segundos). */
  victoryTime: number;
}

export function emptyRecord(): GameRecord {
  return { kills: 0, bosses: 0, deaths: 0, victoryTurn: 0, victoryTime: 0 };
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
      inventory: [],
      equipment: {},
      needsStarterKit: true,
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
    quests: {},
    shops: {},
    world: emptyWorld(),
    record: emptyRecord(),
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
  p.inventory ??= [];
  p.equipment ??= {};
  if (p.needsStarterKit) giveStarterKit(p);
  const d = derive(p);
  p.maxHp = d.maxHp;
  p.maxMp = d.maxMp;
  p.hp = Math.min(Math.max(0, p.hp), p.maxHp);
  p.mp = Math.min(Math.max(0, p.mp), p.maxMp);
}

/** Entrega el equipo inicial de la clase (al crear o tras migrar una partida antigua). */
export function giveStarterKit(p: PlayerState): void {
  const cls = getClass(p.classId);
  const rng = new Rng(0x5eed);
  for (const s of cls.startingItems) {
    let it: ItemInstance;
    try {
      it = createItem(s.item, 'comun', rng, { qty: s.qty ?? 1 });
    } catch {
      console.warn(`[equipo inicial] objeto desconocido: ${s.item}`);
      continue;
    }
    addItem(p, it);
    if (s.equip) {
      const stack = p.inventory.find((x) => x.id === s.item);
      if (stack) equip(p, stack.uid);
    }
  }
  p.needsStarterKit = false;
}
