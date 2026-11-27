/**
 * NÚCLEO DE LA PARTIDA (sin DOM)
 * ------------------------------
 * Mantiene el estado, la zona actual y los enemigos del MAPA. Cada paso o acción
 * del jugador es un turno: los enemigos deambulan y, si uno te ve, se prepara una
 * batalla (`startEncounter` → `beginBattle`). La batalla por turnos vive en
 * src/game/battle (lógica pura) y se reproduce en una escena aparte; al acabar,
 * `finishBattle` aplica el resultado (XP, mapa, muerte).
 */
import { COMPANIONS, NPCS, SHOPS, ORES, TRAPS, getClass, getEnemy, getItem, getZoneDef, npcsInZone, setDynamicZoneResolver } from '@/data/registry';
import type { CompanionDef, CompanionEvent, DamageType, DialogNode, NpcDef, QuestDef, SkillDef, SkillKey, ZoneFeature } from '@/data/schema';
import { Emitter } from '@/engine/events';
import { Battle, allyStatsFor, type BattleResult } from './battle/battle';
import { findPath, type Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';
import { createEnemy, scaleEnemyDef, type Enemy } from './combat/entities';
import { advanceWalker, pushStep } from './combat/walk';
import { dist, hasLineOfSight, savingThrow } from './combat/rules';
import { attributePointsAtLevel, proficiencyBonus, unlockedSkills } from './rules/character';
import { derive, type Derived } from './rules/derived';
import { abilityModifier, roll, rollD20 } from './rules/dice';
import { levelForXp } from './rules/progression';
import { emptyParty, emptyRecord, recalcPlayer, type GameState } from './state';
import * as Pets from './pets/pets';
import { wildEnemyDef, wildSpeciesIn } from './pets/wild';
import { SKILLS, skillBonus } from './rules/skills';
import { enemiesDropping, enemyMatches, nextHop, questGoalZone, questStep, zoneName, type GoalKind } from './quests/guide';
import { addItem, countItem, equip, removeQty, unequip } from './items/inventory';
import { displayName, itemDef, rarityOf, type ItemInstance } from './items/items';
const rarityColor = (i: number): string => ['#d8d4cc', '#5ad05a', '#4a90f0', '#b060f0', '#ff9a20'][i] ?? '#fff';
import { rollLoot } from './items/loot';
import { createItem } from './items/items';
import * as Quests from './quests/quests';
import * as Shop from './economy/shop';
import { encounterXpBonus } from './economy/curve';
import type { EquipSlot } from '@/data/schema';
import { buildZone, type Zone, type ZoneExit } from './world/zone';
import { activateGenWorld, assignQuests, emptyGen, ensureZone, genZoneDef } from './world/procgen';
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
  small?: boolean;
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
  message: { text: string; kind?: MsgKind };
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
  /** Novedades de la mascota (la interfaz muestra elecciones pendientes). */
  petEvent: PetEvent;
  /** Tocaste a tu mascota en el mapa (órdenes). */
  petTapped: Record<string, never>;
  /** Un enemigo te ha visto: en un instante empieza la batalla. */
  battleSoon: Record<string, never>;
  /** Empieza una batalla (la interfaz abre la escena). */
  battleStart: { battle: Battle };
  /** Terminó la batalla y ya se aplicó el resultado. */
  battleEnd: { result: BattleResult };
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

/** Turnos sin ser detectado tras huir de una batalla. */
const FLEE_IMMUNITY = 8;
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
  fx: Fx[] = [];
  heldDir: { dx: number; dy: number } | null = null;
  stepDuration = 0.14;
  phase: 'player' | 'enemies' | 'dead' = 'player';
  rng: Rng;
  /** Batalla en curso (la escena la reproduce; mientras exista, el mapa está en pausa). */
  battle: Battle | null = null;
  /** Grupo de enemigos que ha iniciado una batalla y espera a la transición. */
  pendingBattle: { enemies: Enemy[]; timer: number } | null = null;
  /** Turnos de inmunidad tras huir: los enemigos no te detectan. */
  immunity = 0;
  /** Orden de la mascota para la próxima batalla (se pasa a Battle al empezar). */
  petOrder: string | null = null;
  /** Escapaste de la última batalla. */
  fled = false;

  constructor(public state: GameState) {
    state.quests ??= {};
    state.shops ??= {};
    state.world ??= emptyWorld();
    state.world.gen ??= emptyGen();
    // Los pisos de mazmorra y las zonas del mundo procedural se generan bajo demanda con la semilla de esta partida.
    activateGenWorld(state.seed, state.world.gen);
    setDynamicZoneResolver((id) => dungeonZoneDef(state.seed, state.world, id) ?? genZoneDef(id));
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

  /** Valores derivados con equipo (CA, ataque, arma...). */
  get derived(): Derived {
    return derive(this.state.player);
  }

  playerAC(): number {
    return this.derived.ac;
  }

  // ==================================================================== mensajes
  private msg(text: string, kind: MsgKind = 'info'): void {
    this.events.emit('message', { text, kind });
  }

  /** Texto flotante sobre el mapa (XP, oro). */
  private floatText(x: number, y: number, text: string, color: string, size?: number, life = 0.9): void {
    this.fx.push({ kind: 'text', x, y, text, color, t: 0, life, ...(size ? { size } : {}) });
  }

  private pushFx(f: Fx): void {
    this.fx.push(f);
  }

  // ======================================================================= input
  /** Toque en una casilla: moverse, atacar, apuntar habilidad o informar. */
  tapTile(x: number, y: number): void {
    if (!this.zone.inBounds(x, y) || this.phase === 'dead') return;
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
    this.view.path = path;
    this.view.target = { x, y };
  }

  cancelPath(): void {
    this.view.path = [];
    this.view.target = null;
  }

  /** Esperar un turno sin moverse. */
  waitTurn(): void {
    if (!this.canAct) return;
    this.cancelPath();
    this.endPlayerTurn();
  }

  // ================================================================ bucle / turnos
  update(dt: number): void {
    this.state.playTimeSec += dt;
    this.updateAnimations(dt);
    // Transición de entrada en batalla: tras el «!» de quien te ha visto.
    if (this.pendingBattle) {
      this.pendingBattle.timer -= dt;
      if (this.pendingBattle.timer <= 0) this.beginBattle(this.pendingBattle.enemies);
      return;
    }
    if (this.battle || this.phase !== 'player') return;
    const v = this.view;
    if (v.stepT >= 0) {
      v.stepT += dt / this.stepDuration;
      if (v.stepT >= 1) this.finishStep();
      else {
        v.rx = v.from.x + (v.to.x - v.from.x) * v.stepT;
        v.ry = v.from.y + (v.to.y - v.from.y) * v.stepT;
      }
    }
    if (v.stepT < 0 && this.phase === 'player' && !this.pendingBattle) this.tryStartStep();
  }

  private updateAnimations(dt: number): void {
    for (const g of this.ground) if (g.age !== undefined) g.age += dt;
    const v = this.view;
    const bumpRate = 5;
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
        // Empujar el joystick contra un enemigo = lanzarse al combate.
        this.heldDir = null;
        this.cancelPath();
        this.startEncounter(enemy);
        return;
      }
      next = this.resolveHeldStep(pos, this.heldDir);
      if (!next) return;
      v.path = [next];
    }
    if (!next) return;
    if (!this.playerCanWalk(next.x, next.y)) {
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
    if (!this.zone.def.dungeon && !this.zone.def.fog) return true;
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
      this.useExit(exit);
      return;
    }
    this.endPlayerTurn();
  }

  /** Fin del turno del jugador en el mapa: los enemigos deambulan o te detectan. */
  endPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.state.turn++;
    this.events.emit('turn', { turn: this.state.turn });
    if (this.immunity > 0) this.immunity--;
    this.petRegen();
    this.allyRecover();
    if (this.ally) this.follow(this.ally);
    if (this.pet) this.follow(this.pet);
    for (const e of [...this.enemies]) {
      if (this.battle || this.pendingBattle) break;
      this.enemyMapTurn(e);
    }
    this.startPlayerTurn();
  }

  /** Turno de un enemigo en el mapa: si te ve, se lanza la batalla; si no, deambula. */
  private enemyMapTurn(e: Enemy): void {
    if (e.hp <= 0) return;
    const p = this.playerPos;
    const d = dist(e.x, e.y, p.x, p.y);
    if (this.immunity <= 0 && !this.isDead && d <= e.def.sight && this.los(e, p)) {
      this.startEncounter(e);
      return;
    }
    if (this.rng.chance(0.3)) this.stepEnemy(e, { x: e.x + this.rng.int(-1, 1), y: e.y + this.rng.int(-1, 1) });
  }

  /** El compañero caído se recupera solo fuera de batalla. */
  private allyRecover(): void {
    const party = this.state.party;
    if (this.ally && party.down) {
      party.down = false;
      party.hp = Math.max(1, Math.round(this.allyStats().maxHp * 0.3));
      this.msg(`${this.companionDef?.name ?? 'Tu compañero'} se levanta tambaleándose.`, 'info');
    }
  }

  /** Compañero y mascota te siguen por el mapa. */
  private follow(u: Ally | PetUnit): void {
    const p = this.playerPos;
    const dp = dist(u.x, u.y, p.x, p.y);
    if (dp <= 2) return;
    for (let i = 0; i < (dp > 5 ? 2 : 1); i++) {
      const path = findPath(
        this.zone.width, this.zone.height, u, p,
        (x, y) => this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !(x === p.x && y === p.y) && !this.zone.exitAt(x, y) && !(this.ally !== u && this.allyAt(x, y)) && !(this.pet !== u && this.petAt(x, y)),
        { allowGoalBlocked: true, maxNodes: 800 },
      );
      const next = path?.[0];
      if (!next || (next.x === p.x && next.y === p.y)) return;
      if (next.x !== u.x) u.facing = next.x > u.x ? 'right' : 'left';
      u.x = next.x;
      u.y = next.y;
      pushStep(u, next);
    }
  }

  /** Paso aleatorio de un enemigo (si la casilla está libre). */
  private stepEnemy(e: Enemy, to: Point): boolean {
    if (to.x === e.x && to.y === e.y) return false;
    if (!this.freeForEnemy(to.x, to.y) || this.zone.exitAt(to.x, to.y)) return false;
    if (to.x !== e.x) e.facing = to.x > e.x ? 'right' : 'left';
    e.x = to.x;
    e.y = to.y;
    pushStep(e, to);
    return true;
  }

  /** Comienzo del turno del jugador en el mapa: regeneración y encuentros. */
  private startPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.phase = 'player';
    const p = this.state.player;
    if (this.state.turn % 5 === 0 && p.hp < p.maxHp) p.hp++;
    if (this.state.turn % 3 === 0 && p.mp < p.maxMp) p.mp++;
    this.maybeSpawnEncounter();
    this.scanTraps();
  }

  // ============================================================ batalla (entrada y salida)
  /** Un enemigo te ha visto (o lo has embestido): se prepara la batalla con su grupo. */
  startEncounter(first: Enemy): void {
    if (this.battle || this.pendingBattle || this.isDead) return;
    const group = this.enemies
      .filter((e) => e === first || (e.hp > 0 && dist(e.x, e.y, first.x, first.y) <= 3))
      .sort((a, b) => dist(a.x, a.y, first.x, first.y) - dist(b.x, b.y, first.x, first.y))
      .slice(0, 4);
    for (const e of group) e.alerted = true;
    this.cancelPath();
    this.heldDir = null;
    this.floatText(first.x, first.y - 0.5, '!', '#ff5040');
    this.msg(`¡${first.def.name} te ha visto!`, 'warn');
    this.pendingBattle = { enemies: group, timer: 0.55 };
    this.events.emit('battleSoon', {});
  }

  /** Crea la batalla (la escena de la interfaz la reproduce). */
  beginBattle(enemies: Enemy[]): Battle {
    this.pendingBattle = null;
    const party = this.state.party;
    if (this.ally && party.down) this.msg(`${this.companionDef?.name ?? 'Tu compañero'} está caído y no lucha.`, 'warn');
    const b = new Battle({ state: this.state, rng: this.rng, enemies, ...(this.zone.def.dungeon ? { dungeonId: this.zone.def.dungeon.id } : {}), ...(this.zone.def.generated?.biome ? { biome: this.zone.def.generated.biome } : {}) });
    b.petOrder = this.petOrder;
    this.petOrder = null;
    this.battle = b;
    this.cancelPath();
    this.heldDir = null;
    this.events.emit('battleStart', { battle: b });
    return b;
  }

  /** XP que recibirá el jugador por una batalla (el compañero y la mascota se llevan parte del mérito). */
  battleXp(res: BattleResult): number {
    const petOn = !!this.state.pets?.active && !this.state.pets.active.down;
    const share = (this.state.party?.active ? 0.85 : 1) * (petOn ? 0.9 : 1);
    const bonus = encounterXpBonus(res.kills.length, res.kills.some((k) => k.def.boss));
    return res.xp > 0 ? Math.max(1, Math.round(res.xp * share * bonus)) : 0;
  }

  /** Habilidad de clase fuera de batalla: sólo las curativas tienen sentido en el mapa. */
  useMapSkill(skillId: string): string | null {
    if (!this.canAct) return 'Ahora no.';
    const sk = this.cls.skills.find((x) => x.id === skillId);
    if (!sk) return 'No conoces esa habilidad.';
    const p = this.state.player;
    if (sk.unlockLevel > p.level) return `Se desbloquea a nivel ${sk.unlockLevel}.`;
    const heal = sk.effects.find((e) => e.type === 'heal');
    if (!heal || heal.type !== 'heal') return `${sk.name}: sólo se usa en batalla.`;
    if (p.hp >= p.maxHp) return 'Ya tienes la vida completa.';
    if (p.mp < sk.cost) return `No tienes suficiente ${this.cls.resource.name.toLowerCase()}.`;
    p.mp -= sk.cost;
    const amount = Math.max(1, roll(this.rng, heal.dice).total + (heal.stat ? abilityModifier(this.derived.stats[heal.stat]) : 0) + (heal.perLevel ?? 0) * p.level);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    this.floatText(this.playerPos.x, this.playerPos.y, `+${p.hp - before}`, '#60e070');
    this.msg(`${sk.name}: recuperas ${p.hp - before} PV.`, 'good');
    this.endPlayerTurn();
    return null;
  }

  /** Aplica el resultado de la batalla a la partida (XP, mascota, mapa, muerte). */
  finishBattle(): BattleResult | null {
    const b = this.battle;
    if (!b || !b.ended) return null;
    const res = b.result;
    this.battle = null;
    this.state.turn++;
    const party = this.state.party;
    // Los enemigos vencidos o vinculados desaparecen del mapa.
    this.enemies = this.enemies.filter((e) => !res.removed.includes(e));
    for (const e of this.enemies) e.alerted = false;
    // El compañero caído se levanta al acabar.
    if (party.active && party.down && res.outcome !== 'defeat') {
      party.down = false;
      party.hp = Math.max(1, Math.round(this.allyStats().maxHp * 0.3));
    }
    if (res.boundActivePet) this.spawnPet();
    if (res.outcome === 'fled') {
      this.fled = true;
      this.immunity = FLEE_IMMUNITY;
      this.msg('¡Logras escapar! Tus enemigos te pierden el rastro.', 'good');
    } else if (res.outcome === 'defeat') {
      this.phase = 'dead';
      this.msg('Has caído...', 'warn');
      this.sfx('muerte');
      this.events.emit('playerDied', { cause: b.foes()[0]?.name ?? 'el combate' });
    } else {
      this.fled = false;
      const petOn = !!this.state.pets?.active && !this.state.pets.active.down;
      if (petOn && res.petXp > 0) this.givePetXp(res.petXp);
      const dz = this.zone.def.dungeon;
      if (this.zone.def.generated && res.kills.some((k) => k.def.boss)) {
        this.state.flags[`gz_clear_${this.zone.id}`] = true;
        this.msg('El jefe ha caído. Esta guarida queda en calma.', 'info');
      }
      if (dz && res.kills.some((k) => k.def.boss)) {
        progressOf(this.state.world, dz.id).cleared = true;
        this.msg('El pasadizo a la superficie se abre. Si vuelves a entrar desde fuera, la mazmorra será distinta.', 'info');
      }
      this.events.emit('questsChanged', {});
      const xp = this.battleXp(res);
      if (xp > 0) this.gainXp(xp, 'combate');
      if (res.kills.length) this.companionSay('mata', 0.4);
      if (res.kills.some((k) => k.def.boss)) this.companionSay('victoria');
      this.sfx('victoria');
    }
    this.events.emit('battleEnd', { result: res });
    return res;
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
    const def = ensureZone(exit.to, this.state.player.level) ?? getZoneDef(exit.to);
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
    this.phase = 'player';
    this.pendingBattle = null;
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
    if (firstVisit && this.zone.def.generated) {
      const fresh = assignQuests(this.zone.id, this.state.player.level);
      if (fresh.length) this.msg(`${fresh.length === 1 ? 'Hay una misión' : `Hay ${fresh.length} misiones`} disponible${fresh.length === 1 ? '' : 's'} aquí.`, 'info');
    }
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
    if (boss && !(dz && progressOf(this.state.world, dz.id).cleared) && !this.state.flags[`gz_clear_${this.zone.id}`]) {
      this.spawnEnemy(boss.enemy, boss.x, boss.y, boss.level);
      for (const g of boss.guards ?? []) this.spawnEnemy(g.enemy, g.x, g.y);
    }
    const enc = this.zone.def.encounters;
    if (!enc) return;
    for (let i = 0; i < enc.initial; i++) this.spawnGroup();
    // Siempre hay al menos una criatura salvaje si la zona es su hábitat.
    const wild = this.wildHere(this.zone.def.dungeon?.id ?? this.zone.id);
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
    const wild = this.wildHere(habitat);
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
      // Zonas generadas: nivel fijado al descubrirlas; el resto, nivel del jugador ±1.
      const gz = this.zone.def.generated;
      const lvl = gz ? Math.min(25, Math.max(1, this.zone.def.level)) : Math.min(20, Math.max(1, this.state.player.level + this.rng.int(-1, 1)));
      const sc = scaleEnemyDef(def, lvl);
      const e = createEnemy(sc.def, pos.x, pos.y, this.rng, sc.hpMul);
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  /** Crea un enemigo concreto (jefes, invocaciones, tests). */
  spawnEnemy(id: string, x: number, y: number, level?: number): Enemy | null {
    const def = getEnemy(id);
    if (!def || !this.freeForEnemy(x, y)) return null;
    const sc = level ? scaleEnemyDef(def, level, true) : { def, hpMul: 1 };
    const e = createEnemy(sc.def, x, y, this.rng, sc.hpMul);
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

  /** Deja botín en una casilla (se junta con lo que ya hubiera). */
  dropLoot(x: number, y: number, items: ItemInstance[], gold: number): void {
    let g = this.ground.find((l) => l.x === x && l.y === y);
    if (!g) this.ground.push((g = { x, y, items: [], gold: 0, age: 0 }));
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
        this.msg(`Recoges: ${displayName(it)}${qty - rest > 1 ? ` ×${qty - rest}` : ''}${r.id !== 'comun' ? ` (${r.name})` : ''}.`, r.id === 'comun' ? 'info' : 'good');
        if (def.unique || ['raro', 'epico', 'legendario'].includes(r.id)) {
          this.floatText(p.x, p.y - 0.6, `✦ ${r.name}`, r.color, 5, 1.4);
          this.pushFx({ kind: 'burst', x: p.x, y: p.y, radius: 1, color: r.color, t: 0, life: 0.6 });
        }
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
    if (use.bind) return 'La Runa de vínculo se usa en batalla, sobre una criatura salvaje.';
    if (use.damage) return 'Las bombas se lanzan en batalla.';
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
    if (use.cleanse) this.msg('Te sientes limpio de males.', 'good');
    if (use.buff) this.msg(`${def.name}: sólo sirve en batalla.`, 'warn');
    this.pushFx({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.8, color: '#60e070', t: 0, life: 0.4 });
    removeQty(p, uid, 1);
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

  /** Daño al jugador fuera de batalla (trampas). */
  damagePlayer(amount: number, cause: string, _crit = false, _type: DamageType | null = null): void {
    const p = this.state.player;
    p.hp = Math.max(0, p.hp - amount);
    this.view.flashT = 1;
    this.floatText(this.playerPos.x, this.playerPos.y, `-${amount}`, '#ff8080');
    this.events.emit('playerHurt', { amount });
    this.sfx('herido');
    if (p.hp <= 0) {
      this.phase = 'dead';
      this.cancelPath();
      this.heldDir = null;
      this.msg('Has caído...', 'warn');
      (this.state.record ??= emptyRecord()).deaths++;
      this.sfx('muerte');
      this.events.emit('playerDied', { cause });
    }
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
  }

  /** Usar un cofre, una veta o una trampa conocida (estando al lado). Gasta el turno. */
  interact(f: ZoneFeature): void {
    if (!this.canAct) return;
    const p = this.playerPos;
    if (f.x !== p.x) this.view.facing = f.x > p.x ? 'right' : 'left';
    if (f.kind === 'cofre') this.openChest(f);
    else if (f.kind === 'mineral') {
      if (!this.mine(f)) return;
    } else this.disarmTrap(f);
    if (!this.isDead) this.endPlayerTurn();
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
    const loot = rollLoot(this.rng, f.loot ?? 'cofre', level, { playerLevel: this.state.player.level, classId: this.state.player.classId, luck: f.locked ? 2 : 0 });
    const best = loot.items.reduce((m, it) => Math.max(m, ['comun', 'poco_comun', 'raro', 'epico', 'legendario'].indexOf(it.rarity)), 0);
    this.pushFx({ kind: 'burst', x: f.x, y: f.y, radius: 0.8 + best * 0.25, color: best >= 2 ? rarityColor(best) : '#f2d888', t: 0, life: 0.5 + best * 0.1 });
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
    this.events.emit('sfx', { id, ...(rate ? { rate } : {}) });
  }

  /** Stock actual de una tienda (se renueva si ha pasado el tiempo). */
  shopStock(shopId: string): Shop.ShopState {
    return Shop.ensureStock(this.state, shopId);
  }

  buyFromShop(shopId: string, uid: string, qty = 1): string | null {
    const before = this.state.player.gold;
    const err = Shop.buy(this.state, shopId, this.state.player, this.derived.stats.CAR, uid, qty, this.shopDiscount(shopId));
    if (!err) {
      recalcPlayer(this.state.player);
      const k = `rep:${shopId}`;
      this.state.flags[k] = Number(this.state.flags[k] ?? 0) + Math.max(0, before - this.state.player.gold);
    }
    return err;
  }

  /** Reputación en una tienda: el oro gastado da hasta un 10 % de descuento. */
  shopRep(shopId: string): { spent: number; discount: number; next: number | null } {
    const spent = Number(this.state.flags[`rep:${shopId}`] ?? 0);
    const step = 150 + 30 * Shop.getShop(shopId).level;
    const discount = Math.min(10, Math.floor(spent / step));
    return { spent, discount, next: discount >= 10 ? null : (discount + 1) * step - spent };
  }

  buyBackFromShop(shopId: string, uid: string, qty = 1): string | null {
    const err = Shop.buyBack(this.state, shopId, this.state.player, uid, qty);
    if (!err) recalcPlayer(this.state.player);
    return err;
  }

  /** Vende toda la basura (equipo común y materiales que ninguna misión pide). */
  sellJunkToShop(shopId: string): { gold: number; count: number } {
    const needed = new Set<string>();
    for (const q of Quests.activeQuests(this.state)) for (const o of q.objectives) if (o.type === 'collect') needed.add(o.item);
    return Shop.sellJunk(this.state, shopId, this.state.player, this.derived.stats.CAR, needed);
  }

  /** Mejora un objeto de la mochila o del equipo (herrero). */
  upgradeAtShop(shopId: string, uid: string): string | null {
    const p = this.state.player;
    const it = p.inventory.find((x) => x.uid === uid) ?? Object.values(p.equipment).find((x) => x?.uid === uid);
    if (!it) return 'No tienes ese objeto.';
    const err = Shop.upgradeItem(shopId, p, it);
    if (!err) recalcPlayer(p);
    return err;
  }

  /** Bolsa misteriosa del mercado negro. */
  gambleAtShop(shopId: string): ItemInstance | string {
    return Shop.gamble(shopId, this.state.player, this.rng, this.state.player.classId);
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
    const hurt = p.hp < p.maxHp;
    p.respawnZone = this.zone.id;
    if (!hurt) {
      this.msg('No necesitas sanación. Si caes, despertarás en este templo.', 'info');
      return null;
    }
    if (p.gold < price) return `El donativo es de ${price} de oro y no te llega.`;
    p.gold -= price;
    p.hp = p.maxHp;
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
    return allyStatsFor(this.companionDef, this.state.player.level);
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

  // ================================================================ mascotas
  /** Mascota activa (datos guardados) o null. */
  get petInstance(): Pets.PetInstance | null {
    return this.state.pets?.active ?? null;
  }

  petAt(x: number, y: number): PetUnit | null {
    return this.pet && this.pet.x === x && this.pet.y === y ? this.pet : null;
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

  /** Especies salvajes de la zona actual (id, bioma y lugar procedurales, nivel de la zona). */
  private wildHere(habitat: string): string[] {
    const gen = this.zone.def.generated;
    return wildSpeciesIn(habitat, gen?.biome, gen?.place, this.zone.def.level);
  }

  /** Acaricia a la mascota activa (+3 de vínculo cada 30 min). */
  caressPet(): string {
    const pi = this.petInstance;
    if (!pi) return 'No llevas mascota.';
    if (!Pets.caress(pi, Date.now())) return `${Pets.petName(pi)} ya ha recibido cariño hace poco.`;
    return `${Pets.petName(pi)} se acurruca contigo. Vínculo ${Math.round(pi.bond)}.`;
  }

  /** Evoluciona con un objeto (piedra): comprueba condiciones y lo consume. */
  evolvePetWithItem(to: string): string | null {
    const pi = this.petInstance;
    if (!pi) return 'No llevas mascota.';
    const pl = this.state.player;
    const opt = Pets.evolutionOptions(pi, (id) => countItem(pl, id) > 0).find((e) => e.species === to && e.item);
    if (!opt) return 'Aún no cumple las condiciones.';
    const stack = pl.inventory.find((x) => x.id === opt.item);
    if (!stack || !removeQty(pl, stack.uid, 1)) return 'Te falta el objeto.';
    this.evolvePet(to);
    return null;
  }

  /** Compra una piedra de evolución en el establo. */
  buyStone(id: string): string | null {
    const def = getItem(id);
    const pl = this.state.player;
    if (!def) return 'Objeto desconocido.';
    if (pl.gold < def.value) return 'No tienes oro suficiente.';
    const left = addItem(pl, createItem(id, 'comun', this.rng, { qty: 1 }));
    if (left > 0) return 'Mochila llena.';
    pl.gold -= def.value;
    return null;
  }

  evolvePet(to?: string): Pets.PetInstance | null {
    const pi = this.petInstance;
    if (!pi) return null;
    const before = Pets.getSpecies(pi.species).name;
    const sp = Pets.evolve(pi, to);
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
    const rep = SHOPS.has(shopId) ? this.shopRep(shopId).discount : 0;
    return Math.max(0, Math.min(50, Number(this.state.flags[`descuento:${shopId}`] ?? 0) + rep));
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
