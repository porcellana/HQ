/**
 * NÚCLEO DE LA PARTIDA (sin DOM)
 * ------------------------------
 * Mantiene el estado, la zona actual, los enemigos y el sistema de TURNOS:
 *   turno del jugador (moverse, atacar, habilidad, esperar, huir)
 *     → turno de cada enemigo (con una breve pausa visual si está en combate)
 *     → inicio del turno del jugador (estados, regeneración, encuentros)
 * El combate ocurre en el mismo mapa, sin cambiar de pantalla.
 */
import { COMPANIONS, NPCS, ORES, TRAPS, getBackground, getClass, getEnemy, getZoneDef, npcsInZone, setDynamicZoneResolver } from '@/data/registry';
import type { CompanionDef, CompanionEvent, DamageType, DialogNode, EnemySpell, NpcDef, QuestDef, SkillDef, SkillEffect, SkillKey, StatusApply, StatusId, ZoneFeature } from '@/data/schema';
import { Emitter } from '@/engine/events';
import { FX_LIFE_MUL, PACING, SKIP_MIN_ACTORS } from '@/data/config/combat_pacing';
import type { CombatFxEvent, MsgCat } from './combat/presentation';
import { RARITY_RANK } from './combat/presentation';
import { findPath, type Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';
import { createEnemy, scaleEnemyDef, enemySave, type Enemy } from './combat/entities';
import { advanceWalker, pushStep } from './combat/walk';
import {
  applyDefenses,
  attackRoll,
  damageRoll,
  dangerLevel,
  dist,
  hasLineOfSight,
  savingThrow,
  xpForKill,
  type RollMode,
} from './combat/rules';
import { STATUS_INFO, consumeStun, hasStatus, tickStatuses, tryApplyStatus, type StatusInstance } from './combat/status';
import { attributePointsAtLevel, proficiencyBonus, unlockedSkills } from './rules/character';
import { derive, type Derived } from './rules/derived';
import { abilityModifier, averageDice, roll, rollD20 } from './rules/dice';
import { levelForXp } from './rules/progression';
import { emptyParty, emptyRecord, recalcPlayer, type GameState } from './state';
import * as Pets from './pets/pets';
import { wildEnemyDef, wildSpeciesIn } from './pets/wild';
import { skillMods, talentEffects } from './talents';
import { SKILLS, skillBonus } from './rules/skills';
import { enemiesDropping, enemyMatches, nextHop, questGoalZone, questStep, zoneName, type GoalKind } from './quests/guide';
import { addItem, equip, removeQty, unequip } from './items/inventory';
import { itemDef, rarityOf, type ItemInstance } from './items/items';
import { rollLoot } from './items/loot';
import { createItem } from './items/items';
import * as Quests from './quests/quests';
import * as Shop from './economy/shop';
import type { EquipSlot } from '@/data/schema';
import { buildZone, type Zone, type ZoneExit } from './world/zone';
import { dungeonZoneDef, emptyWorld, featureKey, parseDungeonZone, progressOf } from './world/dungeons';

/** Turnos que tarda en volver a crecer una veta de mineral fuera de las mazmorras. */
const ORE_REGROW_TURNS = 400;

export type MsgKind = 'info' | 'warn' | 'good' | 'combat';

/** Datos de una tirada para animarla en pantalla. */
export interface DiceEvent {
  label: string;
  natural: number;
  bonus: number;
  total: number;
  /** Contra qué (CA o CD); null si no aplica. */
  target: number | null;
  targetLabel: 'CA' | 'CD' | '';
  outcome: 'crit' | 'hit' | 'miss' | 'fumble' | 'success' | 'fail';
  /** Tirada secundaria (ataques enemigos): se muestra más pequeña. */
  small?: boolean;
  /** Quién tira y contra quién (tarjeta de duelo). */
  attacker?: Actor;
  defender?: Actor;
  /** Nombre de la acción («Cimitarra», «Bola de fuego»…). */
  action?: string;
  /** Segundos hasta que se revela el resultado (el dado rueda mientras tanto). */
  lead?: number;
}

export interface LevelUpEvent {
  level: number;
  hpGain: number;
  mpGain: number;
  points: number;
  skills: SkillDef[];
  /** Talentos por elegir tras esta subida. */
  talentChoices: number;
}

/** Compañero en el mapa (su vida y aprobación se guardan en state.party). */
export interface Ally {
  def: CompanionDef;
  x: number;
  y: number;
  rx: number;
  ry: number;
  facing: 'left' | 'right';
  bumpT: number;
  bumpDx: number;
  bumpDy: number;
  flashT: number;
  trail?: Point[];
}

/** Mascota en el mapa (sus datos se guardan en state.pets.active). */
export interface PetUnit {
  x: number;
  y: number;
  rx: number;
  ry: number;
  facing: 'left' | 'right';
  bumpT: number;
  bumpDx: number;
  bumpDy: number;
  flashT: number;
  trail?: Point[];
}

/** Aviso de la mascota para la interfaz (subida de nivel, movimiento nuevo, evolución). */
export interface PetEvent {
  kind: 'nivel' | 'movimiento' | 'evolucion' | 'vinculo' | 'establo';
  text: string;
}

/** Casilla peligrosa temporal (suelo ardiendo). No se guarda. */
export interface Hazard {
  x: number;
  y: number;
  turns: number;
  dice: string;
  damageType: DamageType;
}

/** Resultado de una prueba de habilidad en un diálogo. */
export interface CheckResult {
  success: boolean;
  natural: number;
  total: number;
  bonus: number;
  dc: number;
}

export interface GameEvents extends Record<string, unknown> {
  zoneChanged: { zone: Zone; firstVisit: boolean };
  turn: { turn: number };
  message: { text: string; kind?: MsgKind; /** Retraso visual en segundos. */ delay?: number; cat?: MsgCat };
  dice: DiceEvent;
  levelUp: LevelUpEvent;
  playerDied: { cause: string };
  /** Recibió daño (para vibración). */
  playerHurt: { amount: number };
  /** El jugador habla con un PNJ (la interfaz abre el diálogo). */
  npcTalk: { npc: NpcDef };
  /** Cambió algo de las misiones (para refrescar el HUD). */
  questsChanged: Record<string, never>;
  /** Se ha completado la historia principal (pantalla final). */
  victory: Record<string, never>;
  /** Sonido sugerido para la interfaz (el juego no reproduce audio). */
  sfx: { id: SfxId; delay?: number; rate?: number };
  /** Evento de presentación del combate (golpes, muertes…). */
  cfx: CombatFxEvent;
  /** Novedades de la mascota (la interfaz muestra elecciones pendientes). */
  petEvent: PetEvent;
  /** Tocaste a tu mascota en el mapa (órdenes). */
  petTapped: Record<string, never>;
  /** Un actor terminó su acción en combate (cartel de acción). */
  actorAction: { actor: Actor; name: string; lines: string[] };
  /** Empieza tu turno en combate (cartel «TU TURNO»). */
  playerTurn: Record<string, never>;
}

/** Velocidad del combate: paso a paso (esperar a «Siguiente»), lenta o normal. */
export type CombatSpeed = 'paso' | 'lenta' | 'normal';

/** Quién está actuando en el combate. */
export interface Actor {
  kind: 'player' | 'ally' | 'pet' | 'enemy';
  /** Para enemigos: su uid. */
  uid?: number;
}

/** Entrada de la barra de turnos. */
export interface TurnEntry {
  actor: Actor;
  name: string;
  hp: number;
  maxHp: number;
  current: boolean;
  enemy?: Enemy;
}

export interface QuestGoal {
  text: string;
  ready: boolean;
  zone: string | null;
  zoneName: string;
  /** Destino de la salida que acerca al objetivo (null si ya estás en la zona). */
  exitTo: string | null;
  /** Tipo de paso (icono de la guía). */
  kind: GoalKind;
  /** Punto concreto en la zona actual: PNJ, enemigo, veta o salida a tomar. */
  point: { x: number; y: number } | null;
}

export type SfxId =
  | 'golpe' | 'critico' | 'fallo' | 'herido' | 'nivel' | 'moneda' | 'cofre' | 'muerte' | 'victoria' | 'mision'
  // Combate cinematográfico (v0.5)
  | 'whoosh' | 'imp_tajo' | 'imp_contundente' | 'imp_fuego' | 'imp_hielo' | 'imp_rayo' | 'imp_veneno' | 'imp_sagrado' | 'imp_sombra'
  | 'critico_grave' | 'turno' | 'ding' | 'victoria_acorde' | 'desintegra' | 'combate';

/** Efectos visuales efímeros (el renderizador los dibuja). */
export type Fx =
  | { kind: 'text'; x: number; y: number; text: string; color: string; t: number; life: number; size?: number }
  | { kind: 'bolt'; fx: number; fy: number; tx: number; ty: number; color: string; t: number; life: number }
  | { kind: 'burst'; x: number; y: number; radius: number; color: string; t: number; life: number };

/** Botín tirado en el suelo (no se guarda: desaparece al cambiar de zona). */
export interface GroundLoot {
  x: number;
  y: number;
  items: ItemInstance[];
  gold: number;
  /** Segundos desde que cayó (negativo: aún no se ha revelado). Anima el salto. */
  age?: number;
}

/** Estado visual del jugador (no se guarda; se reconstruye al cargar). */
export interface PlayerView {
  rx: number;
  ry: number;
  facing: 'left' | 'right';
  stepT: number;
  from: Point;
  to: Point;
  path: Point[];
  target: Point | null;
  bumpT: number;
  bumpDx: number;
  bumpDy: number;
  flashT: number;
}

/** Estado de combate del jugador que no se guarda (se limpia al recargar). */
export interface PlayerCombat {
  statuses: StatusInstance[];
  buffs: Array<{ stat: 'ataque' | 'daño' | 'ca'; amount: number; turns: number }>;
  cooldowns: Record<string, number>;
  stealth: number;
  skipNext: boolean;
}

const ENEMY_DELAY = 0.2;
/** Casillas por turno en combate del compañero y de la mascota. */
const ALLY_MOVE = 5;
const PET_MOVE = 6;
/** Pausa entre acciones con la velocidad «Lenta». */
const SLOW_DELAY = 0.9;
/** Probabilidad de que un encuentro sea una criatura salvaje (si la zona tiene). */
const WILD_PET_CHANCE = 0.25;
/** Máximo de criaturas salvajes a la vez en una zona. */
const WILD_PET_MAX = 3;
/** Distingue partidas creadas en el mismo milisegundo (semillas distintas). */
let gameCounter = 0;

export class Game {
  readonly events = new Emitter<GameEvents>();
  zone: Zone;
  readonly view: PlayerView;
  readonly combat: PlayerCombat = { statuses: [], buffs: [], cooldowns: {}, stealth: 0, skipNext: false };
  enemies: Enemy[] = [];
  /** PNJ de la zona actual (fijos en su casilla). */
  npcs: NpcDef[] = [];
  /** Casillas vistas por zona (para el mapa grande de las mazmorras; no se guarda). */
  private explored = new Map<string, Uint8Array>();
  /** PNJ al que vamos caminando para hablar. */
  private pendingTalk: string | null = null;
  /** Elemento (cofre, veta, trampa) hacia el que caminamos para usarlo. */
  private pendingFeature: string | null = null;
  /** Trampas descubiertas en esta visita a la zona (claves de casilla). */
  readonly detectedTraps = new Set<string>();
  /** Trampas que ya intentaste detectar en esta visita. */
  private checkedTraps = new Set<string>();
  /** Golpes de pico dados a cada veta (se pierde al salir de la zona). */
  private mineHits = new Map<string, number>();
  ground: GroundLoot[] = [];
  /** Compañero que te acompaña en esta zona (null si no hay). */
  ally: Ally | null = null;
  /** Mascota activa en el mapa. */
  pet: PetUnit | null = null;
  private petPending = false;
  /** Movimiento ordenado por el jugador para el siguiente turno de la mascota (null = IA). */
  petOrder: string | null = null;
  /** Recargas de los movimientos de la mascota (no se guardan). */
  petCooldowns: Record<string, number> = {};
  private petBuffs: Array<{ stat: keyof import('@/data/schema').PetStats; amount: number; turns: number }> = [];
  /** Suelo ardiendo y similares. */
  hazards: Hazard[] = [];
  private allyPending = false;
  /** Quién causó el daño en curso (para los efectos "al matar" de los talentos). */
  private killContext: 'weapon' | 'spell' | 'ally' | 'other' = 'other';
  /** Evita encadenar golpes gratis infinitos (Carnicería). */
  private freeStrike = false;
  fx: Fx[] = [];
  /** Habilidad elegida esperando objetivo. */
  targeting: SkillDef | null = null;
  heldDir: { dx: number; dy: number } | null = null;
  stepDuration = 0.14;
  phase: 'player' | 'enemies' | 'dead' = 'player';
  rng: Rng;
  private enemyQueue: Enemy[] = [];
  private enemyTimer = 0;
  /** Velocidad del combate (la interfaz la fija desde Ajustes; por defecto instantánea para tests). */
  combatSpeed: CombatSpeed = 'normal';
  /** Paso a paso: el actor ya actuó y esperamos a que el jugador pulse «Siguiente». */
  awaitingContinue = false;
  /** Actor que está actuando (para resaltarlo en el mapa y en la barra de turnos). */
  currentActor: Actor | null = null;
  /** Acción «Defender»: +2 CA hasta el comienzo de tu próximo turno. */
  defending = false;
  /**
   * ECONOMÍA DEL TURNO EN COMBATE (estilo D&D 5e / Baldur's Gate 3):
   * en tu turno tienes `turnMove` casillas de movimiento y UNA acción.
   * Moverte no termina el turno; la acción sólo se puede usar una vez.
   */
  turnActive = false;
  turnMove = 0;
  turnMoveMax = 0;
  actionUsed = false;
  /** Modo «Atacar»: se resaltan los enemigos a tu alcance hasta que tocas uno. */
  attackMode = false;
  /** Mensajes del actor en curso (para el cartel de acción). */
  private caption: string[] | null = null;
  /**
   * COMBATE CINEMATOGRÁFICO (lo activa la interfaz; en tests es false y todo
   * es instantáneo). Con él, las consecuencias visibles de cada acción
   * (impacto, daño, sonido, mensajes) se retrasan `actionLead` segundos para
   * que dé tiempo a ver el d20 rodar en la tarjeta de duelo.
   */
  cinematic = false;
  /** Retraso visual de la acción en curso (segundos). */
  actionLead = 0;
  /** Nombre de la acción en curso (para la tarjeta de duelo). */
  private actionName = '';
  /** Alguien atacó durante la acción en curso (decide la pausa posterior). */
  private sawAttack = false;
  /** «Saltar ronda»: el resto de actores de esta ronda actúan sin pausas. */
  fastRound = false;
  /** Paso a paso: segundos hasta poder pulsar «Siguiente» (que se vea el golpe). */
  holdT = 0;
  /** Escapaste del último combate (para no celebrar una «victoria» al huir). */
  fled = false;
  private timers: Array<{ t: number; fn: () => void }> = [];
  /** Vida del jugador mostrada en el HUD mientras el golpe aún no se revela. */
  private shownPlayerHp: number | undefined;
  /** Nombre de la habilidad en curso (para la tarjeta de duelo de sus ataques). */
  private skillContext: string | null = null;
  /** Quién golpea realmente (el jugador aunque sea durante un turno enemigo: contraataque, espinas). */
  private strikeActor: Actor | null = null;
  /** Algo importante pasó durante el turno enemigo: se detiene la ruta. */
  private interrupt = false;

  constructor(public state: GameState) {
    state.quests ??= {};
    state.shops ??= {};
    state.world ??= emptyWorld();
    // Los pisos de mazmorra se generan bajo demanda con la semilla de esta partida.
    setDynamicZoneResolver((id) => dungeonZoneDef(state.seed, state.world, id));
    recalcPlayer(state.player);
    if (state.player.hp <= 0) state.player.hp = Math.ceil(state.player.maxHp / 2);
    this.rng = new Rng(hashString(`${state.seed}:${state.turn}:${Date.now()}:${gameCounter++}`));
    this.zone = this.loadZoneOrFallback(state.player.pos.zone);
    const p = state.player.pos;
    if (!this.zone.isWalkable(p.x, p.y)) {
      const s = this.zone.spawn ?? this.zone.arrivalPoint('1');
      p.x = s.x;
      p.y = s.y;
    }
    this.view = {
      rx: p.x, ry: p.y, facing: 'right', stepT: -1, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y },
      path: [], target: null, bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0,
    };
    state.party ??= emptyParty();
    state.pets ??= Pets.emptyPets();
    this.populateZone();
    this.spawnAlly();
    this.spawnPet();
    this.markExplored();
  }

  private loadZoneOrFallback(id: string): Zone {
    const def = getZoneDef(id);
    if (def) return buildZone(def);
    console.warn(`[juego] zona "${id}" no existe; volviendo a la aldea`);
    const start = buildZone(getZoneDef('aldea_brumaroja')!);
    const s = start.spawn ?? { x: 1, y: 1 };
    this.state.player.pos = { zone: start.id, x: s.x, y: s.y };
    return start;
  }

  // =================================================================== consultas
  get playerPos(): Point {
    return { x: this.state.player.pos.x, y: this.state.player.pos.y };
  }
  get isMoving(): boolean {
    return this.view.stepT >= 0;
  }
  get cls() {
    return getClass(this.state.player.classId);
  }
  get isDead(): boolean {
    return this.phase === 'dead';
  }
  /** ¿Puede el jugador actuar ahora mismo? */
  get canAct(): boolean {
    return this.phase === 'player' && !this.isMoving;
  }
  /** Hay enemigos alerta a la vista: estamos en combate. */
  get inCombat(): boolean {
    const p = this.playerPos;
    return this.enemies.some((e) => e.alerted && dist(e.x, e.y, p.x, p.y) <= e.def.sight + 2);
  }

  npcAt(x: number, y: number): NpcDef | undefined {
    return this.npcs.find((n) => n.x === x && n.y === y);
  }

  enemyAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => e.x === x && e.y === y && e.hp > 0);
  }

  /** Casilla libre para el jugador (terreno + sin enemigos). */
  playerCanWalk(x: number, y: number): boolean {
    return this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !this.isKnownTrap(x, y);
  }

  private blocksSight = (x: number, y: number) => this.zone.tileAt(x, y)?.blocksSight ?? true;

  los(a: Point, b: Point): boolean {
    return hasLineOfSight(a.x, a.y, b.x, b.y, this.blocksSight);
  }

  buffTotal(stat: 'ataque' | 'daño' | 'ca'): number {
    return this.combat.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.amount, 0);
  }

  /** Valores derivados con equipo (CA, ataque, arma...). */
  get derived(): Derived {
    return derive(this.state.player);
  }

  playerAC(): number {
    return this.derived.ac + this.buffTotal('ca') - (hasStatus(this.combat.statuses, 'ralentizado') ? 2 : 0) + (this.defending ? 2 : 0);
  }

  /** Ritmo de las animaciones: más lentas fuera del modo normal en combate. */
  get animRate(): number {
    // En modo cinematográfico el ritmo lo marca PACING (retrasos explícitos), no un factor global.
    return !this.cinematic && this.combatSpeed !== 'normal' && this.inCombat ? 0.55 : 1;
  }

  playerToHit(): number {
    return this.derived.toHit + this.buffTotal('ataque');
  }

  /** Casillas de movimiento por turno: clase + talentos + trasfondo (ralentizado: la mitad). */
  get movementBase(): number {
    const p = this.state.player;
    let m = this.cls.movement ?? 5;
    for (const t of this.talentList('movement')) m += t.amount;
    m += getBackground(p.background ?? '')?.movement ?? 0;
    if (hasStatus(this.combat.statuses, 'ralentizado')) m = Math.floor(m / 2);
    return Math.max(1, m);
  }

  /** ¿Estamos en un turno de combate con movimiento + acción? */
  get combatTurn(): boolean {
    return this.turnActive && this.phase === 'player' && this.inCombat;
  }

  /** Mensaje si ya gastaste la acción de este turno (null si puedes actuar). */
  actionBlocked(): string | null {
    return this.combatTurn && this.actionUsed ? 'Ya has usado tu acción este turno: muévete o pulsa «Terminar turno».' : null;
  }

  /**
   * Tras usar la acción: en combate puedes seguir moviéndote (el turno acaba
   * solo si no te queda nada que hacer); fuera de combate pasa el turno.
   */
  private afterAction(): void {
    if (this.isDead || this.phase !== 'player') return;
    if (this.combatTurn) {
      this.actionUsed = true;
      this.autoEndIfDone();
      this.endActionLead();
      return;
    }
    this.endPlayerTurn();
  }

  /** Termina el turno solo si ya usaste la acción y no puedes moverte más. */
  private autoEndIfDone(): void {
    if (!this.combatTurn) return;
    if (this.actionUsed && (this.turnMove <= 0 || this.reachableTiles().size === 0)) this.endPlayerTurn();
  }

  /** Casillas alcanzables con el movimiento que te queda (clave y*ancho+x → coste). */
  reachableTiles(): Map<number, number> {
    const out = new Map<number, number>();
    if (!this.combatTurn || this.turnMove <= 0) return out;
    const z = this.zone;
    const start = this.playerPos;
    const ok = (x: number, y: number) => this.playerCanWalk(x, y) && !this.allyAt(x, y) && !this.petAt(x, y);
    let frontier: Point[] = [start];
    const seen = new Set<number>([start.y * z.width + start.x]);
    for (let step = 1; step <= this.turnMove && frontier.length; step++) {
      const next: Point[] = [];
      for (const c of frontier) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const x = c.x + dx;
            const y = c.y + dy;
            const k = y * z.width + x;
            if (seen.has(k) || !ok(x, y)) continue;
            // Sin cortar esquinas, igual que el A*.
            if (dx && dy && (!ok(c.x + dx, c.y) || !ok(c.x, c.y + dy))) continue;
            seen.add(k);
            out.set(k, step);
            next.push({ x, y });
          }
        }
      }
      frontier = next;
    }
    return out;
  }

  /** Acción «Correr»: gastas la acción y ganas otro tanto de movimiento. */
  dash(): string | null {
    if (!this.canAct) return 'Espera a tu turno.';
    if (!this.combatTurn) return 'Sólo en combate.';
    const blocked = this.actionBlocked();
    if (blocked) return blocked;
    this.actionUsed = true;
    this.turnMove += this.movementBase;
    this.turnMoveMax += this.movementBase;
    this.targeting = null;
    this.attackMode = false;
    const p = this.playerPos;
    this.floatText(p.x, p.y - 0.4, `👣 +${this.movementBase}`, '#9ad0ff');
    this.msg(`Corres: +${this.movementBase} casillas este turno.`, 'good');
    return null;
  }

  /** CD de los hechizos del jugador con una característica. */
  spellDC(stat: keyof GameState['player']['stats']): number {
    return 8 + proficiencyBonus(this.state.player.level) + abilityModifier(this.derived.stats[stat]);
  }

  // ==================================================================== mensajes
  private msg(text: string, kind: MsgKind = 'info', cat?: MsgCat): void {
    if (this.caption && kind !== 'info') this.caption.push(text);
    this.events.emit('message', { text, kind, delay: this.actionLead, ...(cat ? { cat } : {}) });
  }

  /** `size` (px de mundo) opcional: por defecto los números de daño son grandes; la XP y el oro, pequeños. */
  private floatText(x: number, y: number, text: string, color: string, size?: number, life = 0.9): void {
    this.pushFx({ kind: 'text', x, y, text, color, t: 0, life, ...(size ? { size } : {}) });
  }

  // ============================================== presentación del combate (v0.5)
  /** Ejecuta `fn` atribuyendo los golpes al jugador (para la tarjeta de duelo). */
  private asPlayer<T>(fn: () => T): T {
    const prev = this.strikeActor;
    this.strikeActor = { kind: 'player' };
    try {
      return fn();
    } finally {
      this.strikeActor = prev;
    }
  }

  /** Ejecuta `fn` tras `delay` segundos de juego (ya, si no hay retraso). */
  private later(delay: number, fn: () => void): void {
    if (delay <= 0) fn();
    else this.timers.push({ t: delay, fn });
  }

  /** Añade un efecto visual respetando el retraso de la acción y alargando su vida en cinematográfico. */
  private pushFx(f: Fx): void {
    f.t = -this.actionLead;
    if (this.actionLead > 0) f.life *= FX_LIFE_MUL;
    this.fx.push(f);
  }

  /** Empieza una acción: fija el retraso visual según la velocidad (0 si no es cinematográfico). */
  private beginAction(attack = false): void {
    this.sawAttack = false;
    const speedKey = this.combatSpeed;
    const inFight = this.inCombat || attack;
    this.actionLead = this.cinematic && inFight && !this.fastRound ? PACING[speedKey].lead : 0;
  }

  private endActionLead(): void {
    this.actionLead = 0;
  }

  /** Embestida con anticipación: el actor retrocede un poco y golpea al llegar el impacto. */
  private strike(o: { bumpT: number; bumpDx: number; bumpDy: number }, dx: number, dy: number): void {
    const go = () => {
      o.bumpT = this.cinematic ? 1.3 : 1;
      o.bumpDx = dx;
      o.bumpDy = dy;
    };
    // Empieza un poco antes del impacto para que el golpe coincida con la revelación.
    this.later(Math.max(0, this.actionLead - 0.3), go);
  }

  /** Destello de daño sobre un actor cuando se revela el golpe. */
  private flash(o: { flashT: number }): void {
    this.later(this.actionLead, () => {
      o.flashT = 1;
    });
  }

  /** Evento de presentación (la capa visual lo reproduce). */
  private cfx(ev: CombatFxEvent): void {
    this.sawAttack = true;
    this.events.emit('cfx', ev);
  }

  /** Vida del jugador que debe enseñar el HUD (retrasada hasta que se revela el golpe). */
  get hudHp(): number {
    return this.shownPlayerHp ?? this.state.player.hp;
  }

  /** Paso a paso: salta las pausas del resto de la ronda. */
  skipRound(): void {
    if (!this.cinematic || this.phase !== 'enemies') return;
    this.fastRound = true;
    this.holdT = 0;
    this.actionLead = 0;
    if (this.awaitingContinue) this.continueTurn(true);
    else this.enemyTimer = 0;
  }

  /** ¿Hay suficientes actores pendientes como para ofrecer «Saltar ronda»? */
  get canSkipRound(): boolean {
    if (!this.cinematic || this.phase !== 'enemies' || this.fastRound) return false;
    const pending = this.enemyQueue.length + (this.allyPending ? 1 : 0) + (this.petPending ? 1 : 0);
    return pending + (this.awaitingContinue ? 1 : 0) >= SKIP_MIN_ACTORS - 1 && pending >= 2;
  }

  // ======================================================================= input
  /** Toque en una casilla: moverse, atacar, apuntar habilidad o informar. */
  tapTile(x: number, y: number): void {
    if (!this.zone.inBounds(x, y) || this.phase === 'dead') return;
    if (this.targeting) {
      this.useSkill(this.targeting, { x, y });
      return;
    }
    const from = this.isMoving ? this.view.to : this.playerPos;
    this.pendingTalk = null;
    // Tocar a la mascota = abrir sus órdenes.
    if (this.petAt(x, y) && this.canAct) {
      this.cancelPath();
      this.events.emit('petTapped', {});
      return;
    }
    // Tocar al compañero (fuera de combate) = hablar con él.
    if (this.allyAt(x, y) && !this.inCombat && this.canAct) {
      const cn = this.companionNpc();
      if (cn) {
        this.cancelPath();
        void Quests.onTalk(this.state, cn.id);
        this.events.emit('npcTalk', { npc: cn });
        return;
      }
    }
    const npc = this.npcAt(x, y);
    if (npc && this.canAct && this.canTalk(npc)) {
      this.cancelPath();
      this.talkTo(npc);
      return;
    }
    if (npc) this.pendingTalk = npc.id;
    this.pendingFeature = null;
    const feat = this.interactiveFeatureAt(x, y);
    if (feat && !this.enemyAt(x, y)) {
      const p0 = this.playerPos;
      if (dist(p0.x, p0.y, x, y) <= 1 && this.canAct) {
        this.cancelPath();
        this.interact(feat);
        return;
      }
      this.pendingFeature = featureKey(this.zone.def, x, y);
    }
    const enemy = this.enemyAt(x, y);
    if (enemy && this.canAct) {
      const p = this.playerPos;
      const range = this.derived.weapon.range;
      if (dist(p.x, p.y, enemy.x, enemy.y) <= range && this.los(p, enemy)) {
        const blocked = this.actionBlocked();
        if (blocked) {
          this.describeEnemy(enemy);
          this.msg(blocked, 'warn');
          return;
        }
        this.cancelPath();
        this.attackMode = false;
        this.playerAttack(enemy, {});
        this.afterAction();
        return;
      }
      this.describeEnemy(enemy);
      if (this.attackMode) {
        this.msg('Ese enemigo está fuera de tu alcance: acércate.', 'warn');
        return;
      }
    }
    this.attackMode = false;
    if (from.x === x && from.y === y) {
      this.cancelPath();
      return;
    }
    const path = findPath(this.zone.width, this.zone.height, from, { x, y }, (tx, ty) => this.playerCanWalk(tx, ty), {
      allowGoalBlocked: true,
      maxNodes: 4000,
    });
    if (!path || path.length === 0) {
      const tile = this.zone.tileAt(x, y);
      if (!enemy && !npc && !feat) {
        if (tile && !tile.walkable && dist(from.x, from.y, x, y) <= 1) this.msg(`${tile.name}.`);
        else this.msg('No puedes llegar ahí.', 'warn');
      }
      this.cancelPath();
      return;
    }
    // En combate te mueves hasta lo que te quede de movimiento este turno.
    if (this.combatTurn) {
      if (this.turnMove <= 0) {
        this.msg(this.actionUsed ? 'Sin movimiento ni acción: termina el turno.' : 'No te queda movimiento: usa tu acción o termina el turno.', 'warn');
        this.cancelPath();
        return;
      }
      path.length = Math.min(path.length, this.turnMove);
    }
    this.view.path = path;
    this.view.target = { x, y };
  }

  /** Enemigos a los que puedes atacar con tu arma desde donde estás. */
  attackTargets(): Enemy[] {
    const p = this.playerPos;
    const range = this.derived.weapon.range;
    return this.enemies.filter((e) => e.hp > 0 && dist(p.x, p.y, e.x, e.y) <= range && this.los(p, e));
  }

  /**
   * Botón «Atacar»: si sólo hay un enemigo a tu alcance, le atacas; si hay
   * varios, se resaltan y eliges tocando. Devuelve un aviso o null.
   */
  startAttack(): string | null {
    if (!this.canAct) return 'Espera a tu turno.';
    this.targeting = null;
    const targets = this.attackTargets();
    if (targets.length === 0) {
      this.attackMode = false;
      return 'Ningún enemigo a tu alcance: acércate tocando el suelo.';
    }
    const blocked = this.actionBlocked();
    if (blocked) return blocked;
    if (targets.length === 1) {
      this.attackMode = false;
      this.cancelPath();
      this.playerAttack(targets[0]!, {});
      this.afterAction();
      return null;
    }
    this.attackMode = !this.attackMode;
    if (this.attackMode) this.msg('Toca al enemigo que quieres atacar.', 'info');
    return null;
  }

  /** Acción «Defender»: +2 CA hasta tu próximo turno. */
  defend(): void {
    if (!this.canAct) return;
    const blocked = this.actionBlocked();
    if (blocked) {
      this.msg(blocked, 'warn');
      return;
    }
    this.cancelPath();
    this.targeting = null;
    this.attackMode = false;
    this.defending = true;
    const p = this.playerPos;
    this.floatText(p.x, p.y - 0.4, '🛡 +2 CA', '#9ad0ff');
    this.msg('Te pones a la defensiva (+2 CA hasta tu próximo turno).', 'good');
    this.afterAction();
  }

  /** Paso a paso: continuar con el siguiente actor. */
  continueTurn(force = false): void {
    if (!this.awaitingContinue) return;
    // Que dé tiempo a ver el golpe antes de pasar al siguiente actor.
    if (!force && this.holdT > 0) return;
    this.awaitingContinue = false;
    this.holdT = 0;
    this.enemyTimer = 0;
  }

  /** Posición del actor en curso (para el anillo y la cámara). */
  actorPos(a: Actor | null = this.currentActor): Point | null {
    if (!a) return null;
    if (a.kind === 'player') return this.playerPos;
    if (a.kind === 'ally') return this.ally ? { x: this.ally.x, y: this.ally.y } : null;
    if (a.kind === 'pet') return this.pet ? { x: this.pet.x, y: this.pet.y } : null;
    const e = this.enemies.find((x) => x.uid === a.uid);
    return e ? { x: e.x, y: e.y } : null;
  }

  /** Orden de turnos visible: tú, aliados y enemigos en combate por cercanía. */
  turnOrder(): TurnEntry[] {
    const cur = this.currentActor;
    const same = (a: Actor) => !!cur && cur.kind === a.kind && cur.uid === a.uid;
    const p = this.state.player;
    const out: TurnEntry[] = [];
    const me: Actor = { kind: 'player' };
    out.push({ actor: me, name: p.name, hp: p.hp, maxHp: p.maxHp, current: same(me) || (this.phase === 'player' && !cur) });
    const cd = this.companionDef;
    if (this.ally && cd) {
      const a: Actor = { kind: 'ally' };
      out.push({ actor: a, name: cd.name, hp: this.state.party.down ? 0 : this.state.party.hp, maxHp: this.allyStats().maxHp, current: same(a) });
    }
    const pi = this.petInstance;
    if (this.pet && pi) {
      const a: Actor = { kind: 'pet' };
      out.push({ actor: a, name: Pets.petName(pi), hp: pi.down ? 0 : pi.hp, maxHp: this.petStatsNow().hp, current: same(a) });
    }
    const pos = this.playerPos;
    const foes = this.enemies
      .filter((e) => e.hp > 0 && e.alerted && dist(e.x, e.y, pos.x, pos.y) <= e.def.sight + 2)
      .sort((a, b) => dist(a.x, a.y, pos.x, pos.y) - dist(b.x, b.y, pos.x, pos.y));
    for (const e of foes) {
      const a: Actor = { kind: 'enemy', uid: e.uid };
      out.push({ actor: a, name: e.def.name, hp: e.hp, maxHp: e.maxHp, current: same(a), enemy: e });
    }
    return out;
  }

  describeEnemy(e: Enemy): void {
    const d = dangerLevel(e.def.level, this.state.player.level);
    const labels = { trivial: 'trivial', facil: 'fácil', normal: 'rival digno', dificil: 'peligroso', mortal: '¡MORTAL!' };
    this.msg(`${e.def.name} · Nv ${e.def.level} · ${e.hp}/${e.maxHp} PV · CA ${e.def.ac} · ${labels[d]}`, d === 'mortal' || d === 'dificil' ? 'warn' : 'info');
  }

  cancelPath(): void {
    this.view.path = [];
    this.view.target = null;
  }

  /** Elegir una habilidad desde la barra. Las de objetivo esperan a que toques el mapa. */
  selectSkill(skill: SkillDef): void {
    if (!this.canAct) return;
    const blocked = this.actionBlocked();
    if (blocked) {
      this.msg(blocked, 'warn');
      return;
    }
    if (this.targeting?.id === skill.id) {
      this.targeting = null;
      return;
    }
    const why = this.skillBlockedReason(skill);
    if (why) {
      this.msg(why, 'warn');
      return;
    }
    if (skill.target === 'self') {
      this.useSkill(skill, this.playerPos);
      return;
    }
    // Si sólo hay un enemigo válido, se lanza directamente.
    const targets = this.enemies.filter((e) => this.inSkillRange(skill, e));
    if (targets.length === 1) {
      this.useSkill(skill, targets[0]!);
      return;
    }
    if (targets.length === 0) {
      this.msg('No hay ningún objetivo a tu alcance.', 'warn');
      return;
    }
    this.targeting = skill;
    this.cancelPath();
    this.msg(`${skill.icon} ${skill.name}: toca un objetivo.`);
  }

  skillBlockedReason(skill: SkillDef): string | null {
    const p = this.state.player;
    if (skill.unlockLevel > p.level) return `Se desbloquea a nivel ${skill.unlockLevel}.`;
    if ((this.combat.cooldowns[skill.id] ?? 0) > 0) return `${skill.name} se está recargando (${this.combat.cooldowns[skill.id]} turnos).`;
    if (p.mp < this.skillCost(skill)) return `No tienes suficiente ${this.cls.resource.name.toLowerCase()}.`;
    return null;
  }

  /** Coste real de una habilidad (los talentos pueden abaratarla). */
  skillCost(skill: SkillDef): number {
    return Math.max(0, skill.cost + skillMods(this.state.player, skill.id).reduce((a, m) => a + (m.costDelta ?? 0), 0));
  }

  inSkillRange(skill: SkillDef, target: Point): boolean {
    const p = this.playerPos;
    return dist(p.x, p.y, target.x, target.y) <= Math.max(1, skill.range) && this.los(p, target);
  }

  /** Esperar un turno sin moverse. */
  waitTurn(): void {
    if (!this.canAct) return;
    this.cancelPath();
    this.targeting = null;
    this.endPlayerTurn();
  }

  // ================================================================ bucle / turnos
  update(dt: number): void {
    this.state.playTimeSec += dt;
    this.updateAnimations(dt);
    if (this.phase === 'enemies') {
      if (this.awaitingContinue) return;
      this.enemyTimer -= dt;
      while (this.phase === 'enemies' && this.enemyTimer <= 0 && !this.awaitingContinue) this.processNextEnemy();
      return;
    }
    if (this.phase !== 'player') return;
    const v = this.view;
    if (v.stepT >= 0) {
      v.stepT += dt / this.stepDuration;
      if (v.stepT >= 1) this.finishStep();
      else {
        v.rx = v.from.x + (v.to.x - v.from.x) * v.stepT;
        v.ry = v.from.y + (v.to.y - v.from.y) * v.stepT;
      }
    }
    if (v.stepT < 0 && this.phase === 'player') this.tryStartStep();
  }

  private updateAnimations(rawDt: number): void {
    const dt = rawDt * this.animRate;
    // Temporizadores de presentación y espera de «Siguiente».
    if (this.holdT > 0) this.holdT = Math.max(0, this.holdT - rawDt);
    if (this.timers.length) {
      const due: Array<() => void> = [];
      for (const t of this.timers) {
        t.t -= rawDt;
        if (t.t <= 0) due.push(t.fn);
      }
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const fn of due) fn();
    }
    for (const g of this.ground) if (g.age !== undefined) g.age += rawDt;
    const v = this.view;
    const bumpRate = this.cinematic ? 3.2 : 5;
    v.bumpT = Math.max(0, v.bumpT - dt * bumpRate);
    v.flashT = Math.max(0, v.flashT - dt * 4);
    if (this.ally) advanceWalker(this.ally, dt);
    if (this.pet) advanceWalker(this.pet, dt);
    for (const e of this.enemies) {
      advanceWalker(e, dt);
      e.bumpT = Math.max(0, e.bumpT - dt * bumpRate);
      e.flashT = Math.max(0, e.flashT - dt * 4);
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  private tryStartStep(): void {
    const v = this.view;
    const pos = this.playerPos;
    let next: Point | undefined;
    if (v.path.length > 0) next = v.path[0];
    else if (this.heldDir) {
      const target = { x: pos.x + this.heldDir.dx, y: pos.y + this.heldDir.dy };
      const enemy = this.enemyAt(target.x, target.y);
      if (enemy) {
        // Empujar el joystick contra un enemigo = atacarlo (si te queda la acción).
        const blocked = this.actionBlocked();
        if (blocked) {
          this.msg(blocked, 'warn');
          this.heldDir = null;
          return;
        }
        this.playerAttack(enemy, {});
        this.afterAction();
        return;
      }
      if (this.combatTurn && this.turnMove <= 0) return;
      next = this.resolveHeldStep(pos, this.heldDir);
      if (!next) return;
      v.path = [next];
    }
    if (!next) return;
    if (!this.playerCanWalk(next.x, next.y) || (this.combatTurn && this.turnMove <= 0)) {
      this.cancelPath();
      return;
    }
    v.path.shift();
    // Si el compañero está en medio, os intercambiáis el sitio.
    const al = this.allyAt(next.x, next.y);
    if (al) {
      al.x = pos.x;
      al.y = pos.y;
    }
    const pu = this.petAt(next.x, next.y);
    if (pu) {
      pu.x = pos.x;
      pu.y = pos.y;
    }
    v.from = pos;
    v.to = { x: next.x, y: next.y };
    if (next.x !== pos.x) v.facing = next.x > pos.x ? 'right' : 'left';
    v.stepT = 0;
  }

  private resolveHeldStep(pos: Point, d: { dx: number; dy: number }): Point | undefined {
    const ok = (x: number, y: number) => this.playerCanWalk(x, y);
    const { dx, dy } = d;
    if (dx !== 0 && dy !== 0) {
      if (ok(pos.x + dx, pos.y + dy) && ok(pos.x + dx, pos.y) && ok(pos.x, pos.y + dy)) return { x: pos.x + dx, y: pos.y + dy };
      if (ok(pos.x + dx, pos.y)) return { x: pos.x + dx, y: pos.y };
      if (ok(pos.x, pos.y + dy)) return { x: pos.x, y: pos.y + dy };
      return undefined;
    }
    return ok(pos.x + dx, pos.y + dy) ? { x: pos.x + dx, y: pos.y + dy } : undefined;
  }

  /** Marca como vistas las casillas alrededor del jugador. */
  markExplored(radius = 6): void {
    const z = this.zone;
    let m = this.explored.get(z.id);
    if (!m || m.length !== z.width * z.height) this.explored.set(z.id, (m = new Uint8Array(z.width * z.height)));
    const p = this.playerPos;
    for (let y = Math.max(0, p.y - radius); y <= Math.min(z.height - 1, p.y + radius); y++) {
      for (let x = Math.max(0, p.x - radius); x <= Math.min(z.width - 1, p.x + radius); x++) m[y * z.width + x] = 1;
    }
  }

  /** ¿Se ha visto esta casilla? Fuera de las mazmorras se ve todo el mapa. */
  isExplored(x: number, y: number): boolean {
    if (!this.zone.def.dungeon) return true;
    return (this.explored.get(this.zone.id)?.[y * this.zone.width + x] ?? 0) === 1;
  }

  private finishStep(): void {
    const v = this.view;
    const prevExit = this.zone.exitAt(v.from.x, v.from.y);
    this.state.player.pos.x = v.to.x;
    this.state.player.pos.y = v.to.y;
    this.markExplored();
    v.rx = v.to.x;
    v.ry = v.to.y;
    v.stepT = -1;
    if (v.path.length === 0) v.target = null;
    if (this.stepOnTrap(v.to.x, v.to.y)) {
      if (this.isDead) return;
      this.cancelPath();
    }
    this.pickupHere();
    if (this.pendingFeature && v.path.length === 0) {
      const key = this.pendingFeature;
      this.pendingFeature = null;
      const f = this.zone.def.features?.find((ff) => featureKey(this.zone.def, ff.x, ff.y) === key);
      if (f && dist(v.to.x, v.to.y, f.x, f.y) <= 1 && this.interactiveFeatureAt(f.x, f.y)) {
        this.interact(f);
        return;
      }
    }
    if (this.pendingTalk && v.path.length === 0) {
      const npc = this.npcs.find((n) => n.id === this.pendingTalk);
      this.pendingTalk = null;
      if (npc && this.canTalk(npc)) {
        this.endPlayerTurn();
        this.talkTo(npc);
        return;
      }
    }
    const exit = this.zone.exitAt(v.to.x, v.to.y);
    if (exit && !prevExit) {
      this.state.turn++;
      this.turnActive = false;
      this.useExit(exit);
      return;
    }
    // En combate, moverse gasta casillas pero no termina el turno.
    if (this.combatTurn) {
      this.turnMove = Math.max(0, this.turnMove - 1);
      if (this.turnMove <= 0) {
        this.cancelPath();
        this.heldDir = null;
        this.autoEndIfDone();
      }
      return;
    }
    this.endPlayerTurn();
  }

  /** Fin del turno del jugador: cuentas atrás y turno de los enemigos. */
  endPlayerTurn(): void {
    if (this.phase === 'dead') return;
    // Al acabar un turno de combate se descarta la ruta pendiente.
    if (this.turnActive) this.cancelPath();
    this.turnActive = false;
    this.state.turn++;
    this.targeting = null;
    const c = this.combat;
    for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, (c.cooldowns[k] ?? 0) - 1);
    for (const b of c.buffs) b.turns--;
    c.buffs = c.buffs.filter((b) => b.turns > 0);
    if (c.stealth > 0) c.stealth--;
    this.events.emit('turn', { turn: this.state.turn });
    this.interrupt = false;
    const p = this.playerPos;
    this.enemyQueue = [...this.enemies].sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    for (const h of this.hazards) h.turns--;
    this.hazards = this.hazards.filter((h) => h.turns > 0);
    this.allyPending = !!this.ally;
    this.petPending = !!this.pet;
    for (const k of Object.keys(this.petCooldowns)) this.petCooldowns[k] = Math.max(0, (this.petCooldowns[k] ?? 0) - 1);
    for (const b of this.petBuffs) b.turns--;
    this.petBuffs = this.petBuffs.filter((b) => b.turns > 0);
    this.enemyTimer = 0;
    this.awaitingContinue = false;
    this.attackMode = false;
    // Cartel con lo que acabas de hacer y una pausa para verlo antes de que actúen los demás.
    const myLines = this.caption;
    this.caption = null;
    const attacked = this.sawAttack;
    this.sawAttack = false;
    this.endActionLead();
    if (this.cinematic && this.inCombat) {
      const pc = PACING[this.combatSpeed];
      if (myLines) this.events.emit('actorAction', { actor: { kind: 'player' }, name: this.state.player.name, lines: myLines });
      this.enemyTimer = attacked ? pc.afterPlayer : pc.moveDelay;
    } else if (myLines && this.inCombat && this.combatSpeed !== 'normal') {
      this.events.emit('actorAction', { actor: { kind: 'player' }, name: this.state.player.name, lines: myLines });
      this.enemyTimer = this.combatSpeed === 'paso' ? 0.8 : SLOW_DELAY;
    }
    this.phase = 'enemies';
    // Sin enemigos cerca, todo ocurre en el acto para que caminar sea fluido.
    if (!this.inCombat) while (this.phase === 'enemies') this.processNextEnemy();
  }

  /**
   * Ejecuta el turno de un actor recogiendo sus mensajes para el cartel y,
   * si estamos en combate y hizo algo visible, marca la pausa según la
   * velocidad elegida (paso a paso = esperar a «Siguiente»).
   */
  private runActor(actor: Actor, name: string, fn: () => boolean): void {
    const wasCombat = this.inCombat;
    this.currentActor = actor;
    this.caption = [];
    this.beginAction();
    this.actionName = '';
    const before = this.actorPos(actor);
    let acted = false;
    try {
      acted = fn();
    } finally {
      const lines = this.caption ?? [];
      // Si no dijo nada, al menos contamos si se movió.
      if (!lines.length) {
        const after = this.actorPos(actor);
        const moved = !!before && !!after && (before.x !== after.x || before.y !== after.y);
        lines.push(moved ? (actor.kind === 'enemy' ? 'Se acerca.' : 'Se coloca.') : 'Espera su momento.');
      }
      this.caption = null;
      const attacked = this.sawAttack;
      this.sawAttack = false;
      const lead = this.actionLead;
      this.endActionLead();
      if (acted && (wasCombat || this.inCombat) && !this.isDead) {
        this.events.emit('actorAction', { actor, name, lines });
        if (this.cinematic) {
          const pc = PACING[this.combatSpeed];
          if (this.fastRound) this.enemyTimer = 0;
          else if (this.combatSpeed === 'paso') {
            this.awaitingContinue = true;
            this.holdT = attacked ? Math.max(lead + 0.3, pc.nextHold) : 0.25;
          } else this.enemyTimer = attacked ? pc.perActor : pc.moveDelay;
        } else if (this.combatSpeed === 'paso') this.awaitingContinue = true;
        else this.enemyTimer = this.combatSpeed === 'lenta' ? SLOW_DELAY : ENEMY_DELAY;
      }
    }
  }

  private processNextEnemy(): void {
    if (this.allyPending) {
      this.allyPending = false;
      this.runActor({ kind: 'ally' }, this.companionDef?.name ?? 'Compañero', () => this.allyTurn());
      return;
    }
    if (this.petPending) {
      this.petPending = false;
      const pi = this.petInstance;
      this.runActor({ kind: 'pet' }, pi ? Pets.petName(pi) : 'Mascota', () => this.petTurn());
      return;
    }
    const e = this.enemyQueue.shift();
    if (!e) {
      this.startPlayerTurn();
      return;
    }
    if (e.hp <= 0 || !this.enemies.includes(e)) return;
    this.runActor({ kind: 'enemy', uid: e.uid }, e.def.name, () => this.enemyTurn(e));
  }

  /** Comienzo del turno del jugador: estados, regeneración y encuentros. */
  private startPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.phase = 'player';
    this.defending = false;
    this.awaitingContinue = false;
    this.fastRound = false;
    this.holdT = 0;
    this.sawAttack = false;
    this.currentActor = this.inCombat ? { kind: 'player' } : null;
    // Lo que hagas en tu turno se recoge para el cartel de acción.
    this.caption = this.inCombat ? [] : null;
    if (this.inCombat) this.events.emit('playerTurn', {});
    const p = this.state.player;
    const c = this.combat;
    if (this.interrupt) this.cancelPath();

    // Daño por estados
    const tick = tickStatuses(this.rng, c.statuses);
    for (const part of tick.parts) {
      this.damagePlayer(part.amount, STATUS_INFO[part.id].name.toLowerCase());
      if (this.isDead) return;
    }
    // Talentos de regeneración en combate
    if (this.inCombat) {
      for (const r of this.talentList('regen')) {
        if (this.state.turn % r.every === 0 && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + r.amount);
          this.floatText(this.playerPos.x, this.playerPos.y, `+${r.amount}`, '#60e070');
        }
      }
    }
    // Regeneración fuera de combate
    if (!this.inCombat) {
      if (this.state.turn % 5 === 0 && p.hp < p.maxHp) p.hp++;
      if (this.state.turn % 3 === 0 && p.mp < p.maxMp) p.mp++;
      this.petRegen();
      this.maybeSpawnEncounter();
    }
    this.scanTraps();
    // Aturdido o ralentizado: se pierde este turno
    if (consumeStun(c.statuses)) {
      this.msg('¡Estás aturdido y pierdes el turno!', 'warn');
      this.cancelPath();
      this.endPlayerTurn();
      return;
    }
    // Turno de combate: movimiento + 1 acción (ralentizado: la mitad de movimiento).
    this.turnActive = this.inCombat;
    this.actionUsed = false;
    this.turnMove = this.turnMoveMax = this.turnActive ? this.movementBase : 0;
    if (this.turnActive && hasStatus(c.statuses, 'ralentizado')) this.msg(`Ralentizado: sólo ${this.turnMove} casillas este turno.`, 'warn');
  }

  // ==================================================================== zonas
  useExit(exit: ZoneExit): void {
    if (exit.requiresFlag && !this.state.flags[exit.requiresFlag]) {
      this.cancelPath();
      this.heldDir = null;
      this.msg(exit.lockedText ?? 'Está cerrado.', 'warn');
      return;
    }
    const ref = parseDungeonZone(exit.to);
    if (ref) {
      const d = ref.dungeon;
      if (d.requiresFlag && !this.state.flags[d.requiresFlag]) {
        this.cancelPath();
        this.heldDir = null;
        this.msg(d.lockedText ?? `${d.name}: la entrada está sellada.`, 'warn');
        return;
      }
      // Entrar desde la superficie en una mazmorra ya completada: ¡una nueva!
      if (ref.floor === 1 && this.zone.def.dungeon?.id !== d.id) {
        const prog = progressOf(this.state.world, d.id);
        if (prog.cleared) {
          prog.run++;
          prog.cleared = false;
          this.msg(`${d.name} ha cambiado desde tu última visita... Nuevos pasadizos, nuevos peligros.`, 'warn');
        }
      }
    }
    const def = getZoneDef(exit.to);
    if (!def) {
      this.cancelPath();
      this.heldDir = null;
      this.msg(`${exit.label ?? 'Este camino'}: está bloqueado por ahora.`, 'warn');
      return;
    }
    if (this.inCombat) this.msg('Escapas de tus perseguidores.', 'good');
    this.enterZone(def.id, exit.arrive);
  }

  enterZone(zoneId: string, arrive: string | null): void {
    const def = getZoneDef(zoneId);
    if (!def) return;
    this.zone = buildZone(def);
    const p = arrive ? this.zone.arrivalPoint(arrive) : (this.zone.spawn ?? this.zone.arrivalPoint('1'));
    this.state.player.pos = { zone: this.zone.id, x: p.x, y: p.y };
    const v = this.view;
    v.rx = p.x;
    v.ry = p.y;
    v.from = { ...p };
    v.to = { ...p };
    v.stepT = -1;
    this.cancelPath();
    this.heldDir = null;
    this.targeting = null;
    this.phase = 'player';
    this.combat.stealth = 0;
    this.populateZone();
    this.spawnAlly();
    this.spawnPet();
    this.markExplored();
    const dz = this.zone.def.dungeon;
    if (dz) {
      const prog = progressOf(this.state.world, dz.id);
      const depth = dz.floor === 'jefe' ? 99 : dz.floor;
      prog.deepest = Math.max(prog.deepest, depth);
      if (dz.floor === 'jefe' && !prog.cleared) {
        this.msg('Sientes una presencia poderosa. Prepárate.', 'warn');
        this.companionSay('jefe');
      } else if (dz.floor === 1) this.companionSay('mazmorra', 0.7);
    }
    const firstVisit = !this.state.visitedZones.includes(this.zone.id);
    if (firstVisit) this.state.visitedZones.push(this.zone.id);
    this.events.emit('zoneChanged', { zone: this.zone, firstVisit });
    void Quests.onVisit(this.state, this.zone.id);
    this.events.emit('questsChanged', {});
    if (firstVisit && (this.zone.def.kind === 'wild' || this.zone.def.kind === 'dungeon')) {
      this.gainXp(this.zone.def.discoverXp ?? 20 * this.zone.def.level, `descubres ${this.zone.def.name}`);
    }
  }

  // =============================================================== encuentros
  /** Coloca los grupos iniciales de la zona (los enemigos no se guardan). */
  private populateZone(): void {
    this.npcs = npcsInZone(this.zone.id, this.state.flags);
    this.pendingTalk = null;
    this.enemies = [];
    this.hazards = [];
    this.ground = [];
    this.fx = [];
    this.detectedTraps.clear();
    this.checkedTraps = new Set();
    this.mineHits.clear();
    this.pendingFeature = null;
    // Vetas: agotadas = se pueden pisar; fuera de mazmorras vuelven a crecer.
    for (const f of this.zone.def.features ?? []) {
      if (f.kind === 'mineral') this.zone.setBlocked(f.x, f.y, !this.featureUsed(f));
    }
    const boss = this.zone.def.bossSpawn;
    const dz = this.zone.def.dungeon;
    if (boss && !(dz && progressOf(this.state.world, dz.id).cleared)) {
      this.spawnEnemy(boss.enemy, boss.x, boss.y);
      for (const g of boss.guards ?? []) this.spawnEnemy(g.enemy, g.x, g.y);
    }
    const enc = this.zone.def.encounters;
    if (!enc) return;
    for (let i = 0; i < enc.initial; i++) this.spawnGroup();
    // Siempre hay al menos una criatura salvaje si la zona es su hábitat.
    const wild = wildSpeciesIn(this.zone.def.dungeon?.id ?? this.zone.id);
    if (wild.length && !this.enemies.some((e) => e.def.pet)) this.spawnWildPet(this.rng.pick(wild));
  }

  private maybeSpawnEncounter(): void {
    const enc = this.zone.def.encounters;
    if (!enc || this.enemies.length >= enc.maxActive) return;
    if (this.rng.chance(enc.perStepChance)) this.spawnGroup();
  }

  /** Crea un grupo aleatorio lejos del jugador y fuera de su vista si es posible. */
  spawnGroup(): Enemy[] {
    const enc = this.zone.def.encounters;
    if (!enc || enc.groups.length === 0) return [];
    // A veces, en lugar de un grupo, aparece una criatura salvaje vinculable.
    const habitat = this.zone.def.dungeon?.id ?? this.zone.id;
    const wild = wildSpeciesIn(habitat);
    if (wild.length && this.enemies.filter((e) => e.def.pet).length < WILD_PET_MAX && this.rng.chance(WILD_PET_CHANCE)) {
      const w = this.spawnWildPet(this.rng.pick(wild));
      if (w) return [w];
    }
    const g = this.rng.weighted(enc.groups, (x) => x.weight);
    const def = getEnemy(g.enemy);
    if (!def) {
      console.warn(`[encuentros] enemigo desconocido: ${g.enemy}`);
      return [];
    }
    const minD = enc.minDistance ?? 7;
    const p = this.playerPos;
    let spot: Point | null = null;
    for (let i = 0; i < 60 && !spot; i++) {
      const x = this.rng.int(0, this.zone.width - 1);
      const y = this.rng.int(0, this.zone.height - 1);
      if (!this.freeForEnemy(x, y) || dist(x, y, p.x, p.y) < minD || this.zone.exitAt(x, y)) continue;
      if (i < 40 && this.los(p, { x, y })) continue;
      spot = { x, y };
    }
    if (!spot) return [];
    const count = this.rng.int(g.min ?? 1, g.max ?? 1);
    const out: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const pos = i === 0 ? spot : this.freeSpotNear(spot, 2);
      if (!pos) break;
      const lvl = Math.min(20, Math.max(1, this.state.player.level + this.rng.int(-1, 1)));
      const sc = scaleEnemyDef(def, lvl);
      const e = createEnemy(sc.def, pos.x, pos.y, this.rng, sc.hpMul);
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  /** Crea un enemigo concreto (jefes, invocaciones, tests). */
  spawnEnemy(id: string, x: number, y: number): Enemy | null {
    const def = getEnemy(id);
    if (!def || !this.freeForEnemy(x, y)) return null;
    const e = createEnemy(def, x, y, this.rng);
    this.enemies.push(e);
    return e;
  }

  freeForEnemy(x: number, y: number): boolean {
    const p = this.playerPos;
    return this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !(p.x === x && p.y === y) && !this.allyAt(x, y) && !this.petAt(x, y);
  }

  private freeSpotNear(c: Point, r: number): Point | null {
    for (let i = 0; i < 20; i++) {
      const x = c.x + this.rng.int(-r, r);
      const y = c.y + this.rng.int(-r, r);
      if (this.freeForEnemy(x, y)) return { x, y };
    }
    return null;
  }

  // ======================================================== ataques del jugador
  /** Ataque con el arma (también lo usan las habilidades de tipo "attack"). */
  playerAttack(
    enemy: Enemy,
    opt: { extraDice?: string; moreDice?: string[]; toHitBonus?: number; critRange?: number; applyStatus?: StatusApply; moreStatus?: StatusApply[] },
  ): void {
    this.asPlayer(() => this.playerAttackInner(enemy, opt));
  }

  private playerAttackInner(
    enemy: Enemy,
    opt: { extraDice?: string; moreDice?: string[]; toHitBonus?: number; critRange?: number; applyStatus?: StatusApply; moreStatus?: StatusApply[] },
  ): void {
    const d = this.derived;
    const weapon = d.weapon;
    const pos = this.playerPos;
    this.beginAction(true);
    this.actionName = this.skillContext ?? weapon.name;
    this.faceTowards(enemy);
    if (weapon.range > 1) {
      this.pushFx({ kind: 'bolt', fx: pos.x, fy: pos.y, tx: enemy.x, ty: enemy.y, color: '#d8d0bc', t: 0, life: 0.25 });
    } else this.strike(this.view, Math.sign(enemy.x - pos.x), Math.sign(enemy.y - pos.y));

    let mode: RollMode = 'normal';
    const adv = this.combat.stealth > 0;
    const dis = hasStatus(this.combat.statuses, 'veneno');
    if (adv && !dis) mode = 'ventaja';
    if (dis && !adv) mode = 'desventaja';
    if (adv) {
      this.combat.stealth = 0;
      this.msg('Atacas desde las sombras (ventaja).', 'combat');
    }
    const toHit = this.playerToHit() + (opt.toHitBonus ?? 0);
    const critRange = Math.min(weapon.critRange, opt.critRange ?? 20);
    const r = attackRoll(this.rng, toHit, enemy.def.ac, mode, critRange);
    this.sawAttack = true;
    this.events.emit('dice', {
      label: weapon.name, natural: r.natural, bonus: toHit, total: r.total, target: enemy.def.ac, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss',
      attacker: { kind: 'player' }, defender: { kind: 'enemy', uid: enemy.uid }, action: this.actionName, lead: this.actionLead,
    });
    this.sfx(r.crit ? 'critico' : r.hit ? 'golpe' : 'fallo');
    enemy.alerted = true;
    if (!r.hit) {
      this.floatText(enemy.x, enemy.y, r.fumble ? '¡Pifia!' : 'Fallo', '#a49c8a');
      this.msg(r.fumble ? `¡Pifia! Tu ${weapon.name.toLowerCase()} golpea el aire.` : `Fallas contra ${enemy.def.name} (${r.total} vs CA ${enemy.def.ac}).`, 'combat', 'miss');
      return;
    }
    const p = this.state.player;
    let bonus = d.damageMod + this.buffTotal('daño');
    for (const t of this.talentList('berserk')) if (p.hp <= (p.maxHp * t.threshold) / 100) bonus += t.damage;
    let dmg = damageRoll(this.rng, weapon.dice, bonus, r.crit).total;
    if (opt.extraDice) dmg += damageRoll(this.rng, opt.extraDice, 0, r.crit).total;
    for (const extra of opt.moreDice ?? []) dmg += damageRoll(this.rng, extra, 0, r.crit).total;
    this.killContext = 'weapon';
    this.damageEnemy(enemy, dmg, weapon.damageType, r.crit);
    this.killContext = 'other';
    // Robo de vida
    const steal = this.talentList('lifesteal').reduce((a, t) => a + t.pct, 0);
    if (steal > 0) {
      const heal = Math.max(1, Math.round((dmg * steal) / 100));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatText(pos.x, pos.y, `+${heal}`, '#60e070');
    }
    if (enemy.hp <= 0) return;
    if (opt.applyStatus) this.applyStatusToEnemy(enemy, opt.applyStatus);
    for (const st of opt.moreStatus ?? []) this.applyStatusToEnemy(enemy, st);
    if (r.crit) for (const t of this.talentList('onCrit')) this.applyStatusToEnemy(enemy, t.status);
    for (const t of this.talentList('poisonStrike')) this.applyStatusToEnemy(enemy, { id: 'veneno', chance: t.chance, turns: t.turns });
    if (adv && this.talentList('stealthStun').length) {
      this.msg('¡Golpe desde la sombra! Queda aturdido.', 'good');
      this.applyStatusToEnemy(enemy, { id: 'aturdido', turns: 1 });
    }
  }

  private applyStatusToEnemy(enemy: Enemy, s: StatusApply): void {
    if (tryApplyStatus(this.rng, enemy.statuses, s, enemy.def.immune)) {
      const info = STATUS_INFO[s.id];
      this.floatText(enemy.x, enemy.y - 0.3, info.icon, info.color);
      this.msg(`${enemy.def.name}: ${info.name.toLowerCase()}.`, 'combat');
    }
  }

  /** Aplica daño a un enemigo (con resistencias) y gestiona muerte y fases. */
  damageEnemy(enemy: Enemy, raw: number, type: DamageType, crit = false): void {
    const d = applyDefenses(raw, type, enemy.def);
    // La barra de vida no baja hasta que la tarjeta de duelo revela el golpe.
    if (this.actionLead > 0 && enemy.shownHp === undefined) {
      enemy.shownHp = enemy.hp;
      this.later(this.actionLead, () => {
        enemy.shownHp = undefined;
      });
    }
    enemy.hp -= d.amount;
    this.flash(enemy);
    enemy.alerted = true;
    const color = crit ? '#f2d888' : d.note === 'vulnerable' ? '#ff8040' : d.note === 'resiste' ? '#a0a0b0' : '#ffffff';
    this.floatText(enemy.x, enemy.y, `${crit ? '¡' : ''}${d.amount}${crit ? '!' : ''}`, color);
    const note = d.note === 'vulnerable' ? ' (¡vulnerable!)' : d.note === 'resiste' ? ' (resiste)' : '';
    this.msg(`${crit ? '¡CRÍTICO! ' : ''}${enemy.def.name} recibe ${d.amount} de daño ${type}${note}.`, 'combat', this.strikeActor || this.currentActor?.kind !== 'enemy' ? 'dmg-out' : 'dmg-in');
    this.cfx({
      type: 'hit', target: { kind: 'enemy', uid: enemy.uid }, pos: { x: enemy.x, y: enemy.y }, amount: d.amount, dmgType: type, crit,
      note: d.note, killed: enemy.hp <= 0, action: this.skillContext ?? this.actionName, lead: this.actionLead,
      attacker: this.strikeActor ?? (this.currentActor && !(this.currentActor.kind === 'enemy' && this.currentActor.uid === enemy.uid) ? this.currentActor : null),
    });
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      return;
    }
    this.checkBossPhase(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    enemy.hp = 0;
    this.enemies = this.enemies.filter((e) => e !== enemy);
    const ctx = this.killContext;
    if (ctx === 'weapon' || ctx === 'spell') this.onKillTalents(enemy, ctx);
    if (ctx === 'ally') this.companionSay('mata', 0.25);
    this.pushFx({ kind: 'burst', x: enemy.x, y: enemy.y, radius: 0.8, color: '#e05050', t: 0, life: 0.4 });
    // Con compañero, él se lleva parte del mérito (compensa la ayuda).
    const petOn = !!this.pet && !!this.state.pets?.active && !this.state.pets.active.down;
    const share = (this.state.party?.active ? 0.85 : 1) * (petOn ? 0.9 : 1);
    const xp = Math.max(1, Math.round(xpForKill(enemy.def.xp, enemy.def.level, this.state.player.level) * share));
    if (petOn) this.givePetXp(Math.round(xpForKill(enemy.def.xp, enemy.def.level, this.state.pets.active!.level) * 0.6));
    this.msg(`${enemy.def.name} cae derrotado.`, 'good');
    const rec = (this.state.record ??= emptyRecord());
    rec.kills++;
    if (enemy.def.boss) {
      rec.bosses++;
      this.state.flags[`boss_${enemy.def.id}`] = true;
      const dz = this.zone.def.dungeon;
      if (dz) {
        progressOf(this.state.world, dz.id).cleared = true;
        this.msg(`¡Has vencido a ${enemy.def.name}! El pasadizo a la superficie se abre.`, 'good');
        this.msg('Si vuelves a entrar desde fuera, la mazmorra será distinta (rejugable).', 'info');
      }
    }
    this.gainXp(xp, enemy.def.name);
    const qm = Quests.onKill(this.state, enemy.def);
    if (qm.length) this.events.emit('questsChanged', {});
    const loot = rollLoot(this.rng, enemy.def.lootTable, enemy.def.level);
    this.cfx({
      type: 'kill', enemy, xp, gold: loot.gold, boss: !!enemy.def.boss, lead: this.actionLead,
      items: loot.items.map((it) => ({ name: itemDef(it).name, rarity: RARITY_RANK[it.rarity] ?? 0 })),
    });
    if (loot.items.length || loot.gold) this.dropLoot(enemy.x, enemy.y, loot.items, loot.gold);
  }

  /** Deja botín en una casilla (se junta con lo que ya hubiera). */
  dropLoot(x: number, y: number, items: ItemInstance[], gold: number): void {
    let g = this.ground.find((l) => l.x === x && l.y === y);
    if (!g) this.ground.push((g = { x, y, items: [], gold: 0, age: -this.actionLead }));
    g.items.push(...items);
    g.gold += gold;
  }

  /** Recoge el botín de la casilla del jugador. */
  private pickupHere(): void {
    const p = this.playerPos;
    const g = this.ground.find((l) => l.x === p.x && l.y === p.y);
    if (!g) return;
    const pl = this.state.player;
    if (g.gold > 0) {
      pl.gold += g.gold;
      this.floatText(p.x, p.y - 0.3, `+${g.gold} oro`, '#f2d888', 5, 1.3);
      this.msg(`Recoges ${g.gold} de oro.`, 'good');
      this.sfx('moneda');
      g.gold = 0;
    }
    const left: ItemInstance[] = [];
    for (const it of g.items) {
      const qty = it.qty;
      const rest = addItem(pl, it);
      const def = itemDef(it);
      if (rest < qty) {
        const r = rarityOf(it);
        this.msg(`Recoges: ${def.name}${qty - rest > 1 ? ` ×${qty - rest}` : ''}${r.id !== 'comun' ? ` (${r.name})` : ''}.`, r.id === 'comun' ? 'info' : 'good');
      }
      if (rest > 0) left.push({ ...it, qty: rest });
      if (rest < qty) void Quests.collectNotes(this.state, it.id);
    }
    g.items = left;
    if (left.length) this.msg('¡La mochila está llena! Parte del botín se queda en el suelo.', 'warn');
    if (!g.items.length && !g.gold) this.ground = this.ground.filter((x) => x !== g);
  }

  // ================================================================ objetos
  /** Usa un consumible. En combate gasta el turno. Devuelve un error o null. */
  useItem(uid: string): string | null {
    if (this.isDead) return 'Ahora no.';
    if (!this.canAct) return 'Espera a tu turno.';
    const p = this.state.player;
    const it = p.inventory.find((x) => x.uid === uid);
    if (!it) return 'No tienes ese objeto.';
    const def = itemDef(it);
    const use = def.use;
    if (!use) return 'Eso no se puede usar.';
    if (use.bind) return this.bindPet();
    const combat = this.inCombat;
    if (use.outOfCombatOnly && combat) return 'No puedes comer en pleno combate.';
    if (combat) {
      const blocked = this.actionBlocked();
      if (blocked) return blocked;
    }
    const pos = this.playerPos;
    if (use.heal) {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + roll(this.rng, use.heal).total);
      this.floatText(pos.x, pos.y, `+${p.hp - before}`, '#60e070');
      this.msg(`${def.name}: recuperas ${p.hp - before} PV.`, 'good');
    }
    if (use.restore) {
      const before = p.mp;
      p.mp = Math.min(p.maxMp, p.mp + roll(this.rng, use.restore).total);
      this.floatText(pos.x, pos.y - 0.3, `+${p.mp - before}`, '#6a9af0');
      this.msg(`${def.name}: recuperas ${p.mp - before} de ${this.cls.resource.name.toLowerCase()}.`, 'good');
    }
    if (use.cleanse) {
      this.combat.statuses = [];
      this.msg('Te sientes limpio de males.', 'good');
    }
    if (use.buff) {
      this.combat.buffs.push({ ...use.buff, turns: use.buff.turns + 1 });
      this.msg(`${def.name}: +${use.buff.amount} ${use.buff.stat}.`, 'good');
    }
    this.pushFx({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.8, color: '#60e070', t: 0, life: 0.4 });
    removeQty(p, uid, 1);
    if (combat) this.afterAction();
    return null;
  }

  /** Poción de curación rápida (botón 🧪): la más pequeña que tengas. */
  quickPotion(): string | null {
    const p = this.state.player;
    const potions = p.inventory.filter((x) => itemDef(x).use?.heal && !itemDef(x).use?.outOfCombatOnly);
    if (!potions.length) return 'No te quedan pociones de curación.';
    potions.sort((a, b) => itemDef(a).value - itemDef(b).value);
    return this.useItem(potions[0]!.uid);
  }

  equipItem(uid: string, slot?: EquipSlot): string | null {
    if (this.inCombat) return 'No puedes cambiarte de equipo en pleno combate.';
    const err = equip(this.state.player, uid, slot);
    if (!err) recalcPlayer(this.state.player);
    return err;
  }

  unequipSlot(slot: EquipSlot): string | null {
    if (this.inCombat) return 'No puedes cambiarte de equipo en pleno combate.';
    const err = unequip(this.state.player, slot);
    if (!err) recalcPlayer(this.state.player);
    return err;
  }

  /** Suelta una pila de la mochila en el suelo. */
  dropItem(uid: string): void {
    const p = this.state.player;
    const i = p.inventory.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const [it] = p.inventory.splice(i, 1);
    this.dropLoot(this.playerPos.x, this.playerPos.y, [it!], 0);
    this.msg(`Dejas ${itemDef(it!).name} en el suelo.`);
  }

  private checkBossPhase(e: Enemy): void {
    const phases = e.def.phases ?? [];
    while (e.phase < phases.length && e.hp / e.maxHp < phases[e.phase]!.hpBelow) {
      const ph = phases[e.phase]!;
      e.phase++;
      this.msg(`${e.def.name}: «${ph.message}»`, 'warn');
      this.floatText(e.x, e.y - 0.6, '‼', '#ff6040');
      e.toHitBonus += ph.toHitBonus ?? 0;
      e.damageBonus += ph.damageBonus ?? 0;
      if (ph.heal) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * ph.heal));
      if (ph.summon) this.summon(e, ph.summon.enemy, ph.summon.count);
    }
  }

  private summon(by: Enemy, id: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const spot = this.freeSpotNear(by, 2);
      if (!spot) continue;
      const m = this.spawnEnemy(id, spot.x, spot.y);
      if (m) {
        m.alerted = true;
        this.pushFx({ kind: 'burst', x: m.x, y: m.y, radius: 0.7, color: '#a040ff', t: 0, life: 0.5 });
      }
    }
  }

  // ================================================================ habilidades
  /** Usa una habilidad sobre una casilla objetivo. */
  useSkill(skill: SkillDef, target: Point): void {
    if (!this.canAct) return;
    const why = this.skillBlockedReason(skill);
    if (why) {
      this.msg(why, 'warn');
      this.targeting = null;
      return;
    }
    const p = this.state.player;
    const pos = this.playerPos;
    const center = skill.target === 'self' ? pos : target;
    if (skill.target !== 'self') {
      if (!this.inSkillRange(skill, center)) {
        this.msg('Fuera de alcance o sin línea de visión.', 'warn');
        return;
      }
      if (skill.target === 'enemy' && !this.enemyAt(center.x, center.y)) {
        this.msg('Toca a un enemigo.', 'warn');
        return;
      }
    }
    this.targeting = null;
    this.cancelPath();
    p.mp -= this.skillCost(skill);
    if (skill.cooldown > 0) this.combat.cooldowns[skill.id] = skill.cooldown + 1;
    this.beginAction(true);
    this.skillContext = skill.name;
    this.actionName = skill.name;
    this.msg(`${skill.icon} ${skill.name}`, 'combat');
    this.asPlayer(() => {
      for (const eff of skill.effects) this.applySkillEffect(skill, eff, center);
    });
    this.skillContext = null;
    this.afterAction();
  }

  private applySkillEffect(skill: SkillDef, eff: SkillEffect, center: Point): void {
    const p = this.state.player;
    const pos = this.playerPos;
    const mods = skillMods(p, skill.id);
    const modDice = mods.map((m) => m.extraDice).filter((x): x is string => !!x);
    const modStatus = mods.map((m) => m.applyStatus).filter((x): x is StatusApply => !!x);
    switch (eff.type) {
      case 'attack': {
        const targets = eff.allAdjacent
          ? this.enemies.filter((e) => dist(e.x, e.y, pos.x, pos.y) === 1)
          : [this.enemyAt(center.x, center.y)].filter((e): e is Enemy => !!e);
        if (targets.length === 0) this.msg('No hay enemigos al alcance.', 'warn');
        for (const t of targets) {
          for (let i = 0; i < (eff.hits ?? 1) && t.hp > 0; i++) {
            this.playerAttack(t, {
              ...(eff.extraDice ? { extraDice: eff.extraDice } : {}),
              ...(eff.toHitBonus ? { toHitBonus: eff.toHitBonus } : {}),
              ...(eff.critRange ? { critRange: eff.critRange } : {}),
              ...(eff.applyStatus ? { applyStatus: eff.applyStatus } : {}),
              moreDice: modDice,
              moreStatus: modStatus,
            });
          }
        }
        break;
      }
      case 'spell': {
        const damageType = mods.find((m) => m.damageType)?.damageType ?? eff.damageType;
        const color = SPELL_COLORS[damageType] ?? '#ffffff';
        const radius = (eff.radius ?? 0) > 0 ? (eff.radius ?? 0) + mods.reduce((a, m) => a + (m.radiusDelta ?? 0), 0) : 0;
        const hits = Math.max(1, (eff.hits ?? 1) + mods.reduce((a, m) => a + (m.hitsDelta ?? 0), 0));
        const power = this.talentList('spellPower').filter((t) => t.damageType === damageType).reduce((a, t) => a + t.amount, 0);
        const targets = radius > 0
          ? this.enemies.filter((e) => dist(e.x, e.y, center.x, center.y) <= radius && this.los(center, e))
          : [this.enemyAt(center.x, center.y)].filter((e): e is Enemy => !!e);
        // Rebote: el hechizo salta a otros enemigos cercanos al primero.
        const bounce = mods.reduce((a, m) => a + (m.bounce ?? 0), 0);
        if (radius === 0 && bounce > 0 && targets[0]) {
          const first = targets[0];
          const near = this.enemies
            .filter((e) => e !== first && dist(e.x, e.y, first.x, first.y) <= 3 && this.los(first, e))
            .sort((a, b) => dist(a.x, a.y, first.x, first.y) - dist(b.x, b.y, first.x, first.y))
            .slice(0, bounce);
          for (const n of near) {
            this.pushFx({ kind: 'bolt', fx: first.x, fy: first.y, tx: n.x, ty: n.y, color, t: 0, life: 0.35 });
            targets.push(n);
          }
          if (near.length) this.msg('¡El hechizo rebota!', 'good');
        }
        if (skill.target !== 'self') this.pushFx({ kind: 'bolt', fx: pos.x, fy: pos.y, tx: center.x, ty: center.y, color, t: 0, life: 0.3 });
        if (radius > 0) this.pushFx({ kind: 'burst', x: center.x, y: center.y, radius: radius + 0.5, color, t: 0, life: 0.5 });
        const mod = abilityModifier(this.derived.stats[eff.stat]);
        const dc = this.spellDC(eff.stat);
        this.killContext = 'spell';
        for (const t of targets) {
          for (let i = 0; i < hits && t.hp > 0; i++) {
            let dmg = roll(this.rng, eff.dice).total + (hits > 1 ? 0 : Math.max(0, mod)) + power;
            for (const extra of modDice) dmg += roll(this.rng, extra).total;
            let saved = false;
            if (eff.save) {
              const bonus = enemySave(t, eff.save);
              const s = savingThrow(this.rng, bonus, dc);
              saved = s.success;
              if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
              this.msg(`${t.def.name} tira salvación de ${eff.save}: ${s.total} vs CD ${dc} — ${saved ? 'la supera (mitad)' : 'falla'}.`, 'combat');
            }
            this.damageEnemy(t, dmg, damageType);
            if (t.hp > 0 && eff.applyStatus && !saved) this.applyStatusToEnemy(t, eff.applyStatus);
            if (t.hp > 0 && !saved) for (const st of modStatus) this.applyStatusToEnemy(t, st);
          }
        }
        this.killContext = 'other';
        // Suelo ardiendo (talento) en los hechizos de área
        const burn = mods.reduce((a, m) => Math.max(a, m.burnGround ?? 0), 0);
        if (burn > 0 && radius > 0) {
          this.burnGround(center, Math.max(1, radius - 1), burn);
          this.msg('¡El suelo queda en llamas!', 'good');
        }
        if (targets.length === 0) this.msg('El hechizo no alcanza a nadie.', 'warn');
        break;
      }
      case 'heal': {
        let amount = Math.max(1, roll(this.rng, eff.dice).total + (eff.stat ? abilityModifier(this.derived.stats[eff.stat]) : 0) + (eff.perLevel ?? 0) * p.level);
        for (const extra of modDice) amount += roll(this.rng, extra).total;
        // Talento: la curación quema a los no-muertos cercanos
        for (const t of this.talentList('healSmite')) {
          const undead = this.enemies.filter((e) => e.def.family === 'no-muerto' && dist(e.x, e.y, pos.x, pos.y) <= t.radius);
          if (undead.length) this.pushFx({ kind: 'burst', x: pos.x, y: pos.y, radius: t.radius + 0.5, color: '#fff0a0', t: 0, life: 0.5 });
          this.killContext = 'spell';
          for (const u of undead) this.damageEnemy(u, roll(this.rng, t.dice).total, 'sagrado');
          this.killContext = 'other';
        }
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        this.floatText(pos.x, pos.y, `+${p.hp - before}`, '#60e070');
        this.pushFx({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.9, color: '#60e070', t: 0, life: 0.5 });
        this.msg(`Recuperas ${p.hp - before} PV.`, 'good');
        break;
      }
      case 'buff':
        this.combat.buffs.push({ stat: eff.stat, amount: eff.amount, turns: eff.turns + 1 });
        this.floatText(pos.x, pos.y, `+${eff.amount} ${eff.stat}`, '#f2d888');
        break;
      case 'stealth':
        this.combat.stealth = eff.turns + 1;
        for (const e of this.enemies) if (dist(e.x, e.y, pos.x, pos.y) > 1) e.alerted = false;
        this.msg('Te fundes con las sombras.', 'good');
        break;
      case 'cleanse':
        this.combat.statuses = [];
        this.msg('Te sientes purificado.', 'good');
        break;
    }
  }

  // ======================================================================= huir
  /** Huir: DES + competencia contra CD 10 + nivel del enemigo más fuerte en combate. */
  flee(): void {
    if (!this.canAct || !this.inCombat) return;
    const p = this.state.player;
    const pos = this.playerPos;
    const foes = this.enemies.filter((e) => e.alerted && dist(e.x, e.y, pos.x, pos.y) <= e.def.sight + 2);
    if (foes.some((e) => e.def.boss)) {
      this.msg('¡No puedes huir de este enemigo!', 'warn');
      return;
    }
    const dc = 10 + Math.max(...foes.map((e) => e.def.level));
    const bonus = abilityModifier(this.derived.stats.DES) + proficiencyBonus(p.level);
    const s = savingThrow(this.rng, bonus, dc);
    this.events.emit('dice', {
      label: 'Huir', natural: s.natural, bonus, total: s.total, target: dc, targetLabel: 'CD', outcome: s.success ? 'success' : 'fail',
    });
    this.cancelPath();
    if (s.success) {
      this.enemies = this.enemies.filter((e) => !foes.includes(e));
      this.fled = true;
      this.msg('¡Logras escapar! Tus enemigos te pierden el rastro.', 'good');
      this.state.turn++;
      return;
    }
    this.msg('No consigues escapar...', 'warn');
    this.afterAction();
  }

  // ================================================================ enemigos
  /** Turno de un enemigo. Devuelve true si hizo algo visible. */
  private enemyTurn(e: Enemy): boolean {
    const p = this.playerPos;
    // Suelo ardiendo bajo sus pies
    const hz = this.hazardAt(e.x, e.y);
    if (hz) {
      const burn = roll(this.rng, hz.dice).total;
      this.floatText(e.x, e.y, `🔥${burn}`, '#ff8030');
      this.killContext = 'other';
      this.damageEnemy(e, burn, hz.damageType);
      if (e.hp <= 0 || !this.enemies.includes(e)) return true;
    }
    // Estados: daño por turno, aturdido, lento
    const tick = tickStatuses(this.rng, e.statuses);
    if (tick.damage > 0) {
      for (const part of tick.parts) this.floatText(e.x, e.y, `${part.amount}`, STATUS_INFO[part.id].color);
      e.hp -= tick.damage;
      e.flashT = 1;
      if (e.hp <= 0) {
        this.msg(`${e.def.name} sucumbe a sus heridas.`, 'good');
        this.killEnemy(e);
        return true;
      }
    }
    if (consumeStun(e.statuses)) {
      this.floatText(e.x, e.y - 0.4, '💫', '#f0e060');
      return true;
    }
    for (const k of Object.keys(e.cooldowns)) e.cooldowns[k] = Math.max(0, (e.cooldowns[k] ?? 0) - 1);

    const d = dist(e.x, e.y, p.x, p.y);
    // ¿Detecta al jugador?
    if (!e.alerted) {
      const hidden = this.combat.stealth > 0 && d > 1;
      if (!hidden && d <= e.def.sight && this.los(e, p)) {
        e.alerted = true;
        this.interrupt = true;
        this.floatText(e.x, e.y - 0.5, '!', '#ff5040');
        if (this.enemies.filter((x) => x.alerted).length === 1) this.msg(`¡${e.def.name} te ha visto!`, 'warn');
        return true;
      }
      // Deambula
      if (this.rng.chance(0.3)) this.stepEnemy(e, { x: e.x + this.rng.int(-1, 1), y: e.y + this.rng.int(-1, 1) }, true);
      return false;
    }
    if (this.combat.stealth > 0 && d > 1) {
      e.alerted = false;
      return false;
    }
    // Pierde el rastro si se aleja mucho
    if (d > e.def.sight * 2) {
      e.alerted = false;
      return false;
    }

    const atk = e.def.attack;
    // ¿A quién ataca? Al jugador o al compañero, el que tenga más cerca.
    const tgt = this.enemyTarget(e);
    const td = dist(e.x, e.y, tgt.x, tgt.y);
    const inAtkRange = td <= atk.range && (atk.range === 1 || this.los(e, tgt));
    const ai = e.def.ai;

    // Hechizos (casters y jefes) desde donde están
    const trySpells = (): boolean => {
      if (ai !== 'caster' && ai !== 'boss') return false;
      for (const sp of e.def.spells ?? []) {
        if ((e.cooldowns[sp.id] ?? 0) > 0) continue;
        if (this.tryEnemySpell(e, sp, dist(e.x, e.y, p.x, p.y))) {
          e.cooldowns[sp.id] = sp.cooldown + 1;
          return true;
        }
      }
      return false;
    };
    const attackTarget = () => {
      if (tgt.pet) this.enemyAttackPet(e);
      else if (tgt.ally) this.enemyAttackAlly(e);
      else this.enemyAttack(e);
    };
    const canHit = () => {
      const dd = dist(e.x, e.y, tgt.x, tgt.y);
      return dd <= atk.range && (atk.range === 1 || this.los(e, tgt));
    };
    if (trySpells()) return true;

    // MOVIMIENTO del turno (casillas) y luego UNA acción.
    let budget = this.enemyMovement(e);
    let moved = false;
    // Arqueros pegados a ti: a veces retroceden un par de casillas antes de disparar.
    if (ai === 'ranged' && td === 1 && this.rng.chance(0.4)) {
      for (let i = 0; i < Math.min(2, budget) && this.stepAway(e); i++) {
        budget--;
        moved = true;
      }
    }
    if (inAtkRange && !moved) {
      attackTarget();
      return true;
    }
    // Casters: si el hechizo se recarga, mantienen la distancia.
    if (ai === 'caster' && d <= 4 && d > 1 && !moved) return false;
    while (budget > 0 && !canHit()) {
      if (!this.approach(e, tgt)) break;
      budget--;
      moved = true;
    }
    // Tras moverse: hechizo si ya alcanza, o ataque si llega.
    if (moved && trySpells()) return true;
    if (canHit()) {
      attackTarget();
      return true;
    }
    return moved;
  }

  /** Casillas por turno de un enemigo (lentos y ralentizados: la mitad). */
  enemyMovement(e: Enemy): number {
    let m = e.def.movement ?? (e.def.speed >= 2 ? 7 : 4);
    if (e.def.slow && e.def.movement === undefined) m = Math.floor(m / 2);
    if (hasStatus(e.statuses, 'ralentizado')) m = Math.floor(m / 2);
    return Math.max(1, m);
  }

  private tryEnemySpell(e: Enemy, sp: EnemySpell, d: number): boolean {
    const p = this.playerPos;
    if (sp.kind === 'heal') {
      const ally = this.enemies.find((a) => a.hp < a.maxHp * 0.5 && dist(a.x, a.y, e.x, e.y) <= sp.range);
      if (!ally) return false;
      const amount = roll(this.rng, sp.dice ?? '1d8').total;
      ally.hp = Math.min(ally.maxHp, ally.hp + amount);
      this.pushFx({ kind: 'bolt', fx: e.x, fy: e.y, tx: ally.x, ty: ally.y, color: '#60e070', t: 0, life: 0.3 });
      this.floatText(ally.x, ally.y, `+${amount}`, '#60e070');
      this.msg(`${e.def.name} usa ${sp.name} y cura ${amount} a ${ally === e ? 'sí mismo' : ally.def.name}.`, 'combat');
      return true;
    }
    if (sp.kind === 'summon' && sp.summon) {
      if (this.enemies.length > 12) return false;
      this.msg(`${e.def.name} usa ${sp.name}.`, 'warn');
      this.summon(e, sp.summon.enemy, sp.summon.count);
      return true;
    }
    if (d > sp.range || !this.los(e, p)) return false;
    // Daño
    this.actionName = sp.name;
    const color = SPELL_COLORS[sp.damageType ?? 'arcano'] ?? '#ffffff';
    this.pushFx({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color, t: 0, life: 0.3 });
    if (sp.radius) this.pushFx({ kind: 'burst', x: p.x, y: p.y, radius: sp.radius + 0.5, color, t: 0, life: 0.5 });
    let dmg = roll(this.rng, sp.dice ?? '1d6').total + e.damageBonus;
    let saved = false;
    if (sp.save && sp.dc) {
      const bonus = abilityModifier(this.derived.stats[sp.save]);
      const s = savingThrow(this.rng, bonus, sp.dc);
      saved = s.success;
      this.sawAttack = true;
      this.events.emit('dice', {
        label: `Salvación de ${sp.save}`, natural: s.natural, bonus, total: s.total, target: sp.dc, targetLabel: 'CD', outcome: saved ? 'success' : 'fail',
        attacker: { kind: 'enemy', uid: e.uid }, defender: { kind: 'player' }, action: sp.name, lead: this.actionLead,
      });
      if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
    }
    this.msg(`${e.def.name} lanza ${sp.name}${saved ? ' (mitad de daño)' : ''}.`, 'combat', 'dmg-in');
    this.damagePlayer(dmg, sp.name, false, sp.damageType ?? 'arcano');
    if (this.phase !== 'dead' && sp.applyStatus && !saved) this.applyStatusToPlayer(sp.applyStatus);
    return true;
  }

  private enemyAttack(e: Enemy): void {
    const p = this.playerPos;
    const atk = e.def.attack;
    this.actionName = atk.name;
    e.facing = p.x >= e.x ? 'right' : 'left';
    if (atk.range === 1) {
      this.strike(e, Math.sign(p.x - e.x), Math.sign(p.y - e.y));
    } else {
      this.pushFx({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color: '#d8d0bc', t: 0, life: 0.25 });
    }
    const mode: RollMode = hasStatus(e.statuses, 'veneno') ? 'desventaja' : 'normal';
    const ac = this.playerAC();
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, ac, mode);
    this.sawAttack = true;
    this.events.emit('dice', {
      label: `${e.def.name}: ${atk.name}`, natural: r.natural, bonus: atk.toHit + e.toHitBonus, total: r.total, target: ac, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss', small: true,
      attacker: { kind: 'enemy', uid: e.uid }, defender: { kind: 'player' }, action: atk.name, lead: this.actionLead,
    });
    if (!r.hit) {
      this.floatText(p.x, p.y, r.fumble ? 'Pifia' : 'Esquivas', '#a49c8a');
      this.msg(`${e.def.name} falla su ${atk.name.toLowerCase()} (${r.total} vs tu CA ${ac}).`, 'combat', 'miss');
      // Talento: contraataque cuando te fallan cuerpo a cuerpo
      const counter = this.talentList('counter').reduce((a, t) => Math.max(a, t.chance), 0);
      if (atk.range === 1 && counter > 0 && dist(e.x, e.y, p.x, p.y) === 1 && this.rng.chance(counter)) {
        this.msg('¡Contraataque!', 'good');
        this.playerAttack(e, {});
      }
      return;
    }
    // Talento: esquiva
    const dodge = this.talentList('dodge').reduce((a, t) => a + t.chance, 0);
    if (dodge > 0 && this.rng.chance(Math.min(0.5, dodge))) {
      this.floatText(p.x, p.y, '¡Esquiva!', '#80e0ff');
      this.msg(`Esquivas en el último instante el ataque de ${e.def.name}.`, 'good');
      return;
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    this.msg(`${r.crit ? '¡Crítico! ' : ''}${e.def.name} te alcanza con ${atk.name.toLowerCase()}: ${dmg} de daño.`, 'combat', 'dmg-in');
    this.damagePlayer(dmg, e.def.name, r.crit, atk.damageType);
    if (this.phase !== 'dead' && atk.applyStatus) this.applyStatusToPlayer(atk.applyStatus);
    // Talento: espinas (daño a quien te golpea cuerpo a cuerpo)
    if (this.phase !== 'dead' && atk.range === 1) {
      for (const t of this.talentList('thorns')) {
        if (e.hp <= 0) break;
        this.killContext = 'other';
        this.asPlayer(() => this.damageEnemy(e, roll(this.rng, t.dice).total, t.damageType));
      }
    }
  }

  private applyStatusToPlayer(s: StatusApply): void {
    if (tryApplyStatus(this.rng, this.combat.statuses, s, this.immunities())) {
      const info = STATUS_INFO[s.id];
      this.floatText(this.playerPos.x, this.playerPos.y - 0.4, info.icon, info.color);
      this.msg(`¡${info.name}!`, 'warn');
    }
  }

  damagePlayer(amount: number, cause: string, crit = false, type: DamageType | null = null): void {
    const p = this.state.player;
    // El HUD no baja la vida hasta que la tarjeta de duelo revela el golpe.
    if (this.actionLead > 0 && this.shownPlayerHp === undefined) {
      this.shownPlayerHp = p.hp;
      this.later(this.actionLead, () => {
        this.shownPlayerHp = undefined;
      });
    }
    p.hp = Math.max(0, p.hp - amount);
    this.flash(this.view);
    this.interrupt = true;
    this.floatText(this.playerPos.x, this.playerPos.y, `-${amount}`, crit ? '#ff4040' : '#ff8080');
    this.cfx({
      type: 'hit', target: { kind: 'player' }, pos: this.playerPos, amount, dmgType: type, crit, note: '', killed: p.hp <= 0,
      attacker: this.currentActor?.kind === 'enemy' ? this.currentActor : null, action: this.actionName || cause, lead: this.actionLead,
    });
    this.events.emit('playerHurt', { amount });
    this.sfx('herido');
    if (p.hp <= 0) {
      this.phase = 'dead';
      this.enemyQueue = [];
      this.cancelPath();
      this.heldDir = null;
      this.msg('Has caído...', 'warn');
      (this.state.record ??= emptyRecord()).deaths++;
      this.sfx('muerte');
      this.events.emit('playerDied', { cause });
    }
  }

  /** Paso de un enemigo hacia el jugador con A* (los demás enemigos estorban). */
  /** Paso de un enemigo hacia su objetivo con A* (los demás enemigos estorban). */
  private approach(e: Enemy, target: Point = this.playerPos): boolean {
    const p = this.playerPos;
    const path = findPath(
      this.zone.width, this.zone.height, e, target,
      (x, y) => this.zone.isWalkable(x, y) && !this.enemies.some((o) => o !== e && o.x === x && o.y === y) && !this.npcAt(x, y) && !this.allyAt(x, y) && !this.petAt(x, y),
      { allowGoalBlocked: true, maxNodes: 600 },
    );
    const next = path?.[0];
    if (!next || (next.x === p.x && next.y === p.y) || this.allyAt(next.x, next.y) || this.petAt(next.x, next.y)) return false;
    return this.stepEnemy(e, next, false);
  }

  /** El objetivo de un enemigo: el jugador o el compañero (el más cercano). */
  private enemyTarget(e: Enemy): Point & { ally: boolean; pet?: boolean } {
    const p = this.playerPos;
    const a = this.ally && !this.state.party.down ? this.ally : null;
    const pu = this.pet && this.state.pets.active && !this.state.pets.active.down ? this.pet : null;
    const dp = dist(e.x, e.y, p.x, p.y);
    const hidden = this.combat.stealth > 0 && dp > 1;
    let best: Point & { ally: boolean; pet?: boolean } = { ...p, ally: false };
    let bestD = hidden ? Infinity : dp;
    if (a) {
      const da = dist(e.x, e.y, a.x, a.y);
      if (da < bestD || (da === bestD && this.rng.chance(0.35))) {
        best = { x: a.x, y: a.y, ally: true };
        bestD = da;
      }
    }
    if (pu) {
      const dm = dist(e.x, e.y, pu.x, pu.y);
      if (dm < bestD || (dm === bestD && this.rng.chance(0.35))) {
        best = { x: pu.x, y: pu.y, ally: false, pet: true };
        bestD = dm;
      }
    }
    return best;
  }

  private stepAway(e: Enemy): boolean {
    const p = this.playerPos;
    let best: Point | null = null;
    let bestD = dist(e.x, e.y, p.x, p.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = e.x + dx;
        const y = e.y + dy;
        if (!this.freeForEnemy(x, y)) continue;
        const nd = dist(x, y, p.x, p.y);
        if (nd > bestD) {
          bestD = nd;
          best = { x, y };
        }
      }
    }
    return best ? this.stepEnemy(e, best, false) : false;
  }

  private stepEnemy(e: Enemy, to: Point, wander: boolean): boolean {
    if (!this.freeForEnemy(to.x, to.y)) return false;
    if (wander && this.zone.exitAt(to.x, to.y)) return false;
    if (to.x !== e.x) e.facing = to.x > e.x ? 'right' : 'left';
    e.x = to.x;
    e.y = to.y;
    pushStep(e, to);
    return true;
  }

  private faceTowards(t: Point): void {
    const p = this.playerPos;
    if (t.x !== p.x) this.view.facing = t.x > p.x ? 'right' : 'left';
  }

  // =========================================================== experiencia
  /** Suma XP y sube de nivel las veces que haga falta. */
  gainXp(amount: number, reason: string): void {
    const p = this.state.player;
    p.xp += amount;
    this.floatText(this.playerPos.x, this.playerPos.y - 0.6, `+${amount} XP`, '#e8c84a', 5, 1.5);
    this.msg(`+${amount} XP (${reason}).`, 'good');
    const target = levelForXp(p.xp);
    while (p.level < target) {
      const hpBefore = p.maxHp;
      const mpBefore = p.maxMp;
      p.level++;
      const points = attributePointsAtLevel(p.level);
      p.attributePoints += points;
      p.talentChoices = (p.talentChoices ?? 0) + 1;
      recalcPlayer(p);
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      const skills = unlockedSkills(this.cls, p.level).filter((s) => s.unlockLevel === p.level);
      this.pushFx({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 1.5, color: '#f2d888', t: 0, life: 0.8 });
      this.sfx('nivel');
      if (this.state.party?.active) this.state.party.hp = this.allyStats().maxHp;
      this.companionSay('nivel', 0.5);
      this.events.emit('levelUp', { level: p.level, hpGain: p.maxHp - hpBefore, mpGain: p.maxMp - mpBefore, points, skills, talentChoices: p.talentChoices });
    }
  }

  // ================================================================= muerte
  /** Despertar en la aldea tras caer: se pierde el 10 % del oro. */
  respawn(): void {
    const p = this.state.player;
    const lost = Math.floor(p.gold * 0.1);
    p.gold -= lost;
    this.combat.statuses = [];
    this.combat.buffs = [];
    this.combat.stealth = 0;
    const where = p.respawnZone && getZoneDef(p.respawnZone) ? p.respawnZone : getZoneDef('aldea_capilla') ? 'aldea_capilla' : 'aldea_brumaroja';
    this.enterZone(where, null);
    if (this.state.party?.active) {
      this.state.party.down = false;
      this.state.party.hp = Math.ceil(this.allyStats().maxHp / 2);
    }
    p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
    p.mp = Math.ceil(p.maxMp / 2);
    this.msg(`Despiertas en ${this.zone.def.name}, magullado. Has perdido ${lost} de oro.`, 'warn');
  }

  // ============================================= cofres, trampas y minería
  /** ¿Se usó ya este elemento? (las vetas fuera de mazmorras vuelven a crecer). */
  featureUsed(f: ZoneFeature): boolean {
    const t = this.state.world.features[featureKey(this.zone.def, f.x, f.y)];
    if (t === undefined) return false;
    if (f.kind === 'mineral' && !this.zone.def.dungeon) return this.state.turn - t < ORE_REGROW_TURNS;
    return true;
  }

  private markUsed(f: ZoneFeature): void {
    this.state.world.features[featureKey(this.zone.def, f.x, f.y)] = this.state.turn;
  }

  /** Trampa activa que ya conoces (no la pisas al caminar). */
  isKnownTrap(x: number, y: number): boolean {
    const f = this.zone.featureAt(x, y);
    return !!f && f.kind === 'trampa' && this.detectedTraps.has(featureKey(this.zone.def, x, y)) && !this.featureUsed(f);
  }

  /** Elemento con el que se puede interactuar en esa casilla. */
  interactiveFeatureAt(x: number, y: number): ZoneFeature | undefined {
    const f = this.zone.featureAt(x, y);
    if (!f || this.featureUsed(f)) return undefined;
    if (f.kind === 'trampa' && !this.detectedTraps.has(featureKey(this.zone.def, x, y))) return undefined;
    return f;
  }

  /** Qué dibujar para cada elemento visible (lo usa el renderizador). */
  featureSprites(): Array<{ x: number; y: number; sprite: string; dim: boolean }> {
    const out: Array<{ x: number; y: number; sprite: string; dim: boolean }> = [];
    for (const f of this.zone.def.features ?? []) {
      const used = this.featureUsed(f);
      if (f.kind === 'cofre') out.push({ x: f.x, y: f.y, sprite: used ? 'chestOpen' : f.locked ? 'chestLocked' : 'chest', dim: false });
      else if (f.kind === 'mineral') {
        if (!used) out.push({ x: f.x, y: f.y, sprite: ORES.get(f.ore)?.sprite ?? 'oreIron', dim: false });
      } else if (used || this.detectedTraps.has(featureKey(this.zone.def, f.x, f.y))) {
        out.push({ x: f.x, y: f.y, sprite: TRAPS.get(f.trap)?.sprite ?? 'trapSpikes', dim: used });
      }
    }
    return out;
  }

  /** Bonificador y modo de una prueba de habilidad (el Pícaro es experto: competencia y ventaja). */
  private skillCheck(stat: 'SAB' | 'DES' | 'FUE', expert: boolean): { bonus: number; mode: 'normal' | 'ventaja' } {
    const picaro = this.state.player.classId === 'picaro' && expert;
    return {
      bonus: abilityModifier(this.derived.stats[stat]) + (picaro ? proficiencyBonus(this.state.player.level) : 0),
      mode: picaro ? 'ventaja' : 'normal',
    };
  }

  private rollCheck(label: string, stat: 'SAB' | 'DES' | 'FUE', dc: number, expert: boolean, show = true): { success: boolean; total: number } {
    const c = this.skillCheck(stat, expert);
    const d = rollD20(this.rng, c.mode);
    const total = d.natural + c.bonus;
    const success = d.natural === 20 || (d.natural !== 1 && total >= dc);
    if (show) {
      this.events.emit('dice', {
        label, natural: d.natural, bonus: c.bonus, total, target: dc, targetLabel: 'CD', outcome: success ? 'success' : 'fail',
      });
    }
    return { success, total };
  }

  private trapDC(f: Extract<ZoneFeature, { kind: 'trampa' }>): number {
    return (TRAPS.get(f.trap)?.dc ?? 12) + Math.floor((f.level ?? this.zone.def.level) / 2);
  }

  /** Percepción pasiva: al acercarte a una trampa oculta tiras SAB una vez. */
  private scanTraps(): void {
    const p = this.playerPos;
    for (const f of this.zone.def.features ?? []) {
      if (f.kind !== 'trampa' || this.featureUsed(f)) continue;
      const key = featureKey(this.zone.def, f.x, f.y);
      if (this.detectedTraps.has(key) || this.checkedTraps.has(key)) continue;
      if (dist(p.x, p.y, f.x, f.y) > 2 || !this.los(p, f)) continue;
      this.checkedTraps.add(key);
      const r = this.rollCheck('Percepción (SAB)', 'SAB', this.trapDC(f), true, false);
      if (r.success) {
        this.detectedTraps.add(key);
        this.cancelPath();
        this.floatText(f.x, f.y, '⚠', '#ff6040');
        this.msg(`¡Detectas una ${TRAPS.get(f.trap)?.name.toLowerCase() ?? 'trampa'}! Tócala para desactivarla o rodéala.`, 'warn');
      }
    }
  }

  /** Pisar una casilla: si hay una trampa oculta, salta. Devuelve true si saltó. */
  private stepOnTrap(x: number, y: number): boolean {
    const f = this.zone.featureAt(x, y);
    if (!f || f.kind !== 'trampa' || this.featureUsed(f)) return false;
    this.triggerTrap(f);
    return true;
  }

  private triggerTrap(f: Extract<ZoneFeature, { kind: 'trampa' }>): void {
    const t = TRAPS.get(f.trap);
    this.markUsed(f);
    this.detectedTraps.add(featureKey(this.zone.def, f.x, f.y));
    if (!t) return;
    const dc = this.trapDC(f);
    const bonus = abilityModifier(this.derived.stats[t.save]);
    const s = savingThrow(this.rng, bonus, dc);
    this.events.emit('dice', {
      label: `Salvación de ${t.save}`, natural: s.natural, bonus, total: s.total, target: dc, targetLabel: 'CD', outcome: s.success ? 'success' : 'fail',
    });
    let dmg = roll(this.rng, t.damage).total;
    if (s.success) dmg = Math.max(1, Math.floor(dmg / 2));
    this.pushFx({ kind: 'burst', x: f.x, y: f.y, radius: 0.9, color: t.damageType === 'fuego' ? '#ff8030' : '#d0d0d0', t: 0, life: 0.5 });
    this.msg(`¡${t.name}!${s.success ? ' Reaccionas a tiempo y recibes la mitad.' : ''}`, 'warn');
    this.damagePlayer(dmg, t.name);
    if (!this.isDead && !s.success && t.applyStatus) this.applyStatusToPlayer(t.applyStatus);
  }

  /** Usar un cofre, una veta o una trampa conocida (estando al lado). Gasta el turno. */
  interact(f: ZoneFeature): void {
    if (!this.canAct) return;
    const blocked = this.actionBlocked();
    if (blocked) {
      this.msg(blocked, 'warn');
      return;
    }
    const p = this.playerPos;
    if (f.x !== p.x) this.view.facing = f.x > p.x ? 'right' : 'left';
    if (f.kind === 'cofre') this.openChest(f);
    else if (f.kind === 'mineral') {
      if (!this.mine(f)) return;
    } else this.disarmTrap(f);
    if (!this.isDead) this.afterAction();
  }

  private openChest(f: Extract<ZoneFeature, { kind: 'cofre' }>): void {
    const level = f.level ?? this.zone.def.level;
    if (f.locked) {
      const dc = 10 + Math.floor(level / 2);
      // Ganzúa (DES, el Pícaro es experto) o forzar (FUE): se usa lo mejor que tengas.
      const des = this.skillCheck('DES', true);
      const fue = this.skillCheck('FUE', false);
      const useDes = des.bonus + (des.mode === 'ventaja' ? 3 : 0) >= fue.bonus;
      const r = this.rollCheck(useDes ? 'Abrir cerradura (DES)' : 'Forzar el cofre (FUE)', useDes ? 'DES' : 'FUE', dc, useDes);
      if (!r.success) {
        this.msg(useDes ? 'La cerradura se resiste. Puedes volver a intentarlo.' : 'El cofre no cede. Puedes volver a intentarlo.', 'warn');
        if (!useDes || this.rng.chance(0.25)) {
          this.msg('¡Un dardo oculto sale disparado del cofre!', 'warn');
          this.damagePlayer(roll(this.rng, '1d4').total, 'cofre con trampa');
        }
        return;
      }
      this.msg(useDes ? '¡Clic! Abres la cerradura.' : '¡Crac! Revientas la cerradura.', 'good');
    }
    this.markUsed(f);
    const loot = rollLoot(this.rng, f.loot ?? 'cofre', level);
    this.pushFx({ kind: 'burst', x: f.x, y: f.y, radius: 0.8, color: '#f2d888', t: 0, life: 0.5 });
    if (!loot.items.length && !loot.gold) {
      this.msg('El cofre está vacío. Alguien llegó antes.', 'info');
      return;
    }
    this.msg('Abres el cofre...', 'good');
    this.sfx('cofre');
    this.dropLoot(this.playerPos.x, this.playerPos.y, loot.items, loot.gold);
    this.pickupHere();
  }

  /** Un golpe de pico. Devuelve false si no se pudo (no gasta turno). */
  private mine(f: Extract<ZoneFeature, { kind: 'mineral' }>): boolean {
    const ore = ORES.get(f.ore);
    if (!ore) return false;
    const tool = this.state.player.equipment.herramienta;
    const tier = tool ? (itemDef(tool).pickaxeTier ?? 0) : 0;
    if (tier <= 0) {
      this.msg(`${ore.name}: necesitas un pico equipado en la ranura Herramienta (se venden en la herrería).`, 'warn');
      return false;
    }
    if (tier < ore.tier) {
      this.msg(`${ore.name}: tu pico no es lo bastante duro (hace falta uno de nivel ${ore.tier}).`, 'warn');
      return false;
    }
    const key = featureKey(this.zone.def, f.x, f.y);
    const hits = (this.mineHits.get(key) ?? 0) + 1;
    this.mineHits.set(key, hits);
    this.floatText(f.x, f.y, '⛏', '#d0d8e8');
    this.pushFx({ kind: 'burst', x: f.x, y: f.y, radius: 0.4, color: '#d0d8e8', t: 0, life: 0.25 });
    if (hits < ore.hits) {
      this.msg(`Picas la ${ore.name.toLowerCase()}... (${hits}/${ore.hits})`, 'info');
      return true;
    }
    this.markUsed(f);
    this.zone.setBlocked(f.x, f.y, false);
    const it = createItem(ore.item, 'comun', this.rng, { qty: this.rng.int(ore.qty[0], ore.qty[1]) });
    this.dropLoot(this.playerPos.x, this.playerPos.y, [it], 0);
    this.pickupHere();
    this.gainXp(ore.xp, 'minería');
    return true;
  }

  private disarmTrap(f: Extract<ZoneFeature, { kind: 'trampa' }>): void {
    const t = TRAPS.get(f.trap);
    const dc = this.trapDC(f);
    const r = this.rollCheck('Desactivar trampa (DES)', 'DES', dc, true);
    if (r.success) {
      this.markUsed(f);
      this.msg(`Desactivas la ${t?.name.toLowerCase() ?? 'trampa'}.`, 'good');
      this.gainXp(10 * (f.level ?? this.zone.def.level), 'trampa desactivada');
      return;
    }
    if (r.total <= dc - 5) {
      this.msg('¡Mal movimiento! La trampa salta.', 'warn');
      this.triggerTrap(f);
      return;
    }
    this.msg('No consigues desactivarla. Puedes volver a intentarlo.', 'warn');
  }

  // ======================================================== PNJ y servicios
  /** ¿Está el PNJ al alcance para hablar? (pegado, o a 2 casillas con un mostrador en medio). */
  canTalk(npc: NpcDef): boolean {
    const p = this.playerPos;
    const d = dist(p.x, p.y, npc.x, npc.y);
    return d <= 1 || (d === 2 && this.los(p, npc));
  }

  /** Habla con un PNJ: cuenta objetivos de "hablar" y avisa a la interfaz. */
  talkTo(npc: NpcDef): void {
    const p = this.playerPos;
    if (npc.x !== p.x) this.view.facing = npc.x > p.x ? 'right' : 'left';
    const qm = Quests.onTalk(this.state, npc.id);
    if (qm.length) this.events.emit('questsChanged', {});
    this.events.emit('npcTalk', { npc });
  }

  acceptQuest(id: string): string | null {
    const err = Quests.accept(this.state, id);
    if (!err) {
      // Los objetivos de "visitar" la zona donde ya estás cuentan al momento.
      void Quests.onVisit(this.state, this.zone.id);
      this.events.emit('questsChanged', {});
    }
    return err;
  }

  /** Entrega una misión y aplica sus recompensas. */
  turnInQuest(id: string, npcId: string): string | null {
    const res = Quests.turnIn(this.state, id, npcId);
    if ('error' in res) return res.error;
    const q = res.quest;
    const p = this.state.player;
    this.msg(`¡Misión completada: ${q.name}!`, 'good');
    if (q.rewards.gold) {
      p.gold += q.rewards.gold;
      this.msg(`+${q.rewards.gold} de oro.`, 'good');
    }
    for (const r of q.rewards.items ?? []) {
      const it = createItem(r.item, 'comun', this.rng, { qty: r.qty ?? 1, level: p.level });
      const left = addItem(p, it);
      if (left > 0) this.dropLoot(this.playerPos.x, this.playerPos.y, [{ ...it, qty: left }], 0);
      this.msg(`Recibes: ${itemDef(it).name}${(r.qty ?? 1) > 1 ? ` ×${r.qty}` : ''}${left > 0 ? ' (en el suelo: mochila llena)' : ''}.`, 'good');
    }
    if (q.rewards.pet) this.givePet(q.rewards.pet.species, q.rewards.pet.level, q.name);
    if (q.rewards.xp) this.gainXp(q.rewards.xp, q.name);
    this.events.emit('questsChanged', {});
    this.sfx('mision');
    if (q.rewards.flag === 'victoria') {
      const rec = (this.state.record ??= emptyRecord());
      if (!rec.victoryTurn) {
        rec.victoryTurn = this.state.turn;
        rec.victoryTime = Math.round(this.state.playTimeSec);
      }
      this.sfx('victoria');
      this.companionSay('victoria');
      this.events.emit('victory', {});
    }
    return null;
  }

  private goalCache: { key: string; goal: QuestGoal | null } = { key: '', goal: null };

  /**
   * Objetivo de la misión seguida: texto, zona donde se cumple y salida de la
   * zona actual que lleva hacia allí (para destacar su flecha).
   */
  get questGoal(): QuestGoal | null {
    const tq = Quests.trackedQuest(this.state);
    const key = `${this.zone.id}|${tq?.quest.id ?? ''}|${tq?.text ?? ''}|${this.state.trackedQuestId ?? ''}`;
    if (key !== this.goalCache.key) {
      let goal: QuestGoal | null = null;
      if (tq) {
        const zone = questGoalZone(this.state, tq.quest);
        const step = questStep(this.state, tq.quest);
        goal = {
          text: tq.text, ready: tq.ready, zone, zoneName: zone ? zoneName(zone) : '',
          exitTo: zone ? nextHop(this.zone, zone) : null, kind: step?.kind ?? 'ir', point: null,
        };
      }
      this.goalCache = { key, goal };
    }
    const goal = this.goalCache.goal;
    if (!goal || !tq) return goal;
    // El punto se recalcula siempre: los enemigos se mueven.
    return { ...goal, point: this.goalPoint(tq.quest, goal) };
  }

  /** Punto de la zona actual hacia el que guiar (objetivo o salida que acerca). */
  private goalPoint(q: QuestDef, goal: QuestGoal): { x: number; y: number } | null {
    const step = questStep(this.state, q);
    const p = this.playerPos;
    const nearest = <T extends { x: number; y: number }>(list: T[]): T | null =>
      list.reduce<T | null>((best, it) => (!best || dist(it.x, it.y, p.x, p.y) < dist(best.x, best.y, p.x, p.y) ? it : best), null);
    if (step) {
      if (step.kind === 'hablar') {
        const npc = this.npcs.find((n) => n.id === step.npc);
        if (npc) return { x: npc.x, y: npc.y };
      } else if (step.kind === 'cazar') {
        const wild = step.wild;
        const e = nearest(this.enemies.filter((x) => (wild ? !!x.def.pet && (wild === true || x.def.pet.species === wild) : enemyMatches(step, x.def.id))));
        if (e) return { x: e.x, y: e.y };
      } else if (step.kind === 'recoger') {
        const ore = [...ORES.values()].find((o) => o.item === step.item);
        if (ore) {
          const veins = (this.zone.def.features ?? []).filter((f) => f.kind === 'mineral' && f.ore === ore.id && !this.featureUsed(f));
          const v = nearest(veins);
          if (v) return { x: v.x, y: v.y };
        }
        const droppers = enemiesDropping(step.item);
        const e = nearest(this.enemies.filter((x) => droppers.includes(x.def.id)));
        if (e) return { x: e.x, y: e.y };
      }
    }
    if (goal.exitTo) {
      const ex = nearest(this.zone.exits.filter((e) => e.to === goal.exitTo));
      if (ex) return { x: ex.x, y: ex.y };
    }
    return null;
  }

  private sfx(id: SfxId, rate?: number): void {
    this.events.emit('sfx', { id, delay: this.actionLead, ...(rate ? { rate } : {}) });
  }

  /** Stock actual de una tienda (se renueva si ha pasado el tiempo). */
  shopStock(shopId: string): Shop.ShopState {
    return Shop.ensureStock(this.state, shopId);
  }

  buyFromShop(shopId: string, uid: string, qty = 1): string | null {
    const err = Shop.buy(this.state, shopId, this.state.player, this.derived.stats.CAR, uid, qty, this.shopDiscount(shopId));
    if (!err) recalcPlayer(this.state.player);
    return err;
  }

  /** Vende y devuelve el oro ganado (número) o un error (texto). */
  sellToShop(shopId: string, uid: string, qty = 1): number | string {
    return Shop.sell(this.state, shopId, this.state.player, this.derived.stats.CAR, uid, qty);
  }

  /** Posada: cura todo, limpia estados y pasa la noche. */
  rest(price: number): string | null {
    const p = this.state.player;
    if (this.inCombat) return 'No puedes descansar con enemigos cerca.';
    if (p.gold < price) return `No tienes suficiente oro (cuesta ${price}).`;
    p.gold -= price;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    this.combat.statuses = [];
    this.combat.buffs = [];
    if (this.state.party?.active) {
      this.state.party.down = false;
      this.state.party.hp = this.allyStats().maxHp;
    }
    this.healPet();
    this.state.turn += 100; // pasa la noche: las tiendas pueden renovar su stock
    this.msg('Duermes de un tirón. Te levantas como nuevo.', 'good');
    return null;
  }

  /** Templo: sanación completa por un donativo y punto de reaparición. */
  templeHeal(pricePerLevel: number): string | null {
    const p = this.state.player;
    const price = pricePerLevel * p.level;
    const hurt = p.hp < p.maxHp || this.combat.statuses.length > 0;
    p.respawnZone = this.zone.id;
    if (!hurt) {
      this.msg('No necesitas sanación. Si caes, despertarás en este templo.', 'info');
      return null;
    }
    if (p.gold < price) return `El donativo es de ${price} de oro y no te llega.`;
    p.gold -= price;
    p.hp = p.maxHp;
    this.combat.statuses = [];
    this.pushFx({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 1.2, color: '#fff0a0', t: 0, life: 0.7 });
    this.msg(`Donas ${price} de oro. La Llama Blanca cierra tus heridas. Si caes, despertarás aquí.`, 'good');
    return null;
  }

  /** Marca de misión sobre un PNJ. */
  npcMarker(npcId: string): '!' | '?' | null {
    return Quests.npcMarker(this.state, npcId);
  }

  // ================================================================ compañero
  get companionDef(): CompanionDef | null {
    const id = this.state.party?.active;
    return id ? (COMPANIONS.get(id) ?? null) : null;
  }

  /** Valores de combate del compañero (escalan con tu nivel). */
  allyStats(): { maxHp: number; toHit: number; dmgBonus: number; ac: number } {
    const def = this.companionDef;
    const L = this.state.player.level;
    if (!def) return { maxHp: 1, toHit: 0, dmgBonus: 0, ac: 10 };
    return {
      maxHp: def.hpBase + def.hpPerLevel * (L - 1),
      toHit: def.attack.toHit + Math.floor((L - 1) / 4),
      dmgBonus: Math.floor(L / 3),
      ac: def.ac + Math.floor(L / 5),
    };
  }

  allyAt(x: number, y: number): Ally | null {
    return this.ally && this.ally.x === x && this.ally.y === y ? this.ally : null;
  }

  /** Coloca al compañero junto a ti (al cargar o cambiar de zona). */
  private spawnAlly(): void {
    this.ally = null;
    const def = this.companionDef;
    if (!def) return;
    const party = this.state.party;
    party.hp = Math.min(Math.max(0, party.hp), this.allyStats().maxHp);
    const p = this.playerPos;
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if ((dx === 0 && dy === 0) || !this.zone.isWalkable(x, y) || this.enemyAt(x, y) || this.npcAt(x, y) || this.zone.exitAt(x, y)) continue;
          this.ally = { def, x, y, rx: x, ry: y, facing: 'right', bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0 };
          return;
        }
      }
    }
  }

  /** El compañero dice algo (si va contigo y está en pie). */
  companionSay(event: CompanionEvent, chance = 1): void {
    const def = this.companionDef;
    if (!def || this.state.party.down || !this.rng.chance(chance)) return;
    const lines = def.comments[event];
    if (!lines?.length) return;
    this.msg(`${def.name}: «${this.rng.pick(lines)}»`, 'info');
    if (this.ally) this.floatText(this.ally.x, this.ally.y - 0.5, '💬', '#f2d888');
  }

  /** Recluta a un compañero (el anterior, si lo hay, vuelve a su sitio). */
  recruitCompanion(id: string): string | null {
    const def = COMPANIONS.get(id);
    if (!def) return 'Ese compañero no existe.';
    const party = this.state.party;
    if (party.active === id) return null;
    if (party.active) this.dismissCompanion();
    party.active = id;
    party.down = false;
    this.state.flags[`reclutado_${id}`] = true;
    party.hp = this.allyStats().maxHp;
    party.approval[id] ??= 0;
    this.npcs = npcsInZone(this.zone.id, this.state.flags);
    this.spawnAlly();
    this.msg(`${def.name} se une a ti.`, 'good');
    this.companionSay('recluta');
    this.events.emit('questsChanged', {});
    return null;
  }

  /** El compañero se separa y vuelve a su sitio de siempre. */
  dismissCompanion(): void {
    const def = this.companionDef;
    if (!def) return;
    this.state.flags[`reclutado_${def.id}`] = false;
    this.state.party.active = null;
    this.ally = null;
    this.npcs = npcsInZone(this.zone.id, this.state.flags);
    this.msg(`${def.name} se separa de ti. Le encontrarás donde le conociste.`, 'info');
  }

  /** Cambia la aprobación de un compañero (sólo si va contigo y lo ve). */
  changeApproval(id: string, amount: number): void {
    const def = this.companionDef;
    if (!def || def.id !== id || amount === 0) return;
    const ap = this.state.party.approval;
    ap[id] = Math.max(-10, Math.min(10, (ap[id] ?? 0) + amount));
    this.msg(`${def.name} ${amount > 0 ? 'aprueba' : 'desaprueba'} (${amount > 0 ? '+' : ''}${amount}).`, amount > 0 ? 'good' : 'warn');
    this.companionSay(amount > 0 ? 'aprueba' : 'desaprueba');
  }

  /** Turno del compañero. Devuelve true si hizo algo visible. */
  private allyTurn(): boolean {
    const a = this.ally;
    const def = this.companionDef;
    if (!a || !def) return false;
    const party = this.state.party;
    if (party.down) {
      if (!this.inCombat) {
        party.down = false;
        party.hp = Math.max(1, Math.round(this.allyStats().maxHp * 0.3));
        this.msg(`${def.name} se levanta tambaleándose.`, 'info');
        return true;
      }
      return false;
    }
    // Fuego bajo sus pies: se aparta (no le hace daño, es "fuego amigo" controlado).
    const p = this.playerPos;
    const foes = this.enemies
      .filter((e) => (e.alerted || dist(e.x, e.y, a.x, a.y) <= 4) && dist(e.x, e.y, a.x, a.y) <= 8 && this.los(a, e))
      .sort((x, y) => dist(x.x, x.y, a.x, a.y) - dist(y.x, y.y, a.x, a.y));
    const target = foes[0];
    if (target) {
      const canHit = () => {
        const dd = dist(a.x, a.y, target.x, target.y);
        return dd <= def.attack.range && (def.attack.range === 1 || this.los(a, target));
      };
      if (canHit()) {
        this.allyAttack(target);
        return true;
      }
      // Se mueve hasta ALLY_MOVE casillas y, si llega, ataca en el mismo turno.
      let moved = false;
      for (let i = 0; i < ALLY_MOVE && !canHit(); i++) {
        if (!this.stepAllyTowards(target, true)) break;
        moved = true;
      }
      if (canHit()) {
        this.allyAttack(target);
        return true;
      }
      return moved;
    }
    // Seguir al jugador
    const dp = dist(a.x, a.y, p.x, p.y);
    if (dp > 2) {
      this.stepAllyTowards(p, true);
      if (dp > 5) this.stepAllyTowards(p, true);
    }
    return false;
  }

  private stepAllyTowards(t: Point, goalBlocked: boolean): boolean {
    const a = this.ally!;
    const p = this.playerPos;
    const path = findPath(
      this.zone.width, this.zone.height, a, t,
      (x, y) => this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !(x === p.x && y === p.y) && !this.zone.exitAt(x, y),
      { allowGoalBlocked: goalBlocked, maxNodes: 800 },
    );
    const next = path?.[0];
    if (!next || this.enemyAt(next.x, next.y) || (next.x === p.x && next.y === p.y)) return false;
    if (next.x !== a.x) a.facing = next.x > a.x ? 'right' : 'left';
    a.x = next.x;
    a.y = next.y;
    pushStep(a, next);
    return true;
  }

  private allyAttack(e: Enemy): void {
    const a = this.ally!;
    const def = this.companionDef!;
    const st = this.allyStats();
    a.facing = e.x >= a.x ? 'right' : 'left';
    this.actionName = def.attack.name;
    if (def.attack.range > 1) {
      this.pushFx({ kind: 'bolt', fx: a.x, fy: a.y, tx: e.x, ty: e.y, color: '#d8d0bc', t: 0, life: 0.25 });
    } else this.strike(a, Math.sign(e.x - a.x), Math.sign(e.y - a.y));
    const r = attackRoll(this.rng, st.toHit, e.def.ac);
    e.alerted = true;
    this.sawAttack = true;
    this.events.emit('dice', {
      label: `${def.name}: ${def.attack.name}`, natural: r.natural, bonus: st.toHit, total: r.total, target: e.def.ac, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss', small: true,
      attacker: { kind: 'ally' }, defender: { kind: 'enemy', uid: e.uid }, action: def.attack.name, lead: this.actionLead,
    });
    if (!r.hit) {
      this.floatText(e.x, e.y, 'Fallo', '#a49c8a');
      this.msg(`${def.name} falla contra ${e.def.name}.`, 'combat', 'miss');
      return;
    }
    const dmg = damageRoll(this.rng, def.attack.dice, st.dmgBonus, r.crit).total;
    this.killContext = 'ally';
    this.msg(`${def.name} ${r.crit ? '¡hace un crítico a' : 'golpea a'} ${e.def.name}${r.crit ? '!' : ''}`, 'combat');
    this.damageEnemy(e, dmg, def.attack.damageType, r.crit);
    this.killContext = 'other';
  }

  /** Un enemigo ataca al compañero. */
  private enemyAttackAlly(e: Enemy): void {
    const a = this.ally!;
    const def = this.companionDef!;
    const atk = e.def.attack;
    e.facing = a.x >= e.x ? 'right' : 'left';
    this.actionName = atk.name;
    if (atk.range === 1) {
      this.strike(e, Math.sign(a.x - e.x), Math.sign(a.y - e.y));
    } else this.pushFx({ kind: 'bolt', fx: e.x, fy: e.y, tx: a.x, ty: a.y, color: '#d8d0bc', t: 0, life: 0.25 });
    const allyAc = this.allyStats().ac;
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, allyAc);
    this.sawAttack = true;
    this.events.emit('dice', {
      label: `${e.def.name}: ${atk.name}`, natural: r.natural, bonus: atk.toHit + e.toHitBonus, total: r.total, target: allyAc, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss', small: true,
      attacker: { kind: 'enemy', uid: e.uid }, defender: { kind: 'ally' }, action: atk.name, lead: this.actionLead,
    });
    if (!r.hit) {
      this.floatText(a.x, a.y, 'Esquiva', '#a49c8a');
      return;
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    const party = this.state.party;
    party.hp = Math.max(0, party.hp - dmg);
    this.flash(a);
    this.floatText(a.x, a.y, `-${dmg}`, '#ff9a60');
    this.msg(`${e.def.name} hiere a ${def.name}: ${dmg} de daño.`, 'combat', 'dmg-in');
    this.cfx({
      type: 'hit', target: { kind: 'ally' }, pos: { x: a.x, y: a.y }, amount: dmg, dmgType: atk.damageType, crit: r.crit, note: '',
      killed: party.hp <= 0, attacker: { kind: 'enemy', uid: e.uid }, action: atk.name, lead: this.actionLead,
    });
    if (party.hp <= 0) {
      this.companionSay('caido');
      party.down = true;
      this.msg(`${def.name} cae al suelo. Se levantará cuando acabe el combate.`, 'warn');
    }
  }

  // ================================================================ mascotas
  /** Mascota activa (datos guardados) o null. */
  get petInstance(): Pets.PetInstance | null {
    return this.state.pets?.active ?? null;
  }

  petAt(x: number, y: number): PetUnit | null {
    return this.pet && this.pet.x === x && this.pet.y === y ? this.pet : null;
  }

  /** Estadísticas de la mascota con sus mejoras temporales. */
  petStatsNow(): import('@/data/schema').PetStats {
    const pi = this.petInstance;
    const st = pi ? Pets.petStats(pi) : { hp: 1, atk: 0, def: 0, spd: 0, mag: 0 };
    for (const b of this.petBuffs) st[b.stat] += b.amount;
    return st;
  }

  petAC(): number {
    return 10 + Math.floor(this.petStatsNow().def / 2);
  }

  /** Coloca a la mascota junto a ti (al cargar o cambiar de zona). */
  private spawnPet(): void {
    this.pet = null;
    const pi = this.petInstance;
    if (!pi) return;
    Pets.markSeen(this.state.pets, pi.species);
    const p = this.playerPos;
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if ((dx === 0 && dy === 0) || !this.zone.isWalkable(x, y) || this.enemyAt(x, y) || this.npcAt(x, y) || this.zone.exitAt(x, y) || this.allyAt(x, y)) continue;
          this.pet = { x, y, rx: x, ry: y, facing: 'right', bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0 };
          return;
        }
      }
    }
  }

  /** Ordena el movimiento del siguiente turno (null = que decida ella). */
  setPetOrder(moveId: string | null): void {
    const pi = this.petInstance;
    this.petOrder = moveId && pi?.moves.includes(moveId) ? moveId : null;
    if (pi) this.msg(this.petOrder ? `${Pets.petName(pi)} usará ${Pets.getMove(this.petOrder)?.name ?? ''} en su turno.` : `${Pets.petName(pi)} decidirá por su cuenta.`, 'info');
  }

  /** Turno de la mascota. Devuelve true si hizo algo visible. */
  private petTurn(): boolean {
    const u = this.pet;
    const pi = this.petInstance;
    if (!u || !pi) return false;
    if (pi.down) return false;
    const p = this.playerPos;
    const foes = this.enemies
      .filter((e) => (e.alerted || dist(e.x, e.y, u.x, u.y) <= 3) && dist(e.x, e.y, u.x, u.y) <= 8 && this.los(u, e))
      .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y));
    const order = this.petOrder;
    this.petOrder = null;
    const ordered = order ? Pets.getMove(order) : undefined;
    // Movimientos de apoyo (no necesitan objetivo)
    const support = ordered && ordered.kind !== 'daño' ? ordered : this.pickSupportMove(foes.length > 0);
    if (support && (this.petCooldowns[support.id] ?? 0) <= 0 && (ordered === support || foes.length > 0 || support.kind === 'curar')) {
      this.usePetMove(support, null);
      return true;
    }
    const target = foes[0];
    if (target) {
      const move = ordered && ordered.kind === 'daño' ? ordered : this.pickDamageMove(target);
      if (move) {
        const canHit = () => {
          const dd = dist(u.x, u.y, target.x, target.y);
          return dd <= move.range && (move.range === 1 || this.los(u, target));
        };
        if (canHit()) {
          this.usePetMove(move, target);
          return true;
        }
        // Se mueve hasta PET_MOVE casillas y, si llega, usa el movimiento.
        let moved = false;
        for (let i = 0; i < PET_MOVE && !canHit(); i++) {
          if (!this.stepPetTowards(target, true)) break;
          moved = true;
        }
        if (canHit()) {
          this.usePetMove(move, target);
          return true;
        }
        return moved;
      }
    }
    // Seguir al jugador
    const dp = dist(u.x, u.y, p.x, p.y);
    if (dp > 2) {
      this.stepPetTowards(p, true);
      if (dp > 5) this.stepPetTowards(p, true);
    }
    return false;
  }

  /** Curar o proteger si hace falta. */
  private pickSupportMove(inCombat: boolean): import('@/data/schema').PetMoveDef | null {
    const pi = this.petInstance!;
    const pl = this.state.player;
    const ready = pi.moves.map((m) => Pets.getMove(m)).filter((m): m is NonNullable<typeof m> => !!m && (this.petCooldowns[m.id] ?? 0) <= 0);
    const petHp = pi.hp / Math.max(1, Pets.petStats(pi).hp);
    const selfHeal = ready.find((m) => m.kind === 'curar' && m.self);
    if (selfHeal && petHp < 0.45) return selfHeal;
    const heal = ready.find((m) => m.kind === 'curar' && !m.self);
    if (heal && pl.hp < pl.maxHp * 0.45) return heal;
    if (!inCombat) return null;
    const shield = ready.find((m) => m.kind === 'proteger');
    const adjacent = this.enemies.some((e) => e.alerted && dist(e.x, e.y, this.playerPos.x, this.playerPos.y) <= 1);
    if (shield && adjacent && pl.hp < pl.maxHp * 0.7 && !this.combat.buffs.some((b) => b.stat === 'ca')) return shield;
    const buff = ready.find((m) => m.kind === 'mejora');
    if (buff && !this.petBuffs.length && this.rng.chance(0.3)) return buff;
    return null;
  }

  /** El movimiento de daño más eficaz disponible contra un objetivo. */
  private pickDamageMove(target: Enemy): import('@/data/schema').PetMoveDef | null {
    const pi = this.petInstance!;
    const u = this.pet!;
    const st = this.petStatsNow();
    const d = dist(u.x, u.y, target.x, target.y);
    const defType = target.def.pet ? Pets.getSpecies(target.def.pet.species).type : Pets.familyType(target.def.family);
    let best: { m: import('@/data/schema').PetMoveDef; score: number } | null = null;
    for (const id of pi.moves) {
      const m = Pets.getMove(id);
      if (!m || m.kind !== 'daño' || (this.petCooldowns[id] ?? 0) > 0) continue;
      const avg = (m.dice ? averageDice(m.dice) : 2) + Math.floor(st[m.stat ?? 'atk'] / 3);
      let score = avg * Pets.typeMultiplier(m.type, defType) * (m.accuracy ?? 0.9);
      if (d > m.range) score *= 0.6; // habría que acercarse
      if (m.radius) score *= 1 + 0.3 * this.enemies.filter((e) => e !== target && dist(e.x, e.y, target.x, target.y) <= m.radius!).length;
      if (!best || score > best.score) best = { m, score };
    }
    return best?.m ?? null;
  }

  /** Ejecuta un movimiento de la mascota. */
  private usePetMove(m: import('@/data/schema').PetMoveDef, target: Enemy | null): void {
    const pi = this.petInstance!;
    const u = this.pet!;
    const st = this.petStatsNow();
    const name = Pets.petName(pi);
    if (m.cooldown > 0) this.petCooldowns[m.id] = m.cooldown + 1;
    const color = PET_TYPE_COLOR[m.type] ?? '#ffffff';
    if (m.kind === 'curar') {
      const amount = roll(this.rng, m.heal ?? '1d6').total + Math.floor(st.mag / 3);
      if (m.self) {
        const max = Pets.petStats(pi).hp;
        const before = pi.hp;
        pi.hp = Math.min(max, pi.hp + amount);
        this.floatText(u.x, u.y, `+${pi.hp - before}`, '#60e070');
      } else {
        const pl = this.state.player;
        const before = pl.hp;
        pl.hp = Math.min(pl.maxHp, pl.hp + amount);
        this.floatText(this.playerPos.x, this.playerPos.y, `+${pl.hp - before}`, '#60e070');
        this.pushFx({ kind: 'bolt', fx: u.x, fy: u.y, tx: this.playerPos.x, ty: this.playerPos.y, color: '#60e070', t: 0, life: 0.3 });
      }
      this.msg(`${name} usa ${m.icon} ${m.name}.`, 'good');
      return;
    }
    if (m.kind === 'proteger' && m.shield) {
      this.combat.buffs.push({ stat: 'ca', amount: m.shield.amount, turns: m.shield.turns + 1 });
      this.pushFx({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 0.9, color, t: 0, life: 0.5 });
      this.msg(`${name} usa ${m.icon} ${m.name}: +${m.shield.amount} a tu CA.`, 'good');
      return;
    }
    if (m.kind === 'mejora' && m.buff) {
      this.petBuffs.push({ ...m.buff, turns: m.buff.turns + 1 });
      this.floatText(u.x, u.y, `▲${m.buff.amount}`, '#f2d888');
      this.msg(`${name} usa ${m.icon} ${m.name}.`, 'good');
      return;
    }
    if (!target) return;
    u.facing = target.x >= u.x ? 'right' : 'left';
    this.actionName = m.name;
    if (m.range > 1) this.pushFx({ kind: 'bolt', fx: u.x, fy: u.y, tx: target.x, ty: target.y, color, t: 0, life: 0.3 });
    else this.strike(u, Math.sign(target.x - u.x), Math.sign(target.y - u.y));
    if (m.radius) this.pushFx({ kind: 'burst', x: target.x, y: target.y, radius: m.radius + 0.5, color, t: 0, life: 0.5 });
    const targets = m.radius ? this.enemies.filter((e) => dist(e.x, e.y, target.x, target.y) <= m.radius! && this.los(target, e)) : [target];
    pi.bond = Math.min(100, pi.bond + 0.2);
    for (const t of targets) {
      t.alerted = true;
      if (!this.rng.chance(m.accuracy ?? 0.9)) {
        this.floatText(t.x, t.y, 'Fallo', '#a49c8a');
        this.cfx({ type: 'miss', target: { kind: 'enemy', uid: t.uid }, pos: { x: t.x, y: t.y }, attacker: { kind: 'pet' }, action: m.name, lead: this.actionLead });
        continue;
      }
      const defType = t.def.pet ? Pets.getSpecies(t.def.pet.species).type : Pets.familyType(t.def.family);
      const mult = Pets.typeMultiplier(m.type, defType);
      const raw = roll(this.rng, m.dice ?? '1d4').total + Math.floor(st[m.stat ?? 'atk'] / 3);
      const dmg = Math.max(1, Math.round(raw * mult));
      if (mult > 1) this.floatText(t.x, t.y - 0.6, '¡Eficaz!', '#a8f08a');
      else if (mult < 1) this.floatText(t.x, t.y - 0.6, 'Poco eficaz', '#a0a0b0');
      this.msg(`${name} usa ${m.icon} ${m.name} contra ${t.def.name}${mult > 1 ? ' (¡muy eficaz!)' : mult < 1 ? ' (poco eficaz)' : ''}.`, 'combat');
      this.killContext = 'ally';
      this.damageEnemy(t, dmg, PET_DAMAGE[m.type] ?? 'contundente');
      this.killContext = 'other';
      if (t.hp > 0 && m.applyStatus) this.applyStatusToEnemy(t, m.applyStatus);
    }
  }

  private stepPetTowards(t: Point, goalBlocked: boolean): boolean {
    const u = this.pet!;
    const p = this.playerPos;
    const path = findPath(
      this.zone.width, this.zone.height, u, t,
      (x, y) => this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !(x === p.x && y === p.y) && !this.zone.exitAt(x, y) && !this.allyAt(x, y),
      { allowGoalBlocked: goalBlocked, maxNodes: 800 },
    );
    const next = path?.[0];
    if (!next || this.enemyAt(next.x, next.y) || (next.x === p.x && next.y === p.y) || this.allyAt(next.x, next.y)) return false;
    if (next.x !== u.x) u.facing = next.x > u.x ? 'right' : 'left';
    u.x = next.x;
    u.y = next.y;
    pushStep(u, next);
    return true;
  }

  /** Un enemigo ataca a la mascota. */
  private enemyAttackPet(e: Enemy): void {
    const u = this.pet!;
    const pi = this.petInstance!;
    const atk = e.def.attack;
    e.facing = u.x >= e.x ? 'right' : 'left';
    this.actionName = atk.name;
    if (atk.range === 1) {
      this.strike(e, Math.sign(u.x - e.x), Math.sign(u.y - e.y));
    } else this.pushFx({ kind: 'bolt', fx: e.x, fy: e.y, tx: u.x, ty: u.y, color: '#d8d0bc', t: 0, life: 0.25 });
    const petAc = this.petAC();
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, petAc);
    this.sawAttack = true;
    this.events.emit('dice', {
      label: `${e.def.name}: ${atk.name}`, natural: r.natural, bonus: atk.toHit + e.toHitBonus, total: r.total, target: petAc, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss', small: true,
      attacker: { kind: 'enemy', uid: e.uid }, defender: { kind: 'pet' }, action: atk.name, lead: this.actionLead,
    });
    if (!r.hit) {
      this.floatText(u.x, u.y, 'Esquiva', '#a49c8a');
      return;
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    pi.hp = Math.max(0, pi.hp - dmg);
    this.flash(u);
    this.floatText(u.x, u.y, `-${dmg}`, '#ff9a60');
    this.msg(`${e.def.name} hiere a ${Pets.petName(pi)}: ${dmg} de daño.`, 'combat', 'dmg-in');
    this.cfx({
      type: 'hit', target: { kind: 'pet' }, pos: { x: u.x, y: u.y }, amount: dmg, dmgType: atk.damageType, crit: r.crit, note: '',
      killed: pi.hp <= 0, attacker: { kind: 'enemy', uid: e.uid }, action: atk.name, lead: this.actionLead,
    });
    if (pi.hp <= 0) {
      pi.down = true;
      this.msg(`${Pets.petName(pi)} está debilitada. Se recuperará fuera de combate.`, 'warn');
    }
  }

  /** Fuera de combate la mascota se recupera poco a poco. */
  private petRegen(): void {
    const pi = this.petInstance;
    if (!pi) return;
    const max = Pets.petStats(pi).hp;
    if (this.state.turn % 3 === 0 && pi.hp < max) pi.hp++;
    if (pi.down && pi.hp >= Math.ceil(max * 0.25)) {
      pi.down = false;
      this.msg(`${Pets.petName(pi)} se recupera y vuelve a tu lado.`, 'good');
    }
  }

  /** Curación completa de la mascota activa (posada, templo, establo). */
  healPet(): void {
    const pi = this.petInstance;
    if (!pi) return;
    pi.down = false;
    pi.hp = Pets.petStats(pi).hp;
  }

  /** Experiencia para la mascota activa (y avisos de nivel, movimientos y evolución). */
  givePetXp(amount: number): void {
    const pi = this.petInstance;
    if (!pi || amount <= 0) return;
    const name = Pets.petName(pi);
    pi.bond = Math.min(100, pi.bond + 1);
    const gain = Pets.gainPetXp(pi, amount, Math.max(this.state.player.level + 2, 3));
    if (gain.levels > 0) {
      this.events.emit('petEvent', { kind: 'nivel', text: `¡${name} sube al nivel ${pi.level}!` });
      this.msg(`¡${name} sube al nivel ${pi.level}!`, 'good');
      if (this.pet) this.pushFx({ kind: 'burst', x: this.pet.x, y: this.pet.y, radius: 1, color: '#80c0ff', t: 0, life: 0.6 });
    }
    for (const m of gain.learned) this.msg(`${name} aprende ${Pets.getMove(m)?.name ?? m}.`, 'good');
    if (pi.pendingMoves.length) this.events.emit('petEvent', { kind: 'movimiento', text: `${name} quiere aprender un movimiento nuevo.` });
    if (pi.pendingEvolution) this.events.emit('petEvent', { kind: 'evolucion', text: `¡${name} está evolucionando!` });
  }

  /** Aparece una criatura salvaje lejos del jugador. */
  spawnWildPet(speciesId: string, at?: Point): Enemy | null {
    const p = this.playerPos;
    let spot: Point | null = at ?? null;
    for (let i = 0; i < 60 && !spot; i++) {
      const x = this.rng.int(0, this.zone.width - 1);
      const y = this.rng.int(0, this.zone.height - 1);
      if (!this.freeForEnemy(x, y) || dist(x, y, p.x, p.y) < 6 || this.zone.exitAt(x, y)) continue;
      spot = { x, y };
    }
    if (!spot || !this.freeForEnemy(spot.x, spot.y)) return null;
    const lvl = Math.max(1, this.zone.def.level + this.rng.int(-1, 1));
    const e = createEnemy(wildEnemyDef(speciesId, lvl), spot.x, spot.y, this.rng);
    this.enemies.push(e);
    return e;
  }

  /** Criaturas salvajes que se pueden intentar vincular ahora (cerca y a la vista). */
  bindTargets(): Enemy[] {
    const p = this.playerPos;
    return this.enemies.filter((e) => e.def.pet && dist(e.x, e.y, p.x, p.y) <= 4 && this.los(p, e));
  }

  /** Probabilidad de vincular a una criatura. */
  bindChance(e: Enemy): number {
    if (!e.def.pet) return 0;
    return Pets.captureChance(Pets.getSpecies(e.def.pet.species).rarity, e.hp / e.maxHp);
  }

  /**
   * Usa una Runa de vínculo sobre la criatura salvaje más debilitada a tu alcance.
   * Gasta el turno. Devuelve un error o null.
   */
  bindPet(): string | null {
    if (!this.canAct) return 'Espera a tu turno.';
    const blockedAction = this.actionBlocked();
    if (blockedAction) return blockedAction;
    const runes = this.state.player.inventory.find((x) => x.id === 'runa_vinculo');
    if (!runes) return 'No tienes Runas de vínculo (se venden en la tienda y el alquimista).';
    const target = this.bindTargets().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!target || !target.def.pet) return 'No hay ninguna criatura salvaje cerca.';
    removeQty(this.state.player, runes.uid, 1);
    const chance = this.bindChance(target);
    const sp = Pets.getSpecies(target.def.pet.species);
    // Se muestra como una tirada de d20 contra una CD equivalente a la probabilidad.
    const dc = Math.max(2, Math.min(20, 21 - Math.round(chance * 20)));
    const natural = this.rng.int(1, 20);
    const ok = natural >= dc;
    this.events.emit('dice', { label: `Vínculo (${Math.round(chance * 100)} %)`, natural, bonus: 0, total: natural, target: dc, targetLabel: 'CD', outcome: ok ? 'success' : 'fail' });
    this.pushFx({ kind: 'burst', x: target.x, y: target.y, radius: 1, color: '#c080ff', t: 0, life: 0.6 });
    if (!ok) {
      this.msg(`La runa brilla... pero ${sp.name} se libera.`, 'warn');
      this.afterAction();
      return null;
    }
    this.enemies = this.enemies.filter((e) => e !== target);
    const pet = Pets.createPet(sp.id, target.def.pet.level);
    pet.hp = Math.max(1, Math.round(Pets.petStats(pet).hp * Math.max(0.3, target.hp / target.maxHp)));
    const where = Pets.addPet(this.state.pets, pet, Date.now());
    if (where === 'lleno') {
      this.msg(`¡Vínculo logrado! Pero tu establo está lleno: ${sp.name} vuelve a la naturaleza.`, 'warn');
    } else {
      this.msg(`¡${sp.name} se une a ti!${where === 'establo' ? ' Te espera en el establo de Brumaroja.' : ''}`, 'good');
      this.events.emit('petEvent', { kind: 'vinculo', text: `¡${sp.name} se une a ti!` });
      if (where === 'activa') this.spawnPet();
    }
    void Quests.onBind(this.state, sp.id);
    this.events.emit('questsChanged', {});
    this.gainXp(Math.round(target.def.xp * 0.5), `vínculo con ${sp.name}`);
    this.sfx('mision');
    this.afterAction();
    return null;
  }

  /** Regala una mascota (recompensa de misión): activa si no llevas ninguna; si no, al establo. */
  givePet(speciesId: string, level: number, reason: string): void {
    const sp = Pets.getSpecies(speciesId);
    const pet = Pets.createPet(sp.id, level);
    Pets.markSeen(this.state.pets, sp.id);
    const where = Pets.addPet(this.state.pets, pet, Date.now());
    if (where === 'lleno') {
      this.msg(`${reason}: ${sp.name} quería unirse a ti, pero tu establo está lleno.`, 'warn');
      return;
    }
    const text = `¡${sp.name} se une a ti!${where === 'establo' ? ' Te espera en el establo de Brumaroja.' : ''}`;
    this.msg(text, 'good');
    this.events.emit('petEvent', { kind: 'vinculo', text: `🐾 ${text}` });
    if (where === 'activa') this.spawnPet();
  }

  /** Elige la mascota inicial en el establo. */
  chooseStarter(speciesId: string): string | null {
    if (this.state.pets.starterChosen) return 'Ya elegiste tu primera mascota.';
    const sp = Pets.getSpecies(speciesId);
    if (!sp.starter) return 'Esa criatura no se ofrece como inicial.';
    const pet = Pets.createPet(sp.id, 2);
    this.state.pets.starterChosen = true;
    this.state.flags['mascota_inicial'] = true;
    Pets.addPet(this.state.pets, pet, Date.now());
    this.spawnPet();
    this.msg(`¡${sp.name} será tu compañera de aventuras!`, 'good');
    // Regalo de Tobías: runas para la primera captura.
    const runes = createItem('runa_vinculo', 'comun', this.rng, { qty: 3 });
    const left = addItem(this.state.player, runes);
    if (left > 0) this.dropLoot(this.playerPos.x, this.playerPos.y, [{ ...runes, qty: left }], 0);
    this.msg('Tobías: «Toma, 3 Runas de vínculo. Debilita a una criatura salvaje y usa 🔮 cuando esté baja de vida.»', 'good');
    this.msg('Tobías: «En el Bosque Sombrío viven guijarrines. Vuelve a hablar conmigo: tengo un encargo para ti.»', 'info');
    this.events.emit('questsChanged', {});
    return null;
  }

  /** Deja la mascota activa en el establo. */
  depositPet(): string | null {
    const err = Pets.depositActive(this.state.pets, Date.now());
    if (!err) this.pet = null;
    return err;
  }

  /** Saca una mascota del establo (la activa entra a descansar). */
  withdrawPet(uid: string): string | null {
    const err = Pets.withdraw(this.state.pets, uid);
    if (!err) this.spawnPet();
    return err;
  }

  /** Aplica el entrenamiento del establo por el tiempo real transcurrido. */
  trainStable(now = Date.now()): Pets.TrainingReport[] {
    return Pets.trainStable(this.state.pets, now, this.state.player.level);
  }

  resolvePetMove(move: string, forget: string | null): void {
    const pi = this.petInstance;
    if (!pi) return;
    Pets.resolveMove(pi, move, forget);
    if (forget) this.msg(`${Pets.petName(pi)} olvida ${Pets.getMove(forget)?.name ?? forget} y aprende ${Pets.getMove(move)?.name ?? move}.`, 'good');
  }

  evolvePet(): Pets.PetInstance | null {
    const pi = this.petInstance;
    if (!pi) return null;
    const before = Pets.getSpecies(pi.species).name;
    const sp = Pets.evolve(pi);
    if (sp) {
      Pets.markSeen(this.state.pets, sp.id);
      if (!this.state.pets.caught.includes(sp.id)) this.state.pets.caught.push(sp.id);
      this.msg(`¡${before} ha evolucionado en ${sp.name}!`, 'good');
      this.sfx('nivel');
    }
    return pi;
  }

  declinePetEvolution(): void {
    const pi = this.petInstance;
    if (pi) Pets.declineEvolution(pi);
  }

  // ================================================================ talentos
  private talentList<T extends Parameters<typeof talentEffects>[1]>(type: T) {
    return talentEffects(this.state.player, type);
  }

  /** Estados a los que eres inmune por talentos. */
  private immunities(): StatusId[] {
    return this.talentList('immune').map((t) => t.status);
  }

  /** Efectos al matar (sólo si lo has matado tú). */
  private onKillTalents(enemy: Enemy, ctx: 'weapon' | 'spell'): void {
    const p = this.state.player;
    for (const t of this.talentList('onKill')) {
      if (t.restore) p.mp = Math.min(p.maxMp, p.mp + t.restore);
      if (t.heal) {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + t.heal);
        if (p.hp > before) this.floatText(this.playerPos.x, this.playerPos.y, `+${p.hp - before}`, '#60e070');
      }
      if (t.stealth) {
        this.combat.stealth = Math.max(this.combat.stealth, t.stealth + 1);
        for (const e of this.enemies) if (dist(e.x, e.y, this.playerPos.x, this.playerPos.y) > 1) e.alerted = false;
        this.msg('Te desvaneces entre las sombras.', 'good');
      }
      if (t.cleave && ctx === 'weapon' && !this.freeStrike) {
        const pos = this.playerPos;
        const next = this.enemies.find((e) => e !== enemy && dist(e.x, e.y, pos.x, pos.y) === 1);
        if (next) {
          this.freeStrike = true;
          this.msg('¡Carnicería! Golpe gratis.', 'combat');
          this.playerAttack(next, {});
          this.freeStrike = false;
        }
      }
    }
  }

  /** Crea suelo ardiendo alrededor de un punto. */
  private burnGround(center: Point, radius: number, turns: number): void {
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        if (!this.zone.isWalkable(x, y) || dist(x, y, center.x, center.y) > radius) continue;
        const h = this.hazards.find((z) => z.x === x && z.y === y);
        if (h) h.turns = Math.max(h.turns, turns);
        else this.hazards.push({ x, y, turns, dice: '1d6', damageType: 'fuego' });
      }
    }
  }

  hazardAt(x: number, y: number): Hazard | undefined {
    return this.hazards.find((h) => h.x === x && h.y === y && h.turns > 0);
  }

  // ======================================================== diálogos y tiradas
  /** Bonificador del jugador en una habilidad. */
  skillBonusOf(skill: SkillKey): number {
    return skillBonus(this.state.player, skill);
  }

  /** Prueba de habilidad de un diálogo: d20 + bonificador contra la CD (con animación). */
  dialogCheck(skill: SkillKey, dc: number): CheckResult {
    const bonus = this.skillBonusOf(skill);
    const natural = this.rng.int(1, 20);
    const total = natural + bonus;
    const success = natural === 20 || (natural !== 1 && total >= dc);
    this.events.emit('dice', {
      label: SKILLS[skill].name, natural, bonus, total, target: dc, targetLabel: 'CD',
      outcome: natural === 20 ? 'crit' : natural === 1 ? 'fumble' : success ? 'success' : 'fail',
    });
    this.sfx(success ? 'moneda' : 'fallo');
    return { success, natural, total, bonus, dc };
  }

  /** Descuento (%) que tienes en una tienda gracias a tus diálogos. */
  shopDiscount(shopId: string): number {
    return Math.max(0, Math.min(50, Number(this.state.flags[`descuento:${shopId}`] ?? 0)));
  }

  /** Actitud de un PNJ hacia ti (por defecto 0). */
  attitude(npcId: string): number {
    return Number(this.state.flags[`actitud:${npcId}`] ?? 0);
  }

  /**
   * Aplica las consecuencias de un nodo de diálogo. Devuelve true si hay que
   * cerrar el diálogo (empieza una pelea).
   */
  applyDialogEffects(node: DialogNode): boolean {
    if (!node.effects?.length) return false;
    if (node.once) {
      if (this.state.flags[node.once]) return false;
      this.state.flags[node.once] = true;
    }
    const p = this.state.player;
    let close = false;
    for (const ef of node.effects) {
      switch (ef.type) {
        case 'gold':
          p.gold = Math.max(0, p.gold + ef.amount);
          this.msg(ef.amount >= 0 ? `+${ef.amount} de oro.` : `Pagas ${-ef.amount} de oro.`, ef.amount >= 0 ? 'good' : 'info');
          if (ef.amount > 0) this.sfx('moneda');
          break;
        case 'item': {
          const it = createItem(ef.item, 'comun', this.rng, { qty: ef.qty ?? 1, level: p.level });
          const left = addItem(p, it);
          if (left > 0) this.dropLoot(this.playerPos.x, this.playerPos.y, [{ ...it, qty: left }], 0);
          this.msg(`Recibes: ${itemDef(it).name}${(ef.qty ?? 1) > 1 ? ` ×${ef.qty}` : ''}.`, 'good');
          break;
        }
        case 'xp':
          this.gainXp(ef.amount, 'buena decisión');
          break;
        case 'flag':
          this.state.flags[ef.flag] = ef.value ?? true;
          break;
        case 'discount': {
          const key = `descuento:${ef.shop}`;
          this.state.flags[key] = Math.max(Number(this.state.flags[key] ?? 0), ef.pct);
          this.msg(`Descuento del ${ef.pct} % en esta tienda.`, 'good');
          break;
        }
        case 'fight': {
          const pos = this.playerPos;
          for (let i = 0; i < (ef.count ?? 1); i++) {
            const spot = this.freeSpotNear(pos, 2);
            const e = spot ? this.spawnEnemy(ef.enemy, spot.x, spot.y) : null;
            if (e) e.alerted = true;
          }
          this.msg('¡Pelea!', 'warn');
          close = true;
          break;
        }
        case 'approval':
          this.changeApproval(ef.companion, ef.amount);
          break;
        case 'attitude': {
          const key = `actitud:${ef.npc}`;
          this.state.flags[key] = Number(this.state.flags[key] ?? 0) + ef.amount;
          break;
        }
        case 'recruit':
          this.recruitCompanion(ef.companion);
          break;
        case 'heal':
          p.hp = p.maxHp;
          this.msg('Te sientes mucho mejor.', 'good');
          break;
        case 'quest':
          this.acceptQuest(ef.quest);
          break;
      }
    }
    // Algún PNJ puede aparecer o desaparecer (p. ej. el prisionero liberado).
    this.npcs = npcsInZone(this.zone.id, this.state.flags);
    this.events.emit('questsChanged', {});
    return close;
  }

  /** PNJ que representa al compañero (para hablar con él cuando te acompaña). */
  companionNpc(): NpcDef | null {
    const def = this.companionDef;
    return def ? (NPCS.get(def.npc) ?? null) : null;
  }
}

const PET_TYPE_COLOR: Record<string, string> = {
  fuego: '#ff8030', agua: '#60b0ff', planta: '#80d040', tierra: '#c8a060', sombra: '#a060ff', luz: '#fff0a0',
};
const PET_DAMAGE: Record<string, DamageType> = {
  fuego: 'fuego', agua: 'frio', planta: 'veneno', tierra: 'contundente', sombra: 'necrotico', luz: 'sagrado',
};

const SPELL_COLORS: Partial<Record<DamageType, string>> = {
  fuego: '#ff8030', frio: '#80d0ff', rayo: '#f0f060', veneno: '#80d040', sagrado: '#fff0a0',
  necrotico: '#a040ff', arcano: '#c080ff',
};
