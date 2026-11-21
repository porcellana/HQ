/**
 * NÚCLEO DE LA PARTIDA (sin DOM)
 * ------------------------------
 * Mantiene el estado, la zona actual, los enemigos y el sistema de TURNOS:
 *   turno del jugador (moverse, atacar, habilidad, esperar, huir)
 *     → turno de cada enemigo (con una breve pausa visual si está en combate)
 *     → inicio del turno del jugador (estados, regeneración, encuentros)
 * El combate ocurre en el mismo mapa, sin cambiar de pantalla.
 */
import { ORES, TRAPS, getClass, getEnemy, getZoneDef, npcsInZone, setDynamicZoneResolver } from '@/data/registry';
import type { DamageType, EnemySpell, NpcDef, SkillDef, SkillEffect, StatusApply, ZoneFeature } from '@/data/schema';
import { Emitter } from '@/engine/events';
import { findPath, type Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';
import { createEnemy, enemySave, type Enemy } from './combat/entities';
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
import { abilityModifier, roll, rollD20 } from './rules/dice';
import { levelForXp } from './rules/progression';
import { recalcPlayer, type GameState } from './state';
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
}

export interface LevelUpEvent {
  level: number;
  hpGain: number;
  mpGain: number;
  points: number;
  skills: SkillDef[];
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
}

/** Efectos visuales efímeros (el renderizador los dibuja). */
export type Fx =
  | { kind: 'text'; x: number; y: number; text: string; color: string; t: number; life: number }
  | { kind: 'bolt'; fx: number; fy: number; tx: number; ty: number; color: string; t: number; life: number }
  | { kind: 'burst'; x: number; y: number; radius: number; color: string; t: number; life: number };

/** Botín tirado en el suelo (no se guarda: desaparece al cambiar de zona). */
export interface GroundLoot {
  x: number;
  y: number;
  items: ItemInstance[];
  gold: number;
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
  fx: Fx[] = [];
  /** Habilidad elegida esperando objetivo. */
  targeting: SkillDef | null = null;
  heldDir: { dx: number; dy: number } | null = null;
  stepDuration = 0.14;
  phase: 'player' | 'enemies' | 'dead' = 'player';
  rng: Rng;
  private enemyQueue: Enemy[] = [];
  private enemyTimer = 0;
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
    this.populateZone();
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
    return this.derived.ac + this.buffTotal('ca') - (hasStatus(this.combat.statuses, 'ralentizado') ? 2 : 0);
  }

  playerToHit(): number {
    return this.derived.toHit + this.buffTotal('ataque');
  }

  /** CD de los hechizos del jugador con una característica. */
  spellDC(stat: keyof GameState['player']['stats']): number {
    return 8 + proficiencyBonus(this.state.player.level) + abilityModifier(this.derived.stats[stat]);
  }

  // ==================================================================== mensajes
  private msg(text: string, kind: MsgKind = 'info'): void {
    this.events.emit('message', { text, kind });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    this.fx.push({ kind: 'text', x, y, text, color, t: 0, life: 0.9 });
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
        this.cancelPath();
        this.playerAttack(enemy, {});
        this.endPlayerTurn();
        return;
      }
      this.describeEnemy(enemy);
    }
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
    if (p.mp < skill.cost) return `No tienes suficiente ${this.cls.resource.name.toLowerCase()}.`;
    return null;
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
      this.enemyTimer -= dt;
      while (this.phase === 'enemies' && this.enemyTimer <= 0) this.processNextEnemy();
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

  private updateAnimations(dt: number): void {
    const v = this.view;
    v.bumpT = Math.max(0, v.bumpT - dt * 5);
    v.flashT = Math.max(0, v.flashT - dt * 4);
    for (const e of this.enemies) {
      const k = Math.min(1, dt * 14);
      e.rx += (e.x - e.rx) * k;
      e.ry += (e.y - e.ry) * k;
      e.bumpT = Math.max(0, e.bumpT - dt * 5);
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
        // Empujar el joystick contra un enemigo = atacarlo.
        this.playerAttack(enemy, {});
        this.endPlayerTurn();
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

  private finishStep(): void {
    const v = this.view;
    const prevExit = this.zone.exitAt(v.from.x, v.from.y);
    this.state.player.pos.x = v.to.x;
    this.state.player.pos.y = v.to.y;
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

  /** Fin del turno del jugador: cuentas atrás y turno de los enemigos. */
  endPlayerTurn(): void {
    if (this.phase === 'dead') return;
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
    this.enemyTimer = 0;
    this.phase = 'enemies';
    // Sin enemigos cerca, todo ocurre en el acto para que caminar sea fluido.
    if (!this.inCombat) while (this.phase === 'enemies') this.processNextEnemy();
  }

  private processNextEnemy(): void {
    const e = this.enemyQueue.shift();
    if (!e) {
      this.startPlayerTurn();
      return;
    }
    if (e.hp <= 0 || !this.enemies.includes(e)) return;
    const visible = this.enemyTurn(e);
    if (visible && this.inCombat) this.enemyTimer = ENEMY_DELAY;
  }

  /** Comienzo del turno del jugador: estados, regeneración y encuentros. */
  private startPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.phase = 'player';
    const p = this.state.player;
    const c = this.combat;
    if (this.interrupt) this.cancelPath();

    // Daño por estados
    const tick = tickStatuses(this.rng, c.statuses);
    for (const part of tick.parts) {
      this.damagePlayer(part.amount, STATUS_INFO[part.id].name.toLowerCase());
      if (this.isDead) return;
    }
    // Regeneración fuera de combate
    if (!this.inCombat) {
      if (this.state.turn % 5 === 0 && p.hp < p.maxHp) p.hp++;
      if (this.state.turn % 3 === 0 && p.mp < p.maxMp) p.mp++;
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
    if (hasStatus(c.statuses, 'ralentizado')) {
      c.skipNext = !c.skipNext;
      if (c.skipNext) {
        this.msg('Ralentizado: te cuesta moverte...', 'warn');
        this.endPlayerTurn();
        return;
      }
    }
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
    const dz = this.zone.def.dungeon;
    if (dz) {
      const prog = progressOf(this.state.world, dz.id);
      const depth = dz.floor === 'jefe' ? 99 : dz.floor;
      prog.deepest = Math.max(prog.deepest, depth);
      if (dz.floor === 'jefe' && !prog.cleared) this.msg('Sientes una presencia poderosa. Prepárate.', 'warn');
    }
    const firstVisit = !this.state.visitedZones.includes(this.zone.id);
    if (firstVisit) this.state.visitedZones.push(this.zone.id);
    this.events.emit('zoneChanged', { zone: this.zone, firstVisit });
    for (const m of Quests.onVisit(this.state, this.zone.id)) this.msg(m, 'good');
    this.events.emit('questsChanged', {});
    if (firstVisit && (this.zone.def.kind === 'wild' || this.zone.def.kind === 'dungeon')) {
      this.gainXp(this.zone.def.discoverXp ?? 20 * this.zone.def.level, `descubres ${this.zone.def.name}`);
    }
  }

  // =============================================================== encuentros
  /** Coloca los grupos iniciales de la zona (los enemigos no se guardan). */
  private populateZone(): void {
    this.npcs = npcsInZone(this.zone.id);
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
    if (boss && !(dz && progressOf(this.state.world, dz.id).cleared)) {
      this.spawnEnemy(boss.enemy, boss.x, boss.y);
      for (const g of boss.guards ?? []) this.spawnEnemy(g.enemy, g.x, g.y);
    }
    const enc = this.zone.def.encounters;
    if (!enc) return;
    for (let i = 0; i < enc.initial; i++) this.spawnGroup();
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
      const e = createEnemy(def, pos.x, pos.y, this.rng);
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
    return this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !this.npcAt(x, y) && !(p.x === x && p.y === y);
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
  playerAttack(enemy: Enemy, opt: { extraDice?: string; toHitBonus?: number; critRange?: number; applyStatus?: StatusApply }): void {
    const d = this.derived;
    const weapon = d.weapon;
    const pos = this.playerPos;
    this.faceTowards(enemy);
    this.view.bumpT = 1;
    this.view.bumpDx = Math.sign(enemy.x - pos.x);
    this.view.bumpDy = Math.sign(enemy.y - pos.y);

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
    this.events.emit('dice', {
      label: weapon.name, natural: r.natural, bonus: toHit, total: r.total, target: enemy.def.ac, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss',
    });
    enemy.alerted = true;
    if (!r.hit) {
      this.floatText(enemy.x, enemy.y, r.fumble ? '¡Pifia!' : 'Fallo', '#a49c8a');
      this.msg(r.fumble ? `¡Pifia! Tu ${weapon.name.toLowerCase()} golpea el aire.` : `Fallas contra ${enemy.def.name} (${r.total} vs CA ${enemy.def.ac}).`, 'combat');
      return;
    }
    let dmg = damageRoll(this.rng, weapon.dice, d.damageMod + this.buffTotal('daño'), r.crit).total;
    if (opt.extraDice) dmg += damageRoll(this.rng, opt.extraDice, 0, r.crit).total;
    this.damageEnemy(enemy, dmg, weapon.damageType, r.crit);
    if (enemy.hp > 0 && opt.applyStatus) this.applyStatusToEnemy(enemy, opt.applyStatus);
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
    enemy.hp -= d.amount;
    enemy.flashT = 1;
    enemy.alerted = true;
    const color = crit ? '#f2d888' : d.note === 'vulnerable' ? '#ff8040' : d.note === 'resiste' ? '#a0a0b0' : '#ffffff';
    this.floatText(enemy.x, enemy.y, `${crit ? '¡' : ''}${d.amount}${crit ? '!' : ''}`, color);
    const note = d.note === 'vulnerable' ? ' (¡vulnerable!)' : d.note === 'resiste' ? ' (resiste)' : '';
    this.msg(`${crit ? '¡CRÍTICO! ' : ''}${enemy.def.name} recibe ${d.amount} de daño ${type}${note}.`, 'combat');
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      return;
    }
    this.checkBossPhase(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    enemy.hp = 0;
    this.enemies = this.enemies.filter((e) => e !== enemy);
    this.fx.push({ kind: 'burst', x: enemy.x, y: enemy.y, radius: 0.8, color: '#e05050', t: 0, life: 0.4 });
    const xp = xpForKill(enemy.def.xp, enemy.def.level, this.state.player.level);
    this.msg(`${enemy.def.name} cae derrotado.`, 'good');
    if (enemy.def.boss) {
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
    for (const m of qm) this.msg(m, 'good');
    if (qm.length) this.events.emit('questsChanged', {});
    const loot = rollLoot(this.rng, enemy.def.lootTable, enemy.def.level);
    if (loot.items.length || loot.gold) this.dropLoot(enemy.x, enemy.y, loot.items, loot.gold);
  }

  /** Deja botín en una casilla (se junta con lo que ya hubiera). */
  dropLoot(x: number, y: number, items: ItemInstance[], gold: number): void {
    let g = this.ground.find((l) => l.x === x && l.y === y);
    if (!g) this.ground.push((g = { x, y, items: [], gold: 0 }));
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
      this.floatText(p.x, p.y - 0.3, `+${g.gold} oro`, '#f2d888');
      this.msg(`Recoges ${g.gold} de oro.`, 'good');
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
      if (rest < qty) for (const m of Quests.collectNotes(this.state, it.id)) this.msg(m, 'good');
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
    const combat = this.inCombat;
    if (use.outOfCombatOnly && combat) return 'No puedes comer en pleno combate.';
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
    this.fx.push({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.8, color: '#60e070', t: 0, life: 0.4 });
    removeQty(p, uid, 1);
    if (combat) this.endPlayerTurn();
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
        this.fx.push({ kind: 'burst', x: m.x, y: m.y, radius: 0.7, color: '#a040ff', t: 0, life: 0.5 });
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
    p.mp -= skill.cost;
    if (skill.cooldown > 0) this.combat.cooldowns[skill.id] = skill.cooldown + 1;
    this.msg(`${skill.icon} ${skill.name}`, 'combat');
    for (const eff of skill.effects) this.applySkillEffect(skill, eff, center);
    this.endPlayerTurn();
  }

  private applySkillEffect(skill: SkillDef, eff: SkillEffect, center: Point): void {
    const p = this.state.player;
    const pos = this.playerPos;
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
            });
          }
        }
        break;
      }
      case 'spell': {
        const color = SPELL_COLORS[eff.damageType] ?? '#ffffff';
        const radius = eff.radius ?? 0;
        const targets = radius > 0
          ? this.enemies.filter((e) => dist(e.x, e.y, center.x, center.y) <= radius && this.los(center, e))
          : [this.enemyAt(center.x, center.y)].filter((e): e is Enemy => !!e);
        if (skill.target !== 'self') this.fx.push({ kind: 'bolt', fx: pos.x, fy: pos.y, tx: center.x, ty: center.y, color, t: 0, life: 0.3 });
        if (radius > 0) this.fx.push({ kind: 'burst', x: center.x, y: center.y, radius: radius + 0.5, color, t: 0, life: 0.5 });
        const mod = abilityModifier(this.derived.stats[eff.stat]);
        const dc = this.spellDC(eff.stat);
        for (const t of targets) {
          for (let i = 0; i < (eff.hits ?? 1) && t.hp > 0; i++) {
            let dmg = roll(this.rng, eff.dice).total + (eff.hits && eff.hits > 1 ? 0 : Math.max(0, mod));
            let saved = false;
            if (eff.save) {
              const bonus = enemySave(t, eff.save);
              const s = savingThrow(this.rng, bonus, dc);
              saved = s.success;
              if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
              this.msg(`${t.def.name} tira salvación de ${eff.save}: ${s.total} vs CD ${dc} — ${saved ? 'la supera (mitad)' : 'falla'}.`, 'combat');
            }
            this.damageEnemy(t, dmg, eff.damageType);
            if (t.hp > 0 && eff.applyStatus && !saved) this.applyStatusToEnemy(t, eff.applyStatus);
          }
        }
        if (targets.length === 0) this.msg('El hechizo no alcanza a nadie.', 'warn');
        break;
      }
      case 'heal': {
        const amount = Math.max(1, roll(this.rng, eff.dice).total + (eff.stat ? abilityModifier(this.derived.stats[eff.stat]) : 0) + (eff.perLevel ?? 0) * p.level);
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        this.floatText(pos.x, pos.y, `+${p.hp - before}`, '#60e070');
        this.fx.push({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.9, color: '#60e070', t: 0, life: 0.5 });
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
      this.msg('¡Logras escapar! Tus enemigos te pierden el rastro.', 'good');
      this.state.turn++;
      return;
    }
    this.msg('No consigues escapar...', 'warn');
    this.endPlayerTurn();
  }

  // ================================================================ enemigos
  /** Turno de un enemigo. Devuelve true si hizo algo visible. */
  private enemyTurn(e: Enemy): boolean {
    const p = this.playerPos;
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
    if (e.def.slow || hasStatus(e.statuses, 'ralentizado')) {
      e.skipNext = !e.skipNext;
      if (e.skipNext) return false;
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
    const inAtkRange = d <= atk.range && (atk.range === 1 || this.los(e, p));
    const ai = e.def.ai;

    // Hechizos (casters y jefes)
    if (ai === 'caster' || ai === 'boss') {
      for (const sp of e.def.spells ?? []) {
        if ((e.cooldowns[sp.id] ?? 0) > 0) continue;
        if (this.tryEnemySpell(e, sp, d)) {
          e.cooldowns[sp.id] = sp.cooldown + 1;
          return true;
        }
      }
    }
    // Arqueros: si estás pegado, intentan alejarse
    if (ai === 'ranged' && d === 1 && this.rng.chance(0.3) && this.stepAway(e)) return true;
    if (inAtkRange) {
      this.enemyAttack(e);
      return true;
    }
    // Casters: mantienen la distancia si el hechizo se recarga
    if (ai === 'caster' && d <= 4 && d > 1) return false;
    // Acercarse (skirmisher: 2 pasos)
    const steps = Math.max(1, e.def.speed);
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const pp = this.playerPos;
      if (dist(e.x, e.y, pp.x, pp.y) <= atk.range && (atk.range === 1 || this.los(e, pp))) break;
      if (!this.approach(e)) break;
      moved = true;
    }
    if (moved && ai === 'skirmisher' && dist(e.x, e.y, p.x, p.y) <= 1) {
      this.enemyAttack(e);
    }
    return moved;
  }

  private tryEnemySpell(e: Enemy, sp: EnemySpell, d: number): boolean {
    const p = this.playerPos;
    if (sp.kind === 'heal') {
      const ally = this.enemies.find((a) => a.hp < a.maxHp * 0.5 && dist(a.x, a.y, e.x, e.y) <= sp.range);
      if (!ally) return false;
      const amount = roll(this.rng, sp.dice ?? '1d8').total;
      ally.hp = Math.min(ally.maxHp, ally.hp + amount);
      this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: ally.x, ty: ally.y, color: '#60e070', t: 0, life: 0.3 });
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
    const color = SPELL_COLORS[sp.damageType ?? 'arcano'] ?? '#ffffff';
    this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color, t: 0, life: 0.3 });
    if (sp.radius) this.fx.push({ kind: 'burst', x: p.x, y: p.y, radius: sp.radius + 0.5, color, t: 0, life: 0.5 });
    let dmg = roll(this.rng, sp.dice ?? '1d6').total + e.damageBonus;
    let saved = false;
    if (sp.save && sp.dc) {
      const bonus = abilityModifier(this.derived.stats[sp.save]);
      const s = savingThrow(this.rng, bonus, sp.dc);
      saved = s.success;
      this.events.emit('dice', {
        label: `Salvación de ${sp.save}`, natural: s.natural, bonus, total: s.total, target: sp.dc, targetLabel: 'CD', outcome: saved ? 'success' : 'fail',
      });
      if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
    }
    this.msg(`${e.def.name} lanza ${sp.name}${saved ? ' (mitad de daño)' : ''}.`, 'combat');
    this.damagePlayer(dmg, sp.name);
    if (this.phase !== 'dead' && sp.applyStatus && !saved) this.applyStatusToPlayer(sp.applyStatus);
    return true;
  }

  private enemyAttack(e: Enemy): void {
    const p = this.playerPos;
    const atk = e.def.attack;
    e.facing = p.x >= e.x ? 'right' : 'left';
    if (atk.range === 1) {
      e.bumpT = 1;
      e.bumpDx = Math.sign(p.x - e.x);
      e.bumpDy = Math.sign(p.y - e.y);
    } else {
      this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color: '#d8d0bc', t: 0, life: 0.25 });
    }
    const mode: RollMode = hasStatus(e.statuses, 'veneno') ? 'desventaja' : 'normal';
    const ac = this.playerAC();
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, ac, mode);
    if (!r.hit) {
      this.floatText(p.x, p.y, r.fumble ? 'Pifia' : 'Esquivas', '#a49c8a');
      this.msg(`${e.def.name} falla su ${atk.name.toLowerCase()} (${r.total} vs tu CA ${ac}).`, 'combat');
      return;
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    this.msg(`${r.crit ? '¡Crítico! ' : ''}${e.def.name} te alcanza con ${atk.name.toLowerCase()}: ${dmg} de daño.`, 'combat');
    this.damagePlayer(dmg, e.def.name, r.crit);
    if (this.phase !== 'dead' && atk.applyStatus) this.applyStatusToPlayer(atk.applyStatus);
  }

  private applyStatusToPlayer(s: StatusApply): void {
    if (tryApplyStatus(this.rng, this.combat.statuses, s)) {
      const info = STATUS_INFO[s.id];
      this.floatText(this.playerPos.x, this.playerPos.y - 0.4, info.icon, info.color);
      this.msg(`¡${info.name}!`, 'warn');
    }
  }

  damagePlayer(amount: number, cause: string, crit = false): void {
    const p = this.state.player;
    p.hp = Math.max(0, p.hp - amount);
    this.view.flashT = 1;
    this.interrupt = true;
    this.floatText(this.playerPos.x, this.playerPos.y, `-${amount}`, crit ? '#ff4040' : '#ff8080');
    this.events.emit('playerHurt', { amount });
    if (p.hp <= 0) {
      this.phase = 'dead';
      this.enemyQueue = [];
      this.cancelPath();
      this.heldDir = null;
      this.msg('Has caído...', 'warn');
      this.events.emit('playerDied', { cause });
    }
  }

  /** Paso de un enemigo hacia el jugador con A* (los demás enemigos estorban). */
  private approach(e: Enemy): boolean {
    const p = this.playerPos;
    const path = findPath(
      this.zone.width, this.zone.height, e, p,
      (x, y) => this.zone.isWalkable(x, y) && !this.enemies.some((o) => o !== e && o.x === x && o.y === y),
      { allowGoalBlocked: true, maxNodes: 600 },
    );
    const next = path?.[0];
    if (!next || (next.x === p.x && next.y === p.y)) return false;
    return this.stepEnemy(e, next, false);
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
    this.floatText(this.playerPos.x, this.playerPos.y - 0.6, `+${amount} XP`, '#c9a227');
    this.msg(`+${amount} XP (${reason}).`, 'good');
    const target = levelForXp(p.xp);
    while (p.level < target) {
      const hpBefore = p.maxHp;
      const mpBefore = p.maxMp;
      p.level++;
      const points = attributePointsAtLevel(p.level);
      p.attributePoints += points;
      recalcPlayer(p);
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      const skills = unlockedSkills(this.cls, p.level).filter((s) => s.unlockLevel === p.level);
      this.fx.push({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 1.5, color: '#f2d888', t: 0, life: 0.8 });
      this.events.emit('levelUp', { level: p.level, hpGain: p.maxHp - hpBefore, mpGain: p.maxMp - mpBefore, points, skills });
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
    this.fx.push({ kind: 'burst', x: f.x, y: f.y, radius: 0.9, color: t.damageType === 'fuego' ? '#ff8030' : '#d0d0d0', t: 0, life: 0.5 });
    this.msg(`¡${t.name}!${s.success ? ' Reaccionas a tiempo y recibes la mitad.' : ''}`, 'warn');
    this.damagePlayer(dmg, t.name);
    if (!this.isDead && !s.success && t.applyStatus) this.applyStatusToPlayer(t.applyStatus);
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
    const loot = rollLoot(this.rng, f.loot ?? 'cofre', level);
    this.fx.push({ kind: 'burst', x: f.x, y: f.y, radius: 0.8, color: '#f2d888', t: 0, life: 0.5 });
    if (!loot.items.length && !loot.gold) {
      this.msg('El cofre está vacío. Alguien llegó antes.', 'info');
      return;
    }
    this.msg('Abres el cofre...', 'good');
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
    this.fx.push({ kind: 'burst', x: f.x, y: f.y, radius: 0.4, color: '#d0d8e8', t: 0, life: 0.25 });
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
    for (const m of qm) this.msg(m, 'good');
    if (qm.length) this.events.emit('questsChanged', {});
    this.events.emit('npcTalk', { npc });
  }

  acceptQuest(id: string): string | null {
    const err = Quests.accept(this.state, id);
    if (!err) {
      this.msg(`Nueva misión: ${Quests.getQuest(id).name}`, 'good');
      // Los objetivos de "visitar" la zona donde ya estás cuentan al momento.
      for (const m of Quests.onVisit(this.state, this.zone.id)) this.msg(m, 'good');
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
    if (q.rewards.xp) this.gainXp(q.rewards.xp, q.name);
    this.events.emit('questsChanged', {});
    return null;
  }

  /** Stock actual de una tienda (se renueva si ha pasado el tiempo). */
  shopStock(shopId: string): Shop.ShopState {
    return Shop.ensureStock(this.state, shopId);
  }

  buyFromShop(shopId: string, uid: string, qty = 1): string | null {
    const err = Shop.buy(this.state, shopId, this.state.player, this.derived.stats.CAR, uid, qty);
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
    this.fx.push({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 1.2, color: '#fff0a0', t: 0, life: 0.7 });
    this.msg(`Donas ${price} de oro. La Llama Blanca cierra tus heridas. Si caes, despertarás aquí.`, 'good');
    return null;
  }

  /** Marca de misión sobre un PNJ. */
  npcMarker(npcId: string): '!' | '?' | null {
    return Quests.npcMarker(this.state, npcId);
  }
}

const SPELL_COLORS: Partial<Record<DamageType, string>> = {
  fuego: '#ff8030', frio: '#80d0ff', rayo: '#f0f060', veneno: '#80d040', sagrado: '#fff0a0',
  necrotico: '#a040ff', arcano: '#c080ff',
};
